import express from "express";
import { addProduct, deleteProduct, getProductsByStatus, getBestSellerProducts, getProductById, updateProduct, updateProductStock, duplicateProduct } from "../../controllers/product/product.controller.js";
import upload from "../../middlewares/multer.middleware.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import { parseMultipartJson } from "../../middlewares/parseMultipartJso.middleware.js";

const router = express.Router();

router.post(
  "/add",
  upload.fields([
    { name: "productImages", maxCount: 10 },
    { name: "descriptionImages", maxCount: 10 },
    { name: "variantImages", maxCount: 20 },
  ]),
  parseMultipartJson,
 auth,
  checkPermission,
  addProduct
);
router.put(
  "/update/:productId",
  upload.fields([
    { name: "productImages", maxCount: 10 },
    { name: "descriptionImages", maxCount: 10 },
    { name: "variantImages", maxCount: 20 },
  ]),
  parseMultipartJson,
  auth,
  checkPermission,
  updateProduct
);
router.get("/get/status/:status", getProductsByStatus);
router.get("/best-selling", getBestSellerProducts);
router.get("/getById/:productId", getProductById);
router.delete("/delete/:productId",auth,checkPermission, deleteProduct);
router.put("/stock/:productId",auth,checkPermission, updateProductStock);
router.post("/duplicate",auth,checkPermission, duplicateProduct);

export default router;