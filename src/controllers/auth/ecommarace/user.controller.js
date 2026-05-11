import { sendSuccess } from "../../../helpers/response.helper.js";
import { handleError, sendError } from "../../../helpers/error.helper.js";
import { registerUserService, loginUserService, verifyEmailService, forgotPasswordService, resetPasswordService, refreshAccessTokenService, updateUserProfileService, getUserDashboardService } from "../../../services/auth/user.service.js";
import { validateRegisterBody, validateLoginBody, validateResetPasswordBody } from "./user.validator.js";
import passport from "passport";
import {getPagination} from "../../../../src/helpers/pagination.helper.js";
import User from "../../../models/ecommarace/user.model.js";


/**
 * @function registerUser
 *
 * @params
 * body: {
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   password: string,
 *   instituteName: string
 * }
 *
 * @process
 * 1. Validate required request fields
 * 2. Check if user already exists using email
 * 3. Create a new user record
 * 4. Generate email verification token
 * 5. Save verification token with expiry
 * 6. Send verification email to user
 * 7. Return success response
 *
 * @response
 * 201 { success: true, message: "Registered Successfully! Check your email to verify your account." }
 */
export const registerUser = async (req, res) => {
  try {
    const { value, error } = validateRegisterBody(req.body);
   if(error){
  return sendError(res,{
    message: "Validation failed",
    statusCode: 400,
    errorCode: "VALIDATION_ERROR",
    details: error.details.map((err) => err.message)
  });
  }
    const user = await registerUserService(value);
    return sendSuccess(
      res,
      { userId: user.userId },
      201,
      "Registered successfully. Please verify your email."
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function loginUser
 *
 * @params
 * body: {
 *   email: string,
 *   password: string
 * }
 *
 * @process
 * 1. Validate required request fields (email and password)
 * 2. Normalize email (convert to lowercase and trim spaces)
 * 3. Find user by email and include password field
 * 4. Check if user exists
 * 5. Verify if user's email is verified
 * 6. Check if the user account is active
 * 7. Compare entered password with hashed password using bcrypt
 * 8. Generate accessToken and refreshToken
 * 9. Store refreshToken in HTTP-only cookie
 * 10. Return accessToken and user basic information
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Login successful",
 *   data: {
 *     accessToken: string,
 *     user: {
 *       userId: string,
 *       firstName: string,
 *       lastName: string,
 *       email: string,
 *       instituteName: string
 *     }
 *   }
 * }
 */
export const loginUser = async (req, res) => {
  try {
    const { value, error } = validateLoginBody(req.body);
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message),
      });
    }
    const { accessToken, refreshToken, user } = await loginUserService(value);
    // store refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return sendSuccess(res, { accessToken, user }, 200, "Login successful");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function verifyEmail
 *
 * @params
 * params: {
 *   token: string
 * }
 *
 * @process
 * Validate that verification token is provided in request params
 * Find user using emailVerificationToken.token and check token expiration
 * Return error if token is invalid or expired
 * Mark user email as verified
 * Remove email verification token from user record
 * Save updated user in database
 * Return success response after successful verification
 *
 * @response
 * 200 { success: true, message: "Email verified successfully! You can now log in." }
 */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return sendError(res, {
        message: "Verification token is required",
        statusCode: 400,
        errorCode: "TOKEN_REQUIRED"
      });
    }
    await verifyEmailService(token);
    return sendSuccess(
      res,
      null,
      200,
      "Email verified successfully! You can now log in."
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function logoutUser
 *
 * @params
 * cookies: {
 *   refreshToken: string,
 *   accessToken: string
 * }
 *
 * @process
 * Clear refresh token stored in browser cookies
 * Clear access token cookie if present
 * Invalidate user session on the client side
 * Return success response confirming logout
 *
 * @response
 * 200 { success: true, message: "Logged out successfully" }
 */
export const logoutUser = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });
    return sendSuccess(res, null, 200, "Logged out successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function refreshAccessToken
 *
 * @params
 * cookies: {
 *   refreshToken: string
 * }
 *
 * @process
 * Retrieve refresh token from request cookies
 * Validate that refresh token exists
 * Verify refresh token using JWT secret
 * Extract userId from decoded token payload
 * Find user in database using userId
 * Return error if user does not exist
 * Generate a new access token for the user
 * Return success response with the new access token
 *
 * @response
 * 200 { success: true, message: "Access token refreshed successfully", data: { accessToken: string } }
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken){
      return sendError(res, {
        message: "Refresh token is required",
        statusCode: 401,
        errorCode: "REFRESH_TOKEN_MISSING"
      });
    }
    const accessToken = await refreshAccessTokenService(refreshToken);
    return sendSuccess(
      res,
      { accessToken },
      200,
      "Access token refreshed successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function googleAuth
 *
 * @params
 * none
 *
 * @process
 * Initiate Google OAuth authentication using Passport
 * Redirect user to Google consent screen
 * Request access to user's profile and email information
 * After successful authentication Google redirects back to the application callback URL
 *
 * @response
 * Redirects user to Google authentication page
 */
export const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

/**
 * @function googleCallback
 *
 * @params
 * query: OAuth response from Google
 *
 * @process
 * Authenticate user using Google OAuth strategy through Passport
 * Handle authentication errors and redirect user to login page if authentication fails
 * Retrieve authenticated user returned by Passport
 * Generate access token and refresh token for the authenticated user
 * Store refresh token in secure HTTP-only cookie
 * Redirect user to frontend OAuth success page with the access token
 *
 * @response
 * Redirects user to frontend success page after successful authentication
 */
export const googleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, async (err, user) => {
    try {
      if (err || !user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=google-failed`);
      }
      const { accessToken, refreshToken } = generateTokens(user);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.redirect(
        `${process.env.FRONTEND_URL}/oauth-success?accessToken=${accessToken}`
      );
    } catch (error) {
      console.error("Google Callback Error:", error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=server-error`);
    }
  })(req, res, next);
};

