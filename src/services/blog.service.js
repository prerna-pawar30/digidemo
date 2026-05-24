import Blog from "../models/blog/blog.modal.js";
import slugify from "slugify";
import { v6 as uuidv6 } from "uuid";
import BlogView from "../models/blog/blogView.model.js";
import { sendNotification } from "./notification.service.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { redis as redisClient } from "../config/redis.config.js";
import {
  uploadToS3,
  deleteFromS3,
} from "./awsS3.service.js";
/* =========================================================
   CACHE CONFIG
========================================================= */
const CACHE_TTL = 60 * 60; // 1 hour

/* =========================================================
   CACHE HELPERS
========================================================= */
const getCache = async (key) => {
  try {
    const cached = await redisClient.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    console.error("REDIS GET CACHE ERROR:", err.message);
    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(key, JSON.stringify(data), { ex: CACHE_TTL });
  } catch (err) {
    console.error("REDIS SET CACHE ERROR:", err.message);
  }
};

const clearBlogCache = async () => {
  try {
    const keys = await redisClient.keys("BLOG:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("BLOG CACHE CLEARED:", keys);
    }
  } catch (err) {
    console.error("REDIS CACHE CLEAR ERROR:", err.message);
  }
};

/* =========================================================
   CREATE BLOG
========================================================= */
export const createBlogService = async ({ data,featuredImage, employee }) => {
  let featuredUpload = null;
  try{
  const exists = await Blog.findOne({
    $or: [{ title: data.title }, { slug: data.slug }],
    isDeleted: false,
  });
  if (exists) {
    const error = new Error("Blog already exists with same title or slug");
    error.statusCode = 409;
    error.errorCode = "BLOG_ALREADY_EXISTS";
    throw error;
  }
  if (!featuredImage) {
    const error = new Error(
      "Featured image is required"
    );
    error.statusCode = 400;
    error.errorCode =
      "VALIDATION_ERROR";
    throw error;
  }
    /* ---------- UPLOAD FEATURED IMAGE ---------- */
    featuredUpload =
      await uploadToS3(
        featuredImage,
        "blogs/featured"
      )
  const slug = `${slugify(data.title, {
    lower: true,
    strict: true,
    trim: true,
  })}-${uuidv6()}`;

  const blog = await Blog.create({
    ...data,
    slug,
    featuredImage:
    featuredUpload.url,
    createdBy: employee?._id || null,
  });

  /* ---------- CLEAR CACHE ---------- */
  await clearBlogCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: blog._id,
      action: `Created blog: ${blog.title}`,
      permission: "blog.create",
      actionType: "Create",
    });
  } catch (err) {
    console.error("Audit log failed on create blog:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id || null,
      permission: "cms.blog.create",
      title: "New Blog Created",
      message: `A new blog "${blog.title}" has been published`,
      type: "BLOG_CREATED",
      entityId: blog._id,
      entityModel: "Blog",
      metadata: {
        blogId: blog._id,
        title: blog.title,
        slug: blog.slug,
        category: blog.category || null,
        createdBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on create blog:", err.message);
  }
  return blog;
}catch (error) {
  /* ---------- ROLLBACK ---------- */
  if (featuredUpload?.url) {
    await deleteFromS3(
      featuredUpload.url
    );
  }
  throw error;
}
};

/* =========================================================
   GET BLOGS
========================================================= */
export const getBlogsService = async ({ page, limit, skip, status, search, category }) => {
  const query = { isDeleted: false };

  if (status && status !== "all") query.status = status;
  if (category) query.category = category;
  if (search) query.$text = { $search: search };

  /* ---------- CACHE KEY ---------- */
  // skip cache for search queries — results change too frequently
  const cacheKey = !search
    ? `BLOG:LIST:${page}:${limit}:${status || "all"}:${category || "all"}`
    : null;

  /* ---------- CACHE CHECK ---------- */
  if (cacheKey) {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("CACHE HIT:", cacheKey);
      return cached;
    }
  }

  /* ---------- FETCH ---------- */
  const [blogs, totalItems] = await Promise.all([
    Blog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const result = {
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
    blogs,
  };

  /* ---------- STORE CACHE ---------- */
  if (cacheKey) await setCache(cacheKey, result);

  return result;
};

/* =========================================================
   GET BLOG BY ID
========================================================= */
export const getBlogByIdService = async ({ blogId }) => {
  /* ---------- FETCH ---------- */
  const blog = await Blog.findOne({ blogId, isDeleted: false }).lean();
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }
  return blog;
};

