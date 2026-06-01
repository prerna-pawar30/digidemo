import Employee from "../models/manage/employee.model.js";
import * as svc from "../services/lead.service.js";

const ok  = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const err = (res, msg, status = 500)  => res.status(status).json({ success: false, message: msg });

/* ─ CRUD Operations ──────────────────────────────────────────────────────── */

export const getAllLeads = async (req, res) => {
  try { 
    const result = await svc.getAllLeads(req.query);
    ok(res, result); 
  } catch (e) { 
    err(res, e.message); 
  }
};

export const createLead = async (req, res) => {
  try { 
    const data = await svc.createLead(req.body);
    ok(res, { data }, 201); 
  } catch (e) { 
    err(res, e.message, 400); 
  }
};

export const getLeadById = async (req, res) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return err(res, "Lead not found", 404);
    ok(res, { data: lead });
  } catch (e) { 
    err(res, e.message); 
  }
};

export const updateLead = async (req, res) => {
  try { 
    const data = await svc.updateLead(req.params.id, req.body);
    ok(res, { data }); 
  } catch (e) { 
    err(res, e.message, 400); 
  }
};

export const deleteLead = async (req, res) => {
  try { 
    await svc.deleteLead(req.params.id); 
    ok(res, { message: "Deleted successfully" }); 
  } catch (e) { 
    err(res, e.message); 
  }
};

/* ─ Pipeline Actions ─────────────────────────────────────────────────────── */

export const moveToFollowup = async (req, res) => {
  try { 
    const data = await svc.moveToFollowup(req.params.id);
    ok(res, { data }); 
  } catch (e) { 
    err(res, e.message, 400); 
  }
};

// POST /leads/:id/followup/:stageType  (where stageType is 'pre-sale' or 'post-sale')
export const logFollowUp = async (req, res) => {
  try {
    const email = req.user?.email;
   const data = await svc.logFollowUp(
  req.params.id,
  req.params.stageType,
  email,
  req.body
);
    ok(res, { data });
  } catch (e) { 
    err(res, e.message, 400); 
  }
};

export const convertToClient = async (req, res) => {
  try { 
    const data = await svc.convertToClient(req.params.id);
    ok(res, { data }); 
  } catch (e) { 
    err(res, e.message, 400); 
  }
};

export const logOrder = async (req, res) => {
  try {
    const email = req.user?.email;
    const emp = await Employee.findOne({ email }, { firstName: 1, lastName: 1 }).lean();
    const data = await svc.logOrder(req.params.id, {
      ...req.body,
      loggedBy: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email,
    });
    ok(res, { data });
  } catch (e) { 
    err(res, e.message, 400); 
  }
};

/* ─ Dashboards & Filters ─────────────────────────────────────────────────── */

export const getDashboard = async (req, res) => {
  try { 
    const data = await svc.getDashboardStats();
    ok(res, { data }); 
  } catch (e) { 
    err(res, e.message); 
  }
};

export const getUpcomingFollowUps = async (req, res) => {
  try {
    const data = await svc.getUpcomingFollowUps(req.query.daysAhead);
    ok(res, { data, count: data.length });
  } catch (e) { 
    err(res, e.message); 
  }
};

/* ─ Excel File Import ────────────────────────────────────────────────────── */

export const importExcel = async (req, res) => {
  try {
    if (!req.file) return err(res, "No file uploaded", 400);
    const results = await svc.importFromExcel(req.file.buffer);
    ok(res, { data: results });
  } catch (e) { 
    err(res, e.message, 400); 
  }
};