import Joi from "joi";
const invoiceItemValidator = Joi.object({
  articleNo: Joi.string().trim().allow("").optional(),
  description: Joi.string().trim().required(),
  qty: Joi.number().min(1).required(),
  price: Joi.number().min(0).required(),
  discountPercent: Joi.number().min(0).default(0),
  discountValue: Joi.number().min(0).default(0),
  gstType: Joi.string().valid("IGST", "CGST", "SGST", "NONE").default("IGST"),
  gstPercent: Joi.number().min(0).default(5),
});
export const createInvoiceValidator = Joi.object({
  orderId: Joi.string().trim().optional(),
<<<<<<< HEAD
  customerNo: Joi.number().optional(),
=======
>>>>>>> b17a9100d3b45c984a0a3837d8ee403056c39ac0
  invoiceDate: Joi.date().optional(),
  paymentTerms: Joi.string().trim().allow("").optional(),
  termsOfDelivery: Joi.string().trim().allow("").optional(),
  shippingCondition: Joi.string().trim().allow("").optional(),
  customerServiceRep: Joi.string().trim().allow("").optional(),
  orderDate: Joi.date().allow(null).optional(),
  deliveryDate: Joi.date().allow(null).optional(),
  dueDate:Joi.date().allow(null).optional(),
  billTo: Joi.object({
    companyName: Joi.string().trim().required(),
    address: Joi.string().trim().allow("").optional(),
    gstin: Joi.string().trim().allow("").optional(),
    contactPerson: Joi.string().trim().allow("").optional(),
    contactNumber: Joi.string().trim().allow("").optional(),
  }).required(),
  seller: Joi.object({
    companyName: Joi.string().trim().allow("").optional(),
    address: Joi.string().trim().allow("").optional(),
    gstin: Joi.string().trim().allow("").optional(),
    email: Joi.string().trim().allow("").optional(),
    contactNumber: Joi.string().trim().allow("").optional(),
  }).optional(),
  bankDetails: Joi.object({
    accountNo: Joi.string().trim().allow("").optional(),
    accountType: Joi.string().trim().allow("").optional(),
    ifscCode: Joi.string().trim().allow("").optional(),
    holderName: Joi.string().trim().allow("").optional(),
  }).optional(),
  items: Joi.array().items(invoiceItemValidator).min(1).required(),
  summary: Joi.object({
    freightCost: Joi.number().min(0).default(0),
    paidAmount: Joi.number().min(0).default(0),
  }).optional(),
  notes: Joi.string().trim().allow("").optional(),
  status: Joi.string().valid("draft", "issued", "paid", "cancelled").optional(),
});