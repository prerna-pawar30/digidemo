import mongoose from "mongoose";

/* ── Follow-up log entry (max 3 per array) ── */
const followUpSchema = new mongoose.Schema(
  {
    agent:       { type: String, required: true, trim: true },
   employeeId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Employee",
  required: true,
},
    notes:       { type: String, required: true, trim: true },
    hurdle:      { type: String, default: "None noted", trim: true },
    nextCallDate:{ type: Date, required: true },
    touchNumber: { type: Number, min: 1, max: 3 },
    loggedAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

/* ── Main DentalLead schema ── */
const dentalLeadSchema = new mongoose.Schema(
  {
    /* ─ Core identity ─ */
    doctorName: { type: String, required: true, trim: true },
    clinicName: { type: String, trim: true, default: "" },
    email:      { type: String, lowercase: true, trim: true, default: "" },
    contact:    { type: String, required: true, trim: true },
    city:       { type: String, trim: true, default: "" },
    state:      { type: String, trim: true, default: "" },
    address:    { type: String, trim: true, default: "" },
    enquiry:    { type: String, trim: true, default: "" },
    remarks:    { type: String, trim: true, default: "" },

    /* ─ Pipeline stage ─ */
    stage: {
      type: String,
      enum: ["inquiry", "followup", "client"],
      default: "inquiry",
      index: true,
    },

    /* ─ Client-only ─ */
    clientId: { type: String, trim: true, default: null, sparse: true },

    /* ─ Pre-sale follow-ups (max 3, enforced in service) ─ */
    preSaleFollowups: {
      type: [followUpSchema],
      validate: { validator: (a) => a.length <= 3, message: "Max 3 pre-sale follow-ups" },
      default: [],
    },

    /* ─ Post-sale follow-ups (max 3, enforced in service) ─ */
    postSaleFollowups: {
      type: [followUpSchema],
      validate: { validator: (a) => a.length <= 3, message: "Max 3 post-sale follow-ups" },
      default: [],
    },
    /* ─ Assignment ─ */
    contactBy: { type: String, trim: true, default: "" },

    /* ─ Data source ─ */
    source: {
      type: String,
      enum: ["manual", "excel"],
      default: "manual",
    },
    invoiceId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Invoice",
},

    /* ─ Computed: nearest upcoming follow-up date for sort ─ */
    nextFollowUpDate: { type: Date, default: null, index: 1 },

    /* ─ Soft-delete ─ */
    isDeleted: { type: Boolean, default: false},
  },
  { timestamps: true }
);

/* ── Pre-save: auto-compute nextFollowUpDate ─────────────────────────────── */
dentalLeadSchema.pre("save", function () {
  // 1. Gather all nextCallDates
  const allDates = [...this.preSaleFollowups, ...this.postSaleFollowups]
    .map((f) => f?.nextCallDate)
    .filter(Boolean); // Removes null/undefined

  if (allDates.length > 0) {
    // 2. Sort ascending to find the absolute earliest upcoming/overdue date
    allDates.sort((a, b) => new Date(a) - new Date(b));
    this.nextFollowUpDate = allDates[0];
  } else {
    this.nextFollowUpDate = null;
  }
});

export default mongoose.model("DentalLead", dentalLeadSchema);