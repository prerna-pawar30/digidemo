import {
  validateCreateProductReviewBody,
  validateUpdateProductReviewBody,
} from "./productReview.validation.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";
import {
  createProductReviewService,
  getAllProductReviewsService,
  getProductReviewByIdService,
  updateProductReviewService,
  deleteProductReviewService,
} from "../../services/productReview.service.js";

/**
 * @function createProductReview
 *
 * @description
 * Create a new product review with one reviewer and multiple category reviews.
 *
 * @process
 * 1. Validate request body
 * 2. Create product review using service layer
 * 3. Return created review
 *
 * @response
 * 201 { success: true, message: "Product review created successfully", data: review }
 * 400 { success: false, message: "Validation failed", details: [...] }
 */
export const createProductReview = async (req, res) => {
  try {
    const { value, error } = validateCreateProductReviewBody(req.body);

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }

    const review = await createProductReviewService({
      data: value,
    });

    return sendSuccess(
      res,
      review,
      201,
      "Product review created successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getAllProductReviews
 *
 * @description
 * Fetch all product reviews with pagination.
 *
 * @process
 * 1. Read pagination params
 * 2. Fetch reviews from service layer
 * 3. Return paginated response
 *
 * @response
 * 200 { success: true, message: "Product reviews fetched successfully", data: { reviews, pagination } }
 */
export const getAllProductReviews = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const result = await getAllProductReviewsService({
      page,
      limit,
      skip,
    });

    return sendSuccess(
      res,
      result,
      200,
      "Product reviews fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getProductReviewById
 *
 * @description
 * Fetch a single product review by reviewId.
 *
 * @process
 * 1. Read reviewId from params
 * 2. Fetch review from service layer
 * 3. Return review if found
 *
 * @response
 * 200 { success: true, message: "Product review fetched successfully", data: review }
 * 404 { success: false, message: "Review not found" }
 */
export const getProductReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await getProductReviewByIdService({ reviewId });

    if (!review) {
      return sendError(res, {
        message: "Review not found",
        statusCode: 404,
        errorCode: "REVIEW_NOT_FOUND",
      });
    }

    return sendSuccess(
      res,
      review,
      200,
      "Product review fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateProductReview
 *
 * @description
 * Update a product review by reviewId.
 *
 * @process
 * 1. Read reviewId from params
 * 2. Validate update body
 * 3. Update review using service layer
 * 4. Return updated review
 *
 * @response
 * 200 { success: true, message: "Review updated successfully", data: review }
 * 400 { success: false, message: "Validation failed", details: [...] }
 * 404 { success: false, message: "Review not found" }
 */
export const updateProductReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { value, error } = validateUpdateProductReviewBody(req.body);

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }

    const updatedReview = await updateProductReviewService({
      reviewId,
      data: value,
    });

    if (!updatedReview) {
      return sendError(res, {
        message: "Review not found",
        statusCode: 404,
        errorCode: "REVIEW_NOT_FOUND",
      });
    }

    return sendSuccess(
      res,
      updatedReview,
      200,
      "Review updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deleteProductReview
 *
 * @description
 * Delete a product review by reviewId.
 *
 * @process
 * 1. Read reviewId from params
 * 2. Delete review using service layer
 * 3. Return success response
 *
 * @response
 * 200 { success: true, message: "Review deleted successfully" }
 * 404 { success: false, message: "Review not found" }
 */
export const deleteProductReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const deletedReview = await deleteProductReviewService({ reviewId });

    if (!deletedReview) {
      return sendError(res, {
        message: "Review not found",
        statusCode: 404,
        errorCode: "REVIEW_NOT_FOUND",
      });
    }

    return sendSuccess(res, null, 200, "Review deleted successfully");
  } catch (error) {
    return handleError(res, error);
  }
};