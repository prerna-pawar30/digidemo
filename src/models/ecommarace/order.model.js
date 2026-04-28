import mongoose from "mongoose";
/* ---------- ADDRESS ---------- */
const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    area: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);
/* ---------- ORDER ITEM ---------- */
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    variantId: {
      type: String,
      required: true,
    },
    sku: String,
    productName: String,
    variantName: String,
    categoryName: { type: String },

    price: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true
    },

    // Added for return tracking
    returnedQuantity: {
      type: Number,
      default: 0,
    },

    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    image: String,
  },
  { _id: false }
);

/* ---------- COUPON SNAPSHOT ---------- */
const couponSchema = new mongoose.Schema(
  {
    couponRef:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    couponId: { type: String, default: null },
    code: { type: String, default: null },
    couponType:{
      type: String,
      enum: [
        "PERCENT",
        "FIXED",
        "FREESHIP",
        "BUY_X_GET_Y_FREE",
        "BUY_X_GET_Y_DISCOUNT",
        "CASHBACK",
      ],
      default: null,
    },
    discountAmount: { type: Number, default: 0 },
    freeShipping: { type: Boolean, default: false },
  },
  { _id: false }
);

/* ---------- ORDER ---------- */
const orderSchema = new mongoose.Schema(
  {
    iId:{ type: String, unique: true },
    orderId: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },
    shippingCharge: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    coupon: {
      type: couponSchema,
      default: null,
    },
    organizationName: { type: String, default: null },
    gstAmount: { type: Number, default: 0 },
    gstPercentage: { type: Number, default: 0 },
    gstNumber: { type: String, default: null },
    billingAddress: {
      type: addressSchema,
      required: true,
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["RAZORPAY"],
      default: "RAZORPAY",
    },
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "refund_pending",
        "partial_refunded",
        "refund_failed"
      ],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "placed",
        "packed",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "partial_returned",
        "returned",
      ],
      default: "pending",
    },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    /* ================= RETURN SYSTEM ================= */
    returnRequests: [
      {
        requestId: { type: String, required: true },
        items: [
          {
            productId: { type: String, required: true },
            variantId: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            reason: { type: String, default: null },
          },
        ],
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        processedAt: {
          type: Date,
          default: null,
        },
      },
    ],
    corourseServiceName: { type: String, default: null },
    DOCNumber:{ type: String, default: null },
    /* ================= REFUND SYSTEM ================= */
    refundAmount: {
      type: Number,
      default: 0,
    },
    partialRefundAmount: {
      type: Number,
      default: 0,
    },
    remainingRefundAmount: {
      type: Number,
      default: 0,
    },
    refundHistory: [
      {
        refundId: String,
        amount: Number,
        refundedBy: String,
        refundedAt: Date,
        refundStatus: String,
      },
    ],
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    razorpayRefundId: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    statusUpdatedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);
export default  mongoose.model("Order", orderSchema);