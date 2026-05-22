// models/blog.model.js

import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";
import slugify from "slugify";

const { Schema, model } = mongoose;

const commentSchema = new Schema(
      {
    commentId: {
      type: String,
      default: () => uuidv6(),
    },
    name: { type: String, required: true },
    company: { type: String, default: "" },
    city: { type: String, default: "" },
    review: { type: String, required: true },
  },
  { timestamps: true }
);

const blogSchema = new Schema(
  {
    blogId: {
      type: String,
      unique: true,
      default: () => uuidv6(),
    },

    title: { type: String, required: true, trim: true },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    contentMarkdown: { type: String, required: true },

    category: { type: String, default: "" },
    tags: { type: [String], default: [] },
    featuredImage:{
      type:String
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    publishedAt: { type: Date, default: null },

    comments: [commentSchema],

    views: {
      type: Number,
      default: 0,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true }
);

// 🔥 Hooks
blogSchema.pre("validate", function () {
  if (this.title && !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }

  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

export default model("Blog", blogSchema);