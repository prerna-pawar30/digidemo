import { addReviewService, deleteReviewService, getAllReviewsService, getHomePageReviewsService, updateReviewService } from "../../services/review.service.js";
import { validateAddReview, validateUpdateReview } from "./review.validator.js";
import {sendError, handleError} from "../../helpers/error.helper.js"
import {sendSuccess} from "../../helpers/response.helper.js"



/**
 * @function addReview
 *
 * @params
 * params: {
 *   productId: string
 * }
 * body: {
 *   rating: number (1-5),
 *   comment: string
 * }
 * user: {
 *   email: string
 * }
 *
 * @process
 * 1. Validate rating (must be between 1 and 5)
 * 2. Fetch product using productId
 * 3. Validate authenticated user (email must exist)
 * 4. Fetch user from DB using email
 * 5. Check if user already reviewed the product
 * 6. Create new review object with unique reviewId
 * 7. Push review into product.reviews array
 * 8. Recalculate product ratingAvg and ratingCount
 * 9. Save product
 * 10. Populate reviews.user for response
 * 11. Return updated reviews and rating data
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Review added",
 *   data: {
 *     reviews: [],
 *     ratingAvg: number,
 *     ratingCount: number
 *   }
 * }
 */
export const addReview = async (req, res) => {
  try {
    /* ---------------- MERGE DATA ---------------- */
    const payload = {
      productId: req.params.productId,
      rating: req.body.rating,
      comment: req.body.comment,
    };
    /* ---------------- VALIDATION ---------------- */
    const { error, value } = validateAddReview(payload);
    if(error){
      return sendError(res,{
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }
    /* ---------------- AUTH ---------------- */
    if (!req.user?.email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }
    /* ---------------- SERVICE ---------------- */
    const result = await addReviewService({
      ...value,
      userEmail: req.user.email,
    });
    return sendSuccess(res, result, 201, "Review added successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateReview
 *
 * @params
 * params: {
 *   productId: string,
 *   reviewId: string
 * }
 * body: {
 *   rating?: number,
 *   comment?: string
 * }
 * user: {
 *   email: string
 * }
 *
 * @process
 * 1. Fetch product using productId
 * 2. Validate authenticated user (email must exist)
 * 3. Fetch user from DB
 * 4. Find review using reviewId
 * 5. Check if review exists
 * 6. Ensure review is not anonymous
 * 7. Verify ownership (review.user === logged-in user)
 * 8. Update rating and/or comment
 * 9. Set updatedAt timestamp
 * 10. Recalculate ratingAvg and ratingCount
 * 11. Save product
 * 12. Populate reviews.user for response
 * 13. Return updated reviews and rating data
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Review updated",
 *   data: {
 *     reviews: [],
 *     ratingAvg: number,
 *     ratingCount: number
 *   }
 * }
 */
export const updateReview = async (req, res) => {
  try {
    const payload = {
      productId: req.params.productId,
      reviewId: req.params.reviewId,
      rating: req.body.rating,
      comment: req.body.comment,
    };

    /* ---------------- VALIDATION ---------------- */
    const { error, value } = validateUpdateReview(payload);
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }

    /* ---------------- AUTH ---------------- */
    if (!req.user?.email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }

    /* ---------------- SERVICE ---------------- */
    const result = await updateReviewService({
      ...value,
      userEmail: req.user.email,
    });

    /* ---------------- SUCCESS ---------------- */
    return sendSuccess(
      res,
      result,
      200,
      "Review updated successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function getAllReviews
 *
 * @params
 * params: {
 *   productId: string
 * }
 *
 * @process
 * 1. Fetch product using productId
 * 2. Populate reviews.user (firstName)
 * 3. Check if product exists
 * 4. Sort reviews by createdAt (latest first)
 * 5. Return ratingAvg, ratingCount, and sorted reviews
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Reviews fetched",
 *   data: {
 *     ratingAvg: number,
 *     ratingCount: number,
 *     reviews: []
 *   }
 * }
 */
export const getAllReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    /* ---------- BASIC CHECK ---------- */
    if (!productId) {
      return sendError(res, {
        message: "ProductId is required",
        statusCode: 400,
        errorCode: "PRODUCT_ID_REQUIRED",
      });
    }
    /* ---------- PAGINATION INPUT ---------- */
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 12;

    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 12 : limit;

    const MAX_LIMIT = 50;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    /* ---------- SERVICE ---------- */
    const result = await getAllReviewsService({
      productId,
      page,
      limit,
    });

    /* ---------- SUCCESS ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "Reviews fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deleteReview
 *
 * @params
 * params: {
 *   productId: string,
 *   reviewId: string
 * }
 * user: {
 *   email: string
 * }
 *
 * @process
 * 1. Fetch product using productId
 * 2. Find review using reviewId
 * 3. Check if review exists
 * 4. Ensure review is not anonymous
 * 5. Validate authenticated user (email must exist)
 * 6. Fetch user from DB
 * 7. Verify ownership (review.user === logged-in user)
 * 8. Remove review from product.reviews array
 * 9. Recalculate ratingAvg and ratingCount
 * 10. Save product
 * 11. Return updated rating and reviews
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Review deleted",
 *   data: {
 *     ratingAvg: number,
 *     ratingCount: number,
 *     reviews: []
 *   }
 * }
 */
export const deleteReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const userEmail = req.user?.email;

    /* ---------- BASIC CHECK ---------- */
    if (!productId || !reviewId) {
      return sendError(res, {
        message: "ProductId and ReviewId are required",
        statusCode: 400,
        errorCode: "MISSING_REQUIRED_FIELDS",
      });
    }

    if (!userEmail) {
      return sendError(res, {
        message: "User email missing",
        statusCode: 400,
        errorCode: "USER_EMAIL_MISSING",
      });
    }

    /* ---------- SERVICE ---------- */
    const result = await deleteReviewService({
      productId,
      reviewId,
      userEmail,
    });

    /* ---------- SUCCESS ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "Review deleted successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getHomePageReviews
 *
 * @params
 * none
 *
 * @process
 * 1. Fetch products where reviews.isHomePage = true
 * 2. Select required fields (name, reviews)
 * 3. Populate reviews.user (firstName, lastName)
 * 4. Iterate through products and extract only homepage reviews
 * 5. Map reviews into custom response format
 * 6. Sort reviews by createdAt (latest first)
 * 7. Limit result to top 6 reviews
 * 8. Return homepage reviews list
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Homepage reviews fetched",
 *   data: [
 *     {
 *       productId: string,
 *       productName: string,
 *       reviewId: string,
 *       user: object,
 *       rating: number,
 *       comment: string,
 *       createdAt: date,
 *       isHomePage: true
 *     }
 *   ]
 * }
 */
export const getHomePageReviews = async (req, res) => {
  try {
    /* ---------- SERVICE ---------- */
    const result = await getHomePageReviewsService();

    if (!result || result.length === 0) {
      return sendError(res, {
        message: "No homepage reviews found",
        statusCode: 404,
        errorCode: "NO_HOMEPAGE_REVIEWS",
      });
    }

    /* ---------- SUCCESS ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "Homepage reviews fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};