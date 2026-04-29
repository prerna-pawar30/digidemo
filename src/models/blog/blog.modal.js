import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";
import slugify from "slugify";
const { Schema, model } = mongoose;

const blogSchema = new Schema(
  {
    blogId: {
      type: String,
      unique: true,
      default: () => uuidv6(),
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    contentMarkdown: {
      type: String,
      required: true,
    },

    images: {
      type: [String],
      default: [],
    },

    category: {
      type: String,
      default: "",
      trim: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    featuredImage: {
      type: String,
      default: "",
    },

    metaTitle: {
      type: String,
      default: "",
      trim: true,
    },

    metaDescription: {
      type: String,
      default: "",
      trim: true,
    },
    keywords: {
      type: [String],
      default: [],
    },
    canonicalUrl: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

blogSchema.pre("validate", function () {
  if (this.title && !this.slug) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
    });
  }

  if (this.slug) {
    this.slug = slugify(this.slug, {
      lower: true,
      strict: true,
    });
  }
  if (!this.metaTitle && this.title) {
    this.metaTitle = this.title;
  }
  if (!this.metaDescription && this.contentMarkdown) {
    const plainText = this.contentMarkdown
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/[#_*>`~\-\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    this.metaDescription = plainText;
  }
  if (!this.keywords.length) {
    this.keywords = [...new Set([...this.tags, this.category].filter(Boolean))];
  }
  if (!this.canonicalUrl && this.slug) {
    this.canonicalUrl = `/blog/${this.slug}`;
  }
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});
export default model("Blog", blogSchema);