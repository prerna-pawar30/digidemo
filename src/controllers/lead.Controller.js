import * as svc from "../services/lead.service.js";
import { ok, asyncHandler } from "../helpers/error.helper.js";

/* ─ CRUD Operations ──────────────────────────────────────────────────────── */

export const getAllLeads = asyncHandler(async (req, res) => {
  const result = await svc.getAllLeads(req.query);
  ok(res, result);
});

export const createLead = asyncHandler(async (req, res) => {
  const data = await svc.createLead(req.body);
  ok(res, { data }, 201);
}, 400);

export const getLeadById = asyncHandler(async (req, res) => {
  const data = await svc.getLeadById(req.params.id);
  ok(res, { data });
});

export const updateLead = asyncHandler(async (req, res) => {
  const data = await svc.updateLead(req.params.id, req.body);
  ok(res, { data });
}, 400);

export const deleteLead = asyncHandler(async (req, res) => {
  await svc.deleteLead(req.params.id);
  ok(res, { message: "Deleted successfully" });
});

/* ─ Pipeline Actions ─────────────────────────────────────────────────────── */

export const moveToFollowup = asyncHandler(async (req, res) => {
  const data = await svc.moveToFollowup(req.params.id, req.body.reason);
  ok(res, { data });
}, 400);

// POST /leads/:id/flag  { reason: string }
export const moveToFlag = asyncHandler(async (req, res) => {
  const email = req.user?.email;
  const data = await svc.moveToFlag(req.params.id, req.body.reason, email);
  ok(res, { data });
}, 400);

// PATCH /leads/:id/call  (no body needed — bumps callCount by 1)
export const incrementCallCount = asyncHandler(async (req, res) => {
  const data = await svc.incrementCallCount(req.params.id);
  ok(res, { data });
}, 400);

// PATCH /leads/:id/whatsapp  { sent?, replied?, noReply? }
export const updateWhatsapp = asyncHandler(async (req, res) => {
  const data = await svc.updateWhatsapp(req.params.id, req.body);
  ok(res, { data });
}, 400);

// POST /leads/:id/followup/:stageType  (stageType is 'pre-sale' or 'post-sale')
export const logFollowUp = asyncHandler(async (req, res) => {
  const email = req.user?.email;
  const data = await svc.logFollowUp(req.params.id, req.params.stageType, email, req.body);
  ok(res, { data });
}, 400);

export const convertToClient = asyncHandler(async (req, res) => {
  const data = await svc.convertToClient(req.params.id);
  ok(res, { data });
}, 400);

export const logOrder = asyncHandler(async (req, res) => {
  const email = req.user?.email;
  const data = await svc.logOrder(req.params.id, email, req.body);
  ok(res, { data });
}, 400);

/* ─ Dashboards & Filters ─────────────────────────────────────────────────── */

export const getDashboard = asyncHandler(async (req, res) => {
  const data = await svc.getDashboardStats();
  ok(res, { data });
});

export const getUpcomingFollowUps = asyncHandler(async (req, res) => {
  const data = await svc.getUpcomingFollowUps(req.query.daysAhead);
  ok(res, { data, count: data.length });
});

/* ─ Excel File Import ────────────────────────────────────────────────────── */

export const importExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  const results = await svc.importFromExcel(req.file.buffer);
  ok(res, { data: results });
}, 400);