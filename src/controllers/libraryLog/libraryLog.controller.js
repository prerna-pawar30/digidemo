import { handleError, sendError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import {sendEmailOtpValidator, updateScanbridgeLibraryValidator, verifyOtpAndCreateCustomerValidator} from "./libaryLog.validator.js"
import { sendEmailOtpService, verifyOtpAndCreateCustomerService, getAllConsumersService, getEmailVerifyDummyService, getLibraryDashboardService, deleteOtpByEmailService, getScanbridgeLibraryService, updateScanbridgeLibraryService } from "../../services/libraryLog.service.js";
import CustomerData from "../../models/ecommarace/customerData.model.js";
import EmailVerifyDummy from "../../models/ecommarace/dummyemailverify.model.js";
import { getPagination } from "../../helpers/pagination.helper.js";

/**
 * @function sendEmailOtp
 *
 * @description
 * Sends an OTP to the user's email for verification. If the email is already
 * verified, skips OTP flow and logs the requested library access.
 *
 * @params
 * body: {
 *   email: string,
 *   libraryObjectId: string,
 *   libraryId: string,
 *   brand: string,
 *   category: string
 * }
 *
 * @process
 * 1. Validate input
 *    - Ensure all required fields are present
 *
 * 2. Check existing user
 *    - If user exists AND email is already verified:
 *        → Skip OTP generation
 *        → Log library access directly
 *        → Return success (isVerified: true)
 *
 * 3. Generate OTP
 *    - Create 6-digit OTP
 *    - Set expiry (5 minutes)
 *
 * 4. Store OTP
 *    - Upsert into EmailVerifyDummy collection
 *
 * 5. Send OTP email
 *    - Use email template
 *    - Send via Zoho Mail service
 *
 * 6. Return response
 *    - Indicate verification required
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "OTP sent to email successfully",
 *   data: {
 *     isVerified: false
 *   }
 * }
 *
 * @alternate_response
 * 200 {
 *   success: true,
 *   message: "Email already verified. Library logged successfully.",
 *   data: {
 *     isVerified: true
 *   }
 * }
 *
 * @errors
 * 400: Missing required fields
 * 500: Email sending or DB failure
 */

/**
 * @function sendEmailOtp
 *
 * @params
 * req.body = {
 *   email
 * }
 *
 * @process
 * 1. Validate request body
 * 2. Call sendEmailOtpService
 * 3. If email already verified, return verified response
 * 4. Otherwise generate OTP, save it, and send email
 *
 * @response
 * 200 - Email already verified / OTP sent successfully
 * 400 - Validation failed
 * 500 - Internal server error
 */
export const sendEmailOtp = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = sendEmailOtpValidator.validate(req.body,{
      abortEarly: false
    });
    if (error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message)
      });
    }
    /* ---------- SERVICE ---------- */
    const result = await sendEmailOtpService(value);
    return sendSuccess(
      res,
      result,
      200,
      result.isVerified
        ? "Email already verified"
        : "OTP sent to email successfully"
    );
  } catch (error) {
    console.error("sendEmailOtp Controller Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function verifyOtpAndCreateCustomer
 *
 * @description
 * Verifies OTP and creates a new customer account.
 *
 * @params
 * body: {
 *   email: string,
 *   otp: string,
 *   firstName: string,
 *   lastName: string,
 *   mobileNumber: string,
 *   companyName: string,
 *   address: {
 *     line1: string,
 *     city: string,
 *     state: string,
 *     postalCode: string,
 *     country: string
 *   }
 * }
 *
 * @process
 * 1. Validate request body using Joi
 * 2. Normalize email to lowercase
 * 3. Fetch OTP record from DB
 * 4. Validate:
 *    - OTP exists
 *    - OTP matches
 *    - OTP not expired
 * 5. Check if customer already exists
 *    - If yes → return verified response
 * 6. Create new customer with verified email
 * 7. Delete OTP record after success
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "OTP verified and customer created" | "Email already verified",
 *   data: {
 *     userId,
 *     email,
 *     isVerified: true
 *   }
 * }
 *
 * @errors
 * 400 VALIDATION_ERROR → Missing or invalid fields
 * 400 INVALID_OTP → Wrong OTP
 * 400 OTP_EXPIRED → OTP expired
 * 400 OTP_NOT_FOUND → No OTP record
 * 500 INTERNAL_SERVER_ERROR → Server error
 */

/**
 * @function verifyOtpAndCreateCustomer
 *
 * @params
 * req.body = {
 *   email,
 *   otp,
 *   libraryObjectId,
 *   libraryId,
 *   brand,
 *   category,
 *   firstName,
 *   lastName,
 *   mobileNumber,
 *   companyName,
 *   address
 * }
 *
 * @process
 * 1. Validate request body
 * 2. Call verifyOtpAndCreateCustomerService
 * 3. Return success response
 *
 * @response
 * 200 - OTP verified and customer created successfully / Email already verified, library log updated
 * 400 - Validation failed
 * 500 - Internal server error
 */
export const verifyOtpAndCreateCustomer = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = verifyOtpAndCreateCustomerValidator.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message)
      });
    }
    /* ---------- SERVICE ---------- */
    const result = await verifyOtpAndCreateCustomerService(value);
    return sendSuccess(res, result, 200, result.message);
  } catch (error) {
    console.error("verifyOtpAndCreateCustomer Controller Error:", error);
    return handleError(res, error);
  }
};
/**
 * @function getCustomerData
 *
 * @description
 * Fetch customer details using customerId.
 *
 * @params
 * params: {
 *   customerId: string
 * }
 *
 * @process
 * 1. Validate customerId from request params
 * 2. Fetch customer from database using customerId
 * 3. If not found → throw error
 * 4. Return retrieved customer data
 *
 * @errors
 * 400 VALIDATION_ERROR → customerId missing
 * 404 USER_NOT_FOUND → Customer not found
 * 500 INTERNAL_SERVER_ERROR → Server error
 */
