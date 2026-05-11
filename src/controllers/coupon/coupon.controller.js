import {createCouponValidation, updateCouponValidation } from "./coupon.validator.js";
import { handleError, sendError } from "../../helpers/error.helper.js";
import { createCouponService, deleteCouponService, filterCouponsService, getSingleCouponService, updateCouponService } from "../../services/coupon.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";


/**
 * @function createCoupon
 *
 * @body
 * {
 *   code: string,
 *   title: string,
 *   couponType: string,
 *   discountValue?: number,
 *   startDate: date,
 *   endDate: date
 * }
 *
 * @process
 * Validate request body using Joi
 * Generate couponId
 * Save coupon in database
 *
 * @response
 * 201 Coupon created successfully
 */
export const createCoupon = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = createCouponValidation.validate(req.body, {
      abortEarly: false
    });
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map(e => e.message)
      });
    }
    /* ---------- SERVICE ---------- */
    const coupon = await createCouponService(value);
    return sendSuccess(
      res,
      coupon,
      201,
      "Coupon created successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateCoupon
 *
 * @params
 * couponId: string
 *
 * @body
 * same as create
 *
 * @process
 * Validate request
 * Update coupon by couponId
 *
 * @response
 * 200 Coupon updated successfully
 */
export const updateCoupon = async (req, res) => {
  try {
    const { value, error } = updateCouponValidation.validate(req.body, {
      abortEarly: false
    });
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map(e => e.message)
      });
    }
    const { id: couponId } = req.params;
    if(!couponId){
      return sendError(res, {
        message: "CouponId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    /* ---------- SERVICE ---------- */
    const coupon = await updateCouponService({
      couponId,
      data: value
    });
    return sendSuccess(
      res,
      coupon,
      200,
      "Coupon updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function filterCouponsByStatus
 *
 * @query
 * {
 *   status?: "active" | "draft",
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Extract pagination params (page, limit, skip)
 * Build filter based on status
 * Fetch coupons with pagination
 * Count total coupons
 * Format coupon response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Coupons fetched successfully",
 *   data: {
 *     coupons: [],
 *     pagination: {
 *       currentPage,
 *       totalPages,
 *       totalCoupons,
 *       limit
 *     },
 *     status
 *   }
 * }
 */

export const filterCouponsByStatus = async (req, res) => {
  try {
    /* ---------- PAGINATION ---------- */
    const { page, limit, skip } = getPagination(req.query);

    /* ---------- QUERY PARAM ---------- */
   const {isActive}  = req.params;

    /* ---------- SERVICE ---------- */
    const { coupons, total } = await filterCouponsService({
      isActive,
      skip,
      limit
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      {
        coupons, // ✅ no formatting
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCoupons: total,
          limit
        },
        status: isActive || "all"
      },
      200,
      "Coupons fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function getSingleCoupon
 *
 * @params
 * couponId: string
 *
 * @process
 * Validate couponId
 * Fetch coupon from database
 * If expired → mark inactive
 * Format coupon response
 *
 * @response
 * 200 Coupon fetched successfully
 * 404 Coupon not found
 */
export const getSingleCoupon = async (req, res) => {
  try {
    const { id: couponId } = req.params;

    if (!couponId) {
      return sendError(res, {
        message: "CouponId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }

    /* ---------- SERVICE ---------- */
    const coupon = await getSingleCouponService({ couponId });    
    return sendSuccess(
      res,
      coupon,
      200,
      "Coupon fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function deleteCoupon
 *
 * @params
 * couponId: string
 *
 * @process
 * Validate couponId
 * Find and delete coupon from database
 * Throw error if not found
 *
 * @response
 * 200 Coupon deleted successfully
 * 404 Coupon not found
 */
export const deleteCoupon = async (req, res) => {
  try {
    const { id: couponId } = req.params;

    if (!couponId) {
      return sendError(res, {
        message: "CouponId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }

    /* ---------- SERVICE ---------- */
    await deleteCouponService({ couponId });
    return sendSuccess(
      res,
      null,
      200,
      "Coupon deleted successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};