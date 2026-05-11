import express from "express";
import {sendEmailOtp,getCustomerData,deleteCustomerData,getAllConsumers,verifyOtpAndCreateCustomer,getEmailVerifyDummy,getAllEmailVerifyDummy,getLibraryDashboard,deleteOtpByEmail, getScanbridgeLibrary, updateScanbridgeLibrary} from "../../controllers/libraryLog/libraryLog.controller.js";

const router = express.Router();

router.patch("/scanbridge", updateScanbridgeLibrary);
// Send OTP to email
router.post("/send-otp",sendEmailOtp);

// Verify OTP and save mobile number
router.post("/verify-otp",  verifyOtpAndCreateCustomer);

// Get customer data by email
router.get("/getById/:customerId", getCustomerData);

// Delete customer by email
router.delete("/deleteById/:customerId", deleteCustomerData);

// Get all consumers
router.get("/getAll", getAllConsumers);

router.get("/email-verify-dummy", getEmailVerifyDummy);

router.get("/email-verify-dummy/all", getAllEmailVerifyDummy);

router.get("/dashboard",getLibraryDashboard);

router.delete("/deleteUser/:email",deleteOtpByEmail);

router.get("/scanbridge", getScanbridgeLibrary);


export default router;
