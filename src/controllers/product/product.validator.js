import Joi from "joi";

/* =========================================================
   PRODUCT SCHEMA
========================================================= */
export const productSchema = Joi.object({
  productId: Joi.string().optional(),

  /* ---------- BASIC ---------- */
  name: Joi.string().required(),
  sku: Joi.string().optional(),
  price: Joi.number().optional(),

  category: Joi.string().required(),
  brand: Joi.array().items(Joi.string()).min(1).required(),
  tags: Joi.array().items(Joi.string()).optional(),
  labels: Joi.array().items(Joi.string()).optional(),

  shortDescription: Joi.string().required(),

  /* ---------- STOCK ---------- */
  stockType: Joi.string()
    .valid("PRODUCT", "VARIANT")
    .default("PRODUCT")
    .required(),

  productStock: Joi.when("stockType", {
    is: "PRODUCT",
    then: Joi.number().min(0).required(),
    otherwise: Joi.forbidden(),
  }),

  /* ---------- DESCRIPTION ---------- */
  description: Joi.array().items(
    Joi.object({
      paragraphId: Joi.string().optional(),
      text: Joi.string().required(),
      image: Joi.array().items(Joi.string()).optional(),
    })
  ),

  /* ---------- SPECIFICATION ---------- */
  specification: Joi.array().items(
    Joi.object({
      specId: Joi.string().optional(),
      key: Joi.string().required(),
      value: Joi.any().required(),
    })
  ),

  /* ---------- VARIANTS ---------- */
  variants: Joi.array().items(
    Joi.object({
      variantId: Joi.string().optional(),
      sku: Joi.string().optional(),
      name: Joi.string().required(),

      attributes: Joi.array().items(
        Joi.object({
          attrId: Joi.string().optional(),
          key: Joi.string().required(),
          value: Joi.array().items(Joi.string()).min(1).required(),
        })
      ),

      priceType: Joi.string()
        .valid("PRODUCT", "VARIANT")
        .default("PRODUCT"),

      variantPrice: Joi.when("priceType", {
        is: "VARIANT",
        then: Joi.number().required(),
        otherwise: Joi.forbidden(),
      }),

      imageType: Joi.string()
        .valid("PRODUCT", "VARIANT")
        .default("PRODUCT"),

      variantImages: Joi.array().items(Joi.string()).optional(),
      variantStock: Joi.number().min(0).optional(),
    })
  ),

  /* ---------- META ---------- */
  status: Joi.string().valid("draft", "active").optional(),
  material: Joi.string().valid("Titanium", "Stainless Steel").optional(),
  seriesNumber: Joi.string().optional(),
  subSeriesNumber: Joi.string().optional(),

  /* ---------- IMAGES ---------- */
  images: Joi.array().items(Joi.string()).optional(),
}).unknown(true);

/* =========================================================
   COMMON VALIDATION FORMATTER
========================================================= */
const formatJoiError = (error) => ({
  message: "Validation failed",
  statusCode: 400,
  errorCode: "VALIDATION_ERROR",
  details: error.details.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  })),
});

/* =========================================================
   CREATE PRODUCT - BODY VALIDATION
========================================================= */
export const validateProductBody = (body) => {
  const { error, value } = productSchema.validate(body, {
    abortEarly: false,
    allowUnknown: true,
    context: { stockType: body.stockType },
  });
  return { error, value };
};

/* =========================================================
   CREATE PRODUCT - FILE VALIDATION
========================================================= */
export const validateProductFiles = (body, files) => {
  const missingFiles = [];

  /* ---------- PRODUCT IMAGES ---------- */
  const hasImagesInBody =
    Array.isArray(body.images) && body.images.length > 0;

  const hasImagesInFiles =
    files?.productImages && files.productImages.length > 0;

  if (!hasImagesInBody && !hasImagesInFiles) {
    missingFiles.push("productImages");
  }

  /* ---------- VARIANT IMAGES ---------- */
  const needsVariantImages = body?.variants?.some(
    (v) => v.imageType === "VARIANT"
  );

  if (needsVariantImages) {
    const hasVariantImagesInFiles =
      files?.variantImages && files.variantImages.length > 0;

    const hasVariantImagesInBody = body.variants?.some(
      (v) => Array.isArray(v.variantImages) && v.variantImages.length > 0
    );

    if (!hasVariantImagesInFiles && !hasVariantImagesInBody) {
      missingFiles.push("variantImages");
    }
  }

  if (missingFiles.length) {
    throw {
      message: "File validation failed",
      statusCode: 400,
      errorCode: "FILE_VALIDATION_ERROR",
      details: missingFiles,
    };
  }
};

/* =========================================================
   UPDATE PRODUCT - BODY VALIDATION
========================================================= */
export const validateUpdateProductBody = (body) => {
  const schema = productSchema.fork(
    ["name", "category", "brand", "variants", "productStock"],
    (field) => field.optional()
  );

  const { error, value } = schema.validate(body, {
    abortEarly: false,
    allowUnknown: true,
    context: { stockType: body.stockType },
  });

  if (error) {
    return { error: formatJoiError(error) };
  }

  return { value };
};

/* =========================================================
   UPDATE PRODUCT - FILE VALIDATION
========================================================= */
export const validateUpdateProductFiles = (body, files) => {
  const needsVariantImages = body?.variants?.some(
    (v) => v.imageType === "VARIANT"
  );

  if (needsVariantImages) {
    const hasVariantImages =
      files?.variantImages?.length ||
      body.variants?.some((v) => v.variantImages?.length);

    if (!hasVariantImages) {
      throw {
        message: "Variant images required",
        statusCode: 400,
        errorCode: "FILE_VALIDATION_ERROR",
      };
    }
  }
};