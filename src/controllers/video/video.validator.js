import Joi from "joi";

/* ---------- SCHEMA ---------- */
const addVideoSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required()
    .messages({
      "string.empty": "Title is required",
      "string.min": "Title must be at least 2 characters",
      "string.max": "Title cannot exceed 200 characters"
    }),

  link: Joi.string()
    .trim()
    .uri()
    .required()
    .messages({
      "string.empty": "Link is required",
      "string.uri": "Link must be a valid URL"
    }),

  permission: Joi.string()
    .trim()
    .required()
    .messages({
      "permission": "Permission is required"
    })
});

/* ---------- VALIDATE FUNCTION ---------- */
export const validateAddVideoBody = (body) => {
  return addVideoSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true
  });
};

/* ---------- SCHEMA ---------- */
const updateVideoSchema = Joi.object({
  ytVideoId: Joi.string().required().messages({
    "any.required": "ytVideoId is required",
    "string.empty": "ytVideoId cannot be empty"
  }),

  title: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .optional()
    .messages({
      "string.min": "Title must be at least 2 characters",
      "string.max": "Title cannot exceed 200 characters"
    }),

  link: Joi.string()
    .trim()
    .uri()
    .optional()
    .messages({
      "string.uri": "Link must be a valid URL"
    }),

  permission: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Permission is required",
      "any.required": "Permission is required"
    })
})

/* ---------- CUSTOM RULE (IMPORTANT) ---------- */
.or("title", "link"); // at least one required

/* ---------- VALIDATE FUNCTION ---------- */
export const validateUpdateVideo = (data) => {
  return updateVideoSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
};