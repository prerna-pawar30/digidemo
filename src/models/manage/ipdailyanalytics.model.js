import mongoose from "mongoose";
const MonthlyUsageSchema = new mongoose.Schema(
  {
    month: {
      type: String, // YYYY-MM (e.g. 2026-01)
      required: true
    },

    hitCount: {
      type: Number,
      default: 1
    },

    endpoints: {
      type: Map,
      of: Number,
      default: {}
    },

    firstHitAt: {
      type: Date,
      default: Date.now
    },

    lastHitAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const IpMonthlyAnalyticsSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true
    },

    // Location snapshot (latest known)
    status: String,
    continent: String,
    country: String,
    countryCode: String,
    regionName: String,
    city: String,
    zip: String,
    lat: Number,
    lon: Number,
    timezone: String,
    currency: String,

    monthlyStats: {
      type: [MonthlyUsageSchema],
      default: []
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { versionKey: false }
);

export default mongoose.model(
  "IpMonthlyAnalytics",
  IpMonthlyAnalyticsSchema
);
