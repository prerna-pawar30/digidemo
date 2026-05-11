import express from "express";
import { razorpayWebhook } from "../../controllers/razorpaywebhook.controller.js";

const router = express.Router();

// MUST USE RAW BODY FOR SIGNATURE VERIFY
router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhook
);

export default router;