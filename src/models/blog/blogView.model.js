// models/blogView.model.js

import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";

const { Schema, model } = mongoose;

const blogViewSchema = new Schema(
  {
    blogViewId: {
      type: String,
      unique: true,
      default: () => uuidv6(),
    },

    blog: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },

    ipAddress: String,
    userAgent: String,
    referrer: String,

    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default model("BlogView", blogViewSchema);