import express from "express";
import { zohoWebhookHandler } from "../controllers/zohoWebhook.controller.js";

const router = express.Router();

router.post("/zoho", zohoWebhookHandler);

export default router;