/**
 * @function microsoftAuth
 *
 * @params
 * none
 *
 * @process
 * Initiate Microsoft OAuth authentication using Passport
 * Request permission to access user's basic profile information
 * Redirect user to Microsoft login and consent screen
 * After successful authentication Microsoft redirects user to the callback URL
 *
 * @response
 * Redirects user to Microsoft authentication page
 */
export const microsoftAuth = passport.authenticate("microsoft", {
  scope: ["user.read"],
});

/**
 * @function microsoftCallback
 *
 * @params
 * query: OAuth response from Microsoft
 *
 * @process
 * Authenticate user using Microsoft OAuth strategy through Passport
 * Handle authentication errors and redirect user to login page if authentication fails
 * Retrieve authenticated user returned by Passport
 * Generate access token and refresh token for the authenticated user
 * Store refresh token in secure HTTP-only cookie
 * Redirect user to frontend OAuth success page with the access token
 *
 * @response
 * Redirects user to frontend success page after successful authentication
 */
export const microsoftCallback = (req, res, next) => {
  passport.authenticate("microsoft", { session: false }, async (err, user) => {
    try {
      if (err || !user) {
        console.error("Microsoft auth error:", err);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=microsoft-failed`);
      }
      const { accessToken, refreshToken } = employeeGenerateTokens(user);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.redirect(
        `${process.env.FRONTEND_URL}/oauth-success?accessToken=${accessToken}`
      );
    } catch (error) {
      console.error("Microsoft Callback Error:", error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=server-error`);
    }
  })(req, res, next);
};

