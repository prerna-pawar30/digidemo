import Joi from "joi";

export const createBlogValidator = Joi.object({
  title: Joi.string().trim().required(),
  slug: Joi.string().trim().optional().allow(""),
  description: Joi.string().trim().optional().allow(""),
  contentMarkdown: Joi.string().required(),

  images: Joi.array().items(Joi.string()).default([]),
  category: Joi.string().trim().optional().allow(""),
  tags: Joi.array().items(Joi.string()).default([]),
  featuredImage: Joi.string().trim().required().allow(""),

  metaTitle: Joi.string().trim().optional().allow(""),
  metaDescription: Joi.string().trim().optional().allow(""),
  keywords: Joi.array().items(Joi.string()).default([]),
  canonicalUrl: Joi.string().trim().optional().allow(""),

  status: Joi.string().valid("draft", "published").default("draft"),
});

export const updateBlogValidator = Joi.object({
  title: Joi.string().trim().optional(),
  slug: Joi.string().trim().optional().allow(""),
  description: Joi.string().trim().optional().allow(""),
  contentMarkdown: Joi.string().optional(),

  images: Joi.array().items(Joi.string()).optional(),
  category: Joi.string().trim().optional().allow(""),
  tags: Joi.array().items(Joi.string()).optional(),
  featuredImage: Joi.string().trim().optional().allow(""),

  metaTitle: Joi.string().trim().optional().allow(""),
  metaDescription: Joi.string().trim().optional().allow(""),
  keywords: Joi.array().items(Joi.string()).optional(),
  canonicalUrl: Joi.string().trim().optional().allow(""),

  status: Joi.string().valid("draft", "published").optional(),
});