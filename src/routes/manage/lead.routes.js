import express from "express";
import * as lc from "../../controllers/lead.Controller.js";
import auth from "../../middlewares/auth.middleware.js";
import {uploadExcel} from "../../middlewares/multer.middleware.js";


const router = express.Router();

router.use(auth); // all routes require valid employee token

/* ── Special (must be before /:id) ──────────────────────────────────────── */
router.get("/dashboard",  lc.getDashboard);
router.get("/upcoming",   lc.getUpcomingFollowUps);      // ?daysAhead=7
router.post("/import-excel", uploadExcel.single("file"), lc.importExcel);

/* ── CRUD ───────────────────────────────────────────────────────────────── */
router.get("/",    lc.getAllLeads);  // ?stage=followup&search=mehta&page=1&limit=100
router.post("/",   lc.createLead);
router.get("/:id", lc.getLeadById);
router.put("/:id", lc.updateLead);
router.delete("/:id", lc.deleteLead);

/* ── Pipeline actions ────────────────────────────────────────────────────── */
router.patch("/:id/move-to-followup",   lc.moveToFollowup);
router.patch("/:id/convert-to-client",  lc.convertToClient);
router.post("/:id/followup/:stageType", lc.logFollowUp);   // pre-sale | post-sale
router.post("/:id/order",               lc.logOrder);

export default router;