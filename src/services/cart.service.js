import Product from "../models/manage/product.model.js";
import Cart from "../models/ecommarace/cart.model.js";
import { v6 as uuidv6 } from "uuid";
import { getStock, resolvePrice, resolveImages } from "./productResolver.service.js";
import { sendSuccess } from "../helpers/response.helper.js";
import { handleError } from "../helpers/error.helper.js";

export const addToCartService = async ({ data, user }) => {
  try {
    /* ---------- AUTH ---------- */
    if (!user) {
      throw {
        message: "Unauthorized user",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      };
    }

    const {
      productId,
      variantId,
      brandId,
      categoryId,
      quantity,
    } = data;

    const qty = Number(quantity);

    /* ---------- FETCH PRODUCT ---------- */
    const product = await Product.findOne({
      productId,
      status: "active",
    })
      .populate("brand", "brandName logoUrl")
      .populate("category", "name");

    if (!product) {
      throw {
        message: "Product not found or inactive",
        statusCode: 404,
        errorCode: "PRODUCT_NOT_FOUND",
      };
    }

    /* ---------- VALIDATIONS ---------- */
    if (product.category?._id.toString() !== categoryId.toString()) {
      throw {
        message: "Invalid category",
        statusCode: 400,
        errorCode: "INVALID_CATEGORY",
      };
    }

    const brand = product.brand.find(
      (b) => b._id.toString() === brandId.toString()
    );

    if (!brand) {
      throw {
        message: "Invalid brand",
        statusCode: 400,
        errorCode: "INVALID_BRAND",
      };
    }

    const variant = product.variants.find(
      (v) => v.variantId.toString() === variantId.toString()
    );

    if (!variant) {
      throw {
        message: "Variant not found",
        statusCode: 404,
        errorCode: "VARIANT_NOT_FOUND",
      };
    }

    const availableStock = getStock(product, variantId);

    if (availableStock < qty) {
      throw {
        message: "Insufficient stock",
        statusCode: 400,
        errorCode: "INSUFFICIENT_STOCK",
      };
    }

    const price = resolvePrice(product, variant);
    const images = resolveImages(product, variant);

    const attributesMap = {};
    variant.attributes?.forEach((attr) => {
      attributesMap[attr.key] = attr.value;
    });

    /* ---------- ENSURE CART ---------- */
    let cart;

    if (user.cart) {
      cart = await Cart.findById(user.cart);
    }

    if (!cart) {
      cart = await Cart.create({
        cartId: uuidv6(),
        items: [],
      });

      user.cart = cart._id;
      await user.save();
    }

    /* ---------- ATOMIC UPDATE ---------- */
    const incrementResult = await Cart.updateOne(
      {
        _id: cart._id,
        "items.variantId": variantId,
      },
      {
        $inc: { "items.$.quantity": qty },
        $set: {
          "items.$.price": price,
          "items.$.image": images?.[0] || "",
          "items.$.updatedAt": new Date(),
        },
      }
    );

    if (incrementResult.modifiedCount === 0) {
      await Cart.updateOne(
        { _id: cart._id },
        {
          $push: {
            items: {
              productId,
              variantId,
              brandId,
              categoryId,
              productName: product.name,
              variantName: variant.name,
              brandName: brand.brandName,
              categoryName: product.category?.name,
              sku: product.sku || "",
              price,
              quantity: qty,
              attributes: attributesMap,
              image: images?.[0] || "",
              updatedAt: new Date(),
            },
          },
        }
      );
    }

    /* ---------- FETCH UPDATED CART ---------- */
    cart = await Cart.findById(cart._id);

    return {
      cartId: cart.cartId,
      totalItems: cart.items.length,
      items: cart.items,
    };

  } catch (error) {
    console.error("Add To Cart Service Error:", error);

    throw {
      message: error.message || "Failed to add item to cart",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "ADD_TO_CART_FAILED",
      details: error.details || error,
    };
  }
};

export const getCartService = async ({ user }) => {
  try {
    /* ---------- AUTH ---------- */
    if (!user){
      throw {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      };
    }

    /* ---------- EMPTY CART ---------- */
    if (!user.cart) {
      return {
        cartId: null,
        items: [],
      };
    }

    const cart = await Cart.findById(user.cart).lean();

    if (!cart || cart.items.length === 0) {
      return {
        cartId: cart?.cartId || null,
        items: [],
      };
    }

    /* ---------- FETCH PRODUCTS ---------- */
    const productIds = [...new Set(cart.items.map((i) => i.productId))];

    const products = await Product.find({
      productId: { $in: productIds },
      status: "active",
    })
      .populate("brand", "BrandName logoUrl")
      .populate("category", "name")
      .lean();

    const productMap = new Map(
      products.map((p) => [p.productId, p])
    );

    /* ---------- BUILD RESPONSE ---------- */
    const cartItems = cart.items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;

        const variant = product.variants.find(
          (v) => v.variantId === item.variantId
        );
        if (!variant) return null;

        const brand = product.brand.find(
          (b) => b._id.toString() === item.brandId.toString()
        );

        return {
          product: {
            id: product.productId,
            name: product.name,
          },

          category: product.category
            ? {
                id: product.category._id,
                name: product.category.name,
              }
            : {
                id: item.categoryId,
                name: item.categoryName || "",
              },

          brand: brand
            ? {
                id: brand._id,
                name: brand.brandName,
              }
            : null,

          variant: {
            id: variant.variantId,
            name: variant.name,
            attributes: item.attributes,
          },

          sku: item.sku,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          addedAt: item.createdAt,
        };
      })
      .filter(Boolean);

    return {
      cartId: cart.cartId,
      items: cartItems,
    };

  } catch (error) {
    console.error("Get Cart Service Error:", error);

    throw {
      message: error.message || "Failed to fetch cart",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "GET_CART_FAILED",
      details: error.details || error,
    };
  }
};

