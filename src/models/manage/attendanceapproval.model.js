import mongoose from "mongoose";
const adminApprovalSchema = new mongoose.Schema(
  {
    approvalId: {
      type: String,
      unique: true,
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    requestType: {
      type: String,
      enum: ["FORGOT_PUNCH_OUT", "LEAVE"],
      required: true,
      index: true,
    },
    // Link to record if needed (EmployeeRecord._id or leave date)
    recordDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    requestData: {
      type: mongoose.Schema.Types.Mixed,
      required: true, // { requestedPunchOut, leaveType, fromDate, toDate... }
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // admin
      default: null,
    },
    actionAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);
export const AdminApproval = mongoose.model(
  "AdminApproval",
  adminApprovalSchema
);
