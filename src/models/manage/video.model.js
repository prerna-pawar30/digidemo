import mongoose from "mongoose";
const { Schema } = mongoose;

const videoItemSchema = new Schema(
  {
    ytVideoId: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    link: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false } // each video gets its own _id
);

const YTVideoSchema = new Schema(
  {
    videos: {
      type: [videoItemSchema], // 🔥 ARRAY INSIDE SINGLE DOCUMENT
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("YTVideo", YTVideoSchema);

