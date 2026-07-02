// import XLSX from "xlsx";
// import DentalLead from "../models/manage/dentalLead.js";
// import Employee from "../models/manage/employee.model.js";

// const baseQuery = { isDeleted: false };
// const norm = (s) => String(s ?? "").toLowerCase().trim().replace(/[\s_\-\/\.]+/g, " ");

// /* ─── Column Map handles flexible naming strategies across varying sheets ─── */
// const COL_MAP = {
//   "doctor name":     "doctorName",
//   // "name":            "doctorName",
//   "clinic name":     "clinicName",
//   "clinic":          "clinicName",
//   "hospital":        "clinicName",
//   "contact":         "contact",
//   "contact no":      "contact",
//   "contact number":  "contact",
//   "phone":           "contact",
//   "mobile":          "contact",
//   "email":           "email",
//   "city":            "city",
//   "state":           "state",
//   "address":         "address",
//   "enquiry":         "enquiry",
//   "product":         "enquiry",
//   "remarks":         "remarks",
//   "remark":          "remarks",
//   "contact by":      "contactBy",
//   "assigned to":     "contactBy",
// };

// /* ═══════════════════════════════════════════════════════════════════════════
//    GET ALL LEADS (Sorted by upcoming nextFollowUpDate first, then newest)
// ═══════════════════════════════════════════════════════════════════════════ */
// export const getAllLeads = async (filters = {}) => {
//   const { stage, search, page = 1, limit = 200 } = filters;
//   const query = { ...baseQuery };
//   if (stage) query.stage = stage;
//   if (search) {
//     query.$or = [
//       { doctorName: new RegExp(search, "i") },
//       { clinicName: new RegExp(search, "i") },
//       { city:       new RegExp(search, "i") },
//       { contact:    new RegExp(search, "i") },
//       { remarks:    new RegExp(search, "i") },
//     ];
//   }
//   const skip = (parseInt(page) - 1) * parseInt(limit);
//   const [leads, total] = await Promise.all([
//     DentalLead.find(query)
//       .sort({ nextFollowUpDate: 1, createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .lean(),
//     DentalLead.countDocuments(query),
//   ]);
//   return { leads, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
// };

// /* ─── CREATE INQUIRY ─────────────────────────────────────────────────────── */
// export const createLead = async (data) => {
//   return new DentalLead({ ...data, stage: "inquiry" }).save();
// };

// /* ─── GET BY ID ──────────────────────────────────────────────────────────── */
// export const getLeadById = async (id) => {
//   return DentalLead.findOne({ _id: id, ...baseQuery }).lean();
// };

// /* ─── UPDATE LEAD (Blocks direct pipeline arrays/stage overrides) ────────── */
// export const updateLead = async (id, data) => {
//   const { stage, clientId, preSaleFollowups, postSaleFollowups, ordersList, ...safeData } = data;
  
//   // Note: Must use findOne and save() to fire your model's pre-save hook cleanly
//   const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
//   if (!lead) throw new Error("Lead record not found");

//   Object.assign(lead, safeData);
//   return lead.save();
// };

// /* ─── SOFT DELETE ────────────────────────────────────────────────────────── */
// export const deleteLead = async (id) => {
//   return DentalLead.findOneAndUpdate({ _id: id, ...baseQuery }, { isDeleted: true }, { new: true });
// };

// /* ─── MOVE INQUIRY ➔ FOLLOW-UP ───────────────────────────────────────────── */
// export const moveToFollowup = async (id) => {
//   const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
//   if (!lead) throw new Error("Lead not found");
//   if (lead.stage !== "inquiry") throw new Error("Lead must be in the inquiry stage to transition");

//   lead.stage = "followup";
//   return lead.save();
// };

