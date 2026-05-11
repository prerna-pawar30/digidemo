import express from "express";

import {
  createBlog,
  getBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
} from "../../controllers/blog/blog.controller.js";

import { checkPermission } from "../../middlewares/permission.middleware.js";
import { addBlogComment, deleteBlogComment, increaseBlogView } from "../../controllers/blog/blogView.controller.js";
import auth from "../../middlewares/auth.middleware.js";
const router = express.Router();

/* ---------- MANAGE ROUTES ---------- */

router.delete(
  "/manage/comment/:blogId/:commentId",
  auth,
  checkPermission,
  deleteBlogComment
);

router.post(
  "/manage/blogs",
  auth,
  checkPermission,
  createBlog
);

router.get(
  "/manage/blogs/:permission",
  auth,
  checkPermission,
  getBlogs
);

router.get(
  "/manage/blogs/:blogId/:permission",
  auth,
  checkPermission,
  getBlogById
);

router.patch(
  "/manage/blogs/:blogId",
  auth,
  checkPermission,
  updateBlog
);

router.delete(
  "/manage/blogs/:blogId",
  auth,
  checkPermission,
  deleteBlog
);

/* ---------- PUBLIC ROUTES ---------- */
router.get("/blogs", getBlogs);
router.get("/blogs/:blogId", getBlogById);


// Add comment on blog
router.post("/comment/:blogId", addBlogComment);

// Increase blog view
router.patch("/:blogId/view", increaseBlogView);



export default router;