export const getCustomerData = async (req, res) => {
  try {
    const { customerId } = req.params;
    /* ---------- VALIDATION ---------- */
    if (!customerId) {
      return sendError(res, {
        message: "customerId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const user = await CustomerData.findOne({ customerId }).lean();
    if (!user) {
      throw {
        message: "User not found",
        statusCode: 404
      };
    }
    return sendSuccess(
      res,
      user,
      200,
      "User data retrieved successfully"
    );
  } catch (error) {
    console.error("Get Customer Data Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteCustomerData
 *
 * @description
 * Deletes a customer using customerId.
 *
 * @params
 * params: {
 *   customerId: string
 * }
 *
 * @process
 * 1. Validate customerId from request params
 * 2. Find and delete customer from database
 * 3. If not found → throw error
 * 4. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "User data deleted successfully"
 * }
 *
 * @errors
 * 400 VALIDATION_ERROR → customerId missing
 * 404 USER_NOT_FOUND → Customer not found
 * 500 INTERNAL_SERVER_ERROR → Server error
 */
export const deleteCustomerData = async (req, res) => {
  try {
    const { customerId } = req.params;
    /* ---------- VALIDATION ---------- */
    if (!customerId) {
      return sendError(res, {
        message: "customerId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const user = await CustomerData.findOneAndDelete({ customerId });
    if (!user) {
      throw {
        message: "User not found",
        statusCode: 404
      };
    }
    return sendSuccess(
      res,
      null,
      200,
      "User data deleted successfully"
    );
  } catch (error) {
    console.error("Delete Customer Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getAllConsumers
 *
 * @description
 * Fetch all customers with pagination support.
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * 1. Extract pagination values using shared utility (getPagination)
 * 2. Fetch customers from database with sorting (latest first)
 * 3. Count total number of customers
 * 4. Return paginated result with metadata
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All consumers retrieved successfully",
 *   data: {
 *     users: [],
 *     pagination: {
 *       currentPage,
 *       totalPages,
 *       totalUsers,
 *       limit
 *     }
 *   }
 * }
 *
 * @errors
 * 500 INTERNAL_SERVER_ERROR → Server error
 */
export const getAllConsumers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const result = await getAllConsumersService({ skip, limit, page });

    return sendSuccess(
      res,
      result,
      200,
      "All consumers retrieved successfully"
    );

  } catch (error) {
    console.error("Get All Consumers Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getEmailVerifyDummy
 *
 * @description
 * Fetch OTP records with optional email filter and pagination.
 *
 * @params
 * query: {
 *   email?: string,
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * 1. Extract pagination values using getPagination utility
 * 2. Build filter object (email optional)
 * 3. Fetch OTP records from database (latest first)
 * 4. Count total records
 * 5. Return paginated response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "OTP records fetched successfully",
 *   data: {
 *     records: [],
 *     pagination: {
 *       currentPage,
 *       totalPages,
 *       totalRecords,
 *       limit
 *     }
 *   }
 * }
 *
 * @errors
 * 500 INTERNAL_SERVER_ERROR → Server error
 */
export const getEmailVerifyDummy = async (req, res) => {
  try {
    const { email, page, limit } = req.query;
    const { page: pg, limit: lm, skip } = getPagination({ page, limit });
    const result = await getEmailVerifyDummyService({
      email,
      skip,
      limit: lm,
      page: pg
    });

    return sendSuccess(
      res,
      result,
      200,
      "OTP records fetched successfully"
    );

  } catch (error) {
    console.error("Get OTP Records Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getAllEmailVerifyDummy
 *
 * @process
 * Fetch all OTP verification records from database
 * Sort records by latest created first
 * Convert mongoose docs to plain objects using lean()
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All EmailVerifyDummy data fetched successfully",
 *   data: {
 *     records: [],
 *     totalRecords: number
 *   }
 * }
 *
 * @error
 * 500 Server error handled via handleError
 */
export const getAllEmailVerifyDummy = async (req, res) => {
  try {
    const records = await EmailVerifyDummy.find()
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(
      res,
      {
        records,
        totalRecords: records.length,
      },
      200,
      "All EmailVerifyDummy data fetched successfully"
    );

  } catch (error) {
    console.error("Get All EmailVerifyDummy Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteAllOtpAndCustomers
 *
 * @process
 * Delete all OTP records from EmailVerifyDummy collection
 * Delete all customer records from Customer collection
 * Execute both operations in parallel using Promise.all for performance
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All OTP and Customer data deleted successfully",
 *   data: {
 *     otpDeleted: number,
 *     customersDeleted: number
 *   }
 * }
 *
 * @error
 * 500 Server error handled via handleError
 */
export const deleteAllOtpAndCustomers = async (req, res) => {
  try {
    const [otpResult, customerResult] = await Promise.all([
      EmailVerifyDummy.deleteMany({}),
      CustomerData.deleteMany({}),
    ]);

    return sendSuccess(
      res,
      {
        otpDeleted: otpResult.deletedCount,
        customersDeleted: customerResult.deletedCount,
      },
      200,
      "All OTP and Customer data deleted successfully"
    );

  } catch (error) {
    console.error("Delete All OTP & Customers Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getLibraryDashboard
 *
 * @query
 * {
 *   days?: number,
 *   groupBy?: "library" | "category" | "brand",
 *   limit?: number,
 *   category?: string,
 *   brand?: string
 * }
 *
 * @process
 * Validate query params
 * Pass params to service layer
 * Service performs:
 *   - Date filtering
 *   - Aggregation on logLibrary
 *   - Dynamic grouping (library/category/brand)
 *   - Sorting & limiting
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Dashboard data fetched successfully",
 *   data: {
 *     days,
 *     groupBy,
 *     category,
 *     brand,
 *     total,
 *     data: []
 *   }
 * }
 *
 * @error
 * 400 Validation error
 * 500 Server error
 */
export const getLibraryDashboard = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const groupBy = req.query.groupBy || "library";
    const limit = parseInt(req.query.limit) || 12;
    const categoryFilter = req.query.category;
    const brandFilter = req.query.brand;
    /* ---------- VALIDATION ---------- */
    if (days < 1) {
      return sendError(res, {
        message: "Days must be greater than 0",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    if (!["library", "category", "brand"].includes(groupBy)) {
      return sendError(res, {
        message: "Invalid groupBy value",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    /* ---------- SERVICE CALL ---------- */
    const result = await getLibraryDashboardService({
      days,
      groupBy,
      limit,
      categoryFilter,
      brandFilter,
    });
    return sendSuccess(
      res,
      result,
      200,
      "Dashboard data fetched successfully"
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteOtpByEmail
 *
 * @params
 * {
 *   email: string (required, URL param)
 * }
 *
 * @process
 * Validate email param
 * Convert email to lowercase
 * Delete OTP record from EmailVerifyDummy collection
 * Throw error if no record found
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "OTP record deleted successfully",
 *   data: {
 *     deletedRecord: {}
 *   }
 * }
 *
 * @error
 * 400 Email required
 * 404 OTP not found
 * 500 Server error handled via handleError
 */

export const deleteOtpByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    /* ---------- VALIDATION ---------- */
    if (!email) {
      return sendError(res, {
        message: "Email is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    /* ---------- SERVICE CALL ---------- */
    const deletedRecord = await deleteOtpByEmailService(email);

    return sendSuccess(
      res,
      { deletedRecord },
      200,
      "OTP record deleted successfully"
    );

  } catch (error) {
    console.error("Delete OTP By Email Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getScanbridgeLibrary
 *
 * @process
 * 1. Fetch all customers having scanbridge category in logLibrary
 * 2. Flatten scanbridge logs
 * 3. Return formatted response
 *
 * @response
 * 200 - Scanbridge library fetched successfully
 * 500 - Internal server error
 */
export const getScanbridgeLibrary = async (req, res) => {
  try {
    /* ---------- QUERY PARAMS ---------- */
    const { page = 1, limit = 12 } = req.query;
    /* ---------- SERVICE ---------- */
    const result = await getScanbridgeLibraryService({ page, limit });
    return sendSuccess(
      res,
      result,
      200,
      "Scanbridge library fetched successfully"
    );
  } catch (error) {
    console.error("getScanbridgeLibrary Controller Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function updateScanbridgeLibrary
 *
 * @params
 * req.body = {
 *   customerId,
 *   logId,
 *   isdelivered
 * }
 *
 * @process
 * 1. Validate request body
 * 2. Find customer and matching library log
 * 3. Ensure category is scanbridge
 * 4. Update isdelivered status
 * 5. Return updated log response
 *
 * @response
 * 200 - Scanbridge library updated successfully
 * 400 - Validation failed / invalid category
 * 404 - Customer or library log not found
 * 500 - Internal server error
 */
export const updateScanbridgeLibrary = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = updateScanbridgeLibraryValidator.validate(req.body, {
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

    /* ---------- SERVICE ---------- */
    const result = await updateScanbridgeLibraryService(value);

    return sendSuccess(
      res,
      result,
      200,
      "Scanbridge library updated successfully"
    );
  } catch (error) {
    console.error("updateScanbridgeLibrary Controller Error:", error);
    return handleError(res, error);
  }
};