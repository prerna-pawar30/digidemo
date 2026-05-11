import { sendError, handleError } from "../../helpers/error.helper.js";
import {sendSuccess} from "../../helpers/response.helper.js"
import { assignPermissionToEmployeeService, createPermissionService, deleteAllPermissionsService, deletePermissionService, getAllPermissionsService, getPermissionAuditLogsService, removePermissionFromEmployeeService } from "../../services/permission.service.js";
import { validateAssignPermissionBody, validatePermissionBody } from "./permission.validator.js";

/**
 * @function createPermission
 *
 * @params
 * body: {
 *   name: string
 * }
 *
 * @process
 * 1. Validate required field `name`
 * 2. Authenticate admin using `req.user.email`
 * 3. Check if permission already exists
 * 4. Create new permission with unique `permissionId`
 * 5. Auto-assign permission to all Super Admins (role: "0")
 * 6. Create audit log entry for permission creation
 * 7. Return success response with created permission
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Permission created",
 *   data: {
 *     _id: string,
 *     name: string,
 *     permissionId: string,
 *     createdBy: ObjectId,
 *     createdAt: Date,
 *     updatedAt: Date
 *   }
 * }
 */
export const createPermission = async (req, res) => {
  try {
    const { value, error } = validatePermissionBody(req.body);

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }

    const permission = await createPermissionService(value, req.user);

    return sendSuccess(
      res,
      { permission },
      201,
      "Permission created successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * @function getAllPermissions
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * 1. Parse pagination parameters (`page`, `limit`) from query
 * 2. Fetch all permissions from database
 * 3. Apply `.lean()` for performance optimization
 * 4. (Optional) Apply pagination if implemented
 * 5. Return list of permissions
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All permissions fetched",
 *   data: [
 *     {
 *       _id: string,
 *       name: string,
 *       permissionId: string,
 *       createdBy: ObjectId,
 *       createdAt: Date,
 *       updatedAt: Date
 *     }
 *   ]
 * }
 */
export const getAllPermissions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await getAllPermissionsService({
      page,
      limit,
    });

    return sendSuccess(
      res,
      result,
      200,
      "Permissions fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deletePermission
 *
 * @params
 * params: {
 *   permissionId: string
 * }
 *
 * @process
 * 1. Extract `permissionId` from request params
 * 2. Find permission by `permissionId`
 * 3. If permission not found → return error
 * 4. Authenticate admin using `req.user.email`
 * 5. Delete permission from Permission collection
 * 6. Remove this permission from all employees
 * 7. Create audit log entry for deletion
 * 8. Return success response with deleted permission
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Permission deleted",
 *   data: {
 *     _id: string,
 *     name: string,
 *     permissionId: string,
 *     createdBy: ObjectId,
 *     createdAt: Date,
 *     updatedAt: Date
 *   }
 * }
 */
export const deletePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;

    if (!permissionId) {
      return sendError(res, {
        message: "permissionId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    const deletedPermission = await deletePermissionService(
      permissionId,
      req.user,
      req.permissionAction
    );

    return sendSuccess(
      res,
      { permission: deletedPermission },
      200,
      "Permission deleted successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function assignPermissionToEmployee
 *
 * @params
 * body: {
 *   email: string,
 *   permission: string
 * }
 *
 * @process
 * 1. Extract `email` and `permission` from request body
 * 2. Authenticate admin using `req.user.email`
 * 3. Find target employee using `email`
 * 4. Validate if permission exists in Permission collection
 * 5. Check if permission is already assigned to employee
 * 6. Add permission to employee using `$addToSet`
 * 7. Create audit log entry for permission assignment
 * 8. Return success response with assigned permission details
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Permission assigned",
 *   data: {
 *     email: string,
 *     permission: string
 *   }
 * }
 */
export const assignPermissionToEmployee = async (req, res) => {
  try {
    const { value, error } = validateAssignPermissionBody(req.body);

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }

    const result = await assignPermissionToEmployeeService(
      value,
      req.user
    );

    return sendSuccess(
      res,
      result,
      201,
      "Permission assigned successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function removePermissionFromEmployee
 *
 * @params
 * body: {
 *   email: string,
 *   permission: string
 * }
 *
 * @process
 * 1. Extract `email` and `permission` from request body
 * 2. Authenticate admin using `req.user.email`
 * 3. Find target employee using `email`
 * 4. Check if permission is assigned to the employee
 * 5. Remove permission using `$pull`
 * 6. Create audit log entry for permission removal (revoke)
 * 7. Return success response with removed permission details
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Permission removed",
 *   data: {
 *     email: string,
 *     permission: string
 *   }
 * }
 */
export const removePermissionFromEmployee = async (req, res) => {
  try {
    const { value, error } = validateAssignPermissionBody(req.body);

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }

    const result = await removePermissionFromEmployeeService(
      value,
      req.user
    );

    return sendSuccess(
      res,
      result,
      200,
      "Permission removed successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getPermissionAuditLogs
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * 1. Parse optional pagination parameters (`page`, `limit`) from query
 * 2. Fetch permission audit logs from database
 * 3. Populate `actionBy` with employee `email` and `name`
 * 4. Populate `actionFor` with employee `email` and `name`
 * 5. Sort logs in descending order (latest first)
 * 6. (Optional) Apply pagination if implemented
 * 7. Return audit logs list
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Permission audit logs fetched",
 *   data: [
 *     {
 *       _id: string,
 *       permissionAuditId: string,
 *       actionBy: {
 *         _id: ObjectId,
 *         email: string,
 *         name: string
 *       },
 *       actionFor: {
 *         _id: ObjectId,
 *         email: string,
 *         name: string
 *       },
 *       permission: string,
 *       action: string,
 *       createdAt: Date
 *     }
 *   ]
 * }
 */
export const getPermissionAuditLogs = async (req, res) => {
  try {
    /* ---------- QUERY PARAMS ---------- */
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    /* ---------- SERVICE ---------- */
    const result = await getPermissionAuditLogsService({ page, limit });

    return sendSuccess(
      res,
      {
        pagination: result.pagination,
        logs: result.logs,
      },
      200,
      "Permission audit logs fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};
/**
 * @function deleteAllPermissions
 *
 * @params
 * body: {}
 *
 * @process
 * 1. Authenticate admin using `req.user.email`
 * 2. Delete all permissions from Permission collection
 * 3. Remove all permissions from every employee
 * 4. Create audit log entry for bulk deletion
 * 5. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All permissions deleted",
 *   data: null
 * }
 */
export const deleteAllPermissions = async (req, res) => {
  try {
    const result = await deleteAllPermissionsService(req.user);

    return sendSuccess(
      res,
      result,
      200,
      "All permissions deleted successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};
