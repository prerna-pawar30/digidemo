import mongoose from "mongoose";

const stockAuditLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true, // for faster searching
    },
    action: {
      type: String,
      required: true,
      enum: ["add", "deduct"],
      lowercase: true,
      trim: true,
    },
    products: [
      {
        productId: {
          type: String,
          required: true,
        },
        variantId: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
      },
    ],

    time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);
export default mongoose.model("StockAuditLog", stockAuditLogSchema);