/* =========================================================
   GET BLOG BY SLUG
========================================================= */
export const getBlogBySlugService = async ({ slug }) => {
  const cacheKey = `BLOG:SLUG:${slug}`;

  /* ---------- CACHE CHECK ---------- */
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("CACHE HIT:", cacheKey);
    return cached;
  }

  /* ---------- FETCH ---------- */
  const blog = await Blog.findOne({
    slug,
    isDeleted: false,
    status: "published",
  }).lean();
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  /* ---------- STORE CACHE ---------- */
  await setCache(cacheKey, blog);

  return blog;
};

/* =========================================================
   UPDATE BLOG
========================================================= */
export const updateBlogService = async ({ blogId, data,featuredImage, employee }) => {
  try{
  const blog = await Blog.findOne({ blogId, isDeleted: false });
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  if (data.slug) {
    const duplicateSlug = await Blog.findOne({
      blogId: { $ne: blogId },
      slug: data.slug,
      isDeleted: false,
    });
    if (duplicateSlug) {
      const error = new Error("Slug already exists");
      error.statusCode = 409;
      error.errorCode = "SLUG_ALREADY_EXISTS";
      throw error;
    }
  }

  /* ---------- FEATURED IMAGE ---------- */

  if (featuredImage) {
    if (blog.featuredImage) {
      await deleteFromS3(blog.featuredImage);
    }
    const uploaded = await uploadToS3(
      featuredImage,
      "blogs/featured"
    );
    blog.featuredImage = uploaded.url;
  }

  const oldData = {
    title: blog.title,
    status: blog.status,
    category: blog.category,
  };

  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) blog[key] = data[key];
  });

  blog.updatedBy = employee?._id || null;
  await blog.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearBlogCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: blog._id,
      action: `Updated blog: ${blog.title}`,
      permission: "blog.update",
      actionType: "Update",
    });
  } catch (err) {
    console.error("Audit log failed on update blog:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id || null,
      permission: "cms.blog.update",
      title: "Blog Updated",
      message: `Blog "${blog.title}" has been updated`,
      type: "BLOG_UPDATED",
      entityId: blog._id,
      entityModel: "Blog",
      metadata: {
        blogId: blog._id,
        title: blog.title,
        slug: blog.slug,
        category: blog.category || null,
        updatedBy: employee?.email || null,
        previousData: oldData,
      },
    });
  } catch (err) {
    console.error("Notification failed on update blog:", err.message);
  }

  return blog;
}catch(error){
   /* ---------- ROLLBACK ---------- */
   if (uploaded?.url) {
    await deleteFromS3(
      uploaded.url
    );
  }
  throw error;
}
}

