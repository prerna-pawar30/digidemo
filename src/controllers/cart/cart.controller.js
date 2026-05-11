import { addToCartService, clearCartService, getCartService, removeCartItemService, updateCartQuantityService } from "../../services/cart.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { handleError } from "../../helpers/error.helper.js";
import { addToCartSchema, removeCartItemSchema, updateCartQuantitySchema } from "./cart.validator.js";

/**
 * @function addToCart
 *
 * @params
 * params: {
 *   productId: string
 * }
 * body: {
 *   variantId: string,
 *   brandId: string,
 *   categoryId: string,
 *   quantity?: number (default: 1)
 * }
 *
 * @process
 * 1. Validate authenticated user
 * 2. Validate required fields (productId, variantId, brandId, categoryId)
 * 3. Validate quantity (must be integer ≥ 1)
 * 4. Fetch product and ensure it is active
 * 5. Validate category and brand match
 * 6. Validate variant exists
 * 7. Check available stock
 * 8. Resolve price and images
 * 9. Ensure user cart exists (create if not)
 * 10. Try atomic update:
 *     - If item exists → increment quantity
 *     - Else → add new item
 * 11. Fetch updated cart
 * 12. Return success response
 *
 * @response
 * 200 {
 *   cartId: string,
 *   totalItems: number,
 *   items: []
 * }
 */
export const addToCart = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { error, value } = addToCartSchema.validate({
      ...req.body,
      productId: req.params.productId,
    });

    if (error) {
      throw {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      };
    }

    /* ---------- SERVICE ---------- */
    const result = await addToCartService({
      data: value,
      user: req.currentUser,
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "Item added to cart successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getCart
 *
 * @params
 * (none)
 *
 * @process
 * 1. Validate authenticated user
 * 2. Check if user has a cart
 * 3. Fetch cart data
 * 4. If empty → return empty response
 * 5. Extract unique productIds from cart items
 * 6. Fetch all active products
 * 7. Create product map for fast lookup
 * 8. Map cart items with:
 *    - product details
 *    - category
 *    - brand
 *    - variant
 * 9. Remove invalid items (deleted product/variant)
 * 10. Return formatted cart response
 *
 * @response
 * 200 {
 *   cartId: string | null,
 *   items: [
 *     {
 *       product: { id, name },
 *       category: { id, name },
 *       brand: { id, name, logo },
 *       variant: { id, name, attributes },
 *       price: number,
 *       quantity: number,
 *       image: string,
 *       sku: string,
 *       addedAt: date
 *     }
 *   ]
 * }
 */
export const getCart = async (req, res) => {
  try {
    const result = await getCartService({
      user: req.currentUser,
    });

    return sendSuccess(res, result, 200, "User cart fetched");

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateCartQuantity
 *
 * @params
 * params: {
 *   variantId: string
 * }
 * body: {
 *   quantity: number (≥ 1)
 * }
 *
 * @process
 * 1. Validate authenticated user
 * 2. Validate variantId and quantity
 * 3. Fetch user cart
 * 4. Ensure cart is not empty
 * 5. Find cart item by variantId
 * 6. Fetch product and validate active status
 * 7. Validate variant exists
 * 8. Check stock availability
 * 9. Update item quantity
 * 10. Update timestamp
 * 11. Save cart
 * 12. Return updated item
 *
 * @response
 * 200 {
 *   cartId: string,
 *   item: {
 *     product: { id, name },
 *     brand: { id, name },
 *     variant: { id, name, attributes },
 *     price: number,
 *     quantity: number,
 *     image: string
 *   }
 * }
 */
export const updateCartQuantity = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { error, value } = updateCartQuantitySchema.validate({
      variantId: req.params.variantId,
      quantity: req.body.quantity,
    });

    if (error) {
      throw {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      };
    }

    /* ---------- SERVICE ---------- */
    const result = await updateCartQuantityService({
      data: value,
      user: req.currentUser,
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "Cart quantity updated"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function removeCartItem
 *
 * @params
 * params: {
 *   variantId: string
 * }
 *
 * @process
 * 1. Validate authenticated user
 * 2. Validate variantId
 * 3. Fetch user cart
 * 4. Ensure cart is not empty
 * 5. Remove item using variantId
 * 6. If item not found → throw error
 * 7. Save updated cart
 * 8. Return updated cart items
 *
 * @response
 * 200 {
 *   cartId: string,
 *   items: []
 * }
 */
export const removeCartItem = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { error, value } = removeCartItemSchema.validate({
      variantId: req.params.variantId,
    });

    if (error) {
      throw {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      };
    }

    /* ---------- SERVICE ---------- */
    const result = await removeCartItemService({
      data: value,
      user: req.currentUser,
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "Item removed from cart"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function clearCart
 *
 * @params
 * (none)
 *
 * @process
 * 1. Validate authenticated user
 * 2. Check if user has a cart
 * 3. If no cart → return empty response
 * 4. Fetch cart
 * 5. If already empty → return success
 * 6. Clear all cart items
 * 7. Update timestamp
 * 8. Save cart
 * 9. Return empty cart response
 *
 * @response
 * 200 {
 *   cartId: string | null,
 *   items: [],
 *   totalItems: 0
 * }
 */
export const clearCart = async (req, res) => {
  try {
    const result = await clearCartService({
      user: req.currentUser,
    });

    return sendSuccess(
      res,
      result,
      200,
      "Cart cleared successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};