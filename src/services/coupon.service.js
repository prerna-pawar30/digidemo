import Coupon from "../models/manage/coupon.model.js";
import { v6 as uuidv6 } from "uuid";
import { sendNotification } from "./notification.service.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { redis as redisClient } from "../config/redis.config.js";

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

const clearCouponCache = async () => {
  try {
    const keys = await redisClient.keys("COUPON:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("COUPON CACHE CLEARED:", keys);
    }
  } catch (err) {
    console.error("REDIS COUPON CACHE CLEAR ERROR:", err.message);
  }
};

/* =========================================================
   CREATE COUPON
========================================================= */
export const createCouponService = async ({ data, employee, permission }) => {
  const coupon = await Coupon.create({
    ...data,
    couponId: uuidv6(),
  });

  /* ---------- CLEAR CACHE ---------- */
  await clearCouponCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: coupon._id,
      action: coupon.code,
      permission: permission || "create_coupon",
      actionType: "Create",
    });
  } catch (err) {
    console.error("Audit log failed on create coupon:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id,
      permission: "coupan.listing.read",
      title: "New Coupon Created",
      message: `${coupon.code} coupon has been created successfully`,
      type: "COUPON_CREATED",
      entityId: coupon._id,
      entityModel: "Coupon",
      metadata: {
        couponId: coupon.couponId,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        createdBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on create coupon:", err.message);
  }

  return coupon;
};

/* =========================================================
   UPDATE COUPON
========================================================= */
export const updateCouponService = async ({ couponId, data }) => {
  if (data.code) data.code = data.code.toUpperCase();

  const coupon = await Coupon.findOneAndUpdate(
    { couponId },
    data,
    { new: true }
  );

  if (!coupon) {
    const error = new Error("Coupon not found");
    error.statusCode = 404;
    throw error;
  }

  /* ---------- CLEAR CACHE ---------- */
  await clearCouponCache();
  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: coupon._id,
      action: coupon.code,
      permission: permission || "update_coupon",
      actionType: "Update",
    });
  } catch (err) {
    console.error("Audit log failed on update coupon:", err.message);
  }
  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id,
      permission: "coupan.listing.read",
      title: "New Coupon Created",
      message: `${coupon.code} coupon has been update successfully`,
      type: "COUPON_CREATED",
      entityId: coupon._id,
      entityModel: "Coupon",
      metadata: {
        couponId: coupon.couponId,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        createdBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on update coupon:", err.message);
  }

  return coupon;
};

/* =========================================================
   FILTER COUPONS
========================================================= */
export const filterCouponsService = async ({ isActive, skip, limit }) => {
  const filter = {};
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;

  /* ---------- CACHE KEY ---------- */
  const cacheKey = `COUPON:LIST:${isActive ?? "all"}:${skip}:${limit}`;

  /* ---------- CACHE CHECK ---------- */
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("COUPON CACHE HIT:", cacheKey);
    return cached;
  }

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .populate("applicableCategories", "name categoryId")
      .populate("applicableBrands", "brandName brandId")
      .populate("buyXGetY.buyCategory", "name categoryId")
      .populate("buyXGetY.getCategory", "name categoryId")
      .populate("buyXGetY.buyBrand", "brandName brandId")
      .populate("buyXGetY.getBrand", "brandName brandId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Coupon.countDocuments(filter),
  ]);

  const result = { coupons, total, filter };

  /* ---------- STORE CACHE ---------- */
  await setCache(cacheKey, result);

  return result;
};

/* =========================================================
   GET SINGLE COUPON
========================================================= */
export const getSingleCouponService = async ({ couponId }) => {
  /* ---------- CACHE KEY ---------- */
  const cacheKey = `COUPON:ID:${couponId}`;

  /* ---------- CACHE CHECK ---------- */
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("COUPON CACHE HIT:", cacheKey);
    return cached;
  }

  const coupon = await Coupon.findOne({ couponId })
    .populate("applicableCategories", "name categoryId")
    .populate("applicableBrands", "brandName brandId")
    .populate("buyXGetY.buyCategory", "name categoryId")
    .populate("buyXGetY.getCategory", "name categoryId")
    .populate("buyXGetY.buyBrand", "brandName brandId")
    .populate("buyXGetY.getBrand", "brandName brandId");

  if (!coupon) {
    const error = new Error("Coupon not found");
    error.statusCode = 404;
    error.errorCode = "COUPON_NOT_FOUND";
    throw error;
  }

  /* ---------- AUTO DEACTIVATE IF EXPIRED ---------- */
  if (coupon.endDate < new Date() && coupon.isActive) {
    coupon.isActive = false;
    await coupon.save();
    await clearCouponCache();
  }

  /* ---------- STORE CACHE ---------- */
  await setCache(cacheKey, coupon);

  return coupon;
};

/* =========================================================
   DELETE COUPON
========================================================= */
export const deleteCouponService = async ({ couponId }) => {
  const coupon = await Coupon.findOneAndDelete({ couponId });

  if (!coupon) {
    const error = new Error("Coupon not found");
    error.statusCode = 404;
    error.errorCode = "COUPON_NOT_FOUND";
    throw error;
  }

  /* ---------- CLEAR CACHE ---------- */
  await clearCouponCache();
  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: coupon._id,
      action: coupon.code,
      permission: permission || "delete_coupon",
      actionType: "Delete",
    });
  } catch (err) {
    console.error("Audit log failed on create coupon:", err.message);
  }
  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id,
      permission: "coupan.listing.read",
      title: "New Coupon Created",
      message: `${coupon.code} coupon has been delete successfully`,
      type: "COUPON_CREATED",
      entityId: coupon._id,
      entityModel: "Coupon",
      metadata: {
        couponId: coupon.couponId,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        createdBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on delete coupon:", err.message);
  }

  return coupon;
};