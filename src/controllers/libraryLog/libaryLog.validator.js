import Joi from "joi";

export const sendEmailOtpValidator = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Valid email is required",
    "string.empty": "Email is required",
    "any.required": "Email is required"
  })
});

export const verifyOtpAndCreateCustomerValidator = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Valid email is required",
    "string.empty": "Email is required",
    "any.required": "Email is required"
  }),

  otp: Joi.string().optional().allow("").messages({
    "string.base": "OTP must be a string"
  }),

  libraryObjectId: Joi.string().optional(),

  libraryId: Joi.string().optional(),

  brand: Joi.string().required().messages({
    "string.empty": "brand is required",
    "any.required": "brand is required"
  }),

  category: Joi.string().required().messages({
    "string.empty": "category is required",
    "any.required": "category is required"
  }),

  firstName: Joi.string().optional().allow(""),
  lastName: Joi.string().optional().allow(""),
  mobileNumber: Joi.string().optional().allow(""),
  companyName: Joi.string().optional().allow(""),

  address: Joi.object({
    line1: Joi.string().optional().allow(""),
    city: Joi.string().optional().allow(""),
    state: Joi.string().optional().allow(""),
    postalCode: Joi.string().optional().allow(""),
    country: Joi.string().optional().allow("")
  }).optional()
});

export const updateScanbridgeLibraryValidator = Joi.object({
  customerId: Joi.string().required().messages({
    "string.empty": "customerId is required",
    "any.required": "customerId is required"
  }),
  logId: Joi.string().required().messages({
    "string.empty": "logId is required",
    "any.required": "logId is required"
  }),
  isdelivered: Joi.boolean().required().messages({
    "boolean.base": "isdelivered must be a boolean value",
    "any.required": "isdelivered is required"
  })
});