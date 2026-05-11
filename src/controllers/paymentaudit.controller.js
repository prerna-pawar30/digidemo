import Payment from "../models/payment.model.js";
import { sendSuccess, handleError } from "../utils/responseHandler.js";
import { getPagination } from "../utils/pagination.js";

/**
 * @function getAllPayments
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * 1. Parse pagination parameters (`page`, `limit`) from query
 * 2. Fetch payments from database
 * 3. Populate `user` with `firstName`, `lastName`, and `email`
 * 4. Sort payments by latest (`createdAt: -1`)
 * 5. Apply pagination using `skip` and `limit`
 * 6. Get total count of payments
 * 7. Generate pagination metadata using central utility
 * 8. Return paginated payment data
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Payments fetched successfully",
 *   data: {
 *     payments: [
 *       {
 *         _id: string,
 *         amount: number,
 *         status: string,
 *         user: {
 *           firstName: string,
 *           lastName: string,
 *           email: string
 *         },
 *         createdAt: Date
 *       }
 *     ],
 *     pagination: {
 *       totalItems: number,
 *       totalPages: number,
 *       currentPage: number,
 *       nextPage: number | null,
 *       prevPage: number | null
 *     }
 *   }
 * }
 */

export const getAllPayments = async (req, res) => {
  try {
    /* ---------- PAGINATION PARAMS ---------- */
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    /* ---------- TOTAL COUNT ---------- */
    const total = await Payment.countDocuments();

    /* ---------- FETCH PAYMENTS ---------- */
    const payments = await Payment.find()
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    /* ---------- PAGINATION ---------- */
    const pagination = getPagination({
      total,
      page,
      limit,
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      {
        payments,
        pagination,
      },
      200,
      "Payments fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};