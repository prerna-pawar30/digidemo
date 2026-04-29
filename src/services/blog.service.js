import Blog from "../models/blog/blog.modal.js";
import slugify from "slugify";
import { v6 as uuidv6 } from "uuid";
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