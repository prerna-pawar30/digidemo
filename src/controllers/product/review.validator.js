import Joi from "joi";

const rating = Joi.number()
  .min(1)
  .max(5)
  .required()
  .messages({
    "number.base": "Rating must be a number",
    "number.min": "Rating must be at least 1",
    "number.max": "Rating must be at most 5",
    "any.required": "Rating is required",
  });

const comment = Joi.string()
  .trim()
  .max(1000)
  .allow("", null)
  .messages({
    "string.base": "Comment must be a string",
    "string.max": "Comment cannot exceed 1000 characters",
  });

const productId = Joi.string()
  .trim()
  .required()
  .messages({
    "string.empty": "ProductId is required",
    "any.required": "ProductId is required",
  });

/* =====================================================
   📌 ADD REVIEW VALIDATION
   ===================================================== */

export const validateAddReview = (data) => {
  const schema = Joi.object({
    productId,
    rating,
    comment,
  });

  return schema.validate(data, { abortEarly: false });
};


export const validateUpdateReview = (data) => {
  const schema = Joi.object({
    productId: Joi.string().required().messages({
      "any.required": "ProductId is required",
    }),

    reviewId: Joi.string().required().messages({
      "any.required": "ReviewId is required",
    }),

    rating: Joi.number().min(1).max(5).optional().messages({
      "number.min": "Rating must be at least 1",
      "number.max": "Rating must be at most 5",
    }),

    comment: Joi.string().max(1000).allow("", null).optional(),
  });

  return schema.validate(data, { abortEarly: false });
};