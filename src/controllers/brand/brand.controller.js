import { handleError, sendError } from "../../helpers/error.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import Employee from "../../models/manage/employee.model.js";
import { createBrandService, deleteAllBrandsService, deleteBrandService, getAllBrandsService, getBrandByIdService, updateBrandService } from "../../services/brand.service.js";
import { createBrandValidator, updateBrandValidator } from "./ brand.validator.js";

/**
 * @function createBrand
 *
 * @route POST /api/brand
 *
 * @description
 * Create a new brand with logo and optional categorized files.
 *
 * @process
 * 1. Validate request body using Joi.
 * 2. Extract files from req.files.
 * 3. Fetch employee from req.user.
 * 4. Call createBrandService.
 * 5. Return created brand.
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Brand created successfully",
 *   data: BrandObject
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 404 - EMPLOYEE_NOT_FOUND
 * 409 - BRAND_ALREADY_EXISTS
 * 500 - INTERNAL_SERVER_ERROR
 */
export const createBrand = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = createBrandValidator.validate(req.body, {
      abortEarly: false
    });
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    const { brandName, categories, permission } = value;
    const logoFile = req.files?.logoUrl?.[0];
    const files = req.files?.file || [];

    if (!logoFile) {
      return sendError(res, {
        message: "Logo is required",
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
    const result = await createBrandService({
      brandName,
      categories,
      files,
      logoFile,
      employee,
      permission
    });
    return sendSuccess(
      res,
      result,
      201,
      "Brand created successfully"
    );
    }catch (error) {
    console.error("Create Brand Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function updateBrand
 *
 * @route PUT /api/brand/:brandId
 *
 * @description
 * Update brand details including:
 * - brand brandName
 * - logo
 * - add/remove files
 *
 * @process
 * 1. Validate request body
 * 2. Extract params + files
 * 3. Fetch employee
 * 4. Call service
 * 5. Return updated brand
 *
 * @response
 * 200 - Brand updated successfully
 *
 * @errors
 * 400 - Validation error
 * 404 - Brand/Employee not found
 * 409 - Duplicate brand brandName
 * 500 - Internal server error
 */
export const updateBrand = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = updateBrandValidator.validate(req.body, {
      abortEarly: false
    });

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message)
      });
    }

    const { brandName, categories, removeFileIds, permission } = value;

    const brandId = req.params.brandId;

    if (!brandId) {
      return sendError(res, {
        message: "BrandId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }

    const logoFile = req.files?.logoUrl?.[0];
    const files = req.files?.file || [];

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

    const result = await updateBrandService({
      brandId,
      brandName,
      categories,
      removeFileIds,
      files,
      logoFile,
      employee,
      permission
    });

    return sendSuccess(
      res,
      result,
      200,
      "Brand updated successfully"
    );

  } catch (error) {

    console.error("Update Brand Error:", error);

    return handleError(res, error);

  }
};


/**
 * @function getAllBrands
 * @route GET /api/brands
 *
 * @description
 * Fetch all brands with pagination
 */
export const getAllBrands = async (req, res) => {
  try {

    const { page, limit, skip } = getPagination(req.query);

    const result = await getAllBrandsService({ page, limit, skip });

    return sendSuccess(
      res,
      result,
      200,
      "Brands fetched successfully"
    );

  } catch (error) {

    console.error("Get Brands Error:", error);

    return handleError(res, error);

  }
};


/**
 * @function getBrandById
 * @route GET /api/brand/:brandId
 *
 * @description
 * Fetch a single brand by its ID
 */
export const getBrandById = async (req, res) => {
  try {

    const { brandId } = req.params;

    const result = await getBrandByIdService(brandId);

    return sendSuccess(
      res,
      result,
      200,
      "Brand fetched successfully"
    );

  } catch (error) {

    console.error("Get Brand By ID Error:", error);

    return handleError(res, error);

  }
};

/**
 * @function deleteBrandByBrandId
 *
 * @params
 * params: {
 *   brandId: string
 * }
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * Validate brandId from request params
 * Fetch employee using req.user.email
 * Check permission (only "delete_brand" allowed if provided)
 * Find brand by brandId
 * Delete logo from S3 if exists
 * Delete all associated files from S3
 * Delete brand from database
 * Create audit log entry
 *
 * @response
 * 200 { success: true, message: "Brand deleted successfully", data: null }
 */
export const deleteBrandByBrandId = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { permission } = req.body;
    if (!brandId) {
      return sendError(res, {
        message: "BrandId is required",
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

    await deleteBrandService({
      brandId,
      employee,
      permission
    });

    return sendSuccess(
      res,
      null,
      200,
      "Brand deleted successfully"
    );
  } catch (error) {
    console.error("Delete Brand Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteAllBrands
 *
 * @params
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * Fetch employee using req.user.email
 * Check permission (only "delete_brand" allowed if provided)
 * Fetch all brands from database
 * Loop through each brand:
 *   Delete logo from S3 if exists
 *   Delete all associated files from S3
 * Delete all brands using deleteMany()
 * Create single audit log entry for bulk delete
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All brands deleted successfully",
 *   data: { deletedCount }
 * }
 */
export const deleteAllBrands = async (req, res) => {
  try {

    const { permission } = req.body;

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

    const result = await deleteAllBrandsService({
      employee,
      permission
    });

    return sendSuccess(
      res,
      result,
      200,
      "All brands deleted successfully"
    );
  } catch (error) {
    console.error("Delete All Brands Error:", error);
    return handleError(res, error);
  }
};