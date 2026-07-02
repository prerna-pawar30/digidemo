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
   LIBRARY LOG HELPERS (software -> library nested model)
========================================================= */
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Pushes a log entry into the matching software's library array
 * (matched by brandName + category, case-insensitive). If this
 * customer has no software entry with that brand+category yet,
 * creates a new software entry with this log as its first library item.
 *
 * Implemented as two atomic updateOne calls (try-push-to-existing,
 * fallback-to-create-new) instead of fetch+mutate+save, so it keeps
 * the same atomicity guarantee the old `$push` into `logLibrary` had.
 */
const pushLibraryLog = async (customerId, { brandName, category, logEntry }) => {
  const brandRegex = new RegExp(`^${escapeRegex(brandName.trim())}$`, "i");
  const categoryRegex = new RegExp(`^${escapeRegex(category.trim())}$`, "i");

  const pushedToExisting = await CustomerData.updateOne(
    {
      _id: customerId,
      software: { $elemMatch: { brandName: brandRegex, category: categoryRegex } },
    },
    { $push: { "software.$[sw].library": logEntry } },
    { arrayFilters: [{ "sw.brandName": brandRegex, "sw.category": categoryRegex }] }
  );

  if (pushedToExisting.modifiedCount === 0) {
    await CustomerData.updateOne(
      { _id: customerId },
      { $push: { software: { brandName, category, library: [logEntry] } } }
    );
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
   VERIFY OTP & CREATE CUSTOMER (now pushes into software.library)
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

  const isScanbridge = category?.toLowerCase() === "scanbridge";

  /* ---------- VALIDATE REQUIRED IDS FOR NON-SCANBRIDGE ---------- */
  if (!isScanbridge) {
    if (!libraryId || !libraryObjectId) {
      const error = new Error("libraryId and libraryObjectId are required");
      error.statusCode = 400;
      error.errorCode = "LIBRARY_DETAILS_REQUIRED";
      throw error;
    }
  }

  const existingUser = await CustomerData.findOne({ email: normalizedEmail });

  /* ---------- SEND EMAILS FOR SCANBRIDGE ---------- */
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

  /* ---------- BUILD LIBRARY LOG ENTRY (lives inside software.library now) ---------- */
  const libraryLogEntry = {
    date: new Date(),
  };

  /* ---------- ADD IDS ONLY FOR NON-SCANBRIDGE ---------- */
  if (!isScanbridge) {
    libraryLogEntry.libraryObjectId = libraryObjectId;
    libraryLogEntry.libraryId = libraryId;
  }

  console.log("Library Log Entry:", libraryLogEntry);

  /* ---------- EXISTING VERIFIED CUSTOMER ---------- */
  if (existingUser && existingUser.isEmailVerified) {
    await pushLibraryLog(existingUser._id, {
      brandName: brand,
      category,
      logEntry: libraryLogEntry,
    });

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
          brand,
          category,
          ...(isScanbridge ? {} : { libraryId, libraryObjectId }),
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

  /* ---------- CREATE CUSTOMER WITH FIRST SOFTWARE ENTRY ---------- */
  const customer = await CustomerData.create({
    customerId: uuidv6(),
    firstName,
    lastName,
    email: normalizedEmail,
    mobileNumber,
    companyName,
    address,
    isEmailVerified: true,
    software: [
      {
        brandName: brand,
        category,
        library: [libraryLogEntry],
      },
    ],
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
        brand,
        category,
        ...(isScanbridge ? {} : { libraryId, libraryObjectId }),
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
   GET ALL CONSUMERS  (unchanged — no logLibrary-specific code)
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
   GET EMAIL VERIFY DUMMY (unchanged)
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
   GET LIBRARY DASHBOARD (now double-unwinds software -> library)
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
    "software.library.date": { $gte: startDate },
  };
  if (categoryFilter) matchStage["software.category"] = categoryFilter;
  if (brandFilter) matchStage["software.brandName"] = brandFilter;

  let groupStage;
  switch (groupBy) {
    case "category":
      groupStage = {
        _id: "$software.category",
        usageCount: { $sum: 1 },
        lastUsedAt: { $max: "$software.library.date" },
      };
      break;
    case "brand":
      groupStage = {
        _id: "$software.brandName",
        usageCount: { $sum: 1 },
        lastUsedAt: { $max: "$software.library.date" },
      };
      break;
    default: // "library"
      groupStage = {
        _id: "$software.library.libraryObjectId",
        libraryId: { $first: "$software.library.libraryId" },
        brandName: { $first: "$software.brandName" },
        category: { $first: "$software.category" },
        usageCount: { $sum: 1 },
        lastUsedAt: { $max: "$software.library.date" },
      };
  }

  const data = await CustomerData.aggregate([
    { $unwind: "$software" },
    { $unwind: "$software.library" },
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
   DELETE OTP BY EMAIL (unchanged)
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
   GET SCANBRIDGE LIBRARY (now flattens software -> library)
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
    { "software.category": { $regex: /^scanbridge$/i } },
    { firstName: 1, lastName: 1, email: 1, companyName: 1, mobileNumber: 1, software: 1 }
  ).lean();

  const scanbridgeLibrary = [];

  for (const customer of customers) {
    const scanbridgeSoftwareEntries = (customer.software || []).filter(
      (sw) => sw.category?.toLowerCase() === "scanbridge"
    );

    for (const sw of scanbridgeSoftwareEntries) {
      for (const log of sw.library || []) {
        scanbridgeLibrary.push({
          customerId: customer._id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          mobileNumber: customer.mobileNumber,
          companyName: customer.companyName,
          softwareId: sw._id,
          logId: log._id,
          brandName: sw.brandName || null,
          category: sw.category,
          isdelivered: log.isdelivered ?? false,
          date: log.date,
        });
      }
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
      currentPage,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      limit: perPage,
    },
  };

  await setCache(cacheKey, result);
  return result;
};

/* =========================================================
   UPDATE SCANBRIDGE LIBRARY (now searches software[].library[])
========================================================= */
export const updateScanbridgeLibraryService = async ({
  customerId,
  softwareId, // optional — pass it if you have it (from getScanbridgeLibrary response) for a direct lookup
  logId,
  isdelivered,
}) => {
  const customer = await CustomerData.findById(customerId);

  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    error.errorCode = "CUSTOMER_NOT_FOUND";
    throw error;
  }

  let softwareEntry;
  let libraryLog;

  if (softwareId) {
    softwareEntry = customer.software.find((sw) => sw._id.toString() === softwareId);
    libraryLog = softwareEntry?.library.find((log) => log._id.toString() === logId);
  } else {
    // Fallback: scan every software entry for this customer to find the log
    for (const sw of customer.software) {
      const match = sw.library.find((log) => log._id.toString() === logId);
      if (match) {
        softwareEntry = sw;
        libraryLog = match;
        break;
      }
    }
  }

  if (!softwareEntry || !libraryLog) {
    const error = new Error("Log not found");
    error.statusCode = 404;
    error.errorCode = "LOG_NOT_FOUND";
    throw error;
  }

  if (softwareEntry.category?.toLowerCase() !== "scanbridge") {
    const error = new Error("This log does not belong to a scanbridge category");
    error.statusCode = 400;
    error.errorCode = "INVALID_CATEGORY";
    throw error;
  }

  libraryLog.isdelivered = isdelivered;
  await customer.save({ validateBeforeSave: false });

  await clearLibraryCache();

  return {
    customerId: customer._id,
    softwareId: softwareEntry._id,
    logId: libraryLog._id,
    brandName: softwareEntry.brandName,
    category: softwareEntry.category,
    isdelivered: libraryLog.isdelivered,
    date: libraryLog.date,
  };
};