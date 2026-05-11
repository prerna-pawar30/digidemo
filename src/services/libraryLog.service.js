import CustomerData from "../models/ecommarace/customerData.model.js";
import EmailVerifyDummy from "../models/ecommarace/dummyemailverify.model.js";
import { otpVerificationTemplate } from "../config/templates/otpEmailTemplate.js";
import { sendZohoMail } from "./ZohoEmail/zohoMail.service.js";
import { v6 as uuidv6 } from "uuid";
import { adminLibraryRequestTemplate} from "../config/templates/adminLibraryRequestTemplat.js";
import { userLibraryRequestTemplate } from "../config/templates/userLibraryRequestTemplat.js";
import { ADMIN_EMAILS } from "../config/adminmail.js"
import { getPagination } from "../helpers/pagination.helper.js";
import mongoose from "mongoose";
/**
 * @function sendEmailOtpService
 *
 * @params
 * {
 *   email
 * }
 *
 * @process
 * 1. Find customer by email
 * 2. If already verified, return isVerified true
 * 3. Generate OTP and expiry
 * 4. Save or update OTP in EmailVerifyDummy
 * 5. Send OTP email
 *
 * @returns
 * {
 *   isVerified: Boolean
 * }
 */
export const sendEmailOtpService = async ({ email }) => {
  /* ---------- FIND CUSTOMER ---------- */
  const customer = await CustomerData.findOne({ email });
  /* ---------- IF EMAIL ALREADY VERIFIED ---------- */
  if (customer && customer.isEmailVerified) {
    return { isVerified: true };
  }
  /* ---------- GENERATE OTP ---------- */
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  /* ---------- SAVE OR UPDATE OTP ---------- */
  await EmailVerifyDummy.findOneAndUpdate(
    { email },
    { email, otp, otpExpiry },
    { upsert: true, new: true }
  );
  /* ---------- SEND OTP EMAIL ---------- */
  const htmlBody = otpVerificationTemplate(email, otp);
  await sendZohoMail(
    email,
    "Your OTP for Email Verification",
    htmlBody
  );
  return { isVerified: false };
};

export const verifyOtpAndCreateCustomerService = async ({
  email,
  otp,
  libraryObjectId,
  libraryId,
  brand,
  category,
  firstName,
  lastName,
  mobileNumber,
  companyName,
  address
}) => {
  /* ---------- NORMALIZE EMAIL ---------- */
  const normalizedEmail = email.toLowerCase().trim();
  /* ---------- FIND EXISTING CUSTOMER ---------- */
  const existingUser = await CustomerData.findOne({ email: normalizedEmail });
  /* ---------- SEND LIBRARY REQUEST EMAILS FOR SCANBRIDGE ---------- */
  if (category.toLowerCase() === "scanbridge") {
    await sendZohoMail(
       ADMIN_EMAILS.join(","), 
      `New Library Request for ${brand} - ${category}`,
      adminLibraryRequestTemplate(normalizedEmail, brand, category)
    );
    await sendZohoMail(
      normalizedEmail,
      "Your Library Request Has Been Received",
      userLibraryRequestTemplate(brand, category)
    );
  }
  /* ---------- IF CUSTOMER ALREADY VERIFIED ---------- */
  if (existingUser && existingUser.isEmailVerified) {
    await CustomerData.updateOne(
      { _id: existingUser._id },
      {
        $push: {
          logLibrary: {
            libraryObjectId,
            libraryId,
            brandName: brand,
            category,
            date: new Date()
          }
        }
      }
    );

    return {
      userId: existingUser._id,
      email: existingUser.email,
      isVerified: true,
      message: "Email already verified, library log updated"
    };
  }

  /* ---------- VALIDATE OTP ---------- */
  if (!otp) {
    const error = new Error("OTP is required");
    error.statusCode = 400;
    error.errorCode = "OTP_REQUIRED";
    throw error;
  }

  const otpRecord = await EmailVerifyDummy.findOne({
    email: normalizedEmail
  });

  if (!otpRecord) {
    const error = new Error("OTP not found. Please request again.");
    error.statusCode = 400;
    error.errorCode = "OTP_NOT_FOUND";
    throw error;
  }

  if (otpRecord.otp !== otp) {
    const error = new Error("Invalid OTP");
    error.statusCode = 400;
    error.errorCode = "INVALID_OTP";
    throw error;
  }

  if (otpRecord.otpExpiry < new Date()) {
    await EmailVerifyDummy.deleteOne({ email: normalizedEmail });

    const error = new Error("OTP expired. Please request again.");
    error.statusCode = 400;
    error.errorCode = "OTP_EXPIRED";
    throw error;
  }

  /* ---------- CREATE CUSTOMER ---------- */
  const customer = await CustomerData.create({
    customerId: uuidv6(),
    firstName,
    lastName,
    email: normalizedEmail,
    mobileNumber,
    companyName,
    address,
    isEmailVerified: true,
    logLibrary: [
      {
        libraryObjectId,
        libraryId,
        brandName: brand,
        category,
        date: new Date()
      }
    ]
  });

  /* ---------- DELETE USED OTP ---------- */
  await EmailVerifyDummy.deleteOne({ email: normalizedEmail });

  return {
    userId: customer._id,
    email: customer.email,
    isVerified: true,
    message: "OTP verified and customer created successfully"
  };
};

