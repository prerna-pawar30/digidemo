import ipRangeCheck from "ip-range-check";
import { sendError, handleError } from "../helpers/error.helper.js";

/**
 * @function punchAccessMiddleware
 *
 * @description
 * Middleware to restrict punch-in/out access to office IP addresses only.
 *
 * @process
 * 1. Extract client IP from `req.userIP`
 * 2. Compare against allowed office IP ranges using `ip-range-check`
 * 3. If IP is allowed, call `next()`
 * 4. If IP is not allowed, return 403 Forbidden with descriptive message
 *
 * @response
 * 403 { success: false, message: "Punch-in/out allowed only from office network" } - if IP not allowed
 * 500 { success: false, message: "<error_message>" } - for unexpected errors
 *
 * @example
 * router.post("/punch-in", authToken, punchAccessMiddleware, punchController);
 */
export const punchAccessMiddleware = (req, res, next) => {
  try {
    const userIp = req.userIP;
    console.log("Punch Access Middleware - User IP:", userIp);

    // Skip if IP not provided
    if (!userIp) return next();

    const OFFICE_IPS = ["150.107.241.0/24"];
    //const OFFICE_IPS = ["192.168.1.1"];
    const isAllowed = ipRangeCheck(userIp, OFFICE_IPS);

    if (!isAllowed) {
      return sendError(res, {
        message: "Punch-in/out allowed only from office network",
        statusCode: 403,
      });
    }

    next();
  } catch (error) {
    console.error("Punch Access Middleware Error:", error);
    return handleError(res, error);
  }
};