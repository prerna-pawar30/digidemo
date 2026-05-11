// import mongoose from "mongoose";
// const { Schema, model, Types } = mongoose;
// import User from "../ecommarace/user.model.js";
// import { v6 as uuidv6 } from "uuid";

// /* ---------- Review Schema ---------- */
// const reviewSchema = new Schema({
//   reviewId: { type: String },
//   user: { type: Types.ObjectId, ref: "User", default: null },
//   rating: { type: Number, min: 1, max: 5, required: true },
//   comment: { type: String, trim: true },
//   isHomePage: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now },
// });

// /* ---------- Variant Schema ---------- */
// const VariantSchema = new Schema(
//   {
//     variantId: { type: String, default: () => uuidv6() },
//     sku: { type: String },
//     name: { type: String, required: true },

//     attributes: [
//       {
//         attrId: { type: String, default: () => uuidv6() },
//         key: { type: String, required: true, trim: true },
//         value: {
//           type: [String],
//           required: true,
//           validate: v => Array.isArray(v) && v.length > 0,
//         },
//       },
//     ],

//     priceType: {
//       type: String,
//       enum: ["PRODUCT", "VARIANT"],
//       default: "PRODUCT",
//     },
//     variantPrice: { type: Number },

//     imageType: {
//       type: String,
//       enum: ["PRODUCT", "VARIANT"],
//       default: "PRODUCT",
//     },
//     variantImages: { type: [String], default: [] },
//     variantStock: { type: Number, default: 0, min: 0 },
//   },
//   { _id: false }
// );

// /* ---------- Product Schema ---------- */
// const ProductSchema = new Schema(
//   {
//     productId: { type: String, unique: true, required: true },
//     name: { type: String, required: true, trim: true },
//     sku: { type: String },

//     price: { type: Number },
//     images: { type: [String], required: true },

//     stockType: {
//       type: String,
//       enum: ["PRODUCT", "VARIANT"],
//       default: "PRODUCT",
//       required: true,
//     },

//     productStock: { type: Number, default: 0, min: 0 },

//     category: { type: Types.ObjectId, ref: "Category", required: true },
//     brand: [{ type: Types.ObjectId, ref: "Brand", required: true }],
//     tags: [String],
//     labels: [String],

//     shortDescription: { type: String, trim: true },

//     description: [
//       {
//         paragraphId: { type: String, default: () => uuidv6() },
//         text: { type: String, required: true, trim: true },
//         image: { type: [String], default: [] },
//       },
//     ],

//     specification: [
//       {
//         specId: { type: String, default: () => uuidv6() },
//         key: { type: String, required: true },
//         value: { type: Schema.Types.Mixed, required: true },
//       },
//     ],

//     variants: {
//       type: [VariantSchema],
//       required: true,
//       validate: v => Array.isArray(v) && v.length > 0,
//     },

//     vendor: { type: Types.ObjectId, ref: "Vendor" },
//     createdBy: { type: Types.ObjectId, ref: "User" },

//     status: {
//       type: String,
//       enum: ["draft", "active"],
//       default: "draft",
//     },

//     reviews: [reviewSchema],
//     ratingAvg: { type: Number, default: 0 },
//     ratingCount: { type: Number, default: 0 },

//     views: { type: Number, default: 0 },
//     purchases: { type: Number, default: 0 },

//     material: { type: String, enum: ["Titanium", "Stainless Steel"] },
//     seriesNumber: { type: String },
//     subSeriesNumber: { type: String },

//     metadata: { type: Map, of: Schema.Types.Mixed },
//   },
//   { timestamps: true }
// );

// /* ---------- Virtual: Availability ---------- */
// ProductSchema.virtual("isAvailable").get(function () {
//   if (this.stockType === "PRODUCT") {
//     return this.productStock > 0;
//   }
//   return this.variants.some(v => v.variantStock > 0);
// });

// /* ---------- Stock Enforcement ---------- */
// ProductSchema.pre("save", function (next) {
//   if (this.stockType === "PRODUCT"){
//     this.variants.forEach(v => {
//       v.variantStock = 0;
//     });
//   }