// /* ─── LOG FOLLOW-UP TOUCH (Strict validation for max array limits) ──────── */
// export const logFollowUp = async (
//   id,
//   stageType,
//   email,
//   payload
// ) => {
//   if (!["pre-sale", "post-sale"].includes(stageType)) {
//     throw new Error("Invalid stage type");
//   }

//   const employee = await Employee.findOne(
//     { email },
//     { firstName: 1, lastName: 1, _id: 1 }
//   ).lean();

//   if (!employee) {
//     throw new Error("Employee not found");
//   }

//   const lead = await DentalLead.findOne({
//     _id: id,
//     ...baseQuery,
//   });

//   if (!lead) {
//     throw new Error("Lead not found");
//   }

//   const arr =
//     stageType === "pre-sale"
//       ? lead.preSaleFollowups
//       : lead.postSaleFollowups;

//   if (arr.length >= 3) {
//     throw new Error(
//       `All 3 ${stageType} touch slots have already been exhausted`
//     );
//   }

//   const entry = {
//     agent: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
//     employeeId: employee._id,
//     notes: payload.notes,
//     hurdle: payload.hurdle || "None noted",
//     nextCallDate: new Date(payload.nextCallDate),
//     touchNumber: arr.length + 1,
//     loggedAt: new Date(),
//   };

//   arr.push(entry);

//   return await lead.save();
// };

// /* ─── CONVERT FOLLOW-UP ➔ CLIENT ─────────────────────────────────────────── */
// export const convertToClient = async (id) => {
//   const lead = await DentalLead.findById(id);
//   if (!lead) throw new Error("Lead record not found");
//   if (lead.stage === "client") throw new Error("This profile is already registered as a client");

//   const clientCount = await DentalLead.countDocuments({ stage: "client" });
//   lead.stage = "client";
//   lead.clientId = `DIGI-DENT-${String(clientCount + 1).padStart(3, "0")}`;
//   return lead.save();
// };

// /* ─── LOG ORDERS FOR CLIENTS ─────────────────────────────────────────────── */
// export const logOrder = async (id, data) => {
//   const lead = await DentalLead.findOne({ _id: id, stage: "client", ...baseQuery });
//   if (!lead) throw new Error("Active converted client portfolio profile not found");

//   // Since ordersList wasn't declared as a schema array field, let's fall back to updating remarks 
//   // or add a fallback tracking string. (Tip: if you want a strict orders array, declare it in schema)
//   lead.remarks = `${lead.remarks}\n[Order Logged]: ${data.product || "Product"} - Price: ${data.price || 0} by ${data.loggedBy}`;
//   return lead.save();
// };

// /* ─── FILTER UPCOMING SCHEDULE ───────────────────────────────────────────── */
// export const getUpcomingFollowUps = async (daysAhead = 7) => {
//   const startRange = new Date(); startRange.setHours(0, 0, 0, 0);
//   const endRange = new Date(startRange); endRange.setDate(endRange.getDate() + parseInt(daysAhead));

//   return DentalLead.find({
//     ...baseQuery,
//     stage: { $in: ["followup", "client"] },
//     nextFollowUpDate: { $gte: startRange, $lte: endRange },
//   })
//     .sort({ nextFollowUpDate: 1 })
//     .lean();
// };

// /* ─── GET DASHBOARD ANALYTICS ────────────────────────────────────────────── */
// export const getDashboardStats = async () => {
//   const [counts, upcoming] = await Promise.all([
//     DentalLead.aggregate([
//       { $match: baseQuery },
//       { $group: { _id: "$stage", count: { $sum: 1 } } },
//     ]),
//     getUpcomingFollowUps(7),
//   ]);

//   const summary = { inquiry: 0, followup: 0, client: 0 };
//   counts.forEach((c) => { if (c._id in summary) summary[c._id] = c.count; });
  
//   return { 
//     ...summary, 
//     total: summary.inquiry + summary.followup + summary.client, 
//     upcomingCount: upcoming.length 
//   };
// };

