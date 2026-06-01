import XLSX from "xlsx";
import DentalLead from "../models/manage/dentalLead.js";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const baseQuery = { isDeleted: false };
const norm = (s) => String(s ?? "").toLowerCase().trim().replace(/[\s_\-\/\.]+/g, " ");

/* ─── Column map covers both Excel sheet structures (WAO019 + WAO021) ───────
   WAO019: NO | DOCTOR NAME | CLINIC NAME | CONTACT | EMAIL | CITY | ENQUIRY | REMARKS
   WAO021: S.NO | DOCTOR NAME | CLINIC NAME | EMAIL | CONTACT NO | CITY | STATE |
           Contact BY | Follow up 1-3 | Client No | Address
   WAO020: SR | CLIENT NO | NAME | CLINIC NAME | CONTACT NO | ADDRESS | PRODUCT | ...
*/
const COL_MAP = {
  "doctor name":    "doctorName",
  "name":           "doctorName",  // WAO020 NAME column
  "clinic name":    "clinicName",
  "clinic":         "clinicName",
  "hospital":       "clinicName",
  "contact":        "contact",
  "contact no":     "contact",
  "contact number": "contact",
  "phone":          "contact",
  "mobile":         "contact",
  "email":          "email",
  "city":           "city",
  "state":          "state",
  "address":        "address",
  "enquiry":        "enquiry",
  "product":        "enquiry",     // WAO020
  "remarks":        "remarks",
  "remark":         "remarks",
  "contact by":     "contactBy",
  "assigned to":    "contactBy",
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET ALL LEADS
   Sort: upcoming nextFollowUpDate FIRST (nulls last), then newest created
═══════════════════════════════════════════════════════════════════════════ */
export const getAllLeads = async (filters = {}) => {
  const { stage, search, page = 1, limit = 200 } = filters;

  const query = { ...baseQuery };
  if (stage) query.stage = stage;
  if (search) {
    query.$or = [
      { doctorName: new RegExp(search, "i") },
      { clinicName: new RegExp(search, "i") },
      { city:       new RegExp(search, "i") },
      { contact:    new RegExp(search, "i") },
      { remarks:    new RegExp(search, "i") },
    ];
  }

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const [leads, total] = await Promise.all([
    DentalLead.find(query)
      .sort({ nextFollowUpDate: 1, createdAt: -1 })   // ← upcoming first
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    DentalLead.countDocuments(query),
  ]);

  return { leads, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
};

/* ─── CREATE INQUIRY ─────────────────────────────────────────────────────── */
export const createLead = async (data) => {
  return new DentalLead({ ...data, stage: "inquiry" }).save();
};

/* ─── GET BY ID ──────────────────────────────────────────────────────────── */
export const getLeadById = async (id) => {
  return DentalLead.findOne({ _id: id, ...baseQuery }).lean();
};

/* ─── UPDATE (safe – blocks direct stage/followup edits) ────────────────── */
export const updateLead = async (id, data) => {
  const { stage, clientId, preSaleFollowups, postSaleFollowups, ordersList, ...safe } = data;
  return DentalLead.findOneAndUpdate({ _id: id, ...baseQuery }, safe, {
    new: true, runValidators: true,
  });
};

/* ─── SOFT DELETE ────────────────────────────────────────────────────────── */
export const deleteLead = async (id) => {
  return DentalLead.findOneAndUpdate({ _id: id, ...baseQuery }, { isDeleted: true });
};

/* ─── MOVE inquiry → followup ────────────────────────────────────────────── */
export const moveToFollowup = async (id) => {
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");
  if (lead.stage !== "inquiry") throw new Error("Lead must be in inquiry stage");
  lead.stage = "followup";
  return lead.save();
};

/* ─── LOG FOLLOW-UP TOUCH ────────────────────────────────────────────────── */
export const logFollowUp = async (id, stageType, payload) => {
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");

  const { agent, employeeId, notes, hurdle, nextCallDate } = payload;
  if (!notes)        throw new Error("notes is required");
  if (!nextCallDate) throw new Error("nextCallDate is required");

  const arr = stageType === "pre-sale" ? lead.preSaleFollowups : lead.postSaleFollowups;
  if (arr.length >= 3) throw new Error(`All 3 ${stageType} touches already logged`);

  const entry = {
    agent,
    employeeId,
    notes,
    hurdle:       hurdle || "None noted",
    nextCallDate: new Date(nextCallDate),
    touchNumber:  arr.length + 1,
    loggedAt:     new Date(),
  };

  if (stageType === "pre-sale") lead.preSaleFollowups.push(entry);
  else                          lead.postSaleFollowups.push(entry);

  return lead.save();
};

/* ─── CONVERT followup → client ──────────────────────────────────────────── */
export const convertToClient = async (id) => {
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead)              throw new Error("Lead not found");
  if (lead.stage === "client") throw new Error("Already a client");

  const count   = await DentalLead.countDocuments({ stage: "client" });
  lead.stage    = "client";
  lead.clientId = `DIGI-DENT-${String(count + 1).padStart(3, "0")}`;
  return lead.save();
};

/* ─── LOG ORDER (clients only) ───────────────────────────────────────────── */
export const logOrder = async (id, data) => {
  const lead = await DentalLead.findOne({ _id: id, stage: "client", ...baseQuery });
  if (!lead) throw new Error("Client not found");

  const { product, quantity, price, gstNo, loggedBy } = data;
  if (!product || price == null) throw new Error("product and price are required");

  lead.ordersList.push({
    product,
    quantity:  parseInt(quantity) || 1,
    price:     parseFloat(price),
    gstNo:     gstNo || "",
    invoiceId: `INV-${Date.now()}`,
    loggedBy:  loggedBy || "Agent",
    orderDate: new Date(),
  });

  return lead.save();
};

/* ─── UPCOMING FOLLOW-UPS ────────────────────────────────────────────────── */
export const getUpcomingFollowUps = async (daysAhead = 7) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(today); end.setDate(end.getDate() + parseInt(daysAhead));

  return DentalLead.find({
    ...baseQuery,
    stage:           { $in: ["followup", "client"] },
    nextFollowUpDate: { $gte: today, $lte: end },
  })
    .sort({ nextFollowUpDate: 1 })
    .lean();
};