//   if (this.stockType === "VARIANT"){
//     this.productStock = 0;

//     const invalid = this.variants.some(
//       v => typeof v.variantStock !== "number" || v.variantStock < 0
//     );

//     if (invalid){
//       return next(
//         new Error("Each variant must have non-negative variantStock")
//       );
//     }
//   }

//   next();
// });
// export default model("Product", ProductSchema);




import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";

const { Schema, model, Types } = mongoose;

/* ---------- Review Schema ---------- */
const reviewSchema = new Schema({
  reviewId: { type: String, default: () => uuidv6() },
  user: { type: Types.ObjectId, ref: "User", default: null },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true },
  isHomePage: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

/* ---------- Variant Schema ---------- */
const VariantSchema = new Schema(
  {
    variantId: { type: String, default: () => uuidv6() },
    sku: { type: String, trim: true },
    name: { type: String, required: true, trim: true },

    attributes: [
      {
        attrId: { type: String, default: () => uuidv6() },
        key: { type: String, required: true, trim: true },
        value: {
          type: [String],
          required: true,
          validate: {
            validator: (v) => Array.isArray(v) && v.length > 0,
            message: "Attribute value must contain at least one item",
          },
        },
      },
    ],

    priceType: {
      type: String,
      enum: ["PRODUCT", "VARIANT"],
      default: "PRODUCT",
    },

    variantPrice: { type: Number, min: 0 },

    imageType: {
      type: String,
      enum: ["PRODUCT", "VARIANT"],
      default: "PRODUCT",
    },

    variantImages: { type: [String], default: [] },
    variantStock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/* ---------- Product Schema ---------- */
const ProductSchema = new Schema(
  {
    productId: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },

    price: { type: Number, min: 0 },

    images: {
      type: [String],
      required: true,
      default: [],
    },

    stockType: {
      type: String,
      enum: ["PRODUCT", "VARIANT"],
      default: "PRODUCT",
      required: true,
    },

    productStock: { type: Number, default: 0, min: 0 },

    category: { type: Types.ObjectId, ref: "Category", required: true },
    brand: [{ type: Types.ObjectId, ref: "Brand", required: true }],
    tags: [String],
    labels: [String],

    shortDescription: { type: String, trim: true },

    description: [
      {
        paragraphId: { type: String, default: () => uuidv6() },
        text: { type: String, required: true, trim: true },
        image: { type: [String], default: [] },
      },
    ],

    specification: [
      {
        specId: { type: String, default: () => uuidv6() },
        key: { type: String, required: true, trim: true },
        value: { type: Schema.Types.Mixed, required: true },
      },
    ],

    variants: {
      type: [VariantSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one variant is required",
      },
    },

    vendor: { type: Types.ObjectId, ref: "Vendor" },
    createdBy: { type: Types.ObjectId, ref: "User" },

    status: {
      type: String,
      enum: ["draft", "active"],
      default: "draft",
    },

    reviews: [reviewSchema],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    views: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },

    material: { type: String, enum: ["Titanium", "Stainless Steel"] },
    seriesNumber: { type: String, trim: true },
    subSeriesNumber: { type: String, trim: true },

    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { timestamps: true }
);

/* ---------- Virtual: Availability ---------- */
ProductSchema.virtual("isAvailable").get(function () {
  if (this.stockType === "PRODUCT") {
    return this.productStock > 0;
  }

  return this.variants.some((v) => v.variantStock > 0);
});

/* ---------- Stock Enforcement ---------- */
ProductSchema.pre("save", function () {
  if (this.stockType === "PRODUCT") {
    this.variants.forEach((v) => {
      v.variantStock = 0;
    });
  }

  if (this.stockType === "VARIANT") {
    this.productStock = 0;

    const invalid = this.variants.some(
      (v) => typeof v.variantStock !== "number" || v.variantStock < 0
    );

    if (invalid) {
      return next(
        new Error("Each variant must have non-negative variantStock")
      );
    }
  }
});

export default model("Product", ProductSchema);