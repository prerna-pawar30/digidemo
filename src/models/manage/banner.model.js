import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    bannerId: {
      type: String,
      required: true,
      unique: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },

    filterBy: {
      type: String,
      enum: ["category", "brand"],
      required: true,
    },

    filterId: {
      type: String,
      required: true,
    },

    displayOrder: {
      type: Number,
      required: true,
      min: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/**
 *  Prevent duplicate order for ACTIVE banners
 */
bannerSchema.index(
  { displayOrder: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;
