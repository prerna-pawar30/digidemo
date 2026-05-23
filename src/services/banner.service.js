import { v6 as uuidv6 } from "uuid";
import Banner from "../models/manage/banner.model.js";
import Category from "../models/manage/category.model.js";
import Brand from "../models/manage/brand.model.js";
import Product from "../models/manage/product.model.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { uploadToS3, deleteFromS3 } from "./awsS3.service.js";
import { sendNotification } from "./notification.service.js";
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
    const cachedData = await redisClient.get(key);
    if (!cachedData) return null;
    return JSON.parse(cachedData);
  } catch (error) {
    console.error("REDIS GET CACHE ERROR:", error.message);
    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(key, JSON.stringify(data), { ex: CACHE_TTL });
  } catch (error) {
    console.error("REDIS SET CACHE ERROR:", error.message);
  }
};

const clearBannerCache = async () => {
  try {
    const keys = await redisClient.keys("BANNER:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("BANNER CACHE CLEARED:", keys);
    }
  } catch (error) {
    console.error("REDIS CACHE CLEAR ERROR:", error.message);
  }
};

/* =========================================================
   CREATE BANNER
========================================================= */
export const createBannerService = async ({
  filterBy,
  filterId,
  isActive = true,
  displayOrder,
  file,
  employee,
  permission,
}) => {
  let imageUpload;
  try {
    if (!file) {
      const err = new Error("Banner image is required");
      err.statusCode = 400;
      throw err;
    }

    if (!displayOrder || displayOrder < 1) {
      const err = new Error("Valid displayOrder required");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- DISPLAY ORDER CHECK ---------- */
    if (isActive) {
      const exists = await Banner.findOne({ displayOrder, isActive: true });
      if (exists) {
        const err = new Error(`Active banner already exists at displayOrder ${displayOrder}`);
        err.statusCode = 409;
        throw err;
      }
    }

    /* ---------- UPLOAD IMAGE ---------- */
    imageUpload = await uploadToS3(file, "banners");

    /* ---------- CREATE BANNER ---------- */
    const banner = await Banner.create({
      bannerId: uuidv6(),
      imageUrl: imageUpload.url,
      filterBy,
      filterId,
      isActive,
      displayOrder,
    });

    /* ---------- CLEAR CACHE ---------- */
    await clearBannerCache();

    /* ---------- AUDIT ---------- */
    try {
      await PermissionAudit.create({
        permissionAuditId: uuidv6(),
        actionBy: employee._id,
        actionByEmail: employee.email,
        actionFor: banner._id,
        action: `Banner Created | Banner:${banner.bannerId} | Filter:${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,
        permission: permission || "create_banner",
        actionType: "Create",
      });
    } catch (err) {
      console.error("Audit log failed on create banner:", err.message);
    }

    try {
      await sendNotification({
        sender: employee._id,
        permission: "marketing.banner.create",
        title: "New Banner Created",
        message: `Banner created successfully at display order ${displayOrder}`,
        type: "BANNER_CREATED",
        entityId: banner._id,
        entityModel: "Banner",
        metadata: {
          bannerId: banner.bannerId,
          filterBy,
          filterId,
          displayOrder,
          isActive,
          imageUrl: banner.imageUrl,
          createdBy: employee.email,
        },
      });
    } catch (err) {
      console.error("Notification failed on create banner:", err.message);
    }

    return banner;
  } catch (error) {
    /* ---------- ROLLBACK ---------- */
    if (imageUpload?.url) {
      await deleteFromS3(imageUpload.url);
    }
    throw error;
  }
};

/* =========================================================
   GET ALL BANNERS
========================================================= */
export const getAllBannersService = async ({ page = 1, limit = 10 }) => {
  try {
    page = Number(page);
    limit = Number(limit);

    if (page < 1 || limit < 1) {
      const err = new Error("Invalid pagination values");
      err.statusCode = 400;
      throw err;
    }

    const skip = (page - 1) * limit;
    const cacheKey = `BANNER:ALL:${page}:${limit}`;

    /* ---------- CACHE CHECK ---------- */
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("CACHE HIT:", cacheKey);
      return cached;
    }

    /* ---------- FETCH ---------- */
    const [banners, totalItems] = await Promise.all([
      Banner.find({}).sort({ displayOrder: 1 }).skip(skip).limit(limit).lean(),
      Banner.countDocuments({}),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    const result = {
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        limit,
      },
      banners,
    };

    /* ---------- STORE CACHE ---------- */
    await setCache(cacheKey, result);

    return result;
  } catch (error) {
    throw error;
  }
};

/* =========================================================
   GET BANNERS BY ACTIVE STATUS
========================================================= */
export const getBannersByIsActiveService = async ({
  isActive,
  page = 1,
  limit = 10,
}) => {
  try {
    page = Number(page);
    limit = Number(limit);

    if (page < 1 || limit < 1) {
      const err = new Error("Invalid pagination values");
      err.statusCode = 400;
      throw err;
    }

    if (typeof isActive !== "boolean") {
      const err = new Error("isActive must be boolean");
      err.statusCode = 400;
      throw err;
    }

    const skip = (page - 1) * limit;
    const cacheKey = `BANNER:ACTIVE:${isActive}:${page}:${limit}`;

    /* ---------- CACHE ---------- */
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("CACHE HIT:", cacheKey);
      return cached;
    }

    const filter = { isActive };

    /* ---------- FETCH ---------- */
    const [banners, totalItems] = await Promise.all([
      Banner.find(filter).sort({ displayOrder: 1 }).skip(skip).limit(limit).lean(),
      Banner.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    const result = {
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        limit,
      },
      banners,
    };

    /* ---------- STORE CACHE ---------- */
    await setCache(cacheKey, result);

    return result;
  } catch (error) {
    throw error;
  }
};

/* =========================================================
   UPDATE BANNER
========================================================= */
export const updateBannerService = async ({
  bannerId,
  filterBy,
  filterId,
  isActive,
  displayOrder,
  file,
  employee,
  permission,
}) => {
  let newImageUpload;
  try {
    if (!bannerId) {
      const err = new Error("BannerId is required");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- FIND BANNER ---------- */
    const banner = await Banner.findOne({ bannerId });
    if (!banner) {
      const err = new Error("Banner not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- DISPLAY ORDER CHECK ---------- */
    const shouldBeActive = isActive !== undefined ? isActive : banner.isActive;
    if (displayOrder !== undefined && shouldBeActive) {
      const conflict = await Banner.findOne({
        bannerId: { $ne: bannerId },
        displayOrder,
        isActive: true,
      });
      if (conflict) {
        const err = new Error(`displayOrder ${displayOrder} already used`);
        err.statusCode = 409;
        throw err;
      }
    }

    /* ---------- IMAGE UPDATE ---------- */
    if (file) {
      const oldImage = banner.imageUrl;
      newImageUpload = await uploadToS3(file, "banners");
      banner.imageUrl = newImageUpload.url;
      if (oldImage) {
        await deleteFromS3(oldImage);
      }
    }

    /* ---------- UPDATE FIELDS ---------- */
    if (filterBy !== undefined) banner.filterBy = filterBy;
    if (filterId !== undefined) banner.filterId = filterId;
    if (displayOrder !== undefined) banner.displayOrder = displayOrder;
    if (isActive !== undefined) banner.isActive = isActive;

    await banner.save();

    /* ---------- CLEAR CACHE ---------- */
    await clearBannerCache();

    /* ---------- AUDIT ---------- */
    try {
      await PermissionAudit.create({
        permissionAuditId: uuidv6(),
        actionBy: employee._id,
        actionByEmail: employee.email,
        actionFor: banner._id,
        action: `Banner Updated | Banner:${banner.bannerId} | Filter:${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,
        permission: permission || "update_banner",
        actionType: "Update",
      });
    } catch (err) {
      console.error("Audit log failed on update banner:", err.message);
    }

    /* ---------- NOTIFICATION ---------- */
    try {
      await sendNotification({
        sender: employee._id,
        permission: "marketing.banner.update",
        title: "Banner Updated",
        message: `Banner ${banner.bannerId} updated successfully`,
        type: "BANNER_UPDATED",
        entityId: banner._id,
        entityModel: "Banner",
        metadata: {
          bannerId: banner.bannerId,
          filterBy: banner.filterBy,
          filterId: banner.filterId,
          displayOrder: banner.displayOrder,
          isActive: banner.isActive,
          updatedBy: employee.email,
        },
      });
    } catch (err) {
      console.error("Notification failed on update banner:", err.message);
    }

    return banner;
  } catch (error) {
    /* ---------- ROLLBACK ---------- */
    if (newImageUpload?.url) {
      await deleteFromS3(newImageUpload.url);
    }
    throw error;
  }
};

/* =========================================================
   UPDATE DISPLAY ORDER
========================================================= */
export const updateBannerDisplayOrderService = async ({
  bannerId,
  displayOrder,
  employee,
  permission,
}) => {
  try {
    if (!bannerId) {
      const err = new Error("BannerId is required");
      err.statusCode = 400;
      throw err;
    }

    if (!displayOrder || displayOrder < 1) {
      const err = new Error("displayOrder must be >= 1");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- FIND ---------- */
    const banner = await Banner.findOne({ bannerId });
    if (!banner) {
      const err = new Error("Banner not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- CONFLICT ---------- */
    if (banner.isActive) {
      const conflict = await Banner.findOne({
        bannerId: { $ne: bannerId },
        displayOrder,
        isActive: true,
      });
      if (conflict) {
        const err = new Error(`displayOrder ${displayOrder} already exists`);
        err.statusCode = 409;
        throw err;
      }
    }

    /* ---------- UPDATE ---------- */
    banner.displayOrder = displayOrder;
    await banner.save();

    /* ---------- CLEAR CACHE ---------- */
    await clearBannerCache();

    /* ---------- AUDIT ---------- */
    try {
      await PermissionAudit.create({
        permissionAuditId: uuidv6(),
        actionBy: employee._id,
        actionByEmail: employee.email,
        actionFor: banner._id,
        action: `Banner Display Order Updated | Banner:${banner.bannerId} | Order:${banner.displayOrder}`,
        permission: permission || "update_banner",
        actionType: "Update",
      });
    } catch (err) {
      console.error("Audit log failed on update display order:", err.message);
    }

    /* ---------- NOTIFICATION ---------- */
    try {
      await sendNotification({
        sender: employee._id,
        permission: "marketing.banner.update",
        title: "Banner Display Order Updated",
        message: `Banner order changed to ${banner.displayOrder}`,
        type: "BANNER_DISPLAY_ORDER_UPDATED",
        entityId: banner._id,
        entityModel: "Banner",
        metadata: {
          bannerId: banner.bannerId,
          displayOrder: banner.displayOrder,
          updatedBy: employee.email,
        },
      });
    } catch (err) {
      console.error("Notification failed on update display order:", err.message);
    }

    return banner;
  } catch (error) {
    throw error;
  }
};

/* =========================================================
   DELETE BANNER
========================================================= */
export const deleteBannerService = async ({ bannerId, employee, permission }) => {
  try {
    if (!bannerId) {
      const err = new Error("BannerId is required");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- FIND ---------- */
    const banner = await Banner.findOne({ bannerId });
    if (!banner) {
      const err = new Error("Banner not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- DELETE FROM DB FIRST ---------- */
    await Banner.findByIdAndDelete(banner._id);

    /* ---------- DELETE IMAGE ---------- */
    if (banner.imageUrl) {
      try {
        await deleteFromS3(banner.imageUrl);
      } catch (err) {
        console.error("S3 image delete failed:", err.message);
      }
    }

    /* ---------- CLEAR CACHE ---------- */
    await clearBannerCache();

    /* ---------- AUDIT ---------- */
    try {
      await PermissionAudit.create({
        permissionAuditId: uuidv6(),
        actionBy: employee._id,
        actionByEmail: employee.email,
        actionFor: banner._id,
        action: `Banner Deleted | Banner:${banner.bannerId} | Filter:${banner.filterBy}:${banner.filterId}`,
        permission: permission || "delete_banner",
        actionType: "Delete",
      });
    } catch (err) {
      console.error("Audit log failed on delete banner:", err.message);
    }

    /* ---------- NOTIFICATION ---------- */
    try {
      await sendNotification({
        sender: employee._id,
        permission: "marketing.banner.delete",
        title: "Banner Deleted",
        message: `Banner ${banner.bannerId} deleted successfully`,
        type: "BANNER_DELETED",
        entityId: banner._id,
        entityModel: "Banner",
        metadata: {
          bannerId: banner.bannerId,
          filterBy: banner.filterBy,
          filterId: banner.filterId,
          deletedBy: employee.email,
        },
      });
    } catch (err) {
      console.error("Notification failed on delete banner:", err.message);
    }

    return true;
  } catch (error) {
    throw error;
  }
};

/* =========================================================
   GET PRODUCTS BY BANNER
========================================================= */
export const getProductsByBannerService = async ({
  bannerId,
  page = 1,
  limit = 10,
}) => {
  try {
    if (!bannerId) {
      const err = new Error("bannerId is required");
      err.statusCode = 400;
      throw err;
    }

    page = Number(page);
    limit = Number(limit);

    if (page < 1 || limit < 1) {
      const err = new Error("Invalid pagination values");
      err.statusCode = 400;
      throw err;
    }

    const skip = (page - 1) * limit;
    const cacheKey = `BANNER:PRODUCTS:${bannerId}:${page}:${limit}`;

    /* ---------- CACHE CHECK ---------- */
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log("CACHE HIT:", cacheKey);
      return cachedData;
    }

    /* ---------- FIND BANNER ---------- */
    const banner = await Banner.findOne({ bannerId, isActive: true }).lean();
    if (!banner) {
      const err = new Error("Banner not found or inactive");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- FILTER ---------- */
    const filter = { status: "active" };

    /* ---------- CATEGORY ---------- */
    if (banner.filterBy === "category") {
      const category = await Category.findOne({ categoryId: banner.filterId })
        .select("_id")
        .lean();
      if (!category) {
        const err = new Error("Category not found");
        err.statusCode = 404;
        throw err;
      }
      filter.category = category._id;
    }

    /* ---------- BRAND ---------- */
    else if (banner.filterBy === "brand") {
      const brand = await Brand.findOne({ brandId: banner.filterId })
        .select("_id")
        .lean();
      if (!brand) {
        const err = new Error("Brand not found");
        err.statusCode = 404;
        throw err;
      }
      filter.brand = brand._id;
    }

    /* ---------- FETCH PRODUCTS ---------- */
    const [products, totalItems] = await Promise.all([
      Product.find(filter)
        .populate("category", "categoryId name")
        .populate("brand", "brandId brandName logoUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    const result = {
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        limit,
      },
      banner: {
        bannerId: banner.bannerId,
        filterBy: banner.filterBy,
        filterId: banner.filterId,
        displayOrder: banner.displayOrder,
        imageUrl: banner.imageUrl,
      },
      products,
    };

    /* ---------- STORE CACHE ---------- */
    await setCache(cacheKey, result);

    return result;
  } catch (error) {
    throw error;
  }
};