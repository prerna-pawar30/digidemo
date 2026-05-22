import { v6 as uuidv6 } from "uuid";
import ProductReview from "../models/manage/productReview.model.js";
import { sendNotification } from "./notification.service.js";
import { redis as redisClient } from "../config/redis.config.js";

/* =========================================================
   CACHE CONFIG
========================================================= */
const CACHE_TTL = 60 * 60;

/* =========================================================
   CACHE HELPERS
========================================================= */
const getCache = async (key) => {
  try {
    const cached = await redisClient.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    console.error("REDIS GET CACHE ERROR:", err.message);
    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(key, JSON.stringify(data), { ex: CACHE_TTL });
  } catch (err) {
    console.error("REDIS SET CACHE ERROR:", err.message);
  }
};

const clearProductReviewCache = async () => {
  try {
    const keys = await redisClient.keys("PRODUCTID:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("PRODUCT REVIEW CACHE CLEARED:", keys);
    }
  } catch (err) {
    console.error("REDIS CLEAR CACHE ERROR:", err.message);
  }
};

export const createProductReviewService = async ({ data }) => {
  const review = await ProductReview.create({
    ...data,
    reviewId: uuidv6(),
  });
  /* ---------- CLEAR CACHE ---------- */
  await clearProductReviewCache();

    /* ---------- NOTIFICATION ---------- */
    try {
      await sendNotification({
        sender: null,
        permission: "product.review.create",
        title: "New Product Review Created",
        message: `A new product review was submitted by ${data.reviewerInfo?.name || "Unknown"}`,
        type: "PRODUCT_REVIEW_CREATED",
        entityId: review._id,
        entityModel: "ProductReview",
        metadata: {
          reviewId: review.reviewId,
          reviewerName: data.reviewerInfo?.name || null,
          reviewerEmail: data.reviewerInfo?.email || null,
          categoryCount: data.categoryReviews.length,
        },
      });
    } catch (err) {
      console.error("Notification failed on review create:", err.message);
    }
  return review.toObject();

};

export const getAllProductReviewsService = async ({ page, limit }) => {
  const pageNum  = Math.max(Number(page)  || 1,  1);
  const limitNum = Math.max(Number(limit) || 10, 1);
  /* ---------- CACHE KEY ---------- */
  const cacheKey = `PRODUCTID:ALL:${pageNum}:${limitNum}`;

  /* ---------- CACHE CHECK ---------- */
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("PRODUCT REVIEW CACHE HIT:", cacheKey);
    return cached;
  } 
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
  /* ---------- EDGE CASE: page out of range ---------- */
  if (pageNum > totalPages) {
    const err = new Error(`Page ${pageNum} does not exist. Total pages: ${totalPages}`);
    err.statusCode = 400;
    err.errorCode = "PAGE_OUT_OF_RANGE";
    throw err;
  }
  const result = {
    reviews,
    pagination: {
      totalItems,
      totalPages,
      currentPage: pageNum,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      prevPage: pageNum > 1 ? pageNum - 1 : null,
      limit: limitNum,
    },
  };

  /* ---------- STORE CACHE ---------- */
  await setCache(cacheKey, result);
  return result;
};

export const getProductReviewByIdService = async ({ reviewId }) => {
    /* ---------- CACHE CHECK ---------- */
    const cacheKey = `PRODUCT_REVIEW:ID:${reviewId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("PRODUCT REVIEW CACHE HIT:", cacheKey);
      return cached;
    }
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
/* ---------- EDGE CASE: not found ---------- */
if (!review) {
  const err = new Error("Review not found");
  err.statusCode = 404;
  err.errorCode = "REVIEW_NOT_FOUND";
  throw err;
}
/* ---------- STORE CACHE ---------- */
await setCache(cacheKey, review);

return review;
};

export const updateProductReviewService = async ({ reviewId, data }) => {
  const review = await ProductReview.findOne({ reviewId });
  if (!review) {
    const err = new Error("Review not found");
    err.statusCode = 404;
    err.errorCode = "REVIEW_NOT_FOUND";
    throw err;
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

  /* ---------- EDGE CASE: no actual change ---------- */
  if (Object.keys(changes).length === 0) {
    const err = new Error("No changes detected — values are the same as existing");
    err.statusCode = 400;
    err.errorCode = "NO_CHANGES_DETECTED";
    throw err;
  }

  await review.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearProductReviewCache();
  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: null,
      permission: "product.review.update",
      title: "Product Review Updated",
      message: `Product review for "${review.reviewerInfo?.name || "Unknown"}" was updated`,
      type: "PRODUCT_REVIEW_UPDATED",
      entityId: review._id,
      entityModel: "ProductReview",
      metadata: {
        reviewId: review.reviewId,
        reviewerName: review.reviewerInfo?.name || null,
        changes,
      },
    });
  } catch (err) {
    console.error("Notification failed on review update:", err.message);
  }

  return review.toObject();
};

export const deleteProductReviewService = async ({ reviewId }) => {
   /* ---------- FETCH & DELETE ---------- */
   const deletedReview = await ProductReview.findOneAndDelete({ reviewId }).lean();
   /* ---------- EDGE CASE: not found ---------- */
   if (!deletedReview) {
     const err = new Error("Review not found");
     err.statusCode = 404;
     err.errorCode = "REVIEW_NOT_FOUND";
     throw err;
   }
   /* ---------- CLEAR CACHE ---------- */
   await clearProductReviewCache();
   /* ---------- NOTIFICATION ---------- */
   try {
     await sendNotification({
       sender: null,
       permission: "product.review.delete",
       title: "Product Review Deleted",
       message: `Product review by "${deletedReview.reviewerInfo?.name || "Unknown"}" was deleted`,
       type: "PRODUCT_REVIEW_DELETED",
       entityId: deletedReview._id,
       entityModel: "ProductReview",
       metadata: {
         reviewId: deletedReview.reviewId,
         reviewerName: deletedReview.reviewerInfo?.name || null,
         reviewerEmail: deletedReview.reviewerInfo?.email || null,
         categoryCount: deletedReview.categoryReviews?.length || 0,
       },
     });
   } catch (err) {
     console.error("Notification failed on review delete:", err.message);
   }
   return deletedReview;
 };
