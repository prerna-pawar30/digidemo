/**
 * Send Success Response
 */
export const sendSuccess = (
  res,
  data = null,
  statusCode = 200,
  message = "Success"
) => {

  return res.status(statusCode).json({
    success: true,
    message,
    statusCode,
    data,
  });

};