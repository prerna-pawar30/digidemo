import express from "express";
import {
  addToCart,
  getCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
} from "../../controllers/cart/cart.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import { attachUser } from "../../middlewares/attechuser.middleware.js";

const router = express.Router();

router.post("/add/:productId", auth,attachUser,addToCart);
router.get("/get", auth, attachUser,getCart);
router.put("/update-qty/:variantId", auth,attachUser, updateCartQuantity);
router.delete("/remove/:variantId",auth, attachUser, removeCartItem);
router.delete("/clear", auth , attachUser, clearCart);

export default router;