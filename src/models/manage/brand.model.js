import mongoose, { Schema } from "mongoose";

const FileSchema = new Schema(
  {
    fileId: { type: String },
    category: { 
      type: [String],
      enum: ["Abutment-Level", "General", "Screw-Retained"],
      required: [true, "Category is required for each file"],
    },
    fileLink: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }  
);

const BrandSchema = new Schema(
  {
    brandId: { type: String },
    brandName: {
      type: String,
      required: [true, "Brand name is required"],
      unique: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      required: [true, "Logo is required"],
    },
    files: [FileSchema],   // use sub-schema
  },
  { timestamps: true }
);

export default mongoose.model("Brand", BrandSchema);


