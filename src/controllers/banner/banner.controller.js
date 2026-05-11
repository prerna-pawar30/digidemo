import { handleError, sendError } from "../../helpers/error.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import Employee from "../../models/manage/employee.model.js";
import { createBannerService, deleteBannerService, getAllBannersService, getBannersByIsActiveService, getProductsByBannerService, updateBannerDisplayOrderService, updateBannerService } from "../../services/banner.service.js";
import { createBannerValidator } from "./banner.validator.js";

/**
 * @function createBanner
 *
 * @params
 * body: {
 *   filterBy?: string,
 *   filterId?: string,
 *   isActive?: boolean,
 *   displayOrder: number,
 *   permission?: string
 * }
 * file: image (required)
 *
 * @process
 * Validate request body using Joi
 * Ensure image file is provided
 * Fetch employee using req.user.email
 * Check displayOrder uniqueness for active banners
 * Upload image to S3
 * Create banner in database
 * Create audit log entry
 *
 * @response
 * 201 { success: true, message: "Banner created successfully", data: banner }
 */
export const createBanner = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = createBannerValidator.validate(req.body,{
      abortEarly: false
    });
    if(error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map(e => e.message)
      });
    }
    const { filterBy, filterId, isActive, displayOrder, permission } = value;
    if (!req.file) {
      return sendError(res, {
        message: "Banner image is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({
      email: req.user.email
    });
    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    }
    const result = await createBannerService({
      filterBy,
      filterId,
      isActive,
      displayOrder,
      file: req.file,
      employee,
      permission
    });

    return sendSuccess(
      res,
      result,
      201,
      "Banner created successfully"
    );

  } catch (error) {
    console.error("Create Banner Error:", error);
    return handleError(res, error);
  }
};


/**
 * @function getProductsByBanner
 *
 * @params
 * params: {
 *   bannerId: string
 * }
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Extract bannerId from params
 * Get pagination values
 * Find active banner
 * Apply filter based on banner type (category/brand)
 * Fetch products with pagination
 * Populate category and brand details
 *
 * @response
 * 200 { success: true, message: "Products fetched by banner", data: { products, pagination } }
 */
export const getProductsByBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    if (!bannerId){
      return sendError(res, {
        message: "BannerId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const { page, limit, skip } = getPagination(req.query);
    const result = await getProductsByBannerService({
      bannerId,
      page,
      limit,
      skip
    });
    return sendSuccess(
      res,
      result,
      200,
      "Products fetched by banner"
    );
  } catch (error) {
    console.error("Get Products By Banner Error:", error);
    return handleError(res, error);
  }
};


/**
 * @function getAllBanners
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Retrieve pagination values using shared pagination utility
 * Fetch active banners from database
 * Sort banners by displayOrder (ascending)
 * Apply pagination (skip & limit)
 * Count total banners
 * Return paginated banners with metadata
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Banners fetched successfully",
 *   data: {
 *     banners,
 *     pagination: {
 *       currentPage,
 *       totalPages,
 *       totalBanners,
 *       limit
 *     }
 *   }
 * }
 */
export const getAllBanners = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const result = await getAllBannersService({
      page,
      limit,
      skip
    });
    return sendSuccess(
      res,
      result,
      200,
      "Banners fetched successfully"
    );
  }catch (error) {
    console.error("Get Banners Error:", error);
    return handleError(res, error);
  }
};


/**
 * @function updateBanner
 *
 * @params
 * params: {
 *   bannerId: string
 * }
 * body: {
 *   filterBy?: string,
 *   filterId?: string,
 *   isActive?: boolean,
 *   displayOrder?: number,
 *   permission?: string
 * }
 * file?: image
 *
 * @process
 * Extract bannerId from params
 * Fetch employee using req.user.email
 * Check displayOrder conflict for active banners
 * If image provided:
 *   Delete old image from S3
 *   Upload new image
 * Update banner fields
 * Save banner
 * Create audit log entry
 *
 * @response
 * 200 { success: true, message: "Banner updated successfully", data: banner }
 */