/**
 * @function getAllUsers
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Retrieve pagination values using shared pagination utility
 * Fetch users from database while excluding password field
 * Count total number of users
 * Return paginated users with pagination metadata
 *
 * @response
 * 200 { success: true, message: "Users fetched successfully", data: { users, pagination } }
 */
 export const getAllUsers = async (req, res) => {
   try {
    const { page, limit, skip } = getPagination(req.query);

    const users = await User.find()
      .select("-password")
      .skip(skip)
      .limit(limit)
      .lean();
    const totalUsers = await User.countDocuments();
    return sendSuccess(
      res,
      {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          limit,
        },
      },
      200,
      "Users fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function deleteUserById
 *
 * @params
 * params: {
 *   userId: string
 * }
 *
 * @process
 * Retrieve userId from request parameters
 * Validate that userId is provided
 * Find and delete the user from database using userId
 * Return error if user does not exist
 * Return success response after successful deletion
 *
 * @response
 * 200 { success: true, message: "User deleted successfully", data: { userId } }
 */
export const deleteUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return sendError(res, {
        message: "userId is required",
        statusCode: 400,
        errorCode: "USER_ID_REQUIRED",
      });
    }
    const deletedUser = await User.findOneAndDelete({ userId });
    if (!deletedUser) {
      return sendError(res, {
        message: "User not found",
        statusCode: 404,
        errorCode: "USER_NOT_FOUND",
      });
    }

    return sendSuccess(
      res,
      { userId },
      200,
      "User deleted successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function forgotPassword
 *
 * @params
 * body: {
 *   email: string
 * }
 *
 * @process
 * Retrieve email from request body
 * Validate that email is provided
 * Call forgot password service
 * Send password reset link to user email
 * Return success response
 *
 * @response
 * 200 { success: true, message: "Password reset link sent to your email" }
 */

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, {
        message: "Email is required",
        statusCode: 400,
        errorCode: "EMAIL_REQUIRED",
      });
    }

    await forgotPasswordService(email);

    return sendSuccess(
      res,
      null,
      200,
      "Password reset link sent to your email"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function resetPassword
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
 * Validate request body using Joi
 * Retrieve reset token from request parameters
 * Call reset password service with token and new password
 * Update user password if token is valid
 * Return success response
 *
 * @response
 * 200 { success: true, message: "Password reset successfully. Please login again." }
 */

export const resetPassword = async (req, res) => {
  try {
    const { value, error } = validateResetPasswordBody(req.body);
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        details: error.details.map((err) => err.message),
      });
    }
    const { token } = req.params;
    if (!token) {
      return sendError(res, {
        message: "Invalid or missing token",
        statusCode: 400,
      });
    }
    await resetPasswordService(token, value.newPassword);
    return sendSuccess(
      res,
      null,
      200,
      "Password reset successfully. Please login again."
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getUserDashboard
 *
 * @params
 * user: {
 *   email: string
 * }
 *
 * @process
 * Retrieve authenticated user's email from request object
 * Validate user authorization
 * Call dashboard service to fetch user data
 * Return user profile, addresses, orders and cart data
 *
 * @response
 * 200 { success: true, message: "Dashboard fetched successfully", data: dashboard }
 */

export const getUserDashboard = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
      });
    }
    const dashboard = await getUserDashboardService(userEmail);
    return sendSuccess(
      res,
      dashboard,
      200,
      "Dashboard fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateUserProfile
 *
 * @params
 * user: {
 *   email: string
 * }
 *
 * body: {
 *   firstName?: string,
 *   lastName?: string,
 *   instituteName?: string,
 *   phone?: string
 * }
 *
 * files: {
 *   avatar?: File
 * }
 *
 * @process
 * Retrieve authenticated user email from request
 * Validate user authorization
 * Call update profile service
 * Return updated user profile
 *
 * @response
 * 200 { success: true, message: "Profile updated successfully", data: user }
 */

export const updateUserProfile = async (req, res) => {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
      });
    }

    const updatedUser = await updateUserProfileService(
      userEmail,
      req.body,
      req.files
    );

    return sendSuccess(
      res,
      { user: updatedUser },
      200,
      "Profile updated successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getUserById
 *
 * @params
 * params: {
 *   userId: string
 * }
 *
 * @process
 * Retrieve userId from request params
 * Find user in database using userId
 * Exclude sensitive fields like password and tokens
 * Return user data if found
 *
 * @response
 * 200 { success: true, message: "User fetched successfully", data: user }
 */

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return sendError(res, {
        message: "UserId is required",
        statusCode: 400,
      });
    }
    const user = await User.findOne({ userId }).select(
      "-_id -password -resetPasswordToken -resetPasswordExpiresAt -emailVerificationToken -__v"
    );
    if (!user) {
      return sendError(res, {
        message: "User not found",
        statusCode: 404,
      });
    }
    return sendSuccess(
      res,
      user,
      200,
      "User fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getCurrentUser
 *
 * @params
 * user: {
 *   email: string
 * }
 *
 * @process
 * Retrieve authenticated user's email from request
 * Find user in database using email
 * Select only required fields
 * Return formatted user data
 *
 * @response
 * 200 { success: true, message: "User details fetched successfully", data: user }
 */

export const getCurrentUser = async (req, res) => {
  try {
    const { email } = req.user;
    if (!email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
      });
    }
    const user = await User.findOne({ email }).select(
      "firstName lastName email avatar"
    );
    if (!user) {
      return sendError(res, {
        message: "User not found",
        statusCode: 404,
      });
    }
    return sendSuccess(
      res,
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar || "",
      },
      200,
      "User details fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function changePassword
 *
 * @params
 * body: {
 *   oldPassword: string,
 *   newPassword: string
 * }
 *
 * @process
 * Validate old and new password
 * Fetch authenticated user from database
 * Compare old password with stored password
 * Update password if valid
 * Invalidate existing refresh token
 *
 * @response
 * 200 { success: true, message: "Password changed successfully. Please log in again." }
 */

export const changePassword = async (req, res) => {
  try {
    const { value, error } = changePasswordValidator(req.body);

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        details: error.details.map((err) => err.message),
      });
    }

    const { oldPassword, newPassword } = value;

    await changePasswordService(req.user.id, oldPassword, newPassword);

    return sendSuccess(
      res,
      null,
      200,
      "Password changed successfully. Please log in again."
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deleteAllUsers
 *
 * @process
 * Prevent execution in production environment
 * Delete all users from database
 * Return number of deleted records
 *
 * @response
 * 200 { success: true, message: "All user data deleted successfully", data: { deletedCount } }
 */

export const deleteAllUsers = async (req, res) => {
  try {
    const result = await User.deleteMany({});
    return sendSuccess(
      res,
      { deletedCount: result.deletedCount },
      200,
      "All user data deleted successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

