import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";
const { Schema, model } = mongoose;


const fileSchema = new Schema(
  {
    filename: { type: String, trim: true },
    originalName: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    sizeBytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const noteSchema = new Schema(
  {
    noteId: {
      type: String,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
    addedBy: {
      employeeId: { type: String, default: null },
      employeeRef: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
      name: { type: String, trim: true, default: null },
      email: { type: String, trim: true, default: null },
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const jobApplicationSchema = new Schema(
  {
    applicationId:{
      type: String,
      unique: true,
    },
    job:{
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    jobId:{
      type: String,
      required: true,
    },
    applicant:{
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName:{
        type: String,
        required: true,
        trim: true,
      },
      email:{
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
      },
      phone:{
        type: String,
        required: true,
        trim: true,
      },
      city:{
        type: String,
        trim: true,
        default: null,
      },
      state:{
        type: String,
        trim: true,
        default: null,
      },
      country:{
        type: String,
        trim: true,
        default: null,
      },
      totalExperienceYears:{
        type: Number,
        default: 0,
        min: 0,
      },
      currentCompany:{
        type: String,
        trim: true,
        default: null,
      },
      currentCTC:{
        type: Number,
        default: 0,
      },
      expectedCTC:{
        type: Number,
        default: 0,
      },
      noticePeriodDays:{
        type: Number,
        default: 0,
      },
      portfolioUrl: {
        type: String,
        trim: true,
        default: null,
      },
      linkedinUrl: {
        type: String,
        trim: true,
        default: null,
      },
      githubUrl: {
        type: String,
        trim: true,
        default: null,
      },
    },

    coverLetter: {
      type: String,
      trim: true,
      default: null,
    },

    resume: {
      type: String,
      required: true,
    },

    additionalFiles: [String],

    source: {
      type: String,
      enum: ["career_page", "linkedin", "naukri", "referral", "manual", "other"],
      default: "career_page",
    },

    status: {
      type: String,
      enum: [
        "applied",
        "shortlisted",
        "interview_scheduled",
        "interviewed",
        "selected",
        "rejected",
        "hired",
      ],
      default: "applied",
    },

    notes: [noteSchema],

    assignedTo: {
      employeeId: { type: String, default: null },
      employeeRef: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
      name: { type: String, trim: true, default: null },
      email: { type: String, trim: true, default: null },
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);
const JobApplication = model("JobApplication", jobApplicationSchema);
export default JobApplication;