export const getAllConsumersService = async ({ skip, limit, page }) => {
  const [users, totalUsers] = await Promise.all([
    CustomerData.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    CustomerData.countDocuments()
  ]);

  return {
    users,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      limit
    }
  };
};

export const getEmailVerifyDummyService = async ({
  email,
  skip,
  limit,
  page
}) => {

  const filter = {};

  if (email) {
    filter.email = email.toLowerCase();
  }

  const [records, total] = await Promise.all([
    EmailVerifyDummy.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    EmailVerifyDummy.countDocuments(filter)
  ]);

  return {
    records,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      limit
    }
  };
};

export const getLibraryDashboardService = async ({
  days,
  groupBy,
  limit,
  categoryFilter,
  brandFilter,
}) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  /* ---------- MATCH STAGE ---------- */
  const matchStage = {
    "logLibrary.date": { $gte: startDate },
  };
  if (categoryFilter) matchStage["logLibrary.category"] = categoryFilter;
  if (brandFilter) matchStage["logLibrary.brandName"] = brandFilter;
  /* ---------- GROUP STAGE ---------- */
  let groupStage;
  switch (groupBy) {
    case "category":
      groupStage = {
        _id: "$logLibrary.category",
        usageCount: { $sum: 1 },
        lastUsedAt: { $max: "$logLibrary.date" },
      };
      break;

    case "brand":
      groupStage = {
        _id: "$logLibrary.brandName",
        usageCount: { $sum: 1 },
        lastUsedAt: { $max: "$logLibrary.date" },
      };
      break;

    default:
      groupStage = {
        _id: "$logLibrary.libraryObjectId",
        libraryId: { $first: "$logLibrary.libraryId" },
        brandName: { $first: "$logLibrary.brandName" },
        category: { $first: "$logLibrary.category" },
        usageCount: { $sum: 1 },
        lastUsedAt: { $max: "$logLibrary.date" },
      };
  }

  /* ---------- AGGREGATION ---------- */
  const data = await CustomerData.aggregate([
    { $unwind: "$logLibrary" },
    { $match: matchStage },
    { $group: groupStage },
    { $sort: { usageCount: -1 } },
    { $limit: limit },
  ]);

  return {
    days,
    groupBy,
    category: categoryFilter || "All",
    brand: brandFilter || "All",
    total: data.length,
    data,
  };
};

