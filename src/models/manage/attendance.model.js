import mongoose from "mongoose";

const dayRecordSchema = new mongoose.Schema(
  {
    /* ===== COMMON ===== */
    recordId: {
      type: String,
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    dayType: {
      type: [String],
      enum: ["WORKING", "LEAVE", "HOLIDAY"],
      required: true,
    },
    /* ===== WORKING ===== */
    punchIn: { type: Date, default: null },
    punchOut: { type: Date, default: null },
    status: {
      type: [String],
      enum: ["PRESENT", "ABSENT", "HALF_DAY", "LATE", "EARLY_GOING", "LEAVE", "HOLIDAY"],
      default: [],
    },
    totalWorkedTime: {
      hours: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 },
    },
    /* ===== LEAVE ===== */
    leaveType: {
      type: String,
      enum: ["SICK", "CASUAL", "EMERGENCY"],
      default: null,
    },
    leaveDuration: {
      type: String,
      enum: ["FULL_DAY", "HALF_DAY"],
      default: "FULL_DAY",
    },

    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },

    leaveStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: null,
    },

    leaveReason: { type: String, default: null },

    /* ===== ADMIN FLAGS ===== */
    requiresAdminApproval: { type: Boolean, default: false },
    adminAdjusted: { type: Boolean, default: false },
  },
  { _id: false }
);

const employeeRecordSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      unique: true,
      required: true,
    },

    records: {
      type: [dayRecordSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// No duplicate dates
employeeRecordSchema.pre("save", function () {
  const dates = this.records.map(r => r.date);
  if (new Set(dates).size !== dates.length) {
    return new Error("Duplicate date record not allowed");
  }
});

// Auto-calc worked time + validations
employeeRecordSchema.pre("save", function () {
  for (const r of this.records) {
    if (r.dayType === "WORKING" && r.punchIn && r.punchOut) {
      if (r.punchOut < r.punchIn) {
        return new Error("Punch-out cannot be before punch-in");
      }

      const diff = r.punchOut - r.punchIn;
      const mins = Math.floor(diff / 60000);

      r.totalWorkedTime.hours = Math.floor(mins / 60);
      r.totalWorkedTime.minutes = mins % 60;
    }

    if (r.dayType === "LEAVE" && r.fromDate && r.toDate) {
      if (r.toDate < r.fromDate) {
        return new Error("toDate cannot be before fromDate");
      }
    }
  }
});

// Returns array of date strings YYYY-MM-DD
const getUpcomingSundays = (year, startDate) => {
  const sundays = [];
  const date = new Date(startDate);

  // move to next Sunday (or same day if Sunday)
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }

  while (date.getFullYear() === year) {
    sundays.push(date.toISOString().split("T")[0]);
    date.setDate(date.getDate() + 7);
  }

  return sundays;
};


employeeRecordSchema.pre("save", function () {
  if (!this.records.length) return;

  // earliest record date (joining / first activity)
  const firstRecordDate = this.records
    .map(r => new Date(r.date))
    .sort((a, b) => a - b)[0];

  const year = firstRecordDate.getFullYear();

  const upcomingSundays = getUpcomingSundays(year, firstRecordDate);

  for (const sunday of upcomingSundays) {
    // skip if already exists
    if (this.records.some(r => r.date === sunday)) continue;

    this.records.push({
      recordId: `holiday-${sunday}`,
      date: sunday,
      dayType: ["HOLIDAY"],
      status: ["HOLIDAY"],
      punchIn: null,
      punchOut: null,
      totalWorkedTime: { hours: 0, minutes: 0 },
      leaveType: null,
      leaveDuration: "FULL_DAY",
      fromDate: null,
      toDate: null,
      leaveStatus: null,
      leaveReason: null,
      requiresAdminApproval: false,
      adminAdjusted: false,
    });
  }
});

export const EmployeeRecord = mongoose.model(
  "EmployeeRecord",
  employeeRecordSchema
);