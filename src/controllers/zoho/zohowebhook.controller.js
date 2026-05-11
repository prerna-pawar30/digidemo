import { zohoWebhookService } from "../services/zohoWebhook.service.js";
import { sendSuccess, handleError, errorResponse } from "../helpers/error.helper.js";

/**
 * @function zohoWebhookHandler
 *
 * @description
 * Handles Zoho payment webhooks for orders.
 * Verifies the HMAC signature, parses the event, and updates the corresponding order.
 *
 * @process
 * 1. Extract `x-zoho-signature` from request headers
 * 2. Generate HMAC SHA256 using secret and compare signatures
 * 3. Parse payload and determine `event_type`
 * 4. Handle different event types:
 *    - `payment.success`: mark order as paid and update payment info
 *    - `payment.failed`: update order status to failed
 *    - `refund.processed`: log refund event
 * 5. Send success response
 *
 * @response
 * 200 { success: true } - webhook processed successfully
 * 401 { success: false, message: "Invalid webhook signature" } - signature verification failed
 * 500 { success: false, message: "<error_message>" } - unexpected errors
 *
 * @example
 * router.post("/zoho-webhook", zohoWebhookHandler);
 */
export const zohoWebhookHandler = async (req, res) => {
  try {
    const rawBody = req.body; // raw body is required for signature verification
    const headers = req.headers;

    const result = await zohoWebhookService(rawBody, headers);

    return sendSuccess(res, result, 200, "Webhook processed successfully");
  } catch (error) {
    if (error.statusCode === 401) {
      return errorResponse(res, { message: error.message, statusCode: 401 });
    }
    return handleError(res, error);
  }
};