export const updateCartQuantityService = async ({ data, user }) => {
  try {
    /* ---------- AUTH ---------- */
    if (!user) {
      throw {
        message: "Unauthorized user",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      };
    }

    const { variantId, quantity } = data;
    const qty = Number(quantity);

    /* ---------- CART CHECK ---------- */
    if (!user.cart) {
      throw {
        message: "Cart is empty",
        statusCode: 404,
        errorCode: "CART_EMPTY",
      };
    }

    const cart = await Cart.findById(user.cart);

    if (!cart || cart.items.length === 0) {
      throw {
        message: "Cart is empty",
        statusCode: 404,
        errorCode: "CART_EMPTY",
      };
    }

    /* ---------- FIND ITEM ---------- */
    const cartItem = cart.items.find(
      (item) => item.variantId === variantId
    );

    if (!cartItem) {
      throw {
        message: "Cart item not found",
        statusCode: 404,
        errorCode: "ITEM_NOT_FOUND",
      };
    }

    /* ---------- FETCH PRODUCT ---------- */
    const product = await Product.findOne({
      productId: cartItem.productId,
      status: "active",
    });

    if (!product) {
      throw {
        message: "Product not available",
        statusCode: 404,
        errorCode: "PRODUCT_NOT_AVAILABLE",
      };
    }

    /* ---------- FIND VARIANT ---------- */
    const variant = product.variants.find(
      (v) => v.variantId === cartItem.variantId
    );

    if (!variant) {
      throw {
        message: "Variant not available",
        statusCode: 404,
        errorCode: "VARIANT_NOT_AVAILABLE",
      };
    }

    /* ---------- STOCK CHECK ---------- */
    const availableStock = getStock(product, cartItem.variantId);

    if (availableStock < qty) {
      throw {
        message: `Only ${availableStock} item(s) available`,
        statusCode: 400,
        errorCode: "INSUFFICIENT_STOCK",
      };
    }

    /* ---------- UPDATE ---------- */
    cartItem.quantity = qty;
    cartItem.updatedAt = new Date();

    await cart.save();

    return {
      cartId: cart.cartId,
      item: {
        product: {
          id: cartItem.productId,
          name: cartItem.productName,
        },
        brand: {
          id: cartItem.brandId,
          name: cartItem.brandName,
        },
        variant: {
          id: cartItem.variantId,
          name: cartItem.variantName,
          attributes: cartItem.attributes,
        },
        price: cartItem.price,
        quantity: cartItem.quantity,
        image: cartItem.image,
      },
    };

  } catch (error) {
    console.error("Update Cart Quantity Service Error:", error);

    throw {
      message: error.message || "Failed to update cart quantity",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "UPDATE_CART_FAILED",
      details: error.details || error,
    };
  }
};

export const removeCartItemService = async ({ data, user }) => {
  try {
    /* ---------- AUTH ---------- */
    if (!user) {
      throw {
        message: "Unauthorized user",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      };
    }

    const { variantId } = data;

    /* ---------- CART CHECK ---------- */
    if (!user.cart) {
      throw {
        message: "Cart is empty",
        statusCode: 404,
        errorCode: "CART_EMPTY",
      };
    }

    const cart = await Cart.findById(user.cart);

    if (!cart || cart.items.length === 0) {
      throw {
        message: "Cart is empty",
        statusCode: 404,
        errorCode: "CART_EMPTY",
      };
    }

    const initialLength = cart.items.length;

    /* ---------- REMOVE ITEM ---------- */
    cart.items = cart.items.filter(
      (item) => item.variantId !== variantId
    );

    if (cart.items.length === initialLength) {
      throw {
        message: "Cart item not found",
        statusCode: 404,
        errorCode: "ITEM_NOT_FOUND",
      };
    }

    await cart.save();

    return {
      cartId: cart.cartId,
      items: cart.items,
    };

  } catch (error) {
    console.error("Remove Cart Item Service Error:", error);

    throw {
      message: error.message || "Failed to remove cart item",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "REMOVE_CART_FAILED",
      details: error.details || error,
    };
  }
};

export const clearCartService = async ({ user }) => {
  try {
    /* ---------- AUTH ---------- */
    if (!user) {
      throw {
        message: "Unauthorized user",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      };
    }

    /* ---------- NO CART ---------- */
    if (!user.cart) {
      return {
        cartId: null,
        items: [],
        totalItems: 0,
      };
    }

    /* ---------- FETCH CART ---------- */
    const cart = await Cart.findById(user.cart);

    if (!cart || cart.items.length === 0) {
      return {
        cartId: cart?.cartId || null,
        items: [],
        totalItems: 0,
      };
    }

    /* ---------- CLEAR CART ---------- */
    cart.items = [];
    cart.updatedAt = new Date();

    await cart.save();

    return {
      cartId: cart.cartId,
      items: [],
      totalItems: 0,
    };

  } catch (error) {
    console.error("Clear Cart Service Error:", error);

    throw {
      message: error.message || "Failed to clear cart",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "CLEAR_CART_FAILED",
      details: error.details || error,
    };
  }
};