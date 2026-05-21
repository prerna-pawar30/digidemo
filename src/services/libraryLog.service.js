import CustomerData from "../models/ecommarace/customerData.model.js";
import EmailVerifyDummy from "../models/ecommarace/dummyemailverify.model.js";
import { otpVerificationTemplate } from "../config/templates/otpEmailTemplate.js";
import { sendZohoMail } from "./ZohoEmail/zohoMail.service.js";
import { v6 as uuidv6 } from "uuid";
import { adminLibraryRequestTemplate } from "../config/templates/adminLibraryRequestTemplat.js";
import { userLibraryRequestTemplate } from "../config/templates/userLibraryRequestTemplat.js";
import { ADMIN_EMAILS } from "../config/adminmail.js";
import { sendNotification } from "./notification.service.js";
import { redis as redisClient } from "../config/redis.config.js";
import mongoose from "mongoose";

/* =========================================================
   CACHE CONFIG
========================================================= */
const CACHE_TTL = 60 * 60;

/* =========================================================
   CACHE HELPERS
========================================================= */
const getCache = async (key) => {
  try {
    const cached = await redisClient.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    console.error("REDIS GET CACHE ERROR:", err.message);
    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(key, JSON.stringify(data), { ex: CACHE_TTL });
  } catch (err) {
    console.error("REDIS SET CACHE ERROR:", err.message);
  }
};

const clearLibraryCache = async () => {
  try {
    const keys = await redisClient.keys("LIBRARY:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("LIBRARY CACHE CLEARED:", keys);
    }
  } catch (err) {
    console.error("REDIS LIBRARY CACHE CLEAR ERROR:", err.message);
  }
};

/* =========================================================
   SEND EMAIL OTP
========================================================= */
export const sendEmailOtpService = async ({ email }) => {
  const customer = await CustomerData.findOne({ email });

  if (customer && customer.isEmailVerified) {
    return { isVerified: true };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  await EmailVerifyDummy.findOneAndUpdate(
    { email },
    { email, otp, otpExpiry },
    { upsert: true, new: true }
  );

  const htmlBody = otpVerificationTemplate(email, otp);
  await sendZohoMail(email, "Your OTP for Email Verification", htmlBody);

  return { isVerified: false };
};

/* =========================================================
   VERIFY OTP AND CREATE CUSTOMER
========================================================= */
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
  address,
}) => {
  const normalizedEmail = email.toLowerCase().trim();
  const isScanbridge = category.toLowerCase() === "scanbridge";
  const existingUser = await CustomerData.findOne({ email: normalizedEmail });
  /* ---------- SEND LIBRARY REQUEST EMAILS FOR SCANBRIDGE ---------- */
  if (isScanbridge) {
    try {
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
    } catch (err) {
      console.error("Scanbridge email failed:", err.message);
    }
  }

  /* ---------- BUILD LOG ENTRY (no libraryObjectId/libraryId for scanbridge) ---------- */
  const libraryLogEntry = {
    ...(isScanbridge ? {} : { libraryObjectId, libraryId }),
    brandName: brand,
    category,
    date: new Date(),
  };

  /* ---------- IF CUSTOMER ALREADY VERIFIED ---------- */
  if (existingUser && existingUser.isEmailVerified) {
    await CustomerData.updateOne(
      { _id: existingUser._id },
      { $push: { logLibrary: libraryLogEntry } }
    );

    await clearLibraryCache();

    try {
      await sendNotification({
        sender: null,
        permission: "library.listing.read",
        title: "Library Downloaded",
        message: `${normalizedEmail} downloaded "${brand}" library (${category})`,
        type: "LIBRARY_DOWNLOADED",
        entityId: existingUser._id,
        entityModel: "CustomerData",
        metadata: {
          customerId: existingUser._id,
          email: normalizedEmail,
          ...(isScanbridge ? {} : { libraryId }),
          brand,
          category,
        },
      });
    } catch (err) {
      console.error("Notification failed on library download:", err.message);
    }

    return {
      userId: existingUser._id,
      email: existingUser.email,
      isVerified: true,
      message: "Email already verified, library log updated",
    };
  }

  /* ---------- VALIDATE OTP ---------- */
  if (!otp) {
    const error = new Error("OTP is required");
    error.statusCode = 400;
    error.errorCode = "OTP_REQUIRED";
    throw error;
  }

  const otpRecord = await EmailVerifyDummy.findOne({ email: normalizedEmail });

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
    logLibrary: [libraryLogEntry],
  });

  await EmailVerifyDummy.deleteOne({ email: normalizedEmail });
  await clearLibraryCache();

  try {
    await sendNotification({
      sender: null,
      permission: "library.listing.read",
      title: "Library Downloaded",
      message: `${normalizedEmail} downloaded "${brand}" library (${category})`,
      type: "LIBRARY_DOWNLOADED",
      entityId: customer._id,
      entityModel: "CustomerData",
      metadata: {
        customerId: customer._id,
        email: normalizedEmail,
        ...(isScanbridge ? {} : { libraryId }),
        brand,
        category,
      },
    });
  } catch (err) {
    console.error("Notification failed on library download:", err.message);
  }

  return {
    userId: customer._id,
    email: customer.email,
    isVerified: true,
    message: "OTP verified and customer created successfully",
  };
};