export const updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { filterBy, filterId, isActive, displayOrder, permission } = req.body;

    if (!bannerId) {
      return sendError(res, {
        message: "BannerId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({
      email: req.user.email
    });

    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    }

    const result = await updateBannerService({
      bannerId,
      filterBy,
      filterId,
      isActive,
      displayOrder,
      file: req.file,
      employee,
      permission
    });

    return sendSuccess(
      res,
      result,
      200,
      "Banner updated successfully"
    );
  } catch (error) {
    console.error("Update Banner Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function updateBannerDisplayOrder
 *
 * @params
 * params: {
 *   bannerId: string
 * }
 * body: {
 *   displayOrder: number,
 *   permission?: string
 * }
 *
 * @process
 * Extract bannerId from params
 * Validate displayOrder (>=1)
 * Fetch employee using req.user.email
 * Check displayOrder conflict for active banners
 * Update banner displayOrder
 * Save banner
 * Create audit log entry
 *
 * @response
 * 200 { success: true, message: "Display order updated successfully", data: banner }
 */
export const updateBannerDisplayOrder = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { displayOrder, permission } = req.body;
    if (!bannerId){
      return sendError(res, {
        message: "BannerId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    if (!displayOrder || displayOrder < 1) {
      return sendError(res, {
        message: "displayOrder must be >= 1",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({
      email: req.user.email
    });

    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    }

    const result = await updateBannerDisplayOrderService({
      bannerId,
      displayOrder,
      employee,
      permission
    });
    return sendSuccess(
      res,
      result,
      200,
      "Display order updated successfully"
    );
  } catch (error) {
    console.error("Update Banner Order Error:", error);
    return handleError(res, error);
  }
};


/**
 * @function deleteBanner
 *
 * @params
 * params: {
 *   bannerId: string
 * }
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * Extract bannerId from params
 * Fetch employee using req.user.email
 * Find banner by bannerId
 * Delete banner image from S3
 * Delete banner from database
 * Create audit log entry
 *
 * @response
 * 200 { success: true, message: "Banner deleted successfully" }
 */
export const deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { permission } = req.body;
    if (!bannerId) {
      return sendError(res, {
        message: "BannerId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({
      email: req.user.email
    });

    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    }

    await deleteBannerService({
      bannerId,
      employee,
      permission
    });

    return sendSuccess(
      res,
      null,
      200,
      "Banner deleted successfully"
    );

  } catch (error) {
    console.error("Delete Banner Error:", error);
    return handleError(res, error);
  }
};


/**
 * @function getBannersByIsActive
 *
 * @params
 * query: {
 *   isActive: boolean (true | false),
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Extract isActive from query
 * Convert isActive string to boolean
 * Retrieve pagination values
 * Fetch banners filtered by isActive
 * Sort by displayOrder
 * Return paginated banners
 *
 * @response
 * 200 { success: true, message: "Banners fetched successfully", data: { banners, pagination } }
 */
export const getBannersByIsActive = async (req, res) => {
  try{
    const { isActive } = req.query;
    if (isActive === undefined){
      return sendError(res, {
        message: "isActive query param is required (true | false)",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    /* ---------- CONVERT TO BOOLEAN ---------- */
    const isActiveBool =
      isActive === "true" ? true :
      isActive === "false" ? false : null;
    if (isActiveBool === null) {
      return sendError(res, {
        message: "isActive must be true or false",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const { page, limit, skip } = getPagination(req.query);
    const result = await getBannersByIsActiveService({
      isActive: isActiveBool,
      page,
      limit,
      skip
    });
    return sendSuccess(
      res,
      result,
      200,
      "Banners fetched successfully"
    );
  }catch (error) {
    console.error("Get Banners By Status Error:", error);
    return handleError(res, error);
  }
};