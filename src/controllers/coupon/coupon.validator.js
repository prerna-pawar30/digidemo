import Joi from "joi";

/* ============================
   BUY X GET Y SCHEMA
============================ */
const buyXGetYSchema = Joi.object({
  buyQuantity: Joi.number().integer().min(1).required(),
  getQuantity: Joi.number().integer().min(1).required(),
  buyProducts: Joi.array().items(Joi.string()).optional(),
  getProducts: Joi.array().items(Joi.string()).optional(),
  buyBrand: Joi.string().optional(),
  getBrand: Joi.string().optional(),
  buyCategory: Joi.string().optional(),
  getCategory: Joi.string().optional(),
  getDiscountPercent: Joi.number().min(1).max(100).optional(),
});

/* ============================
   CREATE VALIDATION
============================ */
export const createCouponValidation = Joi.object({
  title: Joi.string().min(3).required(),
  code: Joi.string().min(3).required(),

  description: Joi.string().allow("").optional(),

  couponType: Joi.string()
    .valid(
      "PERCENT",
      "FIXED",
      "FREESHIP",
      "BUY_X_GET_Y_FREE",
      "BUY_X_GET_Y_DISCOUNT"
    )
    .required(),

  discountValue: Joi.when("couponType", {
    is: Joi.valid("PERCENT", "FIXED"),
    then: Joi.number().min(1).required(),
    otherwise: Joi.optional(),
  }),

  maxDiscountAmount: Joi.number().optional(),
  minOrderAmount: Joi.number().optional(),

  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),

  isActive: Joi.boolean().optional(),

  applicableTo: Joi.string()
    .valid("ALL", "PRODUCT", "BRAND", "CATEGORY")
    .required(),

  applicableProducts: Joi.array().items(Joi.string()).optional(),
  applicableBrands: Joi.array().items(Joi.string()).optional(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),

  buyXGetY: Joi.when("couponType", {
    is: Joi.valid("BUY_X_GET_Y_FREE", "BUY_X_GET_Y_DISCOUNT"),
    then: buyXGetYSchema.required(),
    otherwise: Joi.optional(),
  }),
});

/* ============================
   UPDATE VALIDATION (PARTIAL)
============================ */
export const updateCouponValidation = createCouponValidation.fork(
  Object.keys(createCouponValidation.describe().keys),
  (field) => field.optional()
);



// validators/coupon.validator.js

export const couponValidator = Joi.object({
  code: Joi.string().required(),
  title: Joi.string().required(),

  couponType: Joi.string().valid(
    "PERCENT",
    "FIXED",
    "FREESHIP",
    "BUY_X_GET_Y_FREE",
    "BUY_X_GET_Y_DISCOUNT"
  ).required(),

  discountValue: Joi.number().min(0),

  minOrderAmount: Joi.number().min(0),

  maxDiscountAmount: Joi.number().min(0),

  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),

  applicableTo: Joi.string().valid(
    "ALL",
    "PRODUCT",
    "BRAND",
    "CATEGORY"
  ).required(),

  applicableProducts: Joi.array().items(Joi.string()),
  applicableBrands: Joi.array().items(Joi.string()),
  applicableCategories: Joi.array().items(Joi.string()),

  isActive: Joi.boolean(),

  buyXGetY: Joi.object({
    buyQuantity: Joi.number().min(1),
    getQuantity: Joi.number().min(1),
    getDiscountPercent: Joi.number().min(0).max(100),

    buyProducts: Joi.array().items(Joi.string()),
    getProducts: Joi.array().items(Joi.string()),

    buyBrand: Joi.string(),
    getBrand: Joi.string(),

    buyCategory: Joi.string(),
    getCategory: Joi.string()
  }).optional(),

  permission: Joi.string().optional()
});