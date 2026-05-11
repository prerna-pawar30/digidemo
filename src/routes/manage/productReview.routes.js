import express from "express";
import {
  createProductReview,
  getAllProductReviews,
  getProductReviewById,
  updateProductReview,
  deleteProductReview,
} from "../../controllers/productReview/productReview.controller.js";

const router = express.Router();
router.post("/create", createProductReview);
router.get("/get-all", getAllProductReviews);
router.get("/get/:reviewId", getProductReviewById);
router.put("/update/:reviewId", updateProductReview);
router.delete("/delete/:reviewId", deleteProductReview);

export default router;