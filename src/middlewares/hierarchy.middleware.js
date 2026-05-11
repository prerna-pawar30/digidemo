import Employee from "../models/manage/employee.model.js";
import { sendError, handleError } from "../helpers/error.helper.js";

/**
 * @function hierarchyMiddleware
 *
 * @description
 * Middleware to enforce employee role hierarchy rules.
 * Prevents users from performing actions on employees with equal or higher roles.
 *
 * @process
 * 1. Fetch logged-in employee from the database using `req.user.email`
 * 2. For POST requests:
 *    - Validate `role` is provided in body
 *    - Set `targetRole` to the requested role
 * 3. For PUT / PATCH / DELETE requests:
 *    - Validate `id` param exists
 *    - Fetch target employee using `id`
 *    - Prevent actions on self
 *    - Set `targetRole` to target employee's role
 * 4. Enforce role hierarchy rules:
 *    - Executives (role 3) cannot perform any action
 *    - SuperAdmin (role 0) can perform any action
 *    - Users can act only on employees with higher role number (lower authority)
 * 5. Call `next()` if action is allowed
 *
 * @response
 * 400 { success: false, message: "Role is required" } - for missing role or ID
 * 403 { success: false, message: "<hierarchy violation message>" } - for insufficient permissions
 * 404 { success: false, message: "Employee not found" } - if logged-in or target employee does not exist
 * 500 { success: false, message: "Internal Server Error", error: "<error_message>" } - for any server error
 */

const hierarchyMiddleware = async (req, res, next) => {
  try {
    const loggedInEmployee = await Employee.findOne({
      email: req.user.email,
    }).select("role _id");

    if (!loggedInEmployee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND",
      });
    }

    let targetRole;

    /* ================= CREATE ================= */
    if (req.method === "POST") {
      targetRole = req.body?.role;

      if (targetRole === undefined) {
        return sendError(res, {
          message: "Role is required",
          statusCode: 400,
          errorCode: "ROLE_REQUIRED",
        });
      }
    }

    /* ================= DELETE / UPDATE ================= */
    if (req.method === "DELETE" || req.method === "PUT") {
      const targetEmployee = await Employee.findOne({ email: req.body.email } ).select(
        "role _id"
      );

      if (!targetEmployee) {
        return sendError(res, {
          message: "Target employee not found",
          statusCode: 404,
          errorCode: "TARGET_EMPLOYEE_NOT_FOUND",
        });
      }

      // ❌ cannot act on yourself
      if (loggedInEmployee._id.equals(targetEmployee._id)) {
        return sendError(res, {
          message: "You cannot perform this action on yourself",
          statusCode: 403,
          errorCode: "SELF_ACTION_FORBIDDEN",
        });
      }

      targetRole = targetEmployee.role;
    }

    const creatorRole = loggedInEmployee.role;

    // ❌ Executives can do nothing
    if (creatorRole === 3) {
      return sendError(res, {
        message: "Executives are not allowed to perform this action",
        statusCode: 403,
        errorCode: "EXECUTIVE_FORBIDDEN",
      });
    }

    // ✅ SuperAdmin can do anything
    if (creatorRole === 0) {
      return next();
    }

    // lower number = higher authority
    if (creatorRole < targetRole) {
      return next();
    }

    return sendError(res, {
      message: "You cannot perform this action on same or higher role",
      statusCode: 403,
      errorCode: "HIERARCHY_VIOLATION",
    });
  } catch (error) {
    console.error("Hierarchy middleware error:", error);
    return handleError(res, error);
  }
};
export default hierarchyMiddleware;
