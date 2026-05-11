import IpMonthlyAnalytics from "../models/manage/ipdailyanalytics.model.js";

/**
 * @function ipAnalyticsMiddleware
 *
 * @description
 * Middleware to track monthly API usage per IP.
 * Creates or updates monthly analytics records for each IP, including endpoint hit counts and geolocation.
 *
 * @process
 * 1. Get client IP from `req.userIP` (skip if missing)
 * 2. Determine current month (`YYYY-MM`) and endpoint (`METHOD URL`)
 * 3. Ensure IP document exists using upsert
 * 4. Ensure current month record exists in `monthlyStats`
 * 5. Increment hit count and endpoint count, update lastHitAt and geolocation info
 * 6. Call `next()` to continue
 *
 * @response
 * Middleware does not send a response; logs errors if database updates fail
 */
export const ipAnalyticsMiddleware = async (req, res, next) => {
  try {
    const ip = req.userIP;
    if (!ip) return next();

    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
    const geo = req.geoIpApi || {};

    // 1️⃣ Ensure IP document exists
    await IpMonthlyAnalytics.updateOne(
      { ip },
      {
        $setOnInsert: { ip, monthlyStats: [] }
      },
      { upsert: true }
    );

    // 2️⃣ Ensure month exists
    await IpMonthlyAnalytics.updateOne(
      { ip, "monthlyStats.month": { $ne: month } },
      {
        $push: {
          monthlyStats: {
            month,
            hitCount: 0,
            endpoints: {},
            firstHitAt: now,
            lastHitAt: now
          }
        }
      }
    );

    // 3️⃣ Increment hit counts and update geolocation info
    await IpMonthlyAnalytics.updateOne(
      { ip },
      {
        $set: {
          continent: geo.continent,
          country: geo.country,
          countryCode: geo.countryCode,
          regionName: geo.regionName,
          city: geo.city,
          zip: geo.zip,
          lat: geo.lat,
          lon: geo.lon,
          timezone: geo.timezone,
          currency: geo.currency,
          "monthlyStats.$[m].lastHitAt": now
        },
        $inc: {
          "monthlyStats.$[m].hitCount": 1,
          [`monthlyStats.$[m].endpoints.${endpoint}`]: 1
        }
      },
      {
        arrayFilters: [{ "m.month": month }]
      }
    );
  } catch (error) {
    console.error("IP Analytics Middleware Error:", error);
     handleError(res, error); // usually we don't respond in analytics middleware
  }
  next();
};