// /* ─── EXCEL FILE PARSING & PIPELINE DATA INGESTION ──────────────────────── */
// export const importFromExcel = async (fileBuffer) => {
//   const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
//   const results = { inserted: 0, skipped: 0, errors: [] };

//   for (const sheetName of workbook.SheetNames) {
//     const sheet = workbook.Sheets[sheetName];
//     const matrixRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

//     if (!matrixRows.length) continue;

//     for (const row of matrixRows) {
//       try {
//         const mappedData = {};
//         for (const [rawKey, rawValue] of Object.entries(row)) {
//           const schemaField = COL_MAP[norm(rawKey)];
//           if (schemaField && String(rawValue).trim()) {
//             mappedData[schemaField] = String(rawValue).trim();
//           }
//         }

//         const fallbackIdentifier = mappedData.doctorName || mappedData.clinicName;
//         if (!fallbackIdentifier || !mappedData.contact) {
//           results.skipped++;
//           continue;
//         }

//         // Validate duplicates matching your application rule index tracking keys
//         const matchFound = await DentalLead.findOne({ contact: mappedData.contact, ...baseQuery });
//         if (matchFound) {
//           results.skipped++;
//           continue;
//         }

//         await new DentalLead({
//           doctorName:       mappedData.doctorName || "",
//           clinicName:       mappedData.clinicName || "",
//           email:            mappedData.email      || "",
//           contact:          mappedData.contact,
//           city:             mappedData.city       || "",
//           state:            mappedData.state      || "",
//           address:          mappedData.address    || "",
//           enquiry:          mappedData.enquiry    || "",
//           remarks:          mappedData.remarks    || "",
//           contactBy:        mappedData.contactBy  || "",
//           stage:            "inquiry",
//           source:           "excel",
//         }).save();

//         results.inserted++;
//       } catch (err) {
//         results.errors.push({ 
//           contactId: row["CONTACT"] || row["CONTACT NO"] || "Missing identifier row", 
//           error: err.message 
//         });
//       }
//     }
//   }

//   return results;
// };

import XLSX from "xlsx";
import DentalLead from "../models/manage/dentalLead.js";
import Employee from "../models/manage/employee.model.js";

const baseQuery = { isDeleted: false };
const norm = (s) => String(s ?? "").toLowerCase().trim().replace(/[\s_\-\/\.]+/g, " ");

