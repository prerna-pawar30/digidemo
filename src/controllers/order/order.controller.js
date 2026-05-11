import { cancelOrderService, createOrderService, createReturnRequestService, getAllOrdersAdminService, getAllOrdersService, getAllReturnRequestsService, getOrdersByStatusService, getSingleOrderService, getUserOrdersService, markRefundCompleteAdminService, markRefundCompletedService, salesDashboardService, updateCourierDetailsService, updateOrderStatusService, updatePendingReturnRequestService, updateReturnRequestStatusService, verifyRazorpayService } from "../../services/order.service.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";

/**
 * @function createOrder
 *
 * @description
 * Creates a Razorpay order based on selected cart items.
 * Validates user, cart, products, stock, pricing, and address before initializing payment.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token
 * }
 *
 * body: {
 *   addressId: string,
 *   billingAddress: object,
 *   organizationName?: string,
 *   gstNumber?: string,
 *   discount?: number,
 *   shippingCharge?: number,
 *   couponId?: string,
 *   gstAmount?: number,
 *   gstPercentage?: number,
 *   items: [
 *     {
 *       productId: string,
 *       variantId: string,
 *       quantity: number,
 *       price: number
 *     }
 *   ]
 * }
 *
 * @process
 * 1. Validate authenticated user (req.currentUser)
 * 2. Fetch user and verify existence
 * 3. Fetch user's cart and validate it's not empty
 * 4. Validate request payload (items, address, billing details)
 * 5. Validate selected shipping address from user's saved addresses
 * 6. Iterate through frontend items:
 *    - Validate product existence and active status
 *    - Validate variant existence
 *    - Check stock availability
 *    - Validate price integrity
 *    - Transform attributes into key-value object
 *    - Build normalized order items array
 * 7. Calculate subtotal from items
 * 8. Apply discount and shipping charge safely
 * 9. Calculate grand total (ensure non-negative)
 * 10. Validate and attach coupon details (if provided)
 * 11. Prepare order payload (NOT saved yet)
 * 12. Create Razorpay order using amount (in paise)
 * 13. Return Razorpay order details along with prepared order data
 *
 * @important_notes
 * - Order is NOT saved in DB at this stage
 * - Actual order creation should happen AFTER payment verification
 * - Razorpay amount must be in paise (₹ * 100)
 * - Price is taken from frontend but must be validated against DB (security)
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Razorpay order created",
 *   data: {
 *     razorpayOrderId: string,
 *     amount: number,
 *     currency: "INR",
 *     orderItem: object
 *   }
 * }
 *
 * @errors
 * 400: Invalid input / cart empty / stock issue / invalid coupon
 * 401: Unauthorized user
 * 404: User / product / variant not found
 * 500: Internal server error
 */
export const createOrder = async (req, res) => {
  try {
    const result = await createOrderService(req.body, req.currentUser);
    return sendSuccess(
      res,
      result,
      200,
      "Razorpay order created"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function verifyRazorpay
 *
 * @description
 * Verifies Razorpay payment signature, creates payment record, persists order,
 * deducts stock, logs inventory changes, clears cart, and triggers post-order notifications.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token
 * }
 *
 * body: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string,
 *   orderItem: object   // order payload received from createOrder API
 * }
 *
 * @process
 * 1. Validate Razorpay signature using HMAC SHA256
 *    - Combine order_id and payment_id
 *    - Generate expected signature using secret key
 *    - Compare with received signature
 *
 * 2. Validate authenticated user
 *    - Fetch user from DB
 *
 * 3. Validate orderItem payload
 *
 * 4. Create Payment record
 *    - Store Razorpay transaction details
 *    - Mark payment status as "success"
 *
 * 5. Create Order record
 *    - Persist full order payload
 *    - Attach Razorpay details
 *    - Set paymentStatus = "paid"
 *    - Set orderStatus = "placed"
 *
 * 6. Deduct stock for each ordered item
 *    - Find product and variant
 *    - Deduct stock based on stockType:
 *        a. PRODUCT → reduce productStock
 *        b. VARIANT → reduce variantStock
 *    - Track low stock items (< 50 units)
 *    - Save updated product
 *
 * 7. Maintain Stock Audit Log
 *    - Log all deducted items with order reference
 *
 * 8. Clear user cart
 *    - Remove all items from cart
 *
 * 9. Update user order history
 *    - Push order reference into user document
 *
 * 10. Send post-order notifications
 *    - Send order confirmation email to user
 *    - Send low stock alert to admins (if applicable)
 *
 * @important_notes
 * - Signature verification is critical to prevent payment fraud
 * - Order is created ONLY after successful payment verification
 * - Stock deduction happens post-payment to ensure consistency
 * - Email failures do NOT block order completion
 * - Consider using DB transactions (MongoDB session) for atomicity
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Payment verified and order placed",
 *   data: {
 *     order: object
 *   }
 * }
 *
 * @errors
 * 400: Invalid signature / invalid order data
 * 401: Unauthorized user
 * 404: User / product / variant not found
 * 500: Internal server error
 */
