import mongoose from "mongoose";

// Each log entry inside a software's library
const libraryLogsSchema = new mongoose.Schema(
  {
    libraryObjectId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    libraryId: {
      type: String,
      trim: true,
    },
    isdelivered: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true } 
);

// Each software added to a customer — has its own library array
const softwareSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    library: {
      type: [libraryLogsSchema],
      default: [],
    },
  },
  { _id: true, timestamps: true } 
);

const customerDataSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    isEmailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    address: {
      line1: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    software: {
      type: [softwareSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("CustomerData", customerDataSchema);