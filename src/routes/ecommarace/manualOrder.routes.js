import express from "express";
import {
  createManualOrder,
  getAllManualOrders,
  getSingleManualOrder,
  createManualReturnRequest,
  updatePendingManualReturnRequest,
  getAllManualReturnRequests,
  updateManualReturnRequestStatus,
  markManualRefundCompleted,
  manualOrderAnalysis,
} from "../../controllers/manualOrder/manualOrder.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = express.Router();

/* ---------- MANUAL ORDER ---------- */
router.post("/create", auth, checkPermission, createManualOrder);
router.get("/get/all", auth, getAllManualOrders);
router.get("/get/:manualOrderId", auth, getSingleManualOrder);

/* ---------- RETURN / PARTIAL RETURN ---------- */
router.post("/return", auth, checkPermission, createManualReturnRequest);
router.put("/return/update/:manualOrderId/:requestId", auth, checkPermission, updatePendingManualReturnRequest);
router.get("/return-req/get", auth, getAllManualReturnRequests);
router.put("/return/update/status/:manualOrderId/:requestId", auth, checkPermission, updateManualReturnRequestStatus);

/* ---------- REFUND ---------- */
router.put("/refund/complete/:manualOrderId", auth, checkPermission, markManualRefundCompleted);

/* ---------- ANALYSIS ---------- */
router.get("/analysis/dashboard", auth, manualOrderAnalysis);

export default router;
