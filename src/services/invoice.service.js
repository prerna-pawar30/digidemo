import Invoice from "../models/manage/invoice.model.js";
import { generateInvoiceNumbers } from "../helpers/generateInvoiceNumbers.js";
import {getDefaultSellerDetails,getDefaultBankDetails} from "../helpers/invoiceDefault.helper.js";
import { getPagination } from "../helpers/pagination.helper.js";

const getDueDateFromTerms = (invoiceDate, paymentTerms) => {
  const date = new Date(invoiceDate);
  const text = String(paymentTerms || "").toLowerCase();
  const match = text.match(/(\d+)\s*days?/);
  const days = match ? Number(match[1]) : 10;
  date.setDate(date.getDate() + days);
  return date;
};

export const createInvoiceService = async (data) => {
  const numbers = await generateInvoiceNumbers();

  const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
  const paymentTerms = data.paymentTerms || "Payable due amount in 10 days";

  const seller = {
    ...getDefaultSellerDetails(),
    ...(data.seller || {}),
  };

  const bankDetails = {
    ...getDefaultBankDetails(),
    ...(data.bankDetails || {}),
  };

  const invoice = await Invoice.create({
    invoiceNumber: numbers.invoiceNumber,
    customerNo: numbers.customerNo,
    orderNumber: numbers.orderNumber,
    invoiceDate,
    dueDate: data.dueDate || getDueDateFromTerms(invoiceDate, paymentTerms),
    orderDate: data.orderDate || invoiceDate,
    deliveryDate: data.deliveryDate || invoiceDate,
    paymentTerms,
    termsOfDelivery: data.termsOfDelivery || "",
    shippingCondition: data.shippingCondition || "Normal",
    customerServiceRep: data.customerServiceRep || "",
    seller,
    billTo: {
      companyName: data.billTo.companyName,
      address: data.billTo.address || "",
      gstin: data.billTo.gstin || "",
      contactPerson: data.billTo.contactPerson || "",
      contactNumber: data.billTo.contactNumber || "",
    },
    bankDetails,
    items: (data.items || []).map((item, index) => ({
      articleNo: item.articleNo || String(index + 1),
      description: item.description,
      qty: item.qty,
      price: item.price,
      discountPercent: item.discountPercent || 0,
      discountValue: item.discountValue || 0,
      gstType: item.gstType || "IGST",
      gstPercent: item.gstPercent || 0,
    })),
    summary: {
      freightCost: data?.summary?.freightCost || 0,
      paidAmount: data?.summary?.paidAmount || 0,
    },
    notes: data.notes || "",
    status: data.status || "issued",
  });

  return invoice;
};


export const updateInvoiceService = async ({ invoiceId, data }) => {
  const invoice = await Invoice.findOne({
    invoiceId,
    isDeleted: false,
  });

  if (!invoice) {
    const error = new Error("Invoice not found");
    error.statusCode = 404;
    error.errorCode = "INVOICE_NOT_FOUND";
    throw error;
  }

  if (data.billTo) {
    invoice.billTo = {
      ...invoice.billTo.toObject?.(),
      ...data.billTo,
    };
  }

  if (data.seller) {
    invoice.seller = {
      ...invoice.seller.toObject?.(),
      ...data.seller,
    };
  }

  if (data.bankDetails) {
    invoice.bankDetails = {
      ...invoice.bankDetails.toObject?.(),
      ...data.bankDetails,
    };
  }

  if (data.items) {
    invoice.items = data.items.map((item, index) => ({
      articleNo: item.articleNo || String(index + 1),
      description: item.description,
      qty: item.qty,
      price: item.price,
      discountPercent: item.discountPercent || 0,
      discountValue: item.discountValue || 0,
      gstType: item.gstType || "IGST",
      gstPercent: item.gstPercent || 0,
    }));
  }

  if (data.summary) {
    invoice.summary = {
      ...invoice.summary.toObject?.(),
      ...data.summary,
    };
  }

  const directFields = [
    "invoiceDate",
    "dueDate",
    "orderDate",
    "deliveryDate",
    "paymentTerms",
    "termsOfDelivery",
    "shippingCondition",
    "customerServiceRep",
    "notes",
    "status",
  ];

  for (const field of directFields) {
    if (data[field] !== undefined) {
      invoice[field] = data[field];
    }
  }

  await invoice.save();

  return invoice;
};

export const deleteInvoiceService = async ({ invoiceId }) => {
  const invoice = await Invoice.findOne({
    invoiceId,
    isDeleted: false,
  });

  if (!invoice) {
    const error = new Error("Invoice not found");
    error.statusCode = 404;
    error.errorCode = "INVOICE_NOT_FOUND";
    throw error;
  }

  invoice.isDeleted = true;
  await invoice.save();

  return invoice;
};

export const getInvoiceByIdService = async ({ invoiceId }) => {
  const invoice = await Invoice.findOne({
    invoiceId,
    isDeleted: false,
  }).lean();

  if (!invoice) {
    const error = new Error("Invoice not found");
    error.statusCode = 404;
    error.errorCode = "INVOICE_NOT_FOUND";
    throw error;
  }

  return invoice;
};

export const getInvoicesService = async ({ query }) => {
  const { page, limit, skip } = getPagination(query);
  const { search, status } = query;

  const filter = {
    isDeleted: false,
  };

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { invoiceNumber: { $regex: search, $options: "i" } },
      { customerNo: { $regex: search, $options: "i" } },
      { orderNumber: { $regex: search, $options: "i" } },
      { "billTo.companyName": { $regex: search, $options: "i" } },
    ];
  }

  const [invoices, totalItems] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Invoice.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    invoices,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
  };
};