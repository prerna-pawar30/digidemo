import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
{
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    required: true,
    unique: true
  },
  razorpaySignature: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: "INR"
  },
  paymentStatus: {
    type: String,
    enum: ["success", "refunded"],
    default: "success"
  },
  paidAt: {
    type: Date,
    default: Date.now
  }
},
{ timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);