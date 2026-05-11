import { changePasswordValidation, createEmployeeValidator, loginEmployeeValidator, } from "./employee.validator.js";
import { changeEmployeePasswordService, createEmployeeService, deleteEmployeeService, forgotEmployeePasswordService, getEmployeeService, loginEmployeeService, refreshEmployeeAccessTokenService, resetEmployeePasswordService, updateEmployeeRoleService, verifyEmailService } from "../../../services/auth/employee.service.js";
import { sendSuccess } from "../../../helpers/response.helper.js";
import { handleError, sendError } from "../../../helpers/error.helper.js";
import DeletedEmployee from "../../../models/manage/deleteemployee.model.js";

/**
 * @function createEmployeeService
 *
 * @params
 * data: {
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   password: string,
 *   personalEmail: string,
 *   role: string,
 *   permission?: string
 * }
 *
 * adminEmail: string
 *
 * @process
 * 1. Extract employee details from the request data.
 * 2. Check if an employee already exists using the provided company email.
 * 3. If employee exists, throw "EMPLOYEE_ALREADY_EXISTS".
 * 4. Verify that the requesting admin exists and is not deleted.
 * 5. If admin is not found, throw "UNAUTHORIZED_ADMIN".
 * 6. Create a new employee record with:
 *    - generated employeeId
 *    - provided employee details
 *    - createdBy set to admin email
 *    - isNewEmployee flag set to true (forces password reset on first login)
 * 7. Generate welcome email template with login credentials.
 * 8. Send welcome email to employee's personal email using Zoho Mail service.
 * 9. Create a permission audit record to track who created the employee and what permission was used.
 * 10. Return the newly created employee object.
 *
 * @response
 * success:
 * 201 {
 *   employeeId: string,
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   role: string,
 *   createdBy: string,
 *   isNewEmployee: true
 * }
 *
 * errors:
 * 400 - EMPLOYEE_ALREADY_EXISTS
 * 401 - UNAUTHORIZED_ADMIN
 * 500 - INTERNAL_SERVER_ERROR
 */
