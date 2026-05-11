/**
 * @function errorHandler
 *
 * @description
 * Global Express error-handling middleware.
 * Catches all unhandled errors and sends a standardized JSON response.
 *
 * @process
 * 1. Extract `statusCode` from the error object, default to 500
 * 2. Log detailed error information (message, stack, request path, method)
 * 3. Return JSON response with standardized error structure
 *
 * @response
 * 500 { 
 *   message: "<error_message>", 
 *   error: {
 *     type: "<error_type>",
 *     path: "<request_path>",
 *     method: "<request_method>",
 *     timestamp: "<ISO_timestamp>"
 *   }
 * }
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  console.error("Error:", {
    message: err.message,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: {
      type: err.name || "UnhandledError",
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  });
};