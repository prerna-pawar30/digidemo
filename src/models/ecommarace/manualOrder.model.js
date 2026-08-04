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

/* ---------- CUSTOMER ---------- */
const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: null },
    organizationName: { type: String, default: null },
  },
  { _id: false }
);

/* ---------- ORDER ITEM ---------- */
const manualOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    sku: String,
    productName: String,
    variantName: String,
    categoryName: { type: String },

    price: { type: Number, required: true },
    quantity: { type: Number, required: true },

    returnedQuantity: { type: Number, default: 0 },

    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    image: String,
  },
  { _id: false }
);

/* ---------- RETURN REQUEST ---------- */
const returnRequestSchema = new mongoose.Schema(
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
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  { _id: false }
);

/* ---------- MANUAL ORDER ---------- */
const manualOrderSchema = new mongoose.Schema(
  {
    manualOrderId: {
      type: String,
      unique: true,
      required: true,
    },
    customer: {
      type: customerSchema,
      required: true,
    },
    items: {
      type: [manualOrderItemSchema],
      required: true,
    },
    shippingCharge: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
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
      enum: ["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"],
      default: "CASH",
    },
    paymentReference: { type: String, default: null },
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "paid",
        "refund_pending",
        "partial_refunded",
        "refunded",
        "refund_failed",
      ],
      default: "paid",
    },
    orderStatus: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "partial_returned",
        "returned",
      ],
      default: "delivered",
    },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },

    /* ================= RETURN SYSTEM ================= */
    returnRequests: [returnRequestSchema],

    corourseServiceName: { type: String, default: null },
    DOCNumber: { type: String, default: null },

    /* ================= REFUND SYSTEM ================= */
    refundAmount: { type: Number, default: 0 },
    partialRefundAmount: { type: Number, default: 0 },
    remainingRefundAmount: { type: Number, default: 0 },
    refundHistory: [
      {
        refundId: String,
        amount: Number,
        refundMode: String,
        refundReference: String,
        refundedBy: String,
        refundedAt: Date,
        refundStatus: String,
      },
    ],

    notes: { type: String, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    statusUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ManualOrder", manualOrderSchema);
