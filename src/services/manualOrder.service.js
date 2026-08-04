import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";
import ManualOrder from "../models/ecommarace/manualOrder.model.js";
import Product from "../models/manage/product.model.js";
import Employee from "../models/manage/employee.model.js";
import User from "../models/ecommarace/user.model.js";
import StockAuditLog from "../models/ecommarace/stockauditlog.model.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { getStock, resolvePrice, resolveImages } from "./productResolver.service.js";
import { sendNotification } from "./notification.service.js";

const notFound = (message, errorCode) => {
  const error = new Error(message);
  error.statusCode = 404;
  error.errorCode = errorCode;
  return error;
};

const badRequest = (message, errorCode) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.errorCode = errorCode;
  return error;
};

const getEmployee = async (userEmail, session) => {
  const query = Employee.findOne({ email: userEmail, isDeleted: false });
  const employee = session ? await query.session(session) : await query;
  if (!employee) {
    throw notFound("Employee not found", "EMPLOYEE_NOT_FOUND");
  }
  return employee;
};

const validateAddress = (address, label) => {
  if (!address || typeof address !== "object") {
    throw badRequest(`${label} is required`, "ADDRESS_REQUIRED");
  }
  const required = [
    "fullName",
    "phone",
    "street",
    "area",
    "city",
    "state",
    "country",
    "pincode",
  ];
  const normalized = {};
  for (const key of required) {
    if (!address[key]) {
      throw badRequest(`${label}.${key} is required`, "INVALID_ADDRESS");
    }
    normalized[key] = address[key];
  }
  return normalized;
};

