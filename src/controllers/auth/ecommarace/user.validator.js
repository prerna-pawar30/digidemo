import Joi from "joi";

/* ==============================
COMMON VALIDATION OPTIONS
============================== */

const validationOptions = {
  abortEarly: false,
  stripUnknown: true,
};

/* ==============================
REGISTER USER VALIDATION
============================== */

export const validateRegisterBody = (data) => {
  const schema = Joi.object({
    firstName: Joi.string().trim().min(3).max(50).required(),
    lastName: Joi.string().trim().min(3).max(50).required(),
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(8).max(50).required(),
    instituteName: Joi.string().trim().min(2).max(100).required(),
  });
  return schema.validate(data, validationOptions);
};

/* ==============================
LOGIN VALIDATION
============================== */

export const validateLoginBody = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().required(),
  });
  return schema.validate(data, validationOptions);
};

/* ==============================
FORGOT PASSWORD VALIDATION
============================== */

export const validateForgotPasswordBody = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
  });
  return schema.validate(data, validationOptions);
};

/* ==============================
RESET PASSWORD VALIDATION
============================== */

export const validateResetPasswordBody = (data) => {
  const schema = Joi.object({
    newPassword: Joi.string()
      .min(8)
      .max(50)
      .trim()
      .required()
      .messages({
        "string.empty": "New password is required",
        "string.min": "Password must be at least 8 characters",
      }),
    confirmNewPassword: Joi.string()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({
        "any.only": "Passwords do not match",
        "string.empty": "Confirm password is required",
      }),
  });
  return schema.validate(data, validationOptions);
};

/* ==============================
UPDATE PROFILE VALIDATION
============================== */

export const validateUpdateProfileBody = (data) => {
  const schema = Joi.object({
    firstName: Joi.string().trim().min(2).max(50),
    lastName: Joi.string().trim().min(2).max(50),
    instituteName: Joi.string().trim().min(2).max(100),
    phone: Joi.string().pattern(/^[0-9]{10,15}$/),
  });
  return schema.validate(data, validationOptions);
};

/* ==============================
CHANGE PASSWORD VALIDATION
============================== */

export const validateChangePasswordBody = (data) => {
  const schema = Joi.object({
    oldPassword: Joi.string().required().messages({
      "string.empty": "Old password is required",
    }),
    newPassword: Joi.string()
      .min(8)
      .required()
      .invalid(Joi.ref("oldPassword"))
      .messages({
        "string.empty": "New password is required",
        "string.min": "New password must be at least 8 characters",
        "any.invalid": "New password cannot be the same as the old password",
      }),
  });
  return schema.validate(data, validationOptions);
};