export const deleteOtpByEmailService = async (email) => {
  const deletedRecord = await EmailVerifyDummy.findOneAndDelete({
    email: email.toLowerCase(),
  });

  if (!deletedRecord) {
    const error = new Error("No OTP record found for this email");
    error.statusCode = 404;
    error.errorCode = "OTP_NOT_FOUND";
    throw error;
  }
  return deletedRecord;
};

export const getScanbridgeLibraryService = async ({
  page = 1,
  limit = 12
}) => {
  /* ---------- PARSE PAGINATION ---------- */
  const currentPage = Number(page) || 1;
  const perPage = Number(limit) || 12;
  const skip = (currentPage - 1) * perPage;

  /* ---------- FETCH CUSTOMERS ---------- */
  const customers = await CustomerData.find(
    { "logLibrary.category": { $regex: /^scanbridge$/i } },
    {
      firstName: 1,
      lastName: 1,
      email: 1,
      companyName: 1,
      logLibrary: 1
    }
  ).lean();

  /* ---------- PREPARE RESPONSE ---------- */
  const scanbridgeLibrary = [];

  for (const customer of customers) {
    const filteredLogs = (customer.logLibrary || []).filter(
      (item) => item.category?.toLowerCase() === "scanbridge"
    );

    for (const log of filteredLogs) {
      scanbridgeLibrary.push({
        customerId: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        companyName: customer.companyName,
        logId: log._id,
        libraryObjectId: log.libraryObjectId || null,
        libraryId: log.libraryId || null,
        brandName: log.brandName || null,
        category: log.category,
        isdelivered: log.isdelivered ?? false,
        date: log.date
      });
    }
  }

  /* ---------- SORT LATEST FIRST ---------- */
  scanbridgeLibrary.sort((a, b) => new Date(b.date) - new Date(a.date));
  /* ---------- PAGINATION ---------- */
  const total = scanbridgeLibrary.length;
  const paginatedScanbridgeLibrary = scanbridgeLibrary.slice(
    skip,
    skip + perPage
  );

  return {
    scanbridgeLibrary: paginatedScanbridgeLibrary,
    pagination: getPagination({
      total,
      page: currentPage,
      limit: perPage
    })
  };
};

export const updateScanbridgeLibraryService = async ({
  customerId,
  logId,
  isdelivered,
}) => {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const error = new Error("Invalid customerId");
    error.statusCode = 400;
    error.errorCode = "INVALID_CUSTOMER_ID";
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(logId)) {
    const error = new Error("Invalid logId");
    error.statusCode = 400;
    error.errorCode = "INVALID_LOG_ID";
    throw error;
  }

  const customer = await CustomerData.findOne(
    {
      _id: customerId,
      logLibrary: {
        $elemMatch: {
          _id: logId,
          category: { $regex: /^scanbridge$/i },
        },
      },
    },
    {
      "logLibrary.$": 1,
    }
  ).lean();

  if (!customer || !customer.logLibrary?.length) {
    const error = new Error("Scanbridge library log not found");
    error.statusCode = 404;
    error.errorCode = "SCANBRIDGE_LIBRARY_LOG_NOT_FOUND";
    throw error;
  }

  await CustomerData.updateOne(
    {
      _id: customerId,
      "logLibrary._id": logId,
      "logLibrary.category": { $regex: /^scanbridge$/i },
    },
    {
      $set: {
        "logLibrary.$.isdelivered": isdelivered,
      },
    },
    {
      runValidators: false,
    }
  );

  const updatedCustomer = await CustomerData.findOne(
    {
      _id: customerId,
      "logLibrary._id": logId,
    },
    {
      "logLibrary.$": 1,
    }
  ).lean();

  const libraryLog = updatedCustomer.logLibrary[0];

  return {
    customerId,
    logId: libraryLog._id,
    brandName: libraryLog.brandName || null,
    category: libraryLog.category,
    isdelivered: libraryLog.isdelivered,
    date: libraryLog.date,
  };
};