/* =========================================================
   DELETE BLOG
========================================================= */
export const deleteBlogService = async ({ blogId, employee }) => {
  const blog = await Blog.findOne({ blogId, isDeleted: false });
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  blog.isDeleted = true;
  blog.updatedBy = employee?._id || null;
  await blog.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearBlogCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: blog._id,
      action: `Deleted blog: ${blog.title}`,
      permission: "blog.delete",
      actionType: "Delete",
    });
  } catch (err) {
    console.error("Audit log failed on delete blog:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id || null,
      permission: "cms.blog.delete",
      title: "Blog Deleted",
      message: `Blog "${blog.title}" has been deleted`,
      type: "BLOG_DELETED",
      entityId: blog._id,
      entityModel: "Blog",
      metadata: {
        blogId: blog._id,
        title: blog.title,
        slug: blog.slug,
        deletedBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on delete blog:", err.message);
  }

  return { blogId: blog.blogId, title: blog.title, deleted: true };
};

/* =========================================================
   ADD COMMENT
========================================================= */
export const addBlogCommentService = async ({ blogId, data }) => {
  const blog = await Blog.findOne({ blogId, isDeleted: false });
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  const comment = {
    commentId: uuidv6(),
    name: data.name,
    company: data.company,
    city: data.city,
    review: data.review,
  };

  blog.comments.push(comment);
  await blog.save();
  /* ---------- CLEAR CACHE FOR THIS BLOG ---------- */
  try {
    await redisClient.del(`BLOG:ID:${blogId}`);
    await redisClient.del(`BLOG:SLUG:${blog.slug}`);
  } catch (err) {
    console.error("Cache clear failed on add comment:", err.message);
  }
  /* ---------- NOTIFY EMPLOYEES WITH blog.comment.moderate PERMISSION ---------- */
  try {
    await sendNotification({
      sender: null,
      permission: "cms.blog.read",   // only moderators get this
      title: "New Comment Pending Approval",
      message: `New comment on "${blog.title}" by ${data.name} — awaiting moderation`,
      type: "BLOG_COMMENT_ADDED",
      entityId: blog._id,
      entityModel: "Blog",
      metadata: {
        blogId: blog.blogId,
        blogTitle: blog.title,
        commentId: comment.commentId,
        commenterName: data.name,
        commenterCity: data.city
      },
    });
  } catch (err) {
    console.error("Notification failed on add comment:", err.message);
  }
  return { blogId, comment: blog.comments.at(-1) };
};

/* =========================================================
   DELETE COMMENT
========================================================= */
export const deleteBlogCommentService = async ({
  blogId,
  commentId,
  employee,
  permission,
}) => {
  if (!employee.permissions?.includes(permission)) {
    const error = new Error("Unauthorized");
    error.statusCode = 403;
    error.errorCode = "UNAUTHORIZED";
    throw error;
  }

  const blog = await Blog.findOne({ blogId, isDeleted: false });
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

   /* ---------- CAPTURE COMMENT BEFORE DELETE ---------- */
   const comment = blog.comments.find((c) => c.commentId === commentId);
   if (!comment) {
     const error = new Error("Comment not found");
     error.statusCode = 404;
     error.errorCode = "COMMENT_NOT_FOUND";
     throw error;
   }

  const result = await Blog.updateOne(
    { blogId, "comments.commentId": commentId },
    { $pull: { comments: { commentId } } }
  );

  if (result.modifiedCount === 0) {
    const error = new Error("Comment not found");
    error.statusCode = 404;
    error.errorCode = "COMMENT_NOT_FOUND";
    throw error;
  }

  /* ---------- CLEAR CACHE FOR THIS BLOG ---------- */
  try {
    await redisClient.del(`BLOG:ID:${blogId}`);
    await redisClient.del(`BLOG:SLUG:${blog.slug}`);
  } catch (err) {
    console.error("Cache clear failed on delete comment:", err.message);
  }

  /* ---------- AUDIT (employee action — fully tracked) ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: blog._id,
      action: `Deleted comment on blog: "${blog.title}"`,
      permission: "blog.comment.delete",
      actionType: "Delete",
    });
  } catch (err) {
    console.error("Audit log failed on delete comment:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee._id,
      permission: "cms.blog.read",
      title: "Blog Comment Deleted",
      message: `Comment on "${blog.title}" deleted by ${employee.email}`,
      type: "BLOG_COMMENT_DELETED",
      entityId: blog._id,
      entityModel: "Blog",
      metadata: {
        blogId: blog.blogId,
        blogTitle: blog.title,
        commentId,
        deletedBy: employee.email,
        deletedComment: {
          name: comment.name,
          review: comment.review,
          city: comment.city,
          createdAt: comment.createdAt,
        },
      },
    });
  } catch (err) {
    console.error("Notification failed on delete comment:", err.message);
  }

  return { blogId, commentId };
};

/* =========================================================
   INCREASE VIEW (2 MIN RULE)
========================================================= */
export const increaseBlogViewService = async ({ blogId, req }) => {
  const blog = await Blog.findOne({ blogId, isDeleted: false });
  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "";

  const lastView = await BlogView.findOne({
    blog: blog._id,
    ipAddress: ip,
    userAgent,
  }).sort({ viewedAt: -1 });

  const now = new Date();
  const TWO_MIN = 2 * 60 * 1000;
  const shouldCount = !lastView || now - lastView.viewedAt > TWO_MIN;

  if (shouldCount) {
    await BlogView.create({
      blog: blog._id,
      ipAddress: ip,
      userAgent,
      referrer: req.headers.referer || "",
    });
    await Blog.updateOne({ blogId }, { $inc: { views: 1 } });
    blog.views += 1;

    /* ---------- CLEAR CACHE FOR THIS BLOG ---------- */
    try {
      await redisClient.del(`BLOG:ID:${blogId}`);
      await redisClient.del(`BLOG:SLUG:${blog.slug}`);
    } catch (err) {
      console.error("Cache clear failed on view increment:", err.message);
    }
  }

  return { blogId, views: blog.views };
};
