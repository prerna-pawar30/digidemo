import express from "express";
import { getStockAuditLogs } from "../../controllers/stockauditlog.controller.js";


const router = express.Router();

router.get("/get", getStockAuditLogs);

export default router;