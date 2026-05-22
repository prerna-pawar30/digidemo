import express from "express";
import {
  createCoupon,
  filterCouponsByStatus,
  getSingleCoupon,
  updateCoupon,
  deleteCoupon
} from "../../controllers/coupon/coupon.controller.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import auth from "../../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/create",auth, checkPermission, createCoupon);          // CREATE
router.get("/filter/:isActive",filterCouponsByStatus);          // READ ALL
router.get("/get/:id", getSingleCoupon);     // READ ONE
router.put("/update/:id",auth, checkPermission, updateCoupon);        // UPDATE
router.delete("/delete/:id",auth, checkPermission, deleteCoupon);   
export default router;
