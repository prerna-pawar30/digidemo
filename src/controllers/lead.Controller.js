import * as svc from "../services/lead.service.js";

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  ...data });
const err = (res, msg, status = 500)  => res.status(status).json({ success: false, message: msg });

/* ─ CRUD ──────────────────────────────────────────────────────────────────── */
export const getAllLeads = async (req, res) => {
  try   { ok(res, await svc.getAllLeads(req.query)); }
  catch (e) { err(res, e.message); }
};

export const createLead = async (req, res) => {
  try   { ok(res, { data: await svc.createLead(req.body) }, 201); }
  catch (e) { err(res, e.message, 400); }
};

export const getLeadById = async (req, res) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return err(res, "Lead not found", 404);
    ok(res, { data: lead });
  } catch (e) { err(res, e.message); }
};

export const updateLead = async (req, res) => {
  try   { ok(res, { data: await svc.updateLead(req.params.id, req.body) }); }
  catch (e) { err(res, e.message, 400); }
};

export const deleteLead = async (req, res) => {
  try   { await svc.deleteLead(req.params.id); ok(res, { message: "Deleted" }); }
  catch (e) { err(res, e.message); }
};

/* ─ PIPELINE ACTIONS ──────────────────────────────────────────────────────── */
export const moveToFollowup = async (req, res) => {
  try   { ok(res, { data: await svc.moveToFollowup(req.params.id) }); }
  catch (e) { err(res, e.message, 400); }
};

// POST /leads/:id/followup/:stageType   (pre-sale | post-sale)
export const logFollowUp = async (req, res) => {
  try {
    const emp   = req.employee || {};
    const agent = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email || "Agent";
    const data  = await svc.logFollowUp(req.params.id, req.params.stageType, {
      ...req.body,
      agent,
      employeeId: emp.employeeId || String(emp._id || ""),
    });
    ok(res, { data });
  } catch (e) { err(res, e.message, 400); }
};

export const convertToClient = async (req, res) => {
  try   { ok(res, { data: await svc.convertToClient(req.params.id) }); }
  catch (e) { err(res, e.message, 400); }
};

export const logOrder = async (req, res) => {
  try {
    const emp  = req.employee || {};
    const data = await svc.logOrder(req.params.id, {
      ...req.body,
      loggedBy: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Agent",
    });
    ok(res, { data });
  } catch (e) { err(res, e.message, 400); }
};

/* ─ DASHBOARD & FILTERS ───────────────────────────────────────────────────── */
export const getDashboard = async (req, res) => {
  try   { ok(res, { data: await svc.getDashboardStats() }); }
  catch (e) { err(res, e.message); }
};

export const getUpcomingFollowUps = async (req, res) => {
  try {
    const data = await svc.getUpcomingFollowUps(req.query.daysAhead);
    ok(res, { data, count: data.length });
  } catch (e) { err(res, e.message); }
};

/* ─ EXCEL IMPORT ──────────────────────────────────────────────────────────── */
export const importExcel = async (req, res) => {
  try {
    if (!req.file) return err(res, "No file uploaded", 400);
    const results = await svc.importFromExcel(req.file.buffer);
    ok(res, { data: results });
  } catch (e) { err(res, e.message, 400); }
};