/* =========================================================
   GET ALL CONSUMERS
========================================================= */
export const getAllConsumersService = async ({ skip, limit, page }) => {
  const cacheKey = `LIBRARY:CONSUMERS:${page}:${limit}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("LIBRARY CACHE HIT:", cacheKey);
    return cached;
  }

  const [users, totalItems] = await Promise.all([
    CustomerData.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CustomerData.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const result = {
    users,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
  };

  await setCache(cacheKey, result);
  return result;
};

/* =========================================================
   GET EMAIL VERIFY DUMMY
========================================================= */
export const getEmailVerifyDummyService = async ({ email, skip, limit, page }) => {
  const filter = {};
  if (email) filter.email = email.toLowerCase();

  const [records, totalItems] = await Promise.all([
    EmailVerifyDummy.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    EmailVerifyDummy.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    records,
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

/* =========================================================
   GET LIBRARY DASHBOARD
========================================================= */
export const getLibraryDashboardService = async ({
  days,
  groupBy,
  limit,
  categoryFilter,
  brandFilter,
}) => {
  const cacheKey = `LIBRARY:DASHBOARD:${days}:${groupBy}:${limit}:${categoryFilter || "all"}:${brandFilter || "all"}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("LIBRARY CACHE HIT:", cacheKey);
    return cached;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const matchStage = {
    "logLibrary.date": { $gte: startDate },
  };
  if (categoryFilter) matchStage["logLibrary.category"] = categoryFilter;
  if (brandFilter) matchStage["logLibrary.brandName"] = brandFilter;

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

  const data = await CustomerData.aggregate([
    { $unwind: "$logLibrary" },
    { $match: matchStage },
    { $group: groupStage },
    { $sort: { usageCount: -1 } },
    { $limit: limit },
  ]);

  const result = {
    days,
    groupBy,
    category: categoryFilter || "All",
    brand: brandFilter || "All",
    total: data.length,
    data,
  };

  await setCache(cacheKey, result);
  return result;
};

/* =========================================================
   DELETE OTP BY EMAIL
========================================================= */
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

/* =========================================================
   GET SCANBRIDGE LIBRARY
========================================================= */
export const getScanbridgeLibraryService = async ({ page = 1, limit = 12 }) => {
  const currentPage = Number(page) || 1;
  const perPage = Number(limit) || 12;
  const skip = (currentPage - 1) * perPage;

  const cacheKey = `LIBRARY:SCANBRIDGE:${currentPage}:${perPage}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("LIBRARY CACHE HIT:", cacheKey);
    return cached;
  }

  const customers = await CustomerData.find(
    { "logLibrary.category": { $regex: /^scanbridge$/i } },
    { firstName: 1, lastName: 1, email: 1, companyName: 1, logLibrary: 1, mobileNumber: 1 }
  ).lean();

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
        mobileNumber: customer.mobileNumber,
        companyName: customer.companyName,
        logId: log._id,
        brandName: log.brandName || null,
        category: log.category,
        isdelivered: log.isdelivered ?? false,
        date: log.date,
      });
    }
  }

  scanbridgeLibrary.sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalItems = scanbridgeLibrary.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const paginatedScanbridgeLibrary = scanbridgeLibrary.slice(skip, skip + perPage);

  const result = {
    scanbridgeLibrary: paginatedScanbridgeLibrary,
    pagination: {
      totalItems,
      totalPages,
      currentPage: currentPage,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      limit: perPage,
    },
  };

  await setCache(cacheKey, result);
  return result;
};

/* =========================================================
   UPDATE SCANBRIDGE LIBRARY
========================================================= */
export const updateScanbridgeLibraryService = async ({ customerId, logId, isdelivered }) => {
  const customer = await CustomerData.findById(customerId);

  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    error.errorCode = "CUSTOMER_NOT_FOUND";
    throw error;
  }

  const libraryLog = customer.logLibrary.find(
    (log) => log._id.toString() === logId
  );

  if (!libraryLog) {
    const error = new Error("Log not found");
    error.statusCode = 404;
    error.errorCode = "LOG_NOT_FOUND";
    throw error;
  }

  libraryLog.isdelivered = isdelivered;
  await customer.save({ validateBeforeSave: false });

  await clearLibraryCache();

  return libraryLog;
};