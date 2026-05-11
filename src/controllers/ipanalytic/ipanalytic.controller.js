import { getIpAnalyticsService, getAllIpAnalyticsService, ipAnalyticsDashboardService } from "../../services/ipanalytic.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { handleError } from "../../helpers/error.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";

/**
 * @function getIpAnalytics
 *
 * @params
 * query: {
 *   ip?: string,
 *   month?: string (YYYY-MM),
 *   page?: number (default: 1),
 *   limit?: number (default: 12)
 * }
 *
 * @process
 * 1. Extract query parameters (ip, month)
 * 2. Use shared pagination helper:
 *    - getPagination(query)
 *    - returns page, limit, skip
 * 3. Build MongoDB query filter
 *    - Filter by IP if provided
 *    - Filter by month inside monthlyStats if provided
 * 4. Count total matching records
 * 5. Fetch analytics data with:
 *    - Sorting (latest first)
 *    - Pagination (skip + limit)
 * 6. Return analytics with pagination metadata
 *
 * @response
 * 200 {
 *   analytics: [],
 *   pagination: {
 *     totalRecords: number,
 *     totalPages: number,
 *     currentPage: number,
 *     limit: number
 *   },
 *   filters: {
 *     ip: string | "all",
 *     month: string | "all"
 *   }
 * }
 */
export const getIpAnalytics = async (req, res) => {
  try {
    /* ---------- QUERY PARAMS ---------- */
    const { ip, month } = req.query;

    /* ---------- PAGINATION ---------- */
    const { page, limit, skip } = getPagination(req.query);

    /* ---------- SERVICE ---------- */
    const result = await getIpAnalyticsService({
      ip,
      month,
      page,
      limit,
      skip,
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "IP analytics fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function getAllIpAnalytics
 *
 * @params
 * query: {
 *   page?: number (default: 1),
 *   limit?: number (default: 12)
 * }
 *
 * @process
 * 1. Extract pagination using getPagination helper
 * 2. Count total IP analytics records
 * 3. Fetch analytics data:
 *    - Sort by latest updated
 *    - Apply pagination (skip + limit)
 * 4. Return analytics with pagination metadata
 *
 * @response
 * 200 {
 *   analytics: [
 *     {
 *       ip: string,
 *       country: string,
 *       city: string,
 *       monthlyStats: []
 *     }
 *   ],
 *   pagination: {
 *     totalRecords: number,
 *     totalPages: number,
 *     currentPage: number,
 *     limit: number
 *   }
 * }
 */
export const getAllIpAnalytics = async (req, res) => {
  try {
    /* ---------- PAGINATION ---------- */
    const { page, limit, skip } = getPagination(req.query);

    /* ---------- SERVICE ---------- */
    const result = await getAllIpAnalyticsService({
      page,
      limit,
      skip,
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "All IP analytics fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function ipAnalyticsDashboard
 *
 * @params
 * query: {
 *   fromDate?: string (ISO date),
 *   toDate?: string (ISO date),
 *   top?: number (default: 10),
 *   country?: "true" | "false",
 *   state?: "true" | "false",
 *   city?: "true" | "false",
 *   countryValue?: string,
 *   stateValue?: string
 * }
 *
 * @process
 * 1. Extract query parameters:
 *    - Date range (fromDate, toDate)
 *    - Top limit (top)
 *    - Toggle flags (country, state, city)
 *    - Filters (countryValue, stateValue)
 *
 * 2. Build MongoDB match filters:
 *    - Filter by country if countryValue provided
 *    - Filter by state if stateValue provided
 *
 * 3. Build aggregation base pipeline:
 *    - Match base filters
 *    - Unwind monthlyStats
 *    - Apply date range filter on monthlyStats.firstHitAt (if provided)
 *
 * 4. Calculate summary metrics:
 *    - Total unique IPs
 *    - Total hits (all time or filtered range)
 *    - Current month hits
 *
 * 5. Conditional aggregations (based on flags):
 *    - Top countries (if country === "true")
 *    - Top states (if state === "true")
 *    - Top cities (if city === "true")
 *
 * 6. Always compute:
 *    - Top IPs (based on hit count)
 *    - Top endpoints (based on usage frequency)
 *
 * 7. Sort all results by highest hits and limit using `top`
 *
 * 8. Return structured dashboard data with applied filters
 *
 * @response
 * 200 {
 *   dashboard: {
 *     totalIps: number,
 *     totalHits: number,
 *     thisMonthHits: number,
 *
 *     topCountries?: [
 *       { _id: string, totalHits: number, ipCount: number }
 *     ],
 *
 *     topStates?: [
 *       { _id: string, totalHits: number, ipCount: number }
 *     ],
 *
 *     topCities?: [
 *       { _id: string, totalHits: number, ipCount: number }
 *     ],
 *
 *     topIps: [
 *       {
 *         _id: string,
 *         hits: number,
 *         country: string,
 *         state: string,
 *         city: string
 *       }
 *     ],
 *
 *     topEndpoints: [
 *       { _id: string, hits: number }
 *     ]
 *   },
 *
 *   filters: {
 *     country: boolean,
 *     state: boolean,
 *     city: boolean,
 *     countryValue: string | "all",
 *     stateValue: string | "all",
 *     fromDate: string | "all",
 *     toDate: string | "all"
 *   }
 * }
 */
export const ipAnalyticsDashboard = async (req, res) => {
  try {
    /* ---------- QUERY PARAMS ---------- */
    const {
      fromDate,
      toDate,
      top = 10,
      country,
      state,
      city,
      countryValue,
      stateValue
    } = req.query;

    /* ---------- SERVICE ---------- */
    const result = await ipAnalyticsDashboardService({
      fromDate,
      toDate,
      top: parseInt(top),
      country,
      state,
      city,
      countryValue,
      stateValue
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      200,
      "IP analytics dashboard fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};