export const verifyRazorpay = async (req, res) => {
  try {
    const order = await verifyRazorpayService(
      req.body,
      req.currentUser
    );
    return sendSuccess(
      res,
      { order },
      201,
      "Payment verified and order placed"
    );
  }catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getUserOrders
 *
 * @description
 * Fetches paginated orders of the authenticated user with optional
 * month/year filtering. Returns structured order data with items,
 * pricing, and status details.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token
 * }
 *
 * query: {
 *   page?: number,      // default: 1
 *   limit?: number,     // default: 10
 *   month?: number,     // 1 - 12 (optional)
 *   year?: number       // >= 2000 (optional)
 * }
 *
 * @process
 * 1. Validate authenticated user (req.currentUser)
 *
 * 2. Parse pagination parameters
 *    - page (default: 1)
 *    - limit (default: 10)
 *    - calculate skip value
 *
 * 3. Build filter object
 *    - base filter: { user: user._id }
 *    - if month & year provided:
 *        a. validate month (1–12) and year (>= 2000)
 *        b. construct date range
 *        c. apply createdAt filter using $gte and $lt
 *
 * 4. Execute database queries (parallel)
 *    - fetch paginated orders (sorted by latest)
 *    - count total orders
 *
 * 5. Calculate pagination metadata
 *    - totalPages
 *
 * 6. Handle page overflow
 *    - if requested page > totalPages:
 *        return empty orders with pagination info
 *
 * 7. Transform order data
 *    - include:
 *        orderId, items, totals, coupon, statuses
 *    - map each item:
 *        product details, quantity, price, attributes, image
 *    - compute totalItems per order
 *
 * 8. Return structured response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Orders fetched successfully",
 *   data: {
 *     totalOrders: number,
 *     totalPages: number,
 *     currentPage: number,
 *     nextPage: number | null,
 *     prevPage: number | null,
 *     filters: {
 *       month: number | null,
 *       year: number | null
 *     },
 *     orders: [
 *       {
 *         _id: ObjectId,
 *         orderId: string,
 *         totalItems: number,
 *         items: [
 *           {
 *             productId: string,
 *             variantId: string,
 *             sku: string,
 *             productName: string,
 *             variantName: string,
 *             price: number,
 *             quantity: number,
 *             attributes: object,
 *             image: string
 *           }
 *         ],
 *         shippingCharge: number,
 *         grandTotal: number,
 *         coupon: object | null,
 *         paymentMode: string,
 *         paymentStatus: string,
 *         orderStatus: string,
 *         createdAt: Date,
 *         updatedAt: Date
 *       }
 *     ]
 *   }
 * }
 *
 * @errors
 * 400: Invalid month/year
 * 401: Unauthorized user
 * 500: Internal server error
 */