/* ─── DASHBOARD STATS ────────────────────────────────────────────────────── */
export const getDashboardStats = async () => {
  const [counts, upcoming] = await Promise.all([
    DentalLead.aggregate([
      { $match: baseQuery },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]),
    getUpcomingFollowUps(7),
  ]);

  const s = { inquiry: 0, followup: 0, client: 0 };
  counts.forEach((c) => (s[c._id] = c.count));
  return { ...s, total: s.inquiry + s.followup + s.client, upcomingCount: upcoming.length };
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXCEL IMPORT  (uses xlsx package)
   Reads every sheet in the workbook.
   Smart column detection covers both WAO019 and WAO021 structures.
   Skips duplicates by contact number.
═══════════════════════════════════════════════════════════════════════════ */
export const importFromExcel = async (fileBuffer) => {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const results  = { inserted: 0, skipped: 0, errors: [] };

  for (const sheetName of workbook.SheetNames) {
    const ws   = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

    if (!rows.length) continue;

    for (const row of rows) {
      try {
        /* Map raw Excel headers → DentalLead fields */
        const mapped = {};
        for (const [rawKey, val] of Object.entries(row)) {
          const field = COL_MAP[norm(rawKey)];
          if (field && String(val).trim()) {
            mapped[field] = String(val).trim();
          }
        }

        /* Require at minimum a name and a contact */
        const name    = mapped.doctorName || mapped.clinicName;
        const contact = mapped.contact;
        if (!name || !contact) { results.skipped++; continue; }

        /* Deduplicate by contact */
        const exists = await DentalLead.findOne({ contact, ...baseQuery });
        if (exists) { results.skipped++; continue; }

        await new DentalLead({
          doctorName: mapped.doctorName || mapped.clinicName,
          clinicName: mapped.clinicName || "",
          email:      mapped.email      || "",
          contact:    mapped.contact,
          city:       mapped.city       || "",
          state:      mapped.state      || "",
          address:    mapped.address    || "",
          enquiry:    mapped.enquiry    || "General Inquiry",
          remarks:    mapped.remarks    || "",
          contactBy:  mapped.contactBy  || "",
          stage:      "inquiry",
          source:     "excel",
        }).save();

        results.inserted++;
      } catch (err) {
        results.errors.push({ contact: row["CONTACT"] || row["CONTACT NO"] || "?", error: err.message });
      }
    }
  }

  return results;
};