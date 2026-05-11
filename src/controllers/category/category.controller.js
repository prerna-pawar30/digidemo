import { handleError, sendError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { createCategoryService, deleteCategoryService, getAllCategoriesService, updateCategoryService } from "../../services/category.service.js";
import { createCategoryValidator, updateCategoryValidator } from "./category.validator.js";
import Employee from "../../models/manage/employee.model.js";
import { getPagination } from "../../helpers/pagination.helper.js";

/**
 * @function createCategory
 *
 * @params
 * body: {
 *   name: string,
 *   permission?: string
 * }
 * file: image (required)
 *
 * @process
 * Validate request body using Joi
 * Check if image file is provided
 * Fetch employee using req.user.email
 * Call createCategoryService
 * Return created category
 *
 * @response
 * 201 { success: true, message: "Category created successfully", data: category }
 */
export const createCategory = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = createCategoryValidator.validate(req.body, {
      abortEarly: false
    });
    if (error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map(e => e.message)
      });
    }
    const { name, permission } = value;
    if (!req.file) {
      return sendError(res, {
        message: "Image file is required",
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

    const result = await createCategoryService({
      name,
      file: req.file,
      employee,
      permission
    });
    return sendSuccess(
      res,
      result,
      201,
      "Category created successfully"
    );
  } catch (error) {
    console.error("Create Category Error:", error);
    return handleError(res, error);
  }
};


/**
 * @function updateCategory
 *
 * @params
 * params: {
 *   categoryId: string
 * }
 * body: {
 *   name: string,
 *   permission?: string
 * }
 * file?: image
 *
 * @process
 * Validate request body using Joi
 * Extract categoryId from params
 * Fetch employee using req.user.email
 * Call updateCategoryService
 * Return updated category
 *
 * @response
 * 200 { success: true, message: "Category updated successfully", data: category }
 */
export const updateCategory = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = updateCategoryValidator.validate(req.body, {
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
    const { name, permission } = value;
    const { categoryId } = req.params;
    if (!categoryId) {
      return sendError(res, {
        message: "CategoryId is required",
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
    const result = await updateCategoryService({
      categoryId,
      name,
      file: req.file,
      employee,
      permission
    });

    return sendSuccess(
      res,
      result,
      200,
      "Category updated successfully"
    );

  } catch (error) {

    console.error("Update Category Error:", error);

    return handleError(res, error);

  }
};


/**
 * @function deleteCategory
 *
 * @params
 * params: {
 *   categoryId: string
 * }
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * Extract categoryId from params
 * Fetch employee using req.user.email
 * Call deleteCategoryService
 * Return success response
 *
 * @response
 * 200 { success: true, message: "Category deleted successfully" }
 */
export const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { permission } = req.body;

    if (!categoryId) {
      return sendError(res, {
        message: "CategoryId is required",
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

    await deleteCategoryService({
      categoryId,
      employee,
      permission
    });

    return sendSuccess(
      res,
      null,
      200,
      "Category deleted successfully"
    );

  } catch (error) {

    console.error("Delete Category Error:", error);

    return handleError(res, error);

  }
};


/**
 * @function getAllCategories
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Retrieve pagination values using shared pagination utility
 * Fetch categories from database sorted by name
 * Apply pagination (skip & limit)
 * Count total categories
 * Return paginated categories with pagination metadata
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Categories fetched successfully",
 *   data: {
 *     categories,
 *     pagination: {
 *       currentPage,
 *       totalPages,
 *       totalCategories,
 *       limit
 *     }
 *   }
 * }
 */
export const getAllCategories = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const result = await getAllCategoriesService({
      page,
      limit,
      skip
    });
    return sendSuccess(
      res,
      result,
      200,
      "Categories fetched successfully"
    );
  } catch (error) {
    console.error("Get Categories Error:", error);
    return handleError(res, error);
  }
};