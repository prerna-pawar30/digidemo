import { handleError, sendError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import {getPagination} from "../../helpers/pagination.helper.js"
import { addProductService, deleteProductService, duplicateProductService, getBestSellerProductsService, getProductByIdService, getProductsByStatusService, updateProductService, updateProductStockService } from "../../services/product.service.js";
import { ApiResponse } from "../../helpers/apiResponce.js";
import {
  validateProductBody,
  validateProductFiles,
  validateUpdateProductBody,
  validateUpdateProductFiles,
} from "./product.validator.js";
/**
 * @function addProduct
 *
 * @params
 * body: {
 *   name: string,
 *   sku?: string,
 *   price?: number,
 *   category: ObjectId,
 *   brand: ObjectId[],
 *   tags?: string[],
 *   labels?: string[],
 *   shortDescription?: string,
 *
 *   stockType: "PRODUCT" | "VARIANT",
 *   productStock?: number, // required if stockType = PRODUCT
 *
 *   description?: [
 *     {
 *       text: string,
 *       image?: string[]
 *     }
 *   ],
 *
 *   specification?: [
 *     {
 *       key: string,
 *       value: any
 *     }
 *   ],
 *
 *   variants: [
 *     {
 *       name: string,
 *       sku?: string,
 *
 *       attributes?: [
 *         {
 *           key: string,
 *           value: string[]
 *         }
 *       ],
 *
 *       priceType: "PRODUCT" | "VARIANT",
 *       variantPrice?: number, // required if priceType = VARIANT
 *
 *       imageType: "PRODUCT" | "VARIANT",
 *       variantImages?: string[],
 *
 *       variantStock?: number // required if stockType = VARIANT
 *     }
 *   ],
 *
 *   status?: "draft" | "active",
 *   material?: "Titanium" | "Stainless Steel",
 *   seriesNumber?: string,
 *   subSeriesNumber?: string,
 *
 *   images?: string[],
 *   metadata?: object,
 *
 *   // extra fields (optional)
 *   permission?: string,
 *   descriptionImageMap?: number[],
 *   variantImageMap?: number[]
 * }
 *
 * files (multipart/form-data):
 * {
 *   productImages?: File[],
 *   variantImages?: File[],
 *   descriptionImages?: File[]
 * }
 *
 * @process
 * 1. Validate request body using Joi schema
 * 2. Validate required file uploads (productImages, variantImages if needed)
 * 3. Fetch employee using authenticated user (req.user)
 * 4. Generate unique productId (UUID v6)
 * 5. Upload product images to storage (S3 or similar)
 * 6. Process description and attach paragraphId + images
 * 7. Process specification and generate specId
 * 8. Process variants:
 *    - Generate variantId
 *    - Attach variant images
 *    - Generate attribute IDs
 * 9. Apply stock rules:
 *    - If PRODUCT → use productStock
 *    - If VARIANT → each variant must have variantStock
 * 10. Save product in database
 * 11. Create permission audit log entry
 * 12. Rollback uploaded files if any failure occurs
 * 13. Return success response
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Product added successfully",
 *   data: {
 *     productId: string
 *   }
 * }
 *
 * @errors
 * 400 VALIDATION_ERROR:
 *   - Missing or invalid fields
 *
 * 400 FILE_VALIDATION_ERROR:
 *   - Missing required images (productImages / variantImages)
 *
 * 404:
 *   - Employee not found
 *
 * 500:
 *   - Internal server error (DB / upload failure)
 *
 * @notes
 * - At least one variant is required
 * - Product must have at least one image
 * - category and brand must be valid ObjectIds
 * - variantStock is required when stockType = VARIANT
 * - variantPrice is required when priceType = VARIANT
 * - variantImages required when imageType = VARIANT
 * - All IDs (productId, variantId, specId, paragraphId) are auto-generated
 * - Images are uploaded externally and stored as URLs
 * - File upload uses multipart/form-data
 */
export const addProduct = async (req, res) => {
  try {
    /* ---------- VALIDATE BODY ---------- */
    const { value, error } = validateProductBody(req.body);
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }
    /* ---------- AUTH CHECK ---------- */
    if (!req.user) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }
    /* ---------- VALIDATE FILES ---------- */
    try {
      validateProductFiles(value, req.files);
    } catch (fileError) {
      return sendError(res, {
        message: fileError.message || "Invalid files",
        statusCode: 400,
        errorCode: "FILE_VALIDATION_ERROR",
      });
    }
    /* ---------- SERVICE ---------- */
    const product = await addProductService({
      body: value,
      files: req.files,
      user: req.user,
    });
    /* ---------- SUCCESS ---------- */
    return sendSuccess(
      res,
      { productId: product.productId },
      201,
      "Product added successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateProduct
 *
 * @params
 * params: {
 *   productId: string (UUID) // required
 * }
 *
 * body (all fields optional - PATCH behavior): {
 *   name?: string,
 *   sku?: string,
 *   price?: number,
 *   category?: ObjectId,
 *   brand?: ObjectId[],
 *   tags?: string[],
 *   labels?: string[],
 *   shortDescription?: string,
 *
 *   stockType?: "PRODUCT" | "VARIANT",
 *   productStock?: number,
 *
 *   description?: [
 *     {
 *       paragraphId?: string,
 *       text: string,
 *       image?: string[]
 *     }
 *   ],
 *
 *   specification?: [
 *     {
 *       specId?: string,
 *       key: string,
 *       value: any
 *     }
 *   ],
 *
 *   variants?: [
 *     {
 *       variantId?: string,
 *       name: string,
 *       sku?: string,
 *
 *       attributes?: [
 *         {
 *           attrId?: string,
 *           key: string,
 *           value: string[]
 *         }
 *       ],
 *
 *       priceType?: "PRODUCT" | "VARIANT",
 *       variantPrice?: number,
 *
 *       imageType?: "PRODUCT" | "VARIANT",
 *       variantImages?: string[],
 *
 *       variantStock?: number
 *     }
 *   ],
 *
 *   status?: "draft" | "active",
 *   material?: "Titanium" | "Stainless Steel",
 *   seriesNumber?: string,
 *   subSeriesNumber?: string,
 *
 *   images?: string[],
 *   metadata?: object,
 *
 *   removeImages?: string[],
 *   removeDescImages?: string[],
 *   removeVariantImages?: string[],
 *
 *   descriptionImageMap?: number[],
 *   variantImageMap?: number[],
 *
 *   permission?: string
 * }
 *
 * files (multipart/form-data):
 * {
 *   productImages?: File[],
 *   descriptionImages?: File[],
 *   variantImages?: File[]
 * }
 *
 * @process
 * 1. Validate request body (all fields optional)
 * 2. Validate file inputs (if variant images required)
 * 3. Fetch product using productId
 * 4. Fetch employee using authenticated user (req.user)
 *
 * 5. Update basic fields (excluding blocked fields)
 *
 * 6. Handle product images:
 *    - Remove images from S3 if removeImages provided
 *    - Upload new product images
 *
 * 7. Handle description:
 *    - Remove selected description images
 *    - Map uploaded images using descriptionImageMap
 *    - Generate paragraphId if not provided
 *
 * 8. Handle variants:
 *    - Remove selected variant images
 *    - Map uploaded images using variantImageMap
 *    - Generate variantId if missing
 *    - Generate attrId for attributes
 *
 * 9. Apply stock logic:
 *    - If PRODUCT → variantStock ignored
 *    - If VARIANT → each variant must have variantStock
 *
 * 10. Save updated product in database
 *
 * 11. Create permission audit log entry
 *
 * 12. Rollback uploaded files if any error occurs
 *
 * 13. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Product updated successfully",
 *   data: {
 *     productId: string
 *   }
 * }
 *
 * @errors
 * 400 VALIDATION_ERROR:
 *   - Invalid or malformed fields
 *
 * 400 FILE_VALIDATION_ERROR:
 *   - Missing required variant images when imageType = VARIANT
 *
 * 400:
 *   - Invalid stock configuration (variantStock missing)
 *
 * 404:
 *   - Product not found
 *   - Employee not found
 *
 * 500:
 *   - Internal server error (DB / upload failure)
 *
 * @notes
 * - This API follows PATCH behavior (partial update)
 * - Only provided fields are updated
 * - Existing data remains unchanged if not included
 *
 * - Image removal is handled via:
 *   - removeImages
 *   - removeDescImages
 *   - removeVariantImages
 *
 * - Image mapping is handled via:
 *   - descriptionImageMap
 *   - variantImageMap
 *
 * - If variantId / paragraphId / attrId not provided,
 *   they are auto-generated
 *
 * - When stockType = VARIANT:
 *   every variant must have valid variantStock
 *
 * - When stockType = PRODUCT:
 *   variantStock is ignored
 *
 * - Images are stored externally (e.g., S3) and saved as URLs
 *
 * - File upload requires multipart/form-data
 *
 * - Audit log is created for tracking updates
 */
export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    /* ---------- VALIDATE BODY ---------- */
    const { value, error } = validateUpdateProductBody(req.body);
    if (error) {
      return sendError(res, error);
    }
    /* ---------- VALIDATE FILES ---------- */
    validateUpdateProductFiles(value, req.files);
    /* ---------- SERVICE ---------- */
    const product = await updateProductService({
      productId,
      body: value,
      files: req.files,
      user: req.user,
    });
    return sendSuccess(
      res,
      { productId: product.productId },
      200,
      "Product updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getProductsByStatus
 *
 * @query
 * {
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   category?: ObjectId,
 *   brand?: ObjectId,
 *   minPrice?: number,
 *   maxPrice?: number,
 *   status?: "active" | "draft" | "all",
 *   sortBy?: "name" | "price" | "createdAt",
 *   sortOrder?: "asc" | "desc"
 * }
 *
 * @process
 * 1. Extract pagination using utility
 * 2. Validate status & sorting inputs
 * 3. Build MongoDB filter dynamically
 * 4. Apply search, category, brand, price filters
 * 5. Execute query with:
 *    - pagination (skip, limit)
 *    - sorting
 *    - population
 * 6. Count total documents
 * 7. Handle page overflow safely
 * 8. Return structured JSON response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: string,
 *   data: {
 *     totalProducts: number,
 *     totalPages: number,
 *     currentPage: number,
 *     nextPage: number | null,
 *     prevPage: number | null,
 *     products: []
 *   }
 * }
 *
 * @errors
 * 400 - Invalid query params
 * 500 - Server error
 *
 * @notes
 * - No custom response wrapper (clean JSON response)
 * - Pagination is reusable via utility
 * - limit is capped (max 100)
 * - lean() improves performance
 * - populate fetches minimal fields
 * - safe sorting (whitelisted fields)
 */
export const getProductsByStatus = async (req, res) => {
  try {
    /* ---------------- PAGINATION ---------------- */
    const pagination = getPagination(req.query);

    /* ---------------- QUERY PARAMS ---------------- */
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status = req.params.status || "all",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    /* ---------------- VALIDATION ---------------- */
    const allowedStatus = ["active", "draft", "all"];
    if (!allowedStatus.includes(status)) {
      return sendError(res, {
        message: "Invalid status value",
        statusCode: 400,
        errorCode: "INVALID_STATUS",
      });
    }

    const allowedSortFields = ["name", "price", "createdAt"];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

    /* ---------------- SERVICE CALL ---------------- */
    const result = await getProductsByStatusService({
      pagination,
      filters: {
        search,
        category,
        brand,
        minPrice,
        maxPrice,
        status,
        sortBy: safeSortBy,
        sortOrder: safeSortOrder,
      },
    });

    const { products, totalProducts } = result;

    const totalPages = Math.ceil(totalProducts / pagination.limit);
    const currentPage = pagination.page;

    /* ---------------- PAGE OVERFLOW ---------------- */
    if (totalPages > 0 && currentPage > totalPages) {
      return sendSuccess(
        res,
        {
          pagination: {
            totalItems: totalProducts,
            totalPages,
            currentPage,
            nextPage: null,
            prevPage: totalPages,
            limit: pagination.limit,
          },
          products: [],
        },
        200,
        "Page out of range"
      );
    }

    /* ---------------- SUCCESS ---------------- */
    return sendSuccess(
      res,
      {
        pagination: {
          totalItems: totalProducts,
          totalPages,
          currentPage,
          nextPage: currentPage < totalPages ? currentPage + 1 : null,
          prevPage: currentPage > 1 ? currentPage - 1 : null,
          limit: pagination.limit,
        },
        products,
      },
      200,
      "Products fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getProductById
 *
 * @params
 * params: {
 *   productId: string (UUID)
 * }
 *
 * @process
 * 1. Validate productId param
 * 2. Fetch product from database
 * 3. Populate related fields (brand, category)
 * 4. If product not found → return error
 * 5. Return product data
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Product fetched successfully",
 *   data: { ...product }
 * }
 */
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    /* ---------------- VALIDATION ---------------- */
    if (!productId) {
      return sendError(res, {
        message: "productId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    /* ---------------- SERVICE CALL ---------------- */
    const product = await getProductByIdService(productId);
    /* ---------------- SUCCESS ---------------- */
    return sendSuccess(
      res,
      product,
      200,
      "Product fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getBestSellerProducts
 *
 * @params
 * none
 *
 * @process
 * 1. Fetch products with:
 *    - status = "active"
 *    - labels includes "best_selling"
 * 2. Populate:
 *    - brand (brandName)
 *    - category (name)
 * 3. Sort products by name (ascending)
 * 4. Return product list
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Best selling products fetched successfully",
 *   data: [ ...products ]
 * }
 */
export const getBestSellerProducts = async (req, res) => {
  try {
    /* ---------------- SERVICE CALL ---------------- */
    const products = await getBestSellerProductsService();
    /* ---------------- SUCCESS ---------------- */
    return sendSuccess(
      res,
      products,
      200,
      "Best selling products fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deleteProduct
 *
 * @params
 * params: {
 *   productId: string (UUID)
 * }
 *
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate productId
 * 2. Fetch employee from authenticated user
 * 3. Delete product from database
 * 4. Create permission audit log
 * 5. Return deleted product
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Product deleted successfully",
 *   data: { ...product }
 * }
 */
export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { permission} = req.body;
    /* ---------------- VALIDATION ---------------- */
    if (!productId) {
      return sendError(res, {
        message: "productId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    /* ---------------- SERVICE CALL ---------------- */
    const result = await deleteProductService({
      productId,
      userEmail: req.user?.email,
      permission,
    });
    /* ---------------- SUCCESS ---------------- */
    return sendSuccess(
      res,
      result,
      200,
      "Product deleted successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateProductStock
 *
 * @params
 * params: {
 *   productId: string (UUID)
 * }
 *
 * body: {
 *   stockType: "PRODUCT" | "VARIANT",
 *   productStock?: number,
 *   variantStocks?: [
 *     {
 *       variantId: string,
 *       stock: number
 *     }
 *   ],
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate productId & stockType
 * 2. Call service layer
 * 3. Handle errors (product/employee not found, validation)
 * 4. Return updated product
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Stock updated successfully",
 *   data: { ...product }
 * }
 */
export const updateProductStock = async (req, res) => {
  try {
    const result = await updateProductStockService({
      productId: req.params.productId,
      userEmail: req.user?.email,
      stockType: req.body.stockType,
      productStock: req.body.productStock,
      variantStocks: req.body.variantStocks,
      permission: req.body.permission,
    });

    return sendSuccess(
      res,
      result,
      200,
      "Stock updated successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function duplicateProduct
 *
 * @process
 * 1. Validate productId
 * 2. Fetch original product
 * 3. Fetch employee
 * 4. Convert product to plain object
 * 5. Remove DB-specific fields (_id, timestamps)
 * 6. Generate new productId
 * 7. Modify product name (Copy)
 * 8. Regenerate all nested IDs:
 *    - description.paragraphId
 *    - specification.specId
 *    - variants.variantId
 *    - attributes.attrId
 * 9. Create new product
 * 10. Create permission audit log
 * 11. Return duplicated product
 *
 * @errors
 * 400:
 *   - Missing productId
 *
 * 404:
 *   - Product not found
 *   - Employee not found
 *
 * @notes
 * - Deep cloning avoids reference issues
 * - Unique IDs prevent collisions
 * - Audit ensures traceability
 */
export const duplicateProduct = async (req, res) => {
  try {
    const result = await duplicateProductService({
      productId: req.body.productId,
      userEmail: req.user?.email,
      permission: req.body.permission,
    });

    return sendSuccess(
      res,
      result,
      201,
      "Product duplicated successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};