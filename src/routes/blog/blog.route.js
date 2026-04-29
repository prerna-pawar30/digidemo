import express from "express";

import {
  createBlog,
  getBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
} from "../../controllers/blog/blog.controller.js";

import Auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = express.Router();

/* ---------- MANAGE ROUTES ---------- */
router.post(
  "/manage/blogs",
  Auth,
  checkPermission,
  createBlog
);

router.get(
  "/manage/blogs/:permission",
  Auth,
  checkPermission,
  getBlogs
);

router.get(
  "/manage/blogs/:blogId/:permission",
  Auth,
  checkPermission,
  getBlogById
);

router.patch(
  "/manage/blogs/:blogId",
  Auth,
  checkPermission,
  updateBlog
);

router.delete(
  "/manage/blogs/:blogId",
  Auth,
  checkPermission,
  deleteBlog
);

/* ---------- PUBLIC ROUTES ---------- */
router.get("/blogs", getBlogs);
router.get("/blogs/:blogId", getBlogById);
export default router;