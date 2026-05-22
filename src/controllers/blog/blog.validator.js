import Joi from "joi";

export const createBlogValidator = Joi.object({
  title: Joi.string().trim().required(),
  slug: Joi.string().trim().optional().allow(""),
  description: Joi.string().trim().optional().allow(""),
  contentMarkdown: Joi.string().required(),
  images: Joi.array().items(Joi.string()).default([]),
  category: Joi.string().trim().optional().allow(""),
  tags: Joi.array().items(Joi.string()).default([]),
  metaDescription: Joi.string().trim().optional().allow(""),
  keywords: Joi.array().items(Joi.string()).default([]),
  status: Joi.string().valid("draft", "published").default("draft"),
  permission:Joi.string().required(),
});
export const updateBlogValidator = Joi.object({
  title: Joi.string().trim().optional(),
  slug: Joi.string().trim().optional().allow(""),
  description: Joi.string().trim().optional().allow(""),
  contentMarkdown: Joi.string().optional(),
  images: Joi.array().items(Joi.string()).optional(),
  category: Joi.string().trim().optional().allow(""),
  tags: Joi.array().items(Joi.string()).optional(),
  metaDescription: Joi.string().trim().optional().allow(""),
  keywords: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid("draft", "published").optional(),
  permission:Joi.string().required(),
});