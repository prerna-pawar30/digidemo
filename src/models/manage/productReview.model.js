import mongoose from "mongoose";

const ratingEnum = ["Excellent", "Good", "Average", "Dissatisfied"];

const productTypeEnum = [
  "Scan Body",
  "Horizontal Scan Body",
  "Lab Analog",
  "Screws",
  "Abutment",
];

/* ---------- Rating Schema ---------- */
const ratingSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    score: {
      type: String,
      enum: ratingEnum,
      required: true,
    },
  },
  { _id: false }
);

/* ---------- Category Review Schema ---------- */
const categoryReviewSchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      enum: productTypeEnum,
      required: true,
      trim: true,
    },

    ratings: {
      type: [ratingSchema],
      required: true,
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one rating is required",
      },
    },

    overallSatisfaction: {
      type: String,
      enum: ratingEnum,
      required: true,
    },

    comments: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

/* ---------- Reviewer Info Schema ---------- */
const reviewerInfoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    instituteName: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    age: {
      type: Number,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/* ---------- Product Review Schema ---------- */
const productReviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    reviewerInfo: {
      type: reviewerInfoSchema,
      required: true,
    },

    categoryReviews: {
      type: [categoryReviewSchema],
      required: true,
      validate: [
        {
          validator: function (value) {
            return Array.isArray(value) && value.length > 0;
          },
          message: "At least one category review is required",
        },
        {
          validator: function (value) {
            const productTypes = value.map((item) => item.productType);
            return new Set(productTypes).size === productTypes.length;
          },
          message: "Duplicate product types are not allowed in the same review",
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("ProductReview", productReviewSchema);