/* =========================================================
   CREATE MANUAL ORDER
========================================================= */
export const createManualOrderService = async (data, userEmail) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await getEmployee(userEmail, session);

    const {
      customer,
      items: rawItems,
      billingAddress,
      shippingAddress,
      discountAmount = 0,
      shippingCharge = 0,
      gstAmount = 0,
      gstPercentage = 0,
      gstNumber,
      organizationName,
      paymentMode = "CASH",
      paymentReference,
      paymentStatus = "paid",
      orderStatus = "delivered",
      notes,
    } = data;

    if (!customer?.fullName || !customer?.phone) {
      throw badRequest("customer.fullName and customer.phone are required", "CUSTOMER_REQUIRED");
    }

    let linkedUser = null;
    if (customer.userId) {
      linkedUser = await User.findById(customer.userId).session(session);
      if (!linkedUser) {
        throw notFound("Linked user not found", "USER_NOT_FOUND");
      }
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw badRequest("At least one item is required", "INVALID_ITEMS");
    }

    const normalizedBilling = validateAddress(billingAddress, "billingAddress");
    const normalizedShipping = validateAddress(shippingAddress, "shippingAddress");

    /* ================= ITEMS ================= */
    let subtotal = 0;
    const items = [];
    const deductedProducts = [];

    for (const rawItem of rawItems) {
      const { productId, variantId, quantity } = rawItem;
      if (!productId || !variantId || !quantity || Number(quantity) <= 0) {
        throw badRequest("Invalid item data", "INVALID_ITEM_DATA");
      }

      const product = await Product.findOne({
        productId,
        status: "active",
      })
        .populate("category", "name")
        .session(session);

      if (!product) {
        throw notFound(`Product unavailable: ${productId}`, "PRODUCT_NOT_FOUND");
      }

      const variant = product.variants.find(
        (v) => v?.variantId?.toString() === variantId?.toString()
      );

      if (!variant) {
        throw notFound(`Variant unavailable: ${variantId}`, "VARIANT_NOT_FOUND");
      }

      const availableStock = getStock(product, variantId);
      if (availableStock < Number(quantity)) {
        throw badRequest(
          `Only ${availableStock} item(s) available for ${product.name}`,
          "INSUFFICIENT_STOCK"
        );
      }

      const itemPrice = resolvePrice(product, variant);
      if (Number.isNaN(Number(itemPrice)) || Number(itemPrice) <= 0) {
        throw badRequest(`Invalid product price for ${product.name}`, "INVALID_PRICE");
      }

      const resolvedImages = resolveImages(product, variant);
      const primaryImage = resolvedImages?.[0]?.url || resolvedImages?.[0] || "";

      const itemTotal = Number(itemPrice) * Number(quantity);
      subtotal += itemTotal;

      const attrObj = {};
      if (Array.isArray(variant.attributes)) {
        for (const attr of variant.attributes) {
          if (attr?.key) attrObj[attr.key] = attr.value;
        }
      }

      items.push({
        productId,
        variantId,
        sku: variant.sku || product.sku || "",
        productName: product.name || "",
        variantName: variant.name || "",
        categoryName: product.category?.name || "",
        price: Number(itemPrice),
        quantity: Number(quantity),
        attributes: attrObj,
        image: primaryImage,
      });

      /* ---------- STOCK DEDUCTION ---------- */
      if (product.stockType === "PRODUCT") {
        product.productStock -= Number(quantity);
      } else {
        variant.variantStock -= Number(quantity);
      }
      deductedProducts.push({ productId, variantId, quantity: Number(quantity) });
      await product.save({ session });
    }

    /* ================= CALCULATION ================= */
    const finalDiscount = Math.max(Number(discountAmount) || 0, 0);
    const finalShippingCharge = Math.max(Number(shippingCharge) || 0, 0);
    const finalGstAmount = Math.max(Number(gstAmount) || 0, 0);

    const grandTotal = Math.max(
      subtotal + finalShippingCharge + finalGstAmount - finalDiscount,
      0
    );

    if (grandTotal <= 0) {
      throw badRequest("Invalid order amount", "INVALID_ORDER_AMOUNT");
    }

    const manualOrderId = `MORD-${uuidv6()}`;

    const [manualOrder] = await ManualOrder.create(
      [
        {
          manualOrderId,
          customer: {
            user: linkedUser?._id || null,
            fullName: customer.fullName,
            phone: customer.phone,
            email: customer.email || null,
            organizationName: customer.organizationName || null,
          },
          items,
          shippingCharge: finalShippingCharge,
          discountAmount: finalDiscount,
          grandTotal,
          organizationName: organizationName || null,
          gstAmount: finalGstAmount,
          gstPercentage: Number(gstPercentage) || 0,
          gstNumber: gstNumber || null,
          billingAddress: normalizedBilling,
          shippingAddress: normalizedShipping,
          paymentMode,
          paymentReference: paymentReference || null,
          paymentStatus,
          orderStatus,
          notes: notes || null,
          createdBy: employee._id,
          statusUpdatedAt: new Date(),
        },
      ],
      { session }
    );

    /* ================= STOCK LOG ================= */
    if (deductedProducts.length > 0) {
      await StockAuditLog.create(
        [
          {
            orderId: manualOrderId,
            action: "deduct",
            products: deductedProducts,
          },
        ],
        { session }
      );
    }

    /* ================= AUDIT LOG ================= */
    await PermissionAudit.create(
      [
        {
          permissionAuditId: uuidv6(),
          actionBy: employee._id,
          actionByEmail: employee.email,
          actionFor: manualOrder._id,
          action: `Manual order ${manualOrderId} created`,
          permission: "manual_order.create",
          actionType: "Create manual order",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    try {
      await sendNotification({
        sender: employee._id,
        permission: "manual_order.create",
        title: "Manual Order Created",
        message: `Manual order ${manualOrderId} created by ${employee.email}`,
        type: "MANUAL_ORDER_CREATED",
        entityId: manualOrder._id,
        entityModel: "ManualOrder",
        metadata: {
          manualOrderId,
          grandTotal,
          createdBy: employee.email,
        },
      });
    } catch (err) {
      console.error("Notification failed on manual order create:", err.message);
    }

    return manualOrder;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/* =========================================================
   LISTING / SINGLE
========================================================= */
export const getAllManualOrdersService = async ({ page, limit, status }) => {
  const skip = (page - 1) * limit;
  const filter = {};
  if (status) filter.orderStatus = status;

  const [orders, total] = await Promise.all([
    ManualOrder.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ManualOrder.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    orders,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    },
  };
};

export const getSingleManualOrderService = async (manualOrderId) => {
  if (!manualOrderId) {
    throw badRequest("manualOrderId is required", "VALIDATION_ERROR");
  }

  const order = await ManualOrder.findOne({ manualOrderId })
    .populate("createdBy", "firstName lastName email")
    .populate("customer.user", "firstName lastName email")
    .lean();

  if (!order) {
    throw notFound("Manual order not found", "MANUAL_ORDER_NOT_FOUND");
  }

  return order;
};

/* =========================================================
   RETURN REQUEST — CREATE
========================================================= */
export const createManualReturnRequestService = async (data) => {
  const { manualOrderId, returnItems } = data;

  const order = await ManualOrder.findOne({ manualOrderId });
  if (!order) {
    throw notFound("Manual order not found", "MANUAL_ORDER_NOT_FOUND");
  }

  const allowedStatuses = ["delivered", "shipped", "partial_returned"];
  if (!allowedStatuses.includes(order.orderStatus)) {
    throw badRequest(
      "Only delivered, shipped or partially returned orders can be returned",
      "INVALID_ORDER_STATE"
    );
  }

  if (!Array.isArray(returnItems) || returnItems.length === 0) {
    throw badRequest("Return items are required", "VALIDATION_ERROR");
  }

  const validatedItems = [];
  for (const item of returnItems) {
    const { productId, variantId, quantity, reason } = item;
    if (!productId || !variantId || !quantity || Number(quantity) <= 0) {
      throw badRequest("Invalid return item data", "INVALID_ITEM_DATA");
    }

    const orderItem = order.items.find(
      (o) =>
        o.productId?.toString() === productId?.toString() &&
        o.variantId?.toString() === variantId?.toString()
    );

    if (!orderItem) {
      throw notFound("Product not found in order", "ITEM_NOT_FOUND");
    }

    const availableQuantity =
      Number(orderItem.quantity) - Number(orderItem.returnedQuantity || 0);

    if (Number(quantity) > availableQuantity) {
      throw badRequest(
        `Return quantity exceeds available quantity for ${orderItem.productName}`,
        "QUANTITY_EXCEEDED"
      );
    }

    validatedItems.push({
      productId,
      variantId,
      quantity: Number(quantity),
      price: Number(orderItem.price),
      reason: reason || null,
    });
  }

  const requestId = uuidv6();

  order.returnRequests.push({
    requestId,
    items: validatedItems,
    status: "pending",
    requestedAt: new Date(),
  });

  await order.save();

  try {
    await sendNotification({
      permission: "manual_order.return",
      title: "Manual Return Request Created",
      message: `Return request created for manual order ${order.manualOrderId}`,
      type: "MANUAL_RETURN_REQUEST_CREATED",
      entityId: order._id,
      entityModel: "ManualOrder",
      metadata: {
        manualOrderId: order.manualOrderId,
        requestId,
        items: validatedItems,
      },
    });
  } catch (err) {
    console.error("Notification failed on manual return request create:", err.message);
  }

  return { manualOrderId: order.manualOrderId, requestId };
};

/* =========================================================
   RETURN REQUEST — UPDATE (PENDING ONLY)
========================================================= */
export const updatePendingManualReturnRequestService = async (data) => {
  const { manualOrderId, requestId, returnItems } = data;

  const order = await ManualOrder.findOne({ manualOrderId });
  if (!order) {
    throw notFound("Manual order not found", "MANUAL_ORDER_NOT_FOUND");
  }

  const returnRequest = order.returnRequests.find(
    (r) => r.requestId?.toString() === requestId?.toString()
  );
  if (!returnRequest) {
    throw notFound("Return request not found", "RETURN_REQUEST_NOT_FOUND");
  }
  if (returnRequest.status !== "pending") {
    throw badRequest("Only pending requests can be updated", "INVALID_STATE");
  }
  if (!Array.isArray(returnItems)) {
    throw badRequest("returnItems must be an array", "VALIDATION_ERROR");
  }

  const validatedItems = [];
  for (const item of returnItems) {
    const { productId, variantId, quantity, reason } = item;
    if (!productId || !variantId || !quantity || Number(quantity) <= 0) {
      throw badRequest("Invalid return item data", "INVALID_ITEM_DATA");
    }

    const orderItem = order.items.find(
      (o) =>
        o.productId?.toString() === productId?.toString() &&
        o.variantId?.toString() === variantId?.toString()
    );
    if (!orderItem) {
      throw notFound("Product not found in order", "ITEM_NOT_FOUND");
    }

    const availableQuantity =
      Number(orderItem.quantity) - Number(orderItem.returnedQuantity || 0);

    if (Number(quantity) > availableQuantity) {
      throw badRequest(
        `Return quantity exceeds available quantity for ${orderItem.productName}`,
        "QUANTITY_EXCEEDED"
      );
    }

    validatedItems.push({
      productId,
      variantId,
      quantity: Number(quantity),
      price: Number(orderItem.price),
      reason: reason || null,
    });
  }

  if (validatedItems.length === 0) {
    order.returnRequests = order.returnRequests.filter(
      (r) => r.requestId?.toString() !== requestId?.toString()
    );
  } else {
    returnRequest.items = validatedItems;
  }

  await order.save();

  return {
    manualOrderId: order.manualOrderId,
    requestId,
    items: validatedItems,
  };
};

/* =========================================================
   RETURN REQUEST — LISTING
========================================================= */
export const getAllManualReturnRequestsService = async () => {
  const orders = await ManualOrder.find({
    returnRequests: { $exists: true, $ne: [] },
  })
    .populate("createdBy", "firstName lastName email")
    .sort({ createdAt: -1 })
    .lean();

  return {
    totalOrders: orders.length,
    orders,
  };
};

/* =========================================================
   RETURN REQUEST — APPROVE / REJECT (FULL OR PARTIAL RETURN)
========================================================= */
export const updateManualReturnRequestStatusService = async (data) => {
  const { manualOrderId, requestId, status, items, permission, userEmail } = data;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await getEmployee(userEmail, session);

    const order = await ManualOrder.findOne({ manualOrderId }).session(session);
    if (!order) {
      throw notFound("Manual order not found", "MANUAL_ORDER_NOT_FOUND");
    }

    const returnRequest = order.returnRequests.find(
      (r) => r.requestId === requestId
    );
    if (!returnRequest) {
      throw notFound("Return request not found", "RETURN_REQUEST_NOT_FOUND");
    }
    if (returnRequest.status !== "pending") {
      throw badRequest("Request already processed", "INVALID_STATE");
    }

    const stockProducts = [];

    /* ================= APPROVED (FULL OR PARTIAL) ================= */
    if (status === "approved") {
      if (!Array.isArray(items) || items.length === 0) {
        throw badRequest("Approved items required", "VALIDATION_ERROR");
      }

      for (const approvedItem of items) {
        const { productId, variantId, approvedQuantity } = approvedItem;

        if (!approvedQuantity || approvedQuantity <= 0) {
          throw badRequest("Invalid approved quantity", "INVALID_QUANTITY");
        }

        const requestedItem = returnRequest.items.find(
          (i) => i.productId === productId && i.variantId === variantId
        );
        if (!requestedItem) {
          throw notFound("Item not found in return request", "ITEM_NOT_FOUND");
        }
        if (approvedQuantity > requestedItem.quantity) {
          throw badRequest(
            "Approved quantity exceeds requested quantity",
            "QUANTITY_EXCEEDED"
          );
        }

        const orderItem = order.items.find(
          (o) => o.productId === productId && o.variantId === variantId
        );
        if (!orderItem) continue;

        const alreadyReturned = orderItem.returnedQuantity || 0;
        const totalOrderedQuantity = orderItem.quantity + alreadyReturned;
        if (alreadyReturned + approvedQuantity > totalOrderedQuantity) {
          throw badRequest("Return quantity exceeds allowed limit", "QUANTITY_EXCEEDED");
        }

        /* ---------- RESTOCK ---------- */
        const product = await Product.findOne({ productId }).session(session);
        if (product) {
          if (product.stockType === "PRODUCT") {
            product.productStock += approvedQuantity;
          } else if (product.stockType === "VARIANT") {
            const variant = product.variants.find((v) => v.variantId === variantId);
            if (variant) variant.variantStock += approvedQuantity;
          }
          await product.save({ session });
        }

        orderItem.returnedQuantity = (orderItem.returnedQuantity || 0) + approvedQuantity;
        orderItem.quantity -= approvedQuantity;
        if (orderItem.quantity < 0) orderItem.quantity = 0;

        stockProducts.push({ productId, variantId, quantity: approvedQuantity });
      }

      /* ---------- ORDER STATUS (RETURNED vs PARTIAL_RETURNED) ---------- */
      const remainingQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const returnedQuantity = order.items.reduce(
        (sum, item) => sum + (item.returnedQuantity || 0),
        0
      );

      if (remainingQuantity === 0 && returnedQuantity > 0) {
        order.orderStatus = "returned";
      } else if (returnedQuantity > 0) {
        order.orderStatus = "partial_returned";
      }

      if (["returned", "partial_returned"].includes(order.orderStatus)) {
        order.paymentStatus = "refund_pending";
        const returnedAmount = stockProducts.reduce((sum, sp) => {
          const requestedItem = returnRequest.items.find(
            (i) => i.productId === sp.productId && i.variantId === sp.variantId
          );
          return sum + (requestedItem ? requestedItem.price * sp.quantity : 0);
        }, 0);
        order.refundAmount = (order.refundAmount || 0) + returnedAmount;
        order.remainingRefundAmount =
          (order.refundAmount || 0) - (order.partialRefundAmount || 0);
      }

      if (stockProducts.length > 0) {
        await StockAuditLog.create(
          [
            {
              orderId: order.manualOrderId,
              action: "add",
              products: stockProducts,
            },
          ],
          { session }
        );
      }
    }

    /* ---------- UPDATE REQUEST ---------- */
    returnRequest.status = status;
    returnRequest.processedAt = new Date();
    returnRequest.processedBy = employee._id;

    await order.save({ session });

    await PermissionAudit.create(
      [
        {
          permissionAuditId: uuidv6(),
          actionBy: employee._id,
          actionByEmail: employee.email,
          actionFor: order._id,
          action: `Manual return request ${requestId} ${status} for order ${order.manualOrderId}`,
          permission: permission || "manual_order.return.status",
          actionType: "Update manual return request status",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    try {
      await sendNotification({
        sender: employee._id,
        permission: "manual_order.return",
        title: "Manual Return Request Updated",
        message: `Return request ${status} for manual order ${order.manualOrderId}`,
        type: "MANUAL_RETURN_REQUEST_UPDATED",
        entityId: order._id,
        entityModel: "ManualOrder",
        metadata: {
          manualOrderId: order.manualOrderId,
          requestId,
          status,
        },
      });
    } catch (err) {
      console.error("Notification failed on manual return status update:", err.message);
    }

    return {
      manualOrderId: order.manualOrderId,
      requestId,
      status,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      processedAt: returnRequest.processedAt,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/* =========================================================
   MANUAL REFUND COMPLETION
========================================================= */
export const markManualRefundCompletedService = async (data) => {
  const { manualOrderId, amount, refundMode, refundReference, userEmail } = data;

  const employee = await getEmployee(userEmail);

  const order = await ManualOrder.findOne({ manualOrderId });
  if (!order) {
    throw notFound("Manual order not found", "MANUAL_ORDER_NOT_FOUND");
  }

  if (!["refund_pending", "partial_refunded"].includes(order.paymentStatus)) {
    throw badRequest(
      `Refund not allowed. Current paymentStatus: ${order.paymentStatus}`,
      "INVALID_STATE"
    );
  }

  const totalRefundable = order.refundAmount || 0;
  const alreadyRefunded = order.partialRefundAmount || 0;
  const remainingRefundable = totalRefundable - alreadyRefunded;

  if (remainingRefundable <= 0) {
    throw badRequest("No refundable amount left", "NOTHING_TO_REFUND");
  }

  let refundAmount = remainingRefundable;
  if (amount !== undefined && amount !== null) {
    if (typeof amount !== "number" || amount <= 0) {
      throw badRequest("Invalid refund amount", "INVALID_AMOUNT");
    }
    if (amount > remainingRefundable) {
      throw badRequest(
        `Refund amount exceeds remaining refundable amount ₹${remainingRefundable}`,
        "AMOUNT_EXCEEDED"
      );
    }
    refundAmount = amount;
  }

  const newTotalRefunded = alreadyRefunded + refundAmount;
  const newRemainingAmount = totalRefundable - newTotalRefunded;

  order.partialRefundAmount = newTotalRefunded;
  order.remainingRefundAmount = newRemainingAmount;
  order.paymentStatus = newTotalRefunded >= totalRefundable ? "refunded" : "partial_refunded";

  const refundId = `MREF-${uuidv6()}`;
  order.refundHistory = order.refundHistory || [];
  order.refundHistory.push({
    refundId,
    amount: refundAmount,
    refundMode: refundMode || order.paymentMode,
    refundReference: refundReference || null,
    refundedBy: employee.email,
    refundedAt: new Date(),
    refundStatus: "processed",
  });

  await order.save();

  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: employee._id,
    actionByEmail: employee.email,
    actionFor: order._id,
    action: `Manual refund ${refundId} processed for order ${order.manualOrderId}`,
    permission: "manual_order.refund.complete",
    actionType: "Complete manual refund",
  });

  return {
    manualOrderId: order.manualOrderId,
    paymentStatus: order.paymentStatus,
    totalRefundedAmount: newTotalRefunded,
    remainingRefundableAmount: newRemainingAmount,
    refundedNow: refundAmount,
    refundId,
    refundHistory: order.refundHistory,
  };
};

/* =========================================================
   ANALYSIS / DASHBOARD
========================================================= */
export const manualOrderAnalysisService = async (data) => {
  const { startDate, endDate, employeeId, top } = data;

  const safeTop = Math.min(parseInt(top) || 10, 50);

  const baseMatch = {
    orderStatus: { $ne: "cancelled" },
  };

  if (startDate || endDate) {
    baseMatch.createdAt = {};
    if (startDate) baseMatch.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) baseMatch.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  if (employeeId) {
    baseMatch.createdBy = new mongoose.Types.ObjectId(employeeId);
  }

  const [summary] = await ManualOrder.aggregate([
    { $match: baseMatch },
    {
      $addFields: {
        netRevenue: {
          $subtract: ["$grandTotal", { $ifNull: ["$partialRefundAmount", 0] }],
        },
        totalItems: { $sum: "$items.quantity" },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$netRevenue" },
        totalOrders: { $sum: 1 },
        totalItemsSold: { $sum: "$totalItems" },
      },
    },
  ]);

  const topProducts = await ManualOrder.aggregate([
    { $match: baseMatch },
    { $unwind: "$items" },
    {
      $group: {
        _id: { productId: "$items.productId", productName: "$items.productName" },
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: safeTop },
  ]);

  const topEmployees = await ManualOrder.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: "$createdBy",
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$grandTotal" },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: safeTop },
    {
      $lookup: {
        from: "employees",
        localField: "_id",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        employeeId: "$_id",
        firstName: "$employee.firstName",
        lastName: "$employee.lastName",
        email: "$employee.email",
        totalOrders: 1,
        totalRevenue: 1,
      },
    },
  ]);

  return {
    filters: { startDate, endDate, employeeId },
    summary: {
      totalRevenue: summary?.totalRevenue || 0,
      totalOrders: summary?.totalOrders || 0,
      totalItemsSold: summary?.totalItemsSold || 0,
      averageOrderValue:
        summary?.totalOrders > 0
          ? +(summary.totalRevenue / summary.totalOrders).toFixed(2)
          : 0,
    },
    topProducts: topProducts.map((p) => ({
      productId: p._id.productId,
      productName: p._id.productName,
      quantitySold: p.quantitySold,
      revenue: p.revenue,
    })),
    topEmployees,
  };
};