export const getUserOrders = async (req, res) => {
  try {
    const result = await getUserOrdersService(
      req.query,
      req.currentUser
    );
    return sendSuccess(
      res,
      result,
      200,
      "Orders fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getSingleOrder
 *
 * @description
 * Fetches a single order for the authenticated user using orderId.
 * Ensures the order belongs to the requesting user and returns full order details.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token
 * }
 *
 * params: {
 *   orderId: string
 * }
 *
 * @process
 * 1. Validate authenticated user (req.currentUser)
 *
 * 2. Validate input parameter
 *    - Ensure orderId is provided
 *
 * 3. Fetch order from database
 *    - Match orderId and user._id
 *    - Prevent access to other users' orders
 *
 * 4. Handle not found case
 *    - Return 404 if order does not exist
 *
 * 5. Return order details
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Order fetched successfully",
 *   data: {
 *     order: {
 *       _id: ObjectId,
 *       orderId: string,
 *       user: ObjectId,
 *       items: [
 *         {
 *           productId: string,
 *           variantId: string,
 *           productName: string,
 *           variantName: string,
 *           price: number,
 *           quantity: number,
 *           attributes: object,
 *           image: string
 *         }
 *       ],
 *       shippingAddress: object,
 *       billingAddress: object,
 *       shippingCharge: number,
 *       grandTotal: number,
 *       coupon: object | null,
 *       paymentMode: string,
 *       paymentStatus: string,
 *       orderStatus: string,
 *       razorpayOrderId: string,
 *       razorpayPaymentId: string,
 *       createdAt: Date,
 *       updatedAt: Date
 *     }
 *   }
 * }
 *
 * @errors
 * 400: orderId is required
 * 401: Unauthorized user
 * 404: Order not found
 * 500: Internal server error
 */
export const getSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getSingleOrderService(orderId, req.currentUser);
    return sendSuccess(res, { order }, 200, "Order fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function cancelOrder
 *
 * @description
 * Cancels an existing order for the authenticated user.
 * Delegates business logic to service layer including validation,
 * status update, and potential refund handling.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token
 * }
 *
 * params: {
 *   orderId: string
 * }
 *
 * body: {
 *   reason?: string   // optional cancellation reason
 * }
 *
 * @process
 * 1. Extract orderId from request params
 * 2. Extract cancellation reason from request body
 * 3. Call cancelOrderService with:
 *    - orderId
 *    - currentUser
 *    - reason
 *
 * 4. Inside service layer (expected flow):
 *    - Validate user authorization
 *    - Fetch order by orderId and user
 *    - Validate order eligibility for cancellation
 *        (e.g., not already cancelled/delivered)
 *    - Update orderStatus → "cancelled"
 *    - Update paymentStatus (if applicable)
 *    - Trigger refund (if prepaid order)
 *    - Log cancellation reason
 *
 * 5. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Order cancelled successfully",
 *   data: {
 *     orderId: string,
 *     orderStatus: "cancelled",
 *     refundStatus?: string
 *   }
 * }
 *
 * @errors
 * 400: Invalid orderId / invalid cancellation state
 * 401: Unauthorized user
 * 404: Order not found
 * 500: Internal server error
 */
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const result = await cancelOrderService(orderId, req.currentUser, reason);
    return sendSuccess(res, result, 200, "Order cancelled successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function markRefundCompleted
 *
 * @description
 * Processes and completes a refund for a cancelled order using Razorpay.
 * Ensures eligibility checks before triggering refund and updates order state accordingly.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token (Admin)
 * }
 *
 * params: {
 *   orderId: string
 * }
 *
 * @process
 * 1. Validate input
 *    - Ensure orderId is provided
 *
 * 2. Fetch order from database
 *    - Find order by orderId
 *
 * 3. Validate refund eligibility
 *    - Order must be in "cancelled" state
 *    - paymentStatus must be "refund_pending"
 *    - Prevent duplicate refunds (if already "refunded")
 *    - Ensure Razorpay paymentId exists
 *    - Validate refundAmount (> 0)
 *
 * 4. Trigger Razorpay refund
 *    - Call Razorpay API with:
 *        a. paymentId
 *        b. refund amount (in paise)
 *        c. optional notes (orderId, reason)
 *
 * 5. Update order after successful refund
 *    - paymentStatus → "refunded"
 *    - set refundedAt timestamp
 *    - store razorpayRefundId
 *
 * 6. Maintain refund history
 *    - Push refund entry into refundHistory array
 *
 * 7. Save updated order
 *
 * 8. Return success response with refund details
 *
 * @important_notes
 * - Refund amount must always be converted to paise (₹ * 100)
 * - Razorpay refund API is asynchronous but returns immediate status
 * - Ensure idempotency to avoid duplicate refunds
 * - Consider webhook handling for final refund confirmation
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Refund completed successfully",
 *   data: {
 *     orderId: string,
 *     orderStatus: "cancelled",
 *     paymentStatus: "refunded",
 *     refundAmount: number,
 *     refundedAt: Date,
 *     razorpayRefundId: string,
 *     razorpayRefundStatus: string
 *   }
 * }
 *
 * @errors
 * 400: Invalid order state / already refunded / invalid amount
 * 404: Order not found
 * 500: Refund failed (Razorpay or server error)
 */
