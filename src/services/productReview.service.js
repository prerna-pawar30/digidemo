import { v6 as uuidv6 } from "uuid";
import ProductReview from "../models/manage/productReview.model.js";

export const createProductReviewService = async ({ data }) => {
  const review = await ProductReview.create({
    ...data,
    reviewId: uuidv6(),
  });

  return review.toObject();
};

export const getAllProductReviewsService = async ({ page, limit, skip }) => {
  const [reviews, totalItems] = await Promise.all([
    ProductReview.find()
      .select({
        _id: 1,
        reviewId: 1,
        reviewerInfo: 1,
        categoryReviews: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    ProductReview.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    reviews,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
  };
};

export const getProductReviewByIdService = async ({ reviewId }) => {
  const review = await ProductReview.findOne({ reviewId })
    .select({
      _id: 1,
      reviewId: 1,
      reviewerInfo: 1,
      categoryReviews: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean();

  return review;
};

export const updateProductReviewService = async ({ reviewId, data }) => {
  const review = await ProductReview.findOne({ reviewId });

  if (!review) {
    return null;
  }

  /* ---------- PARTIAL UPDATE reviewerInfo ---------- */
  if (data.reviewerInfo) {
    Object.keys(data.reviewerInfo).forEach((key) => {
      review.reviewerInfo[key] = data.reviewerInfo[key];
    });
  }

  /* ---------- UPSERT categoryReviews BY productType ---------- */
  if (Array.isArray(data.categoryReviews) && data.categoryReviews.length > 0) {
    data.categoryReviews.forEach((incomingCategory) => {
      const existingIndex = review.categoryReviews.findIndex(
        (item) => item.productType === incomingCategory.productType
      );

      if (existingIndex !== -1) {
        review.categoryReviews[existingIndex] = {
          ...review.categoryReviews[existingIndex].toObject(),
          ...incomingCategory,
        };
      } else {
        review.categoryReviews.push(incomingCategory);
      }
    });
  }

  await review.save();

  return review.toObject();
};

export const deleteProductReviewService = async ({ reviewId }) => {
  const deletedReview = await ProductReview.findOneAndDelete({ reviewId }).lean();
  return deletedReview;
};