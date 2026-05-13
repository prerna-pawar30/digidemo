import mongoose from "mongoose";
import { v6 as uuidv6 } from "uuid";
const { Schema, model } = mongoose;

const invoiceItemSchema = new Schema(
  {
    itemId:{
      type: String,
      default: () => uuidv6(),
    },
    articleNo:{
      type: String,
      trim: true,
      default: "",
    },
    description:{
      type: String,
      required: true,
      trim: true,
    },
    qty: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalNet:{
      type: Number,
      default: 0,
      min: 0,
    },
    gstType:{
      type: String,
      enum: ["IGST", "CGST", "SGST", "NONE"],
      default: "IGST",
    },
    gstPercent:{
      type: Number,
      default: 5,
      min: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    invoiceId: {
      type: String,
      unique: true,
      default: () => uuidv6(),
    },

    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

customerNo: {
  type: Number,
  required: true,
},

    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    orderNumber: {
      type: String,
      trim: true,
      default: "",
    },

    orderDate: {
      type: Date,
      default: null,
    },

    deliveryDate: {
      type: Date,
      default: null,
    },

    paymentTerms: {
      type: String,
      trim: true,
      default: "",
    },

    termsOfDelivery: {
      type: String,
      trim: true,
      default: "",
    },

    shippingCondition: {
      type: String,
      trim: true,
      default: "",
    },

    customerServiceRep: {
      type: String,
      trim: true,
      default: "",
    },

    seller: {
      companyName: {
        type: String,
        trim: true,
        default: "",
      },
      address: {
        type: String,
        trim: true,
        default: "",
      },
      gstin: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        default: "",
      },
      contactNumber: {
        type: String,
        trim: true,
        default: "",
      },
    },

    billTo: {
      companyName: {
        type: String,
        required: true,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
        default: "",
      },
      gstin: {
        type: String,
        trim: true,
        default: "",
      },
      contactPerson: {
        type: String,
        trim: true,
        default: "",
      },
      contactNumber: {
        type: String, 
        trim: true,
        default: "",
      },
    },
    bankDetails: {
      accountNo: {
        type: String,
        trim: true,
        default: "",
      },
      accountType: {
        type: String,
        trim: true,
        default: "",
      },
      ifscCode: {
        type: String,
        trim: true,
        default: "",
      },
      holderName: {
        type: String,
        trim: true,
        default: "",
      },
    },

    items: {
      type: [invoiceItemSchema],
      default: [],
    },

    summary: {
      totalGrossValue: {
        type: Number,
        default: 0,
      },
      totalDiscount: {
        type: Number,
        default: 0,
      },
      totalNet: {
        type: Number,
        default: 0,
      },
      freightCost: {
        type: Number,
        default: 0,
      },
      totalTax: {
        type: Number,
        default: 0,
      },
      totalPayAmount: {
        type: Number,
        default: 0,
      },
      paidAmount: {
        type: Number,
        default: 0,
      },
      amountToPay: {
        type: Number,
        default: 0,
      },
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

  status: {
  type: String,
  enum: [
    "draft",
    "issued",
    "paid",
    "cancelled",
    "partially_paid",
  ],
  default: "draft",
},
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.pre("save", function () {
  let totalGrossValue = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalTax = 0;

  for (const item of this.items) {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const gstPercent = Number(item.gstPercent || 5);

    // GST inclusive price
    const total = qty * price;

    const basePrice = total / (1 + gstPercent / 100);
    const gstAmount = total - basePrice;

    const discountValue =
      Number(item.discountPercent || 0) > 0
        ? (basePrice * Number(item.discountPercent || 0)) / 100
        : Number(item.discountValue || 0);

    const net = basePrice - discountValue;

    item.discountValue = Number(discountValue.toFixed(2));
    item.totalNet = Number(net.toFixed(2));
    item.gstAmount = Number(gstAmount.toFixed(2));
    item.totalAmount = Number(total.toFixed(2));

    totalGrossValue += basePrice;
    totalDiscount += discountValue;
    totalNet += net;
    totalTax += gstAmount;
  }

  const freightCost = Number(this.summary.freightCost || 0);
  const paidAmount = Number(this.summary.paidAmount || 0);

  this.summary.totalGrossValue = Number(totalGrossValue.toFixed(2));
  this.summary.totalDiscount = Number(totalDiscount.toFixed(2));
  this.summary.totalNet = Number(totalNet.toFixed(2));
  this.summary.totalTax = Number(totalTax.toFixed(2));

  this.summary.totalPayAmount = Number(
    (totalNet + totalTax + freightCost).toFixed(2)
  );

  this.summary.amountToPay = Number(
    (this.summary.totalPayAmount - paidAmount).toFixed(2)
  );
});
const Invoice = model("Invoice", invoiceSchema);
export default Invoice;