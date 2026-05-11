import Employee from "../models/manage/employee.model.js";
import { sendError, handleError } from "../helpers/error.helper.js";

/**
 * @function checkAdminRole
 *
 * @description
 * Middleware to verify that the current user has Admin or Super Admin privileges.
 *
 * @process
 * 1. Extract user's email from verified JWT payload (`req.user.email`)
 * 2. Validate that the email exists
 * 3. Fetch the user from the database (excluding deleted users)
 * 4. Verify that the user exists
 * 5. Check if user's role is Super Admin (0) or Admin (1)
 * 6. Attach the user object to `req.currentUser` for downstream handlers
 * 7. Call `next()` to continue if authorized
 *
 * @response
 * 401 { success: false, message: "Unauthorized" } - if no email in JWT payload
 * 404 { success: false, message: "User not found" } - if user does not exist
 * 403 { success: false, message: "Access denied: Admin privileges required" } - if role is not admin
 * 500 { success: false, message: "Role check failed", error: "<error_message>" } - for any server errors
 */
const checkAdminRole = async (req, res, next) => {
  try {
    /* =========================
       AUTH CHECK
    ========================= */
    const email = req.user?.email;

    if (!email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }

    /* =========================
       FETCH USER
    ========================= */
    const user = await Employee.findOne({
      email,
      isDeleted: false,
    })
      .select("_id email role")
      .lean();

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    /* =========================
       ROLE VALIDATION
    ========================= */
    const allowedRoles = [0, 1]; // 0 = Super Admin, 1 = Admin

    if (!allowedRoles.includes(user.role)) {
      return sendError(res, {
        message: "Access denied: Admin privileges required",
        statusCode: 403,
        errorCode: "ADMIN_ROLE_REQUIRED",
      });
    }

    /* =========================
       ATTACH USER
    ========================= */
    req.currentUser = user;

    next();
  } catch (error) {
    return handleError(res, error);
  }
};

export default checkAdminRole;