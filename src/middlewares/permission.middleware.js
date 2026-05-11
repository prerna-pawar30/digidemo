// import Employee from "../models/manage/employee.model.js";
// import { sendError, handleError } from "../helpers/error.helper.js";

// /**
//  * @function checkPermission
//  *
//  * @description
//  * Middleware factory to validate if the logged-in employee has the required permission.
//  * SuperAdmin (role 0) bypasses all permission checks.
//  *
//  * @process
//  * 1. Extract user email from `req.user.email`
//  * 2. Validate email exists in token
//  * 3. Fetch employee from DB with role and permissions
//  * 4. Validate `permission` field exists in request body
//  * 5. SuperAdmin bypass: role 0 automatically passes
//  * 6. Check if employee's permissions include the required permission
//  * 7. Call `next()` if permission check passes
//  *
//  * @response
//  * 400 { success: false, message: "Permission is required" } - if missing in request
//  * 401 { success: false, message: "Unauthorized - User not found in token" } - if no token info
//  * 403 { success: false, message: "Permission denied" } - if missing permission
//  * 404 { success: false, message: "Employee not found" } - if employee record missing
//  * 500 { success: false, message: "<error_message>" } - for unexpected errors
//  *
//  * @example
//  * router.post("/some-route", authToken, checkPermission, controllerFunction);
//  */

// export const checkPermission = () => {
//   return async (req, res, next) => {
//     try {
//       /* =========================
//          VALIDATE TOKEN USER
//       ========================= */
//       const userEmail = req.user?.email; 
//       /* ---------- RESOLVE PERMISSION ---------- */
//       let requiredPermission;
//       if (req.method === "GET") {
//         requiredPermission = req.params?.permission;
//       } else {
//         requiredPermission =
//           req.body?.permission ||
//           req.query?.permission;
//       }
//      // Assuming permission is sent in request body
//       if (!userEmail) {
//         return sendError(res, {
//           message: "Unauthorized",
//           statusCode: 401,
//           errorCode: "UNAUTHORIZED",
//         });
//       }

//       /* =========================
//          VALIDATE INPUT
//       ========================= */
//       if (!requiredPermission) {
//         return sendError(res, {
//           message: "Permission is required",
//           statusCode: 500,
//           errorCode: "PERMISSION_CONFIG_MISSING",
//         });
//       }

//       /* =========================
//          FETCH EMPLOYEE
//       ========================= */
//       const employee = await Employee.findOne({
//         email: userEmail,
//         isDeleted: false,
//       }).select("_id email role permissions").lean();
//       if (!employee) {
//         throw new Error("USER_NOT_FOUND");
//       }
//       /* =========================
//          SUPER ADMIN BYPASS
//       ========================= */
//       if (employee.role === 0) {
//         return next();
//       }

//       /* =========================
//          PERMISSION CHECK
//       ========================= */
//       const hasPermission =
//         Array.isArray(employee.permissions) &&
//         employee.permissions.includes(requiredPermission);
//       if (!hasPermission) {
//         return sendError(res, {
//           message: `Permission denied: ${requiredPermission}`,
//           statusCode: 403,
//           errorCode: "PERMISSION_DENIED",
//         });
//       }

//       /* =========================
//          ATTACH FOR DOWNSTREAM
//       ========================= */
//       req.currentUser = employee;
//       next();
//     } catch (error) {
//       return handleError(res, error);
//     }
//   };
// }; 


import Employee from "../models/manage/employee.model.js";
import { sendError, handleError } from "../helpers/error.helper.js";

/**
 * @function checkPermission
 *
 * @description
 * Middleware factory to validate if the logged-in employee has the required permission.
 * SuperAdmin (role 0) bypasses all permission checks.
 *
 * @process
 * 1. Extract user email from `req.user.email`
 * 2. Validate email exists in token
 * 3. Fetch employee from DB with role and permissions
 * 4. Validate `permission` field exists in request body
 * 5. SuperAdmin bypass: role 0 automatically passes
 * 6. Check if employee's permissions include the required permission
 * 7. Call `next()` if permission check passes
 *
 * @response
 * 400 { success: false, message: "Permission is required" } - if missing in request
 * 401 { success: false, message: "Unauthorized - User not found in token" } - if no token info
 * 403 { success: false, message: "Permission denied" } - if missing permission
 * 404 { success: false, message: "Employee not found" } - if employee record missing
 * 500 { success: false, message: "<error_message>" } - for unexpected errors
 *
 * @example
 * router.post("/some-route", authToken, checkPermission, controllerFunction);
 */

export const checkPermission = async (req, res, next) => {
  console.log("🔥 checkPermission middleware hit");

      /* =========================
         VALIDATE TOKEN USE
      ========================= */
      try{
      console.log("Checking permissions for user:", req.user);
      const userEmail = req.user?.email;

      if (!userEmail) {
        return sendError(res, {
          message: "Unauthorized",
          statusCode: 401,
          errorCode: "UNAUTHORIZED",
        });
      }

      /* =========================
         VALIDATE INPUT
      ========================= */
      let requiredPermission;
      if (req.method === "GET") {
        requiredPermission = req.params?.permission;
      } else {
        requiredPermission =
          req.body?.permission ||
          req.query?.permission;
      }
      if (!requiredPermission) {
        return sendError(res, {
          message: "Permission is required",
          statusCode: 500,
          errorCode: "PERMISSION_CONFIG_MISSING",
        });
      }

      /* =========================
         FETCH EMPLOYEE
      ========================= */
      const employee = await Employee.findOne({
        email: userEmail,
        isDeleted: false,
      })
        .select("_id email role permissions")
        .lean();

      if (!employee) {
        throw new Error("USER_NOT_FOUND");
      }

      /* =========================
         SUPER ADMIN BYPASS
      ========================= */
      if (employee.role === 0) {
        return next();
      }

      /* =========================
         PERMISSION CHECK
      ========================= */
      const hasPermission =
        Array.isArray(employee.permissions) &&
        employee.permissions.includes(requiredPermission);

      if (!hasPermission) {
        return sendError(res, {
          message: `Permission denied: ${requiredPermission}`,
          statusCode: 403,
          errorCode: "PERMISSION_DENIED",
        });
      }

      /* =========================
         ATTACH FOR DOWNSTREAM
      ========================= */
      req.currentUser = employee;

      next();
    } catch (error) {
      return handleError(res, error);
    }
  };
