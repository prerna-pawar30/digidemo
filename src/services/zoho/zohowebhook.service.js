import crypto from "crypto";
import Order from "../models/order.model.js";

export const zohoWebhookService = async (rawBody, headers) => {
  const zohoSignature = headers["x-zoho-signature"];
  const secret = process.env.ZOHO_WEBHOOK_SECRET;

  // 1️⃣ Verify signature
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  if (generatedSignature !== zohoSignature) {
    const error = new Error("Invalid webhook signature");
    error.statusCode = 401;
    throw error;
  }

  // 2️⃣ Parse payload
  const payload = JSON.parse(rawBody.toString());
  const eventType = payload.event_type;
  console.log("Zoho Webhook Event:", eventType);

  // 3️⃣ Handle events
  if (eventType === "payment.success") {
    const payment = payload.data.payment;
    await Order.findOneAndUpdate(
      { orderId: payment.reference_number },
      {
        isPaid: true,
        paymentId: payment.payment_id,
        paymentStatus: "SUCCESS",
      }
    );
  }

  if (eventType === "payment.failed") {
    const payment = payload.data.payment;
    await Order.findOneAndUpdate(
      { orderId: payment.reference_number },
      { paymentStatus: "FAILED" }
    );
  }

  if (eventType === "refund.processed") {
    console.log("Refund processed for order:", payload.data.refund);
  }

  return { processed: true };
};