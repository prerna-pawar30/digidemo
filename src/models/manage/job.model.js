import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";

const { Schema, model } = mongoose;
const jobSchema = new Schema({
    jobId:{
      type: String,
      unique: true,
    },
    title:{
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    workplaceType: {
      type: String,
      enum: ["onsite", "remote", "hybrid"],
      default: "onsite",
    },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "internship", "contract", "freelance"],
      required: true,
    },
    experienceLevel: {
      type: String,
      enum: ["fresher", "junior", "mid", "senior", "lead"],
      default: "junior",
    },
    minExperienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxExperienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    openings: {
      type: Number,
      default: 1,
      min: 1,
    },
    salary: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      isVisible: { type: Boolean, default: false },
    },
    shortDescription:{
      type: String,
      trim: true,
      maxlength: 300,
    },
    description:[
      {
        paragraphId: {
          type: String,
          default: () => uuidv6(),
        },
        text:{
          type: String,
          trim: true,
          required: true,
        },
      },
    ],
    responsibilities:[
      {
        type: String,
        trim: true,
      },
    ],
    requirements:[
      {
        type: String,
        trim: true,
      },
    ],
    skills:[
      {
        type: String,
        trim: true,
      },
    ],
    perks:[
      {
        type: String,
        trim: true,
      },
    ],
    applicationDeadline:{
      type: Date,
      default: null,
    },
    status:{
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
    },
    isFeatured:{
      type: Boolean,
      default: false,
    },
    createdBy:{
      employeeId: { type: String, default: null },
      employeeRef: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
      name: { type: String, trim: true, default: null },
      email: { type: String, trim: true, default: null },
    },
    updatedBy:{
      employeeId: { type: String, default: null },
      employeeRef: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
      name: { type: String, trim: true, default: null },
      email: { type: String, trim: true, default: null },
    },
  },
  {
    timestamps: true,
  }
);
const Job = model("Job", jobSchema);
export default Job;