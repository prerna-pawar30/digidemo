import express from "express";
import { createBrand, deleteBrandByBrandId, getAllBrands, getBrandById, updateBrand } from "../../controllers/brand/brand.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import upload from "../../middlewares/multer.middleware.js";
const router = express.Router();
// Routes 
router.post(
  "/create",upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "file", maxCount: 5 },
  ]), auth, checkPermission,
  createBrand
);
router.get("/all",getAllBrands);
router.delete("/delete/:brandId",auth, checkPermission, deleteBrandByBrandId);
router.put(
  "/update/:brandId", upload.fields([
    { name: "logoUrl", maxCount: 1 },
    { name: "file", maxCount: 5 },
  ]), auth, checkPermission,
  updateBrand
);
router.get("/get/:brandId", getBrandById);
export default router;
