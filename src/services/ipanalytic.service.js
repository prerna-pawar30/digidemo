import IpMonthlyAnalytics from "../models/manage/ipdailyanalytics.model.js";

export const getIpAnalyticsService = async ({
  ip,
  month,
  page,
  limit,
  skip,
}) => {
  try {
    /* ---------- BUILD QUERY ---------- */
    const query = {};

    if (ip) query.ip = ip;
    if (month) query["monthlyStats.month"] = month;

    /* ---------- TOTAL COUNT ---------- */
    const total = await IpMonthlyAnalytics.countDocuments(query);

    /* ---------- FETCH DATA ---------- */
    const analytics = await IpMonthlyAnalytics.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      analytics,
      pagination: {
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
      filters: {
        ip: ip || "all",
        month: month || "all",
      },
    };

  } catch (error) {
    console.error("Get IP Analytics Service Error:", error);

    throw {
      message: "Failed to fetch IP analytics",
      statusCode: 500,
      errorCode: "GET_IP_ANALYTICS_FAILED",
      details: error.message,
    };
  }
};




export const getAllIpAnalyticsService = async ({
  page,
  limit,
  skip,
}) => {
  try {
    /* ---------- TOTAL COUNT ---------- */
    const total = await IpMonthlyAnalytics.countDocuments();

    /* ---------- FETCH DATA ---------- */
    const analytics = await IpMonthlyAnalytics.find({})
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      analytics,
      pagination: {
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    };

  } catch (error) {
    console.error("Get All IP Analytics Service Error:", error);

    throw {
      message: "Failed to fetch all IP analytics",
      statusCode: 500,
      errorCode: "GET_ALL_IP_ANALYTICS_FAILED",
      details: error.message,
    };
  }
};



export const ipAnalyticsDashboardService = async ({
  fromDate,
  toDate,
  top,
  country,
  state,
  city,
  countryValue,
  stateValue
}) => {
  try {
    /* -------------------- DATE FILTER -------------------- */
    const dateMatch = {};
    if (fromDate) dateMatch.$gte = new Date(fromDate);
    if (toDate) dateMatch.$lte = new Date(toDate);

    /* -------------------- BASE MATCH -------------------- */
    const matchStage = {};
    if (countryValue) matchStage.country = countryValue;
    if (stateValue) matchStage.regionName = stateValue;

    /* -------------------- BASE PIPELINE -------------------- */
    const basePipeline = [
      { $match: matchStage },
      { $unwind: "$monthlyStats" },
      ...(fromDate || toDate
        ? [{ $match: { "monthlyStats.firstHitAt": dateMatch } }]
        : [])
    ];

    /* -------------------- SUMMARY -------------------- */
    const totalIps = await IpMonthlyAnalytics.countDocuments(matchStage);

    const totalHitsAgg = await IpMonthlyAnalytics.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          total: { $sum: "$monthlyStats.hitCount" }
        }
      }
    ]);

    const currentMonth = new Date().toISOString().slice(0, 7);

    const thisMonthHitsAgg = await IpMonthlyAnalytics.aggregate([
      { $unwind: "$monthlyStats" },
      { $match: { "monthlyStats.month": currentMonth } },
      ...(countryValue ? [{ $match: { country: countryValue } }] : []),
      ...(stateValue ? [{ $match: { regionName: stateValue } }] : []),
      {
        $group: {
          _id: null,
          total: { $sum: "$monthlyStats.hitCount" }
        }
      }
    ]);

    const dashboard = {
      totalIps,
      totalHits: totalHitsAgg[0]?.total || 0,
      thisMonthHits: thisMonthHitsAgg[0]?.total || 0
    };

    /* -------------------- TOP COUNTRIES -------------------- */
    if (country === "true") {
      dashboard.topCountries = await IpMonthlyAnalytics.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: "$country",
            totalHits: { $sum: "$monthlyStats.hitCount" },
            ips: { $addToSet: "$ip" }
          }
        },
        {
          $project: {
            totalHits: 1,
            ipCount: { $size: "$ips" }
          }
        },
        { $sort: { totalHits: -1 } },
        { $limit: top }
      ]);
    }

    /* -------------------- TOP STATES -------------------- */
    if (state === "true") {
      dashboard.topStates = await IpMonthlyAnalytics.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: "$regionName",
            totalHits: { $sum: "$monthlyStats.hitCount" },
            ips: { $addToSet: "$ip" }
          }
        },
        {
          $project: {
            totalHits: 1,
            ipCount: { $size: "$ips" }
          }
        },
        { $sort: { totalHits: -1 } },
        { $limit: top }
      ]);
    }

    /* -------------------- TOP CITIES -------------------- */
    if (city === "true") {
      dashboard.topCities = await IpMonthlyAnalytics.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: "$city",
            totalHits: { $sum: "$monthlyStats.hitCount" },
            ips: { $addToSet: "$ip" }
          }
        },
        {
          $project: {
            totalHits: 1,
            ipCount: { $size: "$ips" }
          }
        },
        { $sort: { totalHits: -1 } },
        { $limit: top }
      ]);
    }

    /* -------------------- TOP IPS -------------------- */
    dashboard.topIps = await IpMonthlyAnalytics.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: "$ip",
          hits: { $sum: "$monthlyStats.hitCount" },
          country: { $first: "$country" },
          city: { $first: "$city" },
          state: { $first: "$regionName" }
        }
      },
      { $sort: { hits: -1 } },
      { $limit: top }
    ]);

    /* -------------------- TOP ENDPOINTS -------------------- */
    dashboard.topEndpoints = await IpMonthlyAnalytics.aggregate([
      ...basePipeline,
      {
        $project: {
          endpoints: { $objectToArray: "$monthlyStats.endpoints" }
        }
      },
      { $unwind: "$endpoints" },
      {
        $group: {
          _id: "$endpoints.k",
          hits: { $sum: "$endpoints.v" }
        }
      },
      { $sort: { hits: -1 } },
      { $limit: top }
    ]);

    /* -------------------- FINAL RESPONSE -------------------- */
    return {
      dashboard,
      filters: {
        country: country === "true",
        state: state === "true",
        city: city === "true",
        countryValue: countryValue || "all",
        stateValue: stateValue || "all",
        fromDate: fromDate || "all",
        toDate: toDate || "all"
      }
    };

  } catch (error) {
    console.error("IP Analytics Dashboard Service Error:", error);

    throw {
      message: "Failed to fetch IP analytics dashboard",
      statusCode: 500,
      errorCode: "IP_ANALYTICS_DASHBOARD_FAILED",
      details: error.message
    };
  }
};