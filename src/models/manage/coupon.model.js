import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const couponSchema = new Schema(
  {
    couponId: {
      type: String,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    couponType: {
      type: String,
      enum: [
        "PERCENT",
        "FIXED",
        "FREESHIP",
        "BUY_X_GET_Y_FREE",
        "BUY_X_GET_Y_DISCOUNT",
        "CASHBACK",
      ],
      required: true,
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    buyXGetY: {
      buyQuantity: { type: Number, default: 0 },
      getQuantity: { type: Number, default: 0 },
      buyBrand: { type: Types.ObjectId, ref: "Brand", default: null },
      buyCategory: { type: Types.ObjectId, ref: "Category", default: null },
      buyProducts: [{ type: String }], // UUIDv6 productId
      getBrand: { type: Types.ObjectId, ref: "Brand", default: null },
      getCategory: { type: Types.ObjectId, ref: "Category", default: null },
      getProducts: [{ type: String }], // UUIDv6 productId
      getDiscountPercent: { type: Number, default: 100 }, // 100% = free
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicableTo: {
      type: String,
      enum: ["ALL", "PRODUCT", "CATEGORY", "BRAND"],
      default: "ALL",
    },
    applicableProducts: [{ type: String }], // UUIDv6 productId
    applicableCategories: [{ type: Types.ObjectId, ref: "Category" }],
    applicableBrands: [{ type: Types.ObjectId, ref: "Brand" }],
    stackable: {
      type: Boolean,
      default: false,
    },
    autoApply: {
      type: Boolean,
      default: false,
    },
    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ----------------------------
   VALIDATIONS
-----------------------------*/
couponSchema.pre("save", function (next) {
  if (this.endDate < this.startDate) {
    return new Error("endDate cannot be before startDate");
  }
});

couponSchema.pre("save", function (next) {
  if (this.couponType === "PERCENT" && this.discountValue > 100) {
    return new Error("Percent discount cannot be greater than 100");
  }
});

export default model("Coupon", couponSchema);


