// services/productResolver.service.js
export const getStock = (product, variantId = null) => {
  if (product.stockType === "PRODUCT") {
    return product.productStock;
  }

  if (!variantId) return 0;

  const variant = product.variants.find(v => v.variantId === variantId);
  return variant ? variant.variantStock : 0;
};

export const resolvePrice = (product, variant) => {
  if (!variant || variant.priceType === "PRODUCT") {
    return product.price ?? 0;
  }
  if (variant.priceType === "VARIANT" && variant.variantPrice == null) {
    throw new Error("Variant price required");
  }
  return variant.variantPrice;
};

// export const resolvePrice = (product, variant) => {
//   if (!variant || variant.priceType === "PRODUCT") {
//     return product.price ?? 0;
//   }
//   if (variant.priceType === "VARIANT" && variant.variantPrice == null) {
//     throw new Error("Variant price required");
//   }
//   return variant.variantPrice;
// };

export const resolveImages = (product, variant) => {
  if (!variant || variant.imageType === "PRODUCT") {
    return product.images ?? [];
  }
  if (variant.imageType === "VARIANT" && (!variant.variantImages || variant.variantImages.length === 0)) {
    throw new Error("Variant images required");
  }
  return variant.variantImages;
};
