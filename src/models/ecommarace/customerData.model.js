import mongoose from "mongoose";

const libraryLogsSchema = new mongoose.Schema(
  {
      libraryObjectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    libraryId: {
      type: String, 
      required: true,
      trim: true,
    },
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    category:{
      type: String,
      required: true,
      trim: true,
    },
     isdelivered:{
      type: Boolean,
      default: false,
    },
    date:{
      type: Date,
      default: Date.now,
    },
  },
  { _id: true } // keeps log entry _id
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
      line1: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      postalCode: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
    },
    logLibrary: {
      type: [libraryLogsSchema],
      required: true,
    },
  },
  { timestamps: true }
);
export default mongoose.model("CustomerData", customerDataSchema);

