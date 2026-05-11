import Joi from "joi";

const ratingEnum = ["Excellent", "Good", "Average", "Dissatisfied"];

const productTypeEnum = [
  "Scan Body",
  "Horizontal Scan Body",
  "Lab Analog",
  "Screws",
  "Abutment",
];

/* ---------- Rating Item Schema ---------- */
const ratingItemSchema = Joi.object({
  question: Joi.string().trim().min(3).required().messages({
    "string.empty": "Question is required",
    "string.min": "Question must be at least 3 characters long",
    "any.required": "Question is required",
  }),

  score: Joi.string()
    .valid(...ratingEnum)
    .required()
    .messages({
      "any.only": "Invalid rating score",
      "any.required": "Score is required",
    }),
});

/* ---------- Reviewer Info Schema ---------- */
const reviewerInfoSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Reviewer name is required",
    "string.min": "Reviewer name must be at least 2 characters long",
    "string.max": "Reviewer name must not exceed 100 characters",
    "any.required": "Reviewer name is required",
  }),

  instituteName: Joi.string().trim().max(100).allow("").optional().messages({
    "string.max": "Institute name must not exceed 100 characters",
  }),

  location: Joi.string().trim().max(100).allow("").optional().messages({
    "string.max": "Location must not exceed 100 characters",
  }),

  age: Joi.number().integer().min(0).max(120).optional().messages({
    "number.base": "Age must be a number",
    "number.min": "Age cannot be negative",
    "number.max": "Age cannot be greater than 120",
  }),

  email: Joi.string().trim().email().required().messages({
    "string.email": "Invalid email format",
    "any.required": "Reviewer email is required",
  }),

  date: Joi.date().optional().messages({
    "date.base": "Date must be a valid date",
  }),
});

/* ---------- Single Category Review Schema ---------- */
const categoryReviewSchema = Joi.object({
  productType: Joi.string()
    .valid(...productTypeEnum)
    .required()
    .messages({
      "any.only": "Invalid product type",
      "any.required": "Product type is required",
    }),

  ratings: Joi.array().items(ratingItemSchema).min(1).required().messages({
    "array.base": "Ratings must be an array",
    "array.min": "At least one rating is required",
    "any.required": "Ratings are required",
  }),

  overallSatisfaction: Joi.string()
    .valid(...ratingEnum)
    .required()
    .messages({
      "any.only": "Invalid overall satisfaction value",
      "any.required": "Overall satisfaction is required",
    }),

  comments: Joi.string().trim().max(1000).allow("").optional().messages({
    "string.max": "Comments must not exceed 1000 characters",
  }),
});

/* ---------- Create Validator ---------- */
export const createProductReviewValidator = Joi.object({
  reviewerInfo: reviewerInfoSchema.required().messages({
    "any.required": "Reviewer info is required",
  }),

  categoryReviews: Joi.array()
    .items(categoryReviewSchema)
    .min(1)
    .required()
    .custom((value, helpers) => {
      const productTypes = value.map((item) => item.productType);
      const uniqueTypes = new Set(productTypes);

      if (uniqueTypes.size !== productTypes.length) {
        return helpers.error("any.duplicateProductType");
      }

      return value;
    })
    .messages({
      "array.base": "Category reviews must be an array",
      "array.min": "At least one category review is required",
      "any.required": "Category reviews are required",
      "any.duplicateProductType":
        "Duplicate product types are not allowed in the same review",
    }),
});

/* ---------- Update Validator ---------- */
export const updateProductReviewValidator = Joi.object({
  reviewerInfo: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional().messages({
      "string.min": "Reviewer name must be at least 2 characters long",
      "string.max": "Reviewer name must not exceed 100 characters",
    }),

    instituteName: Joi.string().trim().max(100).allow("").optional().messages({
      "string.max": "Institute name must not exceed 100 characters",
    }),

    location: Joi.string().trim().max(100).allow("").optional().messages({
      "string.max": "Location must not exceed 100 characters",
    }),

    age: Joi.number().integer().min(0).max(120).optional().messages({
      "number.base": "Age must be a number",
      "number.min": "Age cannot be negative",
      "number.max": "Age cannot be greater than 120",
    }),

    email: Joi.string().trim().email().optional().messages({
      "string.email": "Invalid email format",
    }),

    date: Joi.date().optional().messages({
      "date.base": "Date must be a valid date",
    }),
  })
    .min(1)
    .optional(),

  categoryReviews: Joi.array()
    .items(categoryReviewSchema)
    .min(1)
    .optional()
    .custom((value, helpers) => {
      const productTypes = value.map((item) => item.productType);
      const uniqueTypes = new Set(productTypes);

      if (uniqueTypes.size !== productTypes.length) {
        return helpers.error("any.duplicateProductType");
      }

      return value;
    })
    .messages({
      "array.base": "Category reviews must be an array",
      "array.min": "At least one category review is required",
      "any.duplicateProductType":
        "Duplicate product types are not allowed in the same review",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required for update",
  });

export const validateCreateProductReviewBody = (body) =>
  createProductReviewValidator.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

export const validateUpdateProductReviewBody = (body) =>
  updateProductReviewValidator.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });