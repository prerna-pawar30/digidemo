// validators/category.validator.js

import Joi from "joi";

/* ============================
   CREATE CATEGORY VALIDATOR
============================ */
export const createCategoryValidator = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Category name is required",
      "string.min": "Category name must be at least 2 characters",
      "any.required": "Category name is required",
    }),

  permission: Joi.string()
    .trim()
    .optional()
    .messages({
      "string.base": "Permission must be a string",
    }),
});


/* ============================
   UPDATE CATEGORY VALIDATOR
============================ */
export const updateCategoryValidator = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      "string.min": "Category name must be at least 2 characters",
    }),

  permission: Joi.string()
    .trim()
    .optional()
    .messages({
      "string.base": "Permission must be a string",
    }),
});