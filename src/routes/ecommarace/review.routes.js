// routes/review.routes.js
import express from "express";
import {
  addReview,
  updateReview,
  getAllReviews,
  deleteReview,
  getHomePageReviews,
} from "../../controllers/product/review.controller.js";
import auth from "../../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/add/:productId",auth,addReview);
router.put("/update/:productId/:reviewId",auth,updateReview);
router.get("/all/:productId", getAllReviews); 
router.delete("/delete/:productId/:reviewId",auth,deleteReview);
router.get("/home",getHomePageReviews)
export default router;
