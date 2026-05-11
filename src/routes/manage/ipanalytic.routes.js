import express from "express";
import { getAllIpAnalytics, getIpAnalytics, ipAnalyticsDashboard } from "../../controllers/ipanalytic/ipanalytic.controller.js";

const router = express.Router();

/**
 * GET /api/v1/ip-analytics
 */
router.get("/", getIpAnalytics);
router.get("/all",getAllIpAnalytics)
router.get("/dashboard",ipAnalyticsDashboard)

export default router;