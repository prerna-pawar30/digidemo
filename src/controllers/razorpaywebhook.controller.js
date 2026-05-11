import crypto from "crypto";
import mongoose from "mongoose";
import { sendError, handleError } from "../helpers/error.helper.js";
import { sendSuccess } from "../helpers/response.helper.js";
import Order from "../models/ecommarace/order.model.js";

export const razorpayWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return sendError(res, {
        message: "Webhook secret not configured",
        statusCode: 500,
      });
    }

    const razorpaySignature = req.headers["x-razorpay-signature"];

    if (!razorpaySignature) {
      return sendError(res, {
        message: "Signature missing",
        statusCode: 401,
      });
    }

    /* =====================================================
       VERIFY SIGNATURE
    ===================================================== */

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return sendError(res, {
        message: "Invalid webhook signature",
        statusCode: 401,
      });
    }

    const payload = JSON.parse(req.body.toString());
    const event = payload.event;

    console.log("RAZORPAY WEBHOOK EVENT:", event);

    /* =====================================================
       HANDLE EVENTS
    ===================================================== */

    switch (event) {
      /* ===============================
         REFUND EVENTS
      =============================== */
      case "refund.created":
      case "refund.processed":
      case "refund.failed": {
        const refund = payload?.payload?.refund?.entity;

        if (!refund) {
          throw new Error("Invalid refund payload");
        }
        const razorpayRefundId = refund.id;
        const razorpayPaymentId = refund.payment_id;
        const refundAmount = refund.amount / 100;

        const order = await Order.findOne({ razorpayPaymentId }).session(session);

        if (!order) {
          throw new Error("Order not found for refund");
        }

        /* ---------- REFUND CREATED ---------- */
        if (event === "refund.created") {
          if (order.paymentStatus !== "refunded") {
            order.paymentStatus = "refund_pending";
          }
        }

        /* ---------- REFUND PROCESSED ---------- */
        if (event === "refund.processed") {
          // idempotency protection
          if (order.razorpayRefundId === razorpayRefundId) {
            await session.commitTransaction();
            session.endSession();

            return sendSuccess(res, {}, 200, "Refund already processed");
          }
          order.razorpayRefundId = razorpayRefundId;

          // accumulate refunds safely
          order.refundAmount = (order.refundAmount || 0) + refundAmount;
          if (order.refundAmount >= order.grandTotal) {
            order.paymentStatus = "refunded";
          } else {
            order.paymentStatus = "partially_refunded";
          }
          order.refundedAt = new Date();
        }

        /* ---------- REFUND FAILED ---------- */
        if (event === "refund.failed") {
          if (order.paymentStatus !== "refunded") {
            order.paymentStatus = "refund_failed";
          }
        }

        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        return sendSuccess(res, {}, 200, "Refund webhook processed");
      }

      /* ===============================
         DEFAULT (IGNORE EVENTS)
      =============================== */
      default: {
        await session.commitTransaction();
        session.endSession();

        return sendSuccess(res, {}, 200, "Event ignored");
      }
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("RAZORPAY WEBHOOK ERROR:", error);

    return handleError(res, error);
  }
};