export const createEmployee = async (req, res) => {
  try {
    const { value, error } = createEmployeeValidator(req.body, {
      abortEarly: false
    });
    if (error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    const employee = await createEmployeeService(
      value,
      req.user.email
    );
    return sendSuccess(
      res,
      employee,
      201,
      "Employee created successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function loginEmployeeService
 *
 * @params
 * email: string
 * password: string
 *
 * @process
 * 1. Search for employee using company email where isDeleted = false.
 * 2. Include the password field explicitly for authentication.
 * 3. If employee is not found, throw "USER_NOT_FOUND".
 * 4. Compare the provided password with the stored hashed password using bcrypt.
 * 5. If password does not match, throw "INVALID_CREDENTIALS".
 * 6. Generate authentication tokens:
 *    - Access Token
 *    - Refresh Token
 * 7. Return employee details along with generated tokens.
 *
 * @response
 * success:
 * 200 {
 *   employee: EmployeeObject,
 *   accessToken: string,
 *   refreshToken: string
 * }
 *
 * errors:
 * 404 - USER_NOT_FOUND
 * 401 - INVALID_CREDENTIALS
 * 500 - INTERNAL_SERVER_ERROR
 */
export const loginEmployee = async (req, res) => {
  try {
    const { value, error } = loginEmployeeValidator(req.body);
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    const { email, password } = value;
    const { employee, accessToken, refreshToken } =
    await loginEmployeeService(email, password);
    // Store refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    const employeeData = {
      id: employee._id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      role: employee.role,
      accessToken,
      isNewEmployee: employee.isNewEmployee
    };
    return sendSuccess(
      res,
      employeeData,
      200,
      "Login successful"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function logoutEmployee
 *
 * @params
 * cookies: {
 *   refreshToken: string
 * }
 *
 * @process
 * 1. Receive logout request from the authenticated employee.
 * 2. Check if refreshToken cookie exists in the request.
 * 3. Clear the refreshToken stored in browser cookies using res.clearCookie().
 * 4. Apply secure cookie options while clearing:
 *    - httpOnly → prevents client-side JavaScript access
 *    - secure → cookie transmitted only over HTTPS
 *    - sameSite: "strict" → prevents CSRF attacks
 *    - path: "/" → ensures cookie removal for the entire application
 * 5. Invalidate the user session on the client side.
 * 6. Return a success response confirming the logout operation.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Logout successful"
 * }
 *
 * @errors
 * 500 - INTERNAL_SERVER_ERROR
 */
export const logoutEmployee = async (req, res) => {
  try {

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });

    return sendSuccess(res, null, 200, "Logout successful");

  } catch (error) {

    return handleError(res, error);

  }
};

/**
 * @function changeEmployeePassword
 *
 * @route POST /api/employees/change-password
 *
 * @params
 * body: {
 *   email: string,
 *   password: string
 * }
 *
 * @process
 * 1. Validate request body using changePasswordValidator.
 * 2. If validation fails, return VALIDATION_ERROR.
 * 3. Call changeEmployeePasswordService to update password.
 * 4. Return success response with updated employee data.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Password updated successfully",
 *   data: EmployeeObject
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 404 - EMPLOYEE_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const changeEmployeePassword = async (req, res) => {
  try {
    const { value, error } = changePasswordValidation(req.body, {
      abortEarly: false
    });
    if (error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    const { email, password } = value;
    const employee = await changeEmployeePasswordService(email, password);
    return sendSuccess(
      res,
      employee,
      200,
      "Password updated successfully"
    );
  } catch (error) {
    console.error("Change Password Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function verifyEmail
 *
 * @route GET /api/employees/verify-email/:token
 *
 * @params
 * params: {
 *   token: string
 * }
 *
 * @process
 * 1. Extract verification token from request params.
 * 2. Validate token presence.
 * 3. Call verifyEmailService to verify employee email.
 * 4. If token is valid and not expired:
 *      - mark email as verified
 *      - remove verification token from employee record
 * 5. Redirect user to frontend login page.
 *
 * @response
 * Redirect → FRONTEND_URL/login
 *
 * @errors
 * 400 - VERIFICATION_TOKEN_REQUIRED
 * 400 - INVALID_OR_EXPIRED_TOKEN
 * 500 - INTERNAL_SERVER_ERROR
 */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return sendError(res, {
        message: "Verification token is required",
        statusCode: 400,
        errorCode: "VERIFICATION_TOKEN_REQUIRED"
      });
    }
    await verifyEmailService(token);
    return res.redirect(`${process.env.FRONTEND_URL}/login`);
  } catch (error) {
  console.error("Email Verification Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function resetEmployeePassword
 *
 * @route POST /api/employees/reset-password/:token
 *
 * @params
 * params: {
 *   token: string
 * }
 *
 * body: {
 *   newPassword: string,
 *   confirmNewPassword: string
 * }
 *
 * @process
 * 1. Extract reset token from request params.
 * 2. Validate request body fields.
 * 3. Ensure newPassword and confirmNewPassword match.
 * 4. Call resetEmployeePasswordService to update employee password.
 * 5. Return success response once password is reset.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Password reset successfully. Please login.",
 *   data: null
 * }
 *
 * @errors
 * 400 - INVALID_OR_MISSING_TOKEN
 * 400 - PASSWORDS_DO_NOT_MATCH
 * 400 - INVALID_OR_EXPIRED_TOKEN
 * 500 - INTERNAL_SERVER_ERROR
 */
export const resetEmployeePassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmNewPassword } = req.body;
    if (!token) {
      return sendError(res, {
        message: "Invalid or missing token",
        statusCode: 400,
        errorCode: "INVALID_OR_MISSING_TOKEN"
      });
    }
    if (!newPassword || !confirmNewPassword) {
      return sendError(res, {
        message: "All fields are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    if (newPassword !== confirmNewPassword) {
      return sendError(res, {
        message: "Passwords do not match",
        statusCode: 400,
        errorCode: "PASSWORDS_DO_NOT_MATCH"
      });
    }
    await resetEmployeePasswordService(token, newPassword);
    return sendSuccess(
      res,
      null,
      200,
      "Password reset successfully. Please login."
    );

  } catch (error) {
    console.error("RESET EMPLOYEE PASSWORD ERROR:", error);
    return handleError(res, error);
  }
};

/**
 * @function forgotEmployeePassword
 *
 * @route POST /api/employees/forgot-password
 *
 * @params
 * body: {
 *   email: string
 * }
 *
 * @process
 * 1. Validate request body to ensure email is provided.
 * 2. Call forgotEmployeePasswordService.
 * 3. If employee exists:
 *      - generate password reset token
 *      - save token with expiry time
 *      - send password reset email
 * 4. Always return success response to prevent email enumeration.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "If the email exists, reset link has been sent.",
 *   data: null
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 500 - INTERNAL_SERVER_ERROR
 */
export const forgotEmployeePassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, {
        message: "Email is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    await forgotEmployeePasswordService(email);
    return sendSuccess(
      res,
      null,
      200,
      "If the email exists, reset link has been sent."
    );
  } catch (error) {
    console.error("Forgot Employee Password Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getEmployee
 *
 * @route GET /api/employees/:email?
 *
 * @params
 * params: {
 *   email?: string
 * }
 *
 * @process
 * 1. Extract email from request params (optional).
 * 2. If email is provided:
 *      - fetch employee by email.
 *      - exclude password field.
 *      - return employee data.
 * 3. If email is not provided:
 *      - fetch all employees where isDeleted = false.
 *      - exclude password field.
 *      - return employees list.
 * 4. Return success response.
 *
 * @response
 * success (single employee):
 * 200 {
 *   success: true,
 *   message: "Employee retrieved successfully",
 *   data: EmployeeObject
 * }
 *
 * success (all employees):
 * 200 {
 *   success: true,
 *   message: "All employees retrieved successfully",
 *   data: [EmployeeObject]
 * }
 *
 * @errors
 * 404 - EMPLOYEE_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const getEmployee = async (req, res) => {
  try {
    const { email } = req.params;
    const result = await getEmployeeService(email);
    if (!result) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    }
    const message = email
      ? "Employee retrieved successfully"
      : "All employees retrieved successfully";
    return sendSuccess(res, result, 200, message);
  } catch (error) {
    console.error("Get Employee Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteEmployee
 *
 * @route DELETE /api/employees/:employeeId
 *
 * @params
 * params: {
 *   employeeId: string
 * }
 *
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * 1. Extract employeeId from request params.
 * 2. Extract permission from request body.
 * 3. Identify the admin performing the action from req.user.
 * 4. Call deleteEmployeeService to perform soft delete.
 * 5. Employee record will be marked as deleted and scheduled for final deletion after 30 days.
 * 6. Save permission audit record for tracking admin actions.
 * 7. Return success response.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Employee account marked deleted (Final delete after 30 days)",
 *   data: {
 *     employeeId: string
 *   }
 * }
 *
 * @errors
 * 404 - EMPLOYEE_NOT_FOUND
 * 401 - UNAUTHORIZED_ACTION
 * 500 - INTERNAL_SERVER_ERROR
 */
export const deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { permission } = req.body;
    if (!employeeId) {
      return sendError(res, {
        message: "Employee ID is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const result = await deleteEmployeeService(
      employeeId,
      req.user.email,
      permission
    );
    return sendSuccess(
      res,
      { employeeId: result.employeeId },
      200,
      "Employee account marked deleted (Final delete after 30 days)"
    );
  } catch (error) {
    console.error("deleteEmployee Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function updateEmployeeRole
 *
 * @route PATCH /api/employees/update-role
 *
 * @params
 * body: {
 *   email: string,
 *   role: number,
 *   permission?: string
 * }
 *
 * @process
 * 1. Extract email, role, and permission from request body.
 * 2. Validate role value (allowed roles: 0,1,2,3,4).
 * 3. Identify the admin performing the action using req.user.email.
 * 4. Call updateEmployeeRoleService.
 * 5. Update employee role.
 * 6. Save permission audit log.
 * 7. Return success response.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Employee role updated successfully",
 *   data: {
 *     email: string,
 *     updatedRole: number,
 *     updatedBy: string
 *   }
 * }
 *
 * @errors
 * 400 - INVALID_ROLE
 * 404 - EMPLOYEE_NOT_FOUND
 * 401 - UNAUTHORIZED_ACTION
 * 500 - INTERNAL_SERVER_ERROR
 */
export const updateEmployeeRole = async (req, res) => {
  console.log("Update Employee Role Request Body:");
  try {
    const { email, role, permission } = req.body;
    console.log("Updating role for:", email, "to role:", role, "by admin:", req.user.email, "with permission:", permission);
    if (role === undefined || ![0, 1, 2, 3, 4].includes(role)) {
      return sendError(res, {
        message: "Invalid role value",
        statusCode: 400,
        errorCode: "INVALID_ROLE"
      });
    }
    const result = await updateEmployeeRoleService(
      email,
      role,
      req.user.email,
      permission
    );
    return sendSuccess(
      res,
      result,
      200,
      "Employee role updated successfully"
    );
  } catch (error) {
    console.error("Role Update Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getAllDeletedEmployee
 *
 * @route GET /api/employees/deleted
 *
 * @params
 * none
 *
 * @process
 * 1. Fetch all employees from DeletedEmployee collection.
 * 2. Exclude password field for security.
 * 3. Return deleted employees list.
 * 4. If no records exist, return an empty array.
 *
 * @response
 * success:
 * 200 {
 *   success: true,
 *   message: "Deleted employees retrieved successfully",
 *   data: [DeletedEmployeeObject]
 * }
 *
 * success (no records):
 * 200 {
 *   success: true,
 *   message: "No deleted employees found",
 *   data: []
 * }
 *
 * @errors
 * 500 - INTERNAL_SERVER_ERROR
 */
export const getAllDeletedEmployee = async (req, res) => {
  try {
    const deletedEmployees = await DeletedEmployee
    .find()
    .select("-password")
    .lean();
    const message =
      deletedEmployees.length === 0
        ? "No deleted employees found"
        : "Deleted employees retrieved successfully";
    return sendSuccess(res, deletedEmployees, 200, message);
  } catch (error) {
    console.error("Error fetching deleted employees:", error);
    return handleError(res, error);
  }
};

/**
 * @function refreshEmployeeAccessToken
 *
 * @route POST /api/employees/refresh-token
 *
 * @params
 * cookies: {
 *   refreshToken: string
 * }
 *
 * @process
 * 1. Extract refresh token from cookies.
 * 2. If refresh token is missing, return authentication error.
 * 3. Call refreshEmployeeAccessTokenService.
 * 4. Verify refresh token using JWT secret.
 * 5. Find employee using decoded employeeId.
 * 6. Generate a new access token.
 * 7. Return the new access token.
 *
 * @response
 * success:
 * 200 {
 *   success: true,
 *   message: "Employee access token refreshed successfully",
 *   data: {
 *     accessToken: string
 *   }
 * }
 *
 * @errors
 * 401 - REFRESH_TOKEN_REQUIRED
 * 403 - INVALID_OR_EXPIRED_REFRESH_TOKEN
 * 404 - EMPLOYEE_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const refreshEmployeeAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return sendError(res, {
        message: "Employee refresh token is required",
        statusCode: 401,
        errorCode: "REFRESH_TOKEN_REQUIRED"
      });
    }
    const accessToken = await refreshEmployeeAccessTokenService(refreshToken);
    return sendSuccess(
      res,
      { accessToken },
      200,
      "Employee access token refreshed successfully"
    );
  } catch (error) {
    console.error("Employee Refresh Token Error:", error);
    return handleError(res, error);
  }
};