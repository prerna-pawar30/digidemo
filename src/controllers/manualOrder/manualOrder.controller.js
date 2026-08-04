import {
  createManualOrderService,
  getAllManualOrdersService,
  getSingleManualOrderService,
  createManualReturnRequestService,
  updatePendingManualReturnRequestService,
  getAllManualReturnRequestsService,
  updateManualReturnRequestStatusService,
  markManualRefundCompletedService,
  manualOrderAnalysisService,
} from "../../services/manualOrder.service.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";

/**
 * @function createManualOrder
 *
 * @description
 * Creates an order manually on behalf of a customer (offline/phone/walk-in sale).
 * Deducts stock immediately and records the sale against the creating employee.
 *
 * body: {
 *   customer: { userId?, fullName, phone, email?, organizationName? },
 *   items: [{ productId, variantId, quantity }],
 *   billingAddress: { fullName, phone, street, area, city, state, country, pincode },
 *   shippingAddress: { fullName, phone, street, area, city, state, country, pincode },
 *   discountAmount?, shippingCharge?, gstAmount?, gstPercentage?, gstNumber?, organizationName?,
 *   paymentMode?, paymentReference?, paymentStatus?, orderStatus?, notes?
 * }
 */
export const createManualOrder = async (req, res) => {
  try {
    const order = await createManualOrderService(req.body, req.user.email);
    return sendSuccess(res, { order }, 201, "Manual order created successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

export const getAllManualOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const { status } = req.query;

    const result = await getAllManualOrdersService({ page, limit, status });
    return sendSuccess(res, result, 200, "Manual orders fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

export const getSingleManualOrder = async (req, res) => {
  try {
    const { manualOrderId } = req.params;
    const order = await getSingleManualOrderService(manualOrderId);
    return sendSuccess(res, { order }, 200, "Manual order fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function createManualReturnRequest
 *
 * body: {
 *   manualOrderId: string,
 *   returnItems: [{ productId, variantId, quantity, reason? }]
 * }
 */
export const createManualReturnRequest = async (req, res) => {
  try {
    const { manualOrderId, returnItems } = req.body;
    if (!manualOrderId || !Array.isArray(returnItems) || returnItems.length === 0) {
      return sendError(res, {
        message: "Invalid return request data",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const data = await createManualReturnRequestService({ manualOrderId, returnItems });
    return sendSuccess(res, data, 201, "Return request created successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

export const updatePendingManualReturnRequest = async (req, res) => {
  try {
    const { manualOrderId, requestId } = req.params;
    const { returnItems } = req.body;

    if (!manualOrderId || !requestId) {
      return sendError(res, {
        message: "manualOrderId and requestId are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    if (!Array.isArray(returnItems)) {
      return sendError(res, {
        message: "returnItems must be an array",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    const data = await updatePendingManualReturnRequestService({
      manualOrderId,
      requestId,
      returnItems,
    });

    return sendSuccess(res, data, 200, "Return request updated successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

export const getAllManualReturnRequests = async (req, res) => {
  try {
    const data = await getAllManualReturnRequestsService();
    return sendSuccess(
      res,
      data,
      200,
      data.orders.length === 0 ? "No return requests found" : "Return requests fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateManualReturnRequestStatus
 *
 * @description
 * Approves or rejects a pending return request. Approving with a quantity lower
 * than the full ordered quantity results in a "partial_returned" order, while
 * approving the remaining balance results in "returned" — this single endpoint
 * therefore covers both full and partial returns.
 *
 * body: {
 *   status: "approved" | "rejected",
 *   items?: [{ productId, variantId, approvedQuantity }],
 *   permission?: string
 * }
 */
export const updateManualReturnRequestStatus = async (req, res) => {
  try {
    const { manualOrderId, requestId } = req.params;
    const { status, items, permission } = req.body;

    if (!manualOrderId || !requestId) {
      return sendError(res, {
        message: "manualOrderId and requestId are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    if (!["approved", "rejected"].includes(status)) {
      return sendError(res, {
        message: "Invalid status",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    const data = await updateManualReturnRequestStatusService({
      manualOrderId,
      requestId,
      status,
      items,
      permission,
      userEmail: req.user.email,
    });

    return sendSuccess(res, data, 200, `Return request ${status} successfully`);
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function markManualRefundCompleted
 *
 * body: { amount?, refundMode?, refundReference? }
 */
export const markManualRefundCompleted = async (req, res) => {
  try {
    const { manualOrderId } = req.params;
    const { amount, refundMode, refundReference } = req.body;

    if (!manualOrderId) {
      return sendError(res, {
        message: "manualOrderId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    const data = await markManualRefundCompletedService({
      manualOrderId,
      amount,
      refundMode,
      refundReference,
      userEmail: req.user.email,
    });

    return sendSuccess(res, data, 200, "Refund completed successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function manualOrderAnalysis
 *
 * query: { startDate?, endDate?, employeeId?, top? }
 */
export const manualOrderAnalysis = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, top } = req.query;
    const data = await manualOrderAnalysisService({ startDate, endDate, employeeId, top });
    return sendSuccess(res, data, 200, "Manual order analysis fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};
