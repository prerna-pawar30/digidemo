import Joi from "joi";

export const createEmployeeValidator = (data) => {
  const schema = Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required(),

    lastName: Joi.string().trim().min(2).max(50).required(),

    email: Joi.string()
      .email()
      .pattern(/@digident\.in$/)
      .lowercase()
      .trim()
      .required()
      .messages({
        "string.pattern.base": "Email must end with @digident.in"
      }),

    personalEmail: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required(),

    password: Joi.string().min(8).max(50).required(),

    role: Joi.string().required(),

    permission: Joi.string().required()
  });

  return schema.validate(data, { abortEarly: false });
};

export const loginEmployeeValidator = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .pattern(/@digident\.in$/)
      .lowercase()
      .trim()
      .required()
      .messages({
        "string.email": "Valid email is required",
        "string.empty": "Email is required",
        "string.pattern.base": "Only @digident.in emails are allowed"
      }),

    password: Joi.string()
      .min(8)
      .required()
      .messages({
        "string.empty": "Password is required",
        "string.min": "Password must be at least 8 characters",
      }),
  });

  return schema.validate(data, { abortEarly: false });
};

export const changePasswordValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .pattern(/@digident\.in$/)
      .required()
      .messages({
        "string.pattern.base": "Email must end with @digident.in"
      }),

    password: Joi.string().min(8).required()
  });

  return schema.validate(data);
};

export const forgotPasswordValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .pattern(/@digident\.in$/)
      .required()
      .messages({
        "string.pattern.base": "Email must end with @digident.in"
      })
  });

  return schema.validate(data);
};