export const markRefundCompleted = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return sendError(res, {
        message: "orderId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    // Call service to process refund
    const refundData = await markRefundCompletedService(orderId);
    return sendSuccess(
      res,
      refundData,
      200,
      "Refund completed successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateOrderStatus
 *
 * @description
 * Updates the status of an order (Admin/Authorized user).
 * Delegates business logic to service layer, including validation of
 * status transitions and side effects (notifications, logs, etc.).
 *
 * @params
 * headers: {
 *   Authorization: Bearer token (Admin / Authorized User)
 * }
 *
 * params: {
 *   orderId: string
 * }
 *
 * body: {
 *   status: "placed" | "packed" | "confirmed" | "shipped" | "delivered" | "cancelled"
 * }
 *
 * @process
 * 1. Validate input
 *    - Ensure orderId is provided
 *    - Validate status against allowed values
 *
 * 2. Call service layer (updateOrderStatusService)
 *    - Pass orderId and status
 *    - Pass current user context (for authorization/audit)
 *
 * 3. Service layer handles:
 *    - Fetch order by orderId
 *    - Validate order existence
 *    - Validate allowed status transitions (state machine)
 *    - Update orderStatus
 *    - Trigger side effects:
 *        a. Delivery timestamp (if delivered)
 *        b. Cancellation handling (if cancelled)
 *        c. Notifications (email/SMS)
 *        d. Audit logs
 *
 * 4. Return updated order details
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Order status updated successfully",
 *   data: {
 *     orderId: string,
 *     previousStatus: string,
 *     currentStatus: string,
 *     updatedAt: Date
 *   }
 * }
 *
 * @errors
 * 400: Invalid input / invalid status
 * 401: Unauthorized user
 * 403: Forbidden (insufficient permissions)
 * 404: Order not found
 * 500: Internal server error
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    /* ---------- VALIDATION ---------- */
    if (!orderId) {
      return sendError(res, {
        message: "orderId is required",
        statusCode: 400,
      });
    }
    const validStatuses = [
      "placed",
      "packed",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!status || !validStatuses.includes(status)) {
      return sendError(res, {
        message: "Invalid order status",
        statusCode: 400,
      });
    }

    /* ---------- SERVICE CALL ---------- */
    const result = await updateOrderStatusService(
      { orderId, status },
      req.user
    );

    return sendSuccess(
      res,
      result,
      200,
      "Order status updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const getOrdersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    /* ---------- VALIDATION ---------- */
    const validStatuses = [
      "pending",
      "placed",
      "packed",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
      "partial_returned",
    ];

    if (!validStatuses.includes(status)) {
      return sendError(res, {
        message: "Invalid order status",
        statusCode: 400,
      });
    }

    /* ---------- SERVICE ---------- */
    const result = await getOrdersByStatusService(
      {
        status,
        page: Number(page),
        limit: Number(limit),
      }
    );
    return sendSuccess(
      res,
      result,
      200,
      "Orders fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateOrderStatus
 *
 * @description
 * Updates the status of an order by an authorized employee.
 * Enforces strict status transition rules, prevents race conditions,
 * logs audit actions, and notifies the customer.
 *
 * @params
 * headers: {
 *   Authorization: Bearer token (Employee/Admin)
 * }
 *
 * params: {
 *   orderId: string
 * }
 *
 * body: {
 *   status: "placed" | "packed" | "confirmed" | "shipped" | "delivered" | "cancelled",
 *   permission?: string   // optional override permission label
 * }
 *
 * @process
 * 1. Validate input
 *    - Ensure orderId is provided
 *    - Validate status against allowed values
 *
 * 2. Fetch employee
 *    - Identify employee using req.user.email
 *    - Ensure employee exists (authorization layer)
 *
 * 3. Fetch order
 *    - Find order by orderId
 *    - Populate user details for notifications
 *
 * 4. Validate order state
 *    - Prevent updates if order is already:
 *        a. cancelled
 *        b. returned
 *
 * 5. Validate status transition (state machine)
 *    - Define allowed transitions:
 *        placed → packed / confirmed / shipped
 *        packed → confirmed / shipped
 *        confirmed → shipped
 *        shipped → delivered
 *    - Prevent same status update
 *    - Reject invalid transitions
 *
 * 6. Atomic update (race condition safe)
 *    - Update only if current status matches expected
 *    - Set:
 *        orderStatus
 *        statusUpdatedAt
 *    - If delivered:
 *        set paymentStatus = "paid"
 *        set paidAt timestamp
 *
 * 7. Handle concurrency conflict
 *    - If update fails → return 409 conflict
 *
 * 8. Send notification email
 *    - Notify user about status update
 *    - Non-blocking failure handling
 *
 * 9. Create audit log
 *    - Record employee action
 *    - Store permission used
 *    - Track old → new status change
 *
 * 10. Return structured response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Order status updated successfully",
 *   data: {
 *     orderId: string,
 *     oldStatus: string,
 *     newStatus: string,
 *     paymentStatus: string,
 *     statusUpdatedAt: Date
 *   }
 * }
 *
 * @errors
 * 400: Invalid input / invalid status transition / already final state
 * 401: Unauthorized user
 * 404: Order or employee not found
 * 409: Concurrent update conflict
 * 500: Internal server error
 */
export const getAllOrdersAdmin = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);

    const result = await getAllOrdersAdminService({ page, limit });

    return sendSuccess(
      res,
      result,
      200,
      "All orders fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const result = await getAllOrdersService({ page, limit });
    return sendSuccess(
      res,
      result,
      200,
      "All orders fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const markRefundCompleteAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;

    if (!orderId) {
      return sendError(res, {
        message: "orderId is required",
        statusCode: 400,
      });
    }
    const result = await markRefundCompleteAdminService(
      { orderId, amount },
      req.user
    );
    return sendSuccess(
      res,
      result,
      200,
      "Refund completed successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function salesDashboard
 *
 * @query
 * {
 *   startDate?: string,
 *   endDate?: string,
 *   country?: string,
 *   state?: string,
 *   top?: number
 * }
 *
 * @process
 * 1. Validate query params
 * 2. Call service layer
 * 3. Return analytics response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Sales dashboard fetched successfully",
 *   data: { level, filters, analytics }
 * }
 */
export const salesDashboard = async (req, res) => {
  try {
    const { startDate, endDate, country, state, top } = req.query;
    const data = await salesDashboardService({
      startDate,
      endDate,
      country,
      state,
      top,
    });
    return sendSuccess(
      res,
      data,
      200,
      "Sales dashboard fetched successfully"
    );
  }catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function createReturnRequest
 *
 * @params
 * body: {
 *   orderId: string,
 *   returnItems: [
 *     {
 *       productId: string,
 *       variantId: string,
 *       quantity: number,
 *       reason?: string
 *     }
 *   ]
 * }
 *
 * @process
 * 1. Validate request body
 * 2. Call service layer
 * 3. Return success response
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Return request created successfully",
 *   data: { orderId, requestId }
 * }
 */
export const createReturnRequest = async (req, res) => {
  try {
    const { orderId, returnItems } = req.body;
    if (!orderId || !Array.isArray(returnItems) || returnItems.length === 0) {
      return sendError(res, {
        message: "Invalid return request data",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const data = await createReturnRequestService({
      orderId,
      returnItems,
    });

    return sendSuccess(
      res,
      data,
      201,
      "Return request created successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updatePendingReturnRequest
 *
 * @params
 * params: {
 *   orderId: string,
 *   requestId: string
 * }
 *
 * body: {
 *   returnItems: [
 *     {
 *       productId: string,
 *       variantId: string,
 *       quantity: number,
 *       reason?: string
 *     }
 *   ]
 * }
 *
 * @process
 * 1. Validate params and body
 * 2. Call service layer
 * 3. Return updated response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Return request updated successfully",
 *   data: { orderId, requestId, items }
 * }
 */
export const updatePendingReturnRequest = async (req, res) => {
  try {
    const { orderId, requestId } = req.params;
    const { returnItems } = req.body;
    if (!orderId || !requestId) {
      return sendError(res, {
        message: "orderId and requestId are required",
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
    const data = await updatePendingReturnRequestService({
      orderId,
      requestId,
      returnItems,
    });

    return sendSuccess(
      res,
      data,
      200,
      "Return request updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getAllReturnRequests
 *
 * @process
 * 1. Call service layer
 * 2. Return return requests data
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Return requests fetched successfully",
 *   data: {
 *     totalOrders: number,
 *     orders: []
 *   }
 * }
 */
export const getAllReturnRequests = async (req, res) => {
  try {
    const data = await getAllReturnRequestsService();
    return sendSuccess(
      res,
      data,
      200,
      data.orders.length === 0
        ? "No return requests found"
        : "Return requests fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateReturnRequestStatus
 *
 * @params
 * params: {
 *   orderId: string,
 *   requestId: string
 * }
 *
 * body: {
 *   status: "approved" | "rejected",
 *   items?: [
 *     {
 *       productId: string,
 *       variantId: string,
 *       approvedQuantity: number
 *     }
 *   ],
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate input
 * 2. Call service layer
 * 3. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Return request updated successfully",
 *   data: { orderId, requestId, status, processedAt }
 * }
 */
export const updateReturnRequestStatus = async (req, res) => {
  try {
    const { orderId, requestId } = req.params;
    const { status, items, permission } = req.body;
    if (!orderId || !requestId) {
      return sendError(res, {
        message: "orderId and requestId are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    if(!["approved", "rejected"].includes(status)){
      return sendError(res, {
        message: "Invalid status",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const data = await updateReturnRequestStatusService({
      orderId,
      requestId,
      status,
      items,
      permission,
      userEmail: req.user.email,
    });

    return sendSuccess(
      res,
      data,
      200,
      `Return request ${status} successfully`
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateCourierDetails
 *
 * @params
 * params:{
 *   orderId: string
 * }
 *
 * body: {
 *   corourseServiceName?: string,
 *   DOCNumber?: string,
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate input
 * 2. Call service layer
 * 3. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Courier details updated successfully",
 *   data: { orderId, corourseServiceName, DOCNumber, updatedAt }
 * }
 */
export const updateCourierDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { corourseServiceName, DOCNumber, permission } = req.body;
    if (!orderId) {
      return sendError(res, {
        message: "orderId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    if(!corourseServiceName && !DOCNumber) {
      return sendError(res, {
        message: "At least one field is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const data = await updateCourierDetailsService({
      orderId,
      corourseServiceName,
      DOCNumber,
      permission,
      userEmail: req.user.email,
    });
    return sendSuccess(
      res,
      data,
      200,
      "Courier details updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};