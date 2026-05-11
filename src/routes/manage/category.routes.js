import express from "express";
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../../controllers/category/category.controller.js";
import upload from "../../middlewares/multer.middleware.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = express.Router();

router.post("/create",upload.single("image"), auth,checkPermission,createCategory);
router.get("/get", getAllCategories);
router.put("/update/:categoryId",upload.single("image"), auth,checkPermission,  updateCategory);
router.delete("/delete/:categoryId",auth,checkPermission, deleteCategory);

export default router;