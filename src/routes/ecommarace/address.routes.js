import express from "express";
import {
  addAddress,
  getAllAddresses,
  updateAddress,
  deleteAddress,
  getDefaultAddress,
  setDefaultAddress,
  clearAllAddresses,
} from "../../controllers/address/address.controller.js";
import  employeeVerifyAccessToken  from "../../middlewares/auth.middleware.js";
import { attachUser } from "../../middlewares/attechuser.middleware.js";


const router = express.Router();

router.use(employeeVerifyAccessToken, attachUser);

router.post("/add", addAddress);
router.get("/get-all", getAllAddresses);
router.put("/update/:addressId", updateAddress);
router.delete("/delete/:addressId", deleteAddress);
router.get("/default", getDefaultAddress);
router.patch("/default/:addressId", setDefaultAddress);
router.delete("/clear",
  employeeVerifyAccessToken,
  attachUser,
  clearAllAddresses
);
export default router;
