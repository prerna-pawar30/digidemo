import express from "express";
import { getAccountId } from "../../controllers/zoho/zoho.controller.js";

const router = express.Router();

router.get("/zoho/accounts", getAccountId);

export default router;
