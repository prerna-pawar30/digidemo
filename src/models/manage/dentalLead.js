import mongoose from "mongoose";

/* ── Follow-up log entry (max 3 per array) ── */
const followUpSchema = new mongoose.Schema(
  {
    agent:       { type: String, required: true, trim: true },
    employeeId:  { type: String, trim: true },
    notes:       { type: String, required: true, trim: true },
    hurdle:      { type: String, default: "None noted", trim: true },
    nextCallDate:{ type: Date, required: true },
    touchNumber: { type: Number, min: 1, max: 3 },
    loggedAt:    { type: Date, default: Date.now },
  },
  { _id: true }
);

/* ── Order entry (only for clients) ── */
const orderSchema = new mongoose.Schema(
  {
    product:   { type: String, required: true, trim: true },
    quantity:  { type: Number, default: 1, min: 1 },
    price:     { type: Number, required: true, min: 0 },
    gstNo:     { type: String, trim: true, default: "" },
    invoiceId: { type: String, trim: true },
    loggedBy:  { type: String, trim: true },
    orderDate: { type: Date, default: Date.now },
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
    enquiry:    { type: String, trim: true, default: "General Inquiry" },
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

    /* ─ Orders (clients only) ─ */
    ordersList: { type: [orderSchema], default: [] },

    /* ─ Assignment ─ */
    contactBy: { type: String, trim: true, default: "" },

    /* ─ Data source ─ */
    source: {
      type: String,
      enum: ["manual", "excel"],
      default: "manual",
    },

    /* ─ Computed: nearest upcoming follow-up date for sort ─ */
    nextFollowUpDate: { type: Date, default: null, index: 1 },

    /* ─ Soft-delete ─ */
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/* ── Indexes ─────────────────────────────────────────────────────────────── */
dentalLeadSchema.index({ stage: 1, nextFollowUpDate: 1 });
dentalLeadSchema.index({ contact: 1 });
dentalLeadSchema.index(
  { doctorName: "text", clinicName: "text", city: "text", state: "text", remarks: "text" },
  { name: "lead_text_idx" }
);

/* ── Pre-save: auto-compute nextFollowUpDate ─────────────────────────────── */
dentalLeadSchema.pre("save", function () {
  const now = new Date();
  const upcoming = [...this.preSaleFollowups, ...this.postSaleFollowups]
    .map((f) => f?.nextCallDate)
    .filter((d) => d && new Date(d) >= now)
    .sort((a, b) => new Date(a) - new Date(b));

  this.nextFollowUpDate = upcoming.length ? upcoming[0] : null;
});

export default mongoose.model("DentalLead", dentalLeadSchema);