/* ─── Column Map handles flexible naming strategies across varying sheets ─── */
const COL_MAP = {
  "doctor name":     "doctorName",
  "name":            "doctorName",
  "clinic name":     "clinicName",
  "clinic":          "clinicName",
  "hospital":        "clinicName",
  "contact":         "contact",
  "contact no":      "contact",
  "contact number":  "contact",
  "phone":           "contact",
  "mobile":          "contact",
  "email":           "email",
  "city":            "city",
  "state":           "state",
  "address":         "address",
  "enquiry":         "enquiry",
  "product":         "enquiry",
  "remarks":         "remarks",
  "remark":          "remarks",
  "contact by":      "contactBy",
  "assigned to":     "contactBy",
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET ALL LEADS (Sorted by upcoming nextFollowUpDate first, then newest)
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
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [leads, total] = await Promise.all([
    DentalLead.find(query)
      .sort({ nextFollowUpDate: 1, createdAt: -1 })
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

/* ─── UPDATE LEAD (Blocks direct pipeline/stage-critical field overrides) ── */
export const updateLead = async (id, data) => {
  const {
    stage,
    clientId,
    preSaleFollowups,
    postSaleFollowups,
    ordersList,
    flagReason,
    flaggedAt,
    flaggedBy,
    ...safeData
  } = data;

  // Note: Must use findOne and save() to fire your model's pre-save hook cleanly
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead record not found");

  Object.assign(lead, safeData);
  return lead.save();
};

/* ─── SOFT DELETE ────────────────────────────────────────────────────────── */
export const deleteLead = async (id) => {
  return DentalLead.findOneAndUpdate({ _id: id, ...baseQuery }, { isDeleted: true }, { new: true });
};

/* ─── MOVE INQUIRY ➔ FOLLOW-UP (now accepts an optional reason) ─────────── */
export const moveToFollowup = async (id, reason = "") => {
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");
  if (lead.stage !== "inquiry") throw new Error("Lead must be in the inquiry stage to transition");

  lead.stage = "followup";
  if (reason) lead.moveReason = reason;
  return lead.save();
};

/* ─── MOVE ANY LEAD ➔ FLAG (new) ─────────────────────────────────────────── */
export const moveToFlag = async (id, reason, email) => {
  if (!reason || !reason.trim()) throw new Error("A reason is required to flag a lead");

  const employee = await Employee.findOne(
    { email },
    { firstName: 1, lastName: 1 }
  ).lean();

  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");

  lead.stage = "flag";
  lead.flagReason = reason.trim();
  lead.flaggedAt = new Date();
  lead.flaggedBy = employee
    ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim()
    : email || "";

  return lead.save();
};

/* ─── INCREMENT CALL COUNT (new) ─────────────────────────────────────────── */
export const incrementCallCount = async (id) => {
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");

  lead.callCount = (lead.callCount || 0) + 1;
  return lead.save();
};

/* ─── UPDATE WHATSAPP STATUS (new — handles sent / replied / noReply) ───── */
export const updateWhatsapp = async (id, whatsappData = {}) => {
  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");

  const current = lead.whatsapp?.toObject ? lead.whatsapp.toObject() : (lead.whatsapp || {});
  lead.whatsapp = { ...current, ...whatsappData };
  return lead.save();
};

/* ─── LOG FOLLOW-UP TOUCH (auto-rolls into next round; first pre-sale
     touch also auto-promotes lead from "inquiry" → "followup"; also
     bumps callCount since a logged touch means a call was made) ──────── */
export const logFollowUp = async (id, stageType, email, payload) => {
  if (!["pre-sale", "post-sale"].includes(stageType)) {
    throw new Error("Invalid stage type");
  }
  if (!["Picked", "Not Picked"].includes(payload.callStatus)) {
    throw new Error("callStatus must be 'Picked' or 'Not Picked'");
  }
  if (!payload.nextCallDate) {
    throw new Error("nextCallDate is required");
  }

  const employee = await Employee.findOne(
    { email },
    { firstName: 1, lastName: 1, _id: 1 }
  ).lean();
  if (!employee) throw new Error("Employee not found");

  const lead = await DentalLead.findOne({ _id: id, ...baseQuery });
  if (!lead) throw new Error("Lead not found");

  if (stageType === "post-sale" && lead.stage !== "client") {
    throw new Error("Post-sale follow-ups can only be logged for clients");
  }

  const arr = stageType === "pre-sale" ? lead.preSaleFollowups : lead.postSaleFollowups;

  const last = arr[arr.length - 1];
  let round = 1;
  let touchNumber = 1;
  if (last) {
    if (last.touchNumber < 3) {
      round = last.round;
      touchNumber = last.touchNumber + 1;
    } else {
      round = last.round + 1;
      touchNumber = 1;
    }
  }

  const entry = {
    agent: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
    employeeId: employee._id,
    callStatus: payload.callStatus,
    reason: payload.reason || "",
    nextCallDate: new Date(payload.nextCallDate),
    round,
    touchNumber,
    loggedAt: new Date(),
  };

  arr.push(entry);

  // A logged follow-up touch IS a call — bump the counter automatically.
  lead.callCount = (lead.callCount || 0) + 1;

  if (stageType === "pre-sale" && lead.stage === "inquiry") {
    lead.stage = "followup";
  }

  return await lead.save();
};

/* ─── CONVERT FOLLOW-UP ➔ CLIENT ─────────────────────────────────────────── */
export const convertToClient = async (id) => {
  const lead = await DentalLead.findById(id);
  if (!lead) throw new Error("Lead record not found");
  if (lead.stage === "client") throw new Error("This profile is already registered as a client");

  const clientCount = await DentalLead.countDocuments({ stage: "client" });
  lead.stage = "client";
  lead.clientId = `DIGI-DENT-${String(clientCount + 1).padStart(3, "0")}`;
  return lead.save();
};

/* ─── LOG ORDERS FOR CLIENTS ─────────────────────────────────────────────── */
export const logOrder = async (id, data) => {
  const lead = await DentalLead.findOne({ _id: id, stage: "client", ...baseQuery });
  if (!lead) throw new Error("Active converted client portfolio profile not found");

  lead.remarks = `${lead.remarks}\n[Order Logged]: ${data.product || "Product"} - Price: ${data.price || 0} by ${data.loggedBy}`;
  return lead.save();
};

/* ─── FILTER UPCOMING SCHEDULE ───────────────────────────────────────────── */
export const getUpcomingFollowUps = async (daysAhead = 7) => {
  const startRange = new Date(); startRange.setHours(0, 0, 0, 0);
  const endRange = new Date(startRange); endRange.setDate(endRange.getDate() + parseInt(daysAhead));

  return DentalLead.find({
    ...baseQuery,
    stage: { $in: ["followup", "client"] },
    nextFollowUpDate: { $gte: startRange, $lte: endRange },
  })
    .sort({ nextFollowUpDate: 1 })
    .lean();
};

/* ─── GET DASHBOARD ANALYTICS ────────────────────────────────────────────── */
export const getDashboardStats = async () => {
  const [counts, upcoming] = await Promise.all([
    DentalLead.aggregate([
      { $match: baseQuery },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]),
    getUpcomingFollowUps(7),
  ]);

  const summary = { inquiry: 0, followup: 0, client: 0, flag: 0 };
  counts.forEach((c) => { if (c._id in summary) summary[c._id] = c.count; });

  return {
    ...summary,
    total: summary.inquiry + summary.followup + summary.client + summary.flag,
    upcomingCount: upcoming.length
  };
};

/* ─── EXCEL FILE PARSING & PIPELINE DATA INGESTION ──────────────────────── */
export const importFromExcel = async (fileBuffer) => {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  const results = { inserted: 0, skipped: 0, errors: [] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrixRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    if (!matrixRows.length) continue;

    for (const row of matrixRows) {
      try {
        const mappedData = {};
        for (const [rawKey, rawValue] of Object.entries(row)) {
          const schemaField = COL_MAP[norm(rawKey)];
          if (schemaField && String(rawValue).trim()) {
            mappedData[schemaField] = String(rawValue).trim();
          }
        }

        const fallbackIdentifier = mappedData.doctorName || mappedData.clinicName;
        if (!fallbackIdentifier || !mappedData.contact) {
          results.skipped++;
          continue;
        }

        const matchFound = await DentalLead.findOne({ contact: mappedData.contact, ...baseQuery });
        if (matchFound) {
          results.skipped++;
          continue;
        }

        await new DentalLead({
          doctorName:       mappedData.doctorName || "",
          clinicName:       mappedData.clinicName || "",
          email:            mappedData.email      || "",
          contact:          mappedData.contact,
          city:             mappedData.city       || "",
          state:            mappedData.state      || "",
          address:          mappedData.address    || "",
          enquiry:          mappedData.enquiry    || "",
          remarks:          mappedData.remarks    || "",
          contactBy:        mappedData.contactBy  || "",
          stage:            "inquiry",
          source:           "excel",
        }).save();

        results.inserted++;
      } catch (err) {
        results.errors.push({
          contactId: row["CONTACT"] || row["CONTACT NO"] || "Missing identifier row",
          error: err.message
        });
      }
    }
  }

  return results;
};