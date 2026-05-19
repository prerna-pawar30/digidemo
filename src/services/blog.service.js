import Blog from "../models/blog/blog.modal.js";
import slugify from "slugify";
import { v6 as uuidv6 } from "uuid";
import BlogView from "../models/blog/blogView.model.js";
import { sendNotification } from "./notification.service.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";

export const createBlogService = async ({ data, employee }) => {
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

    // 🔥 FORCE UNIQUE SLUG (ignore frontend slug)
  const slug = `${slugify(data.title, {
    lower: true,
    strict: true,
    trim: true,
  })}-${uuidv6()}`;

  const blog = await Blog.create({
    ...data,
     slug,
    createdBy: employee?._id || null,
  });

    /* ---------- CREATE AUDIT LOG ---------- */

  await PermissionAudit.create({

    permissionAuditId: uuidv6(),

    actionBy: employee?._id,

    actionByEmail: employee?.email,

    actionFor: blog._id,

    action: `Created blog: ${blog.title}`,

    permission: "blog.create",

    actionType: "Create",
  });

    /* ---------- SEND NOTIFICATION ---------- */

  await sendNotification({
    sender: employee?._id || null,
    permission: "blog.listing.read",
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
    },
  });

  return blog;
};

export const getBlogsService = async ({ page, limit, skip, status, search, category }) => {
  const query = {
    isDeleted: false,
  };

  if (status && status !== "all") {
    query.status = status;
  }

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$text = { $search: search };
  }

  const [blogs, totalItems] = await Promise.all([
    Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Blog.countDocuments(query),
  ]);

  return {
    blogs,
    pagination: {
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      nextPage: page < Math.ceil(totalItems / limit) ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
  };
};

export const getBlogByIdService = async ({ blogId }) => {
  const blog = await Blog.findOne({
    blogId,
    isDeleted: false,
  }).lean();

  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  return blog;
};

export const getBlogBySlugService = async ({ slug }) => {
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

  return blog;
};

export const updateBlogService = async ({ blogId, data, employee }) => {
  const blog = await Blog.findOne({
    blogId,
    isDeleted: false,
  });

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

  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      blog[key] = data[key];
    }
  });

  blog.updatedBy = employee?._id || null;

  await blog.save();

  return blog;
};

export const deleteBlogService = async ({ blogId, employee }) => {
  const blog = await Blog.findOne({
    blogId,
    isDeleted: false,
  });

  if (!blog) {
    const error = new Error("Blog not found");
    error.statusCode = 404;
    error.errorCode = "BLOG_NOT_FOUND";
    throw error;
  }

  blog.isDeleted = true;
  blog.updatedBy = employee?._id || null;

  await blog.save();

  return {
    blogId: blog.blogId,
    title: blog.title,
    deleted: true,
  };
};


// ➤ ADD COMMENT
export const addBlogCommentService = async ({ blogId, data }) => {
  const blog = await Blog.findOne({ blogId: blogId, isDeleted: false });
  if (!blog) {
    throw {
      message: "Blog not found",
      statusCode: 404,
    };
  }
 const comment = {
  commentId: uuidv6(),   // ✅ added
  name: data.name,
  company: data.company,
  city: data.city,
  review: data.review,
};

blog.comments.push(comment);
  await blog.save();
  return {
    blogId,
    comment: blog.comments.at(-1),
  };
};


// ➤ DELETE COMMENT
export const deleteBlogCommentService = async ({
  blogId,
  commentId,
  employee,
  permission,
}) => {
  if (!employee.permissions?.includes(permission)) {
    throw {
      message: "Unauthorized",
      statusCode: 403,
    };
  }

  const result = await Blog.updateOne(
    { blogId: blogId, "comments.commentId": commentId },
    { $pull: { comments: { commentId } } }
  );

  if (result.modifiedCount === 0) {
    throw {
      message: "Comment not found",
      statusCode: 404,
    };
  }

  return { blogId, commentId };
};



// ➤ INCREASE VIEW (2 MIN RULE)
export const increaseBlogViewService = async ({ blogId, req }) => {
  const blog = await Blog.findOne({ blogId: blogId, isDeleted: false });

  if (!blog) {
    throw {
      message: "Blog not found",
      statusCode: 404,
    };
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress;

  const userAgent = req.headers["user-agent"] || "";

  const lastView = await BlogView.findOne({
    blog: blog._id,
    ipAddress: ip,
    userAgent,
  }).sort({ viewedAt: -1 });

  const now = new Date();
  const TWO_MIN = 2 * 60 * 1000;
  let shouldCount = false;
  if (!lastView) {
    shouldCount = true;
  } else {
    const diff = now - lastView.viewedAt;
    if (diff > TWO_MIN) shouldCount = true;
  }

  if (shouldCount) {
    await BlogView.create({
      blog: blog._id,
      ipAddress: ip,
      userAgent,
      referrer: req.headers.referer || "",
    });
    await Blog.updateOne({ blogId: blogId }, { $inc: { views: 1 } });
    blog.views += 1;
  }
  return {
    blogId,
    views: blog.views,
  };
};