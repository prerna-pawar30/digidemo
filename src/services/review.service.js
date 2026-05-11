import Product from "../models/manage/product.model.js";
import User from "../models/ecommarace/user.model.js";
import { v6 as uuidv6 } from "uuid";
import { getPagination } from "../helpers/pagination.helper.js";

export const addReviewService = async ({
  productId,
  rating,
  comment,
  userEmail,
}) => {
  try {
    /* ---------------- GET PRODUCT ---------------- */
    const product = await Product.findOne({ productId });
    if (!product) {
      throw new Error("Product not found");
    }

    /* ---------------- GET USER ---------------- */
    const user = await User.findOne({ email: userEmail }).select("_id firstName");
    if (!user) {
      throw new Error("User not found");
    }

    const userId = user._id;

    /* ---------------- DUPLICATE CHECK ---------------- */
    const alreadyReviewed = product.reviews.find(
      (r) => r.user?.toString() === userId.toString()
    );

    if (alreadyReviewed) {
      throw new Error("You already reviewed this product");
    }

    /* ---------------- CREATE REVIEW ---------------- */
    const newReview = {
      reviewId: uuidv6(),
      user: userId,
      rating,
      comment,
      createdAt: new Date(),
    };

    product.reviews.push(newReview);

    /* ---------------- RE-CALCULATE RATING ---------------- */
    const total = product.reviews.length;
    const sum = product.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);

    product.ratingCount = total;
    product.ratingAvg = total ? sum / total : 0;

    await product.save();

    /* ---------------- POPULATE (OPTIMIZED) ---------------- */
    await product.populate({
      path: "reviews.user",
      select: "name email avatar",
    });

    return {
      reviews: product.reviews,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
    };

  } catch (error) {
    throw new Error(error.message || "Failed to add review");
  }
};

export const updateReviewService = async ({
  productId,
  reviewId,
  rating,
  comment,
  userEmail,
}) => {
  try {
    /* ---------------- GET PRODUCT ---------------- */
    const product = await Product.findOne({ productId });
    if (!product) {
      throw new Error("Product not found");
    }

    /* ---------------- GET USER ---------------- */
    const user = await User.findOne({ email: userEmail }).select("_id");
    if (!user) {
      throw new Error("User not found");
    }

    /* ---------------- FIND REVIEW ---------------- */
    const review = product.reviews.find(
      (r) => r.reviewId === reviewId
    );

    if (!review) {
      throw new Error("Review not found");
    }

    if (!review.user) {
      throw new Error("Cannot update anonymous review");
    }

    if (review.user.toString() !== user._id.toString()) {
      throw new Error("You cannot update someone else's review");
    }

    /* ---------------- UPDATE FIELDS ---------------- */
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    review.updatedAt = new Date();

    /* ---------------- RE-CALCULATE RATING ---------------- */
    const total = product.reviews.length;
    const sum = product.reviews.reduce(
      (acc, r) => acc + (r.rating || 0),
      0
    );

    product.ratingCount = total;
    product.ratingAvg = total ? sum / total : 0;

    await product.save();

    /* ---------------- POPULATE ---------------- */
    await product.populate({
      path: "reviews.user",
      select: "name email avatar",
    });

    return {
      reviews: product.reviews,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
    };

  } catch (error) {
    throw new Error(error.message || "Failed to update review");
  }
};


export const getAllReviewsService = async ({
  productId,
  page,
  limit,
}) => {
  try {
    const skip = (page - 1) * limit;

    /* ---------- FETCH PRODUCT ---------- */
    const product = await Product.findOne({ productId }).populate({
      path: "reviews.user",
      select: "firstName",
    });

    if (!product) {
      throw {
        message: "Product not found",
        statusCode: 404,
        errorCode: "PRODUCT_NOT_FOUND",
      };
    }

    /* ---------- SORT REVIEWS ---------- */
    const reviews = [...(product.reviews || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    /* ---------- PAGINATE ---------- */
    const paginatedReviews = reviews.slice(skip, skip + limit);

    const pagination = getPagination({
      total: reviews.length,
      page,
      limit,
    });

    /* ---------- RETURN ---------- */
    return {
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      ...pagination,
      reviews: paginatedReviews,
    };

  } catch (error) {
    throw error;
  }
};


export const deleteReviewService = async ({
  productId,
  reviewId,
  userEmail,
}) => {
  try {
    /* ---------- FETCH PRODUCT ---------- */
    const product = await Product.findOne({ productId });

    if (!product) {
      throw {
        message: "Product not found",
        statusCode: 404,
        errorCode: "PRODUCT_NOT_FOUND",
      };
    }

    /* ---------- FIND REVIEW ---------- */
    const review = product.reviews.find(
      (r) => r.reviewId === reviewId
    );

    if (!review) {
      throw {
        message: "Review not found",
        statusCode: 404,
        errorCode: "REVIEW_NOT_FOUND",
      };
    }

    if (!review.user) {
      throw {
        message: "Anonymous review cannot be deleted",
        statusCode: 403,
        errorCode: "ANONYMOUS_REVIEW",
      };
    }

    /* ---------- FETCH USER ---------- */
    const user = await User.findOne({ email: userEmail }).select("_id");

    if (!user) {
      throw {
        message: "User not found",
        statusCode: 404,
        errorCode: "USER_NOT_FOUND",
      };
    }

    /* ---------- OWNERSHIP CHECK ---------- */
    if (review.user.toString() !== user._id.toString()) {
      throw {
        message: "You cannot delete someone else's review",
        statusCode: 403,
        errorCode: "UNAUTHORIZED_ACTION",
      };
    }

    /* ---------- DELETE REVIEW ---------- */
    product.reviews = product.reviews.filter(
      (r) => r.reviewId !== reviewId
    );

    /* ---------- RECALCULATE RATINGS ---------- */
    const total = product.reviews.length;

    const sum = product.reviews.reduce(
      (acc, r) => acc + (r.rating || 0),
      0
    );

    product.ratingCount = total;
    product.ratingAvg = total ? sum / total : 0;

    await product.save();

    /* ---------- RETURN ---------- */
    return {
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      reviews: product.reviews,
    };

  } catch (error) {
    throw error;
  }
};

export const getHomePageReviewsService = async () => {
  try {
    /* ---------- FETCH PRODUCTS ---------- */
    const products = await Product.find({
      "reviews.isHomePage": true,
    })
      .select("name reviews")
      .populate({
        path: "reviews.user",
        select: "firstName lastName",
      });

    if (!products || products.length === 0) {
      return [];
    }

    /* ---------- EXTRACT REVIEWS ---------- */
    let homePageReviews = [];

    for (const product of products) {
      const filteredReviews = (product.reviews || []).filter(
        (rev) => rev.isHomePage === true
      );

      const mapped = filteredReviews.map((rev) => ({
        productId: product.productId || product._id,
        productName: product.name,
        reviewId: rev.reviewId,
        user: rev.user || null,
        rating: rev.rating,
        comment: rev.comment,
        createdAt: rev.createdAt,
        isHomePage: true,
      }));

      homePageReviews.push(...mapped);
    }

    /* ---------- SORT ---------- */
    homePageReviews.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    /* ---------- LIMIT (TOP 6) ---------- */
    return homePageReviews.slice(0, 6);

  } catch (error) {
    throw {
      message: error.message || "Failed to fetch homepage reviews",
      statusCode: 500,
      errorCode: "FETCH_HOMEPAGE_REVIEWS_FAILED",
    };
  }
};