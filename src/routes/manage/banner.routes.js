import express from "express";
import {
  createBanner,
  deleteBanner,
  getAllBanners,
  getBannersByIsActive,
  getProductsByBanner,
  updateBanner,
  updateBannerDisplayOrder,
} from "../../controllers/banner/banner.controller.js";
import upload from "../../middlewares/multer.middleware.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = express.Router();

router.post("/create", upload.single("imageUrl"),auth,checkPermission,createBanner);
router.get("/products/:bannerId",getProductsByBanner);
router.get("/get",getAllBanners);
router.get("/status",getBannersByIsActive);
router.put("/update/DisplayOrder/:bannerId",auth, checkPermission, updateBannerDisplayOrder);
router.put("/update/:bannerId",upload.single("imageUrl"),auth, checkPermission, updateBanner);
router.delete("/delete/:bannerId",auth, checkPermission, deleteBanner);

export default router;
