import Joi from "joi";

export const createBrandValidator = Joi.object({
  brandName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      "string.empty": "Brand brandName is required"
    }),
  categories: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
  permission: Joi.string().optional()
});

export const updateBrandValidator = Joi.object({
  brandName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  categories: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string())
    )
    .optional(),

  removeFileIds: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string())
    )
    .optional(),

  permission: Joi.string().required()
});