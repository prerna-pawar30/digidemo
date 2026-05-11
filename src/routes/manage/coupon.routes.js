import express from "express";
import {
  createCoupon,
  filterCouponsByStatus,
  getSingleCoupon,
  updateCoupon,
  deleteCoupon
} from "../../controllers/coupon/coupon.controller.js";

const router = express.Router();

router.post("/create", createCoupon);          // CREATE
router.get("/filter/:isActive",filterCouponsByStatus);          // READ ALL
router.get("/get/:id", getSingleCoupon);     // READ ONE
router.put("/update/:id", updateCoupon);        // UPDATE
router.delete("/delete/:id", deleteCoupon);   
export default router;
