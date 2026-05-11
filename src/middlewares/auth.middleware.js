
/**
 * @function authToken
 *
 * @description
 * Middleware to verify JWT access token and attach decoded user info to the request.
 *
 * @process
 * 1. Extract Authorization header from request
 * 2. Validate header exists and starts with "Bearer "
 * 3. Extract token from header
 * 4. Verify token using ACCESS_TOKEN_SECRET
 * 5. Attach decoded user info (`id` and `email`) to `req.user`
 * 6. Call `next()` to continue if token is valid
 *
 * @response
 * 401 { success: false, message: "Authorization token missing" } - if no header or invalid format
 * 401 { success: false, message: "Access token expired" } - if token expired
 * 401 { success: false, message: "Invalid token" } - if token is invalid
 * 401 { success: false, message: "Unauthorized access" } - for other errors
 */
import jwt from "jsonwebtoken";
import { sendError, handleError } from "../helpers/error.helper.js";

const authToken = async (req, res, next) => {
  try {
    /* =========================
       CHECK AUTH HEADER
    ========================= */
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, {
        message: "Authorization token missing",
        statusCode: 401,
        errorCode: "AUTH_HEADER_MISSING",
      });
    }

    /* =========================
       EXTRACT TOKEN
    ========================= */
    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new Error("TOKEN_EXPIRED");
      }
      if (err.name === "JsonWebTokenError") {
        throw new Error("INVALID_TOKEN");
      }
      throw err;
    }

    /* =========================
       ATTACH USER
    ========================= */
    req.user = {
      id: decoded.id,
      email: decoded.email,
    };
    next();
  } catch (error) {
    return handleError(res, error);
  }
};
export default authToken;





  