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
   CACHE HELPERS
========================================================= */

const clearBannerCache = async () => {
  try {
    const keys = await redisClient.keys("BANNER*");

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.log("REDIS CACHE CLEAR ERROR:", err.message);
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
    /* ---------- VALIDATION ---------- */
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

    if (isActive === true) {
      const exists = await Banner.findOne({
        displayOrder,
        isActive: true,
      });

      if (exists) {
        const err = new Error(
          `Active banner already exists at displayOrder ${displayOrder}`
        );

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
// Clear Banner CachE
      await clearBannerCache();

    /* ---------- AUDIT ---------- */

    await PermissionAudit.create({
      permissionAuditId: uuidv6(),

      actionBy: employee._id,
      actionByEmail: employee.email,

      actionFor: banner._id,

      action: `Banner Created | Banner:${banner.bannerId} | Filter:${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,

      permission: permission || "create_banner",

      actionType: "Create",
    });

    /* ---------- NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,
      permission: "banner.listing.read",
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

export const getAllBannersService = async ({
  page = 1,
  limit = 10,
}) => {
  try {

    page = Number(page);
    limit = Number(limit);

    const skip = (page - 1) * limit;

    const cacheKey = `BANNER:ALL:${page}:${limit}`;

    /* ---------- CACHE CHECK ---------- */

    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return cached;
    }

    /* ---------- FETCH ---------- */

    const [banners, totalItems] = await Promise.all([

      Banner.find({})
        .sort({ displayOrder: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

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
    await redisClient.set(
      cacheKey,
      result,
      {
        ex: 300,
      }
    );
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

    const skip = (page - 1) * limit;

    if (typeof isActive !== "boolean") {
      const err = new Error("isActive must be boolean");
      err.statusCode = 400;
      throw err;
    }

    const cacheKey = `BANNER:ACTIVE:${isActive}:${page}:${limit}`;

    /* ---------- CACHE ---------- */

    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return cached;
    }

    const filter = { isActive };

    /* ---------- FETCH ---------- */

    const [banners, totalItems] = await Promise.all([

      Banner.find(filter)
        .sort({ displayOrder: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

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
    await redisClient.set(
      cacheKey,
      result,
      {
        ex: 300,
      }
    );
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

    /* ---------- ACTIVE CHECK ---------- */

    const shouldBeActive =
      typeof isActive === "boolean"
        ? isActive
        : banner.isActive;

    /* ---------- DISPLAY ORDER CHECK ---------- */

    if (
      displayOrder !== undefined &&
      shouldBeActive
    ) {
      const conflict = await Banner.findOne({
        bannerId: { $ne: bannerId },

        displayOrder,

        isActive: true,
      });

      if (conflict) {
        const err = new Error(
          `displayOrder ${displayOrder} already used`
        );

        err.statusCode = 409;

        throw err;
      }
    }

    /* ---------- IMAGE UPDATE ---------- */

    if (file) {
      const oldImage = banner.imageUrl;

      newImageUpload = await uploadToS3(
        file,
        "banners"
      );

      banner.imageUrl = newImageUpload.url;

      await banner.save();

      if (oldImage) {
        await deleteFromS3(oldImage);
      }
    }

    /* ---------- UPDATE FIELDS ---------- */

    if (filterBy) {
      banner.filterBy = filterBy;
    }

    if (filterId) {
      banner.filterId = filterId;
    }

    if (displayOrder !== undefined) {
      banner.displayOrder = displayOrder;
    }

    if (typeof isActive === "boolean") {
      banner.isActive = isActive;
    }

    await banner.save();
    
    /* ---------- CLEAR CACHE ---------- */

    await clearBannerCache();

    /* ---------- AUDIT ---------- */

    await PermissionAudit.create({
      permissionAuditId: uuidv6(),

      actionBy: employee._id,
      actionByEmail: employee.email,

      actionFor: banner._id,

      action: `Banner Updated | Banner:${banner.bannerId} | Filter:${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,

      permission: permission || "update_banner",

      actionType: "Update",
    });

    /* ---------- NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,

      permission: "banner.listing.read",

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

export const updateBannerDisplayOrderService =
  async ({
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
        const err = new Error(
          "displayOrder must be >= 1"
        );

        err.statusCode = 400;

        throw err;
      }

      /* ---------- FIND ---------- */

      const banner = await Banner.findOne({
        bannerId,
      });

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
          const err = new Error(
            `displayOrder ${displayOrder} already exists`
          );

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

      await PermissionAudit.create({
        permissionAuditId: uuidv6(),

        actionBy: employee._id,
        actionByEmail: employee.email,

        actionFor: banner._id,

        action: `Banner Display Order Updated | Banner:${banner.bannerId} | Order:${banner.displayOrder}`,

        permission: permission || "update_banner",

        actionType: "Update",
      });

      /* ---------- NOTIFICATION ---------- */

      await sendNotification({
        sender: employee._id,

        permission: "banner.listing.read",

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

      return banner;
    } catch (error) {
      throw error;
    }
  };

/* =========================================================
   DELETE BANNER
========================================================= */

export const deleteBannerService = async ({
  bannerId,
  employee,
  permission,
}) => {
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

    /* ---------- DELETE IMAGE ---------- */

    if (banner.imageUrl) {
      await deleteFromS3(banner.imageUrl);
    }

    /* ---------- DELETE ---------- */

    await Banner.findByIdAndDelete(banner._id);

    /* ---------- AUDIT ---------- */

    await PermissionAudit.create({
      permissionAuditId: uuidv6(),

      actionBy: employee._id,
      actionByEmail: employee.email,

      actionFor: banner._id,

      action: `Banner Deleted | Banner:${banner.bannerId} | Filter:${banner.filterBy}:${banner.filterId}`,

      permission: permission || "delete_banner",

      actionType: "Delete",
    });

    /* ---------- NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,

      permission: "banner.listing.read",

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

    /* ---------- CLEAR CACHE ---------- */
    await clearBannerCache();
    return true;
  } catch (error) {
    throw error;
  }
};


export const getProductsByBannerService = async ({
  bannerId,
  page = 1,
  limit = 10,
}) => {
  try {

    /* =====================================================
       VALIDATION
    ===================================================== */

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

    /* =====================================================
       CACHE KEY
    ===================================================== */

    const cacheKey = `BANNER:${bannerId}:${page}:${limit}`;

    /* =====================================================
       CACHE CHECK
    ===================================================== */

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    /* =====================================================
       FIND BANNER
    ===================================================== */

    const banner = await Banner.findOne({
      bannerId,
      isActive: true,
    }).lean();

    if (!banner) {
      const err = new Error("Banner not found or inactive");
      err.statusCode = 404;
      throw err;
    }

    /* =====================================================
       FILTER
    ===================================================== */

    const filter = {
      status: "active",
    };

    /* CATEGORY */

    if (banner.filterBy === "category") {

      const category = await Category.findOne({
        categoryId: banner.filterId,
      })
      .select("_id")
      .lean();

      if (!category) {
        const err = new Error("Category not found");
        err.statusCode = 404;
        throw err;
      }

      filter.category = category._id;
    }

    /* BRAND */

    else if (banner.filterBy === "brand") {

      const brand = await Brand.findOne({
        brandId: banner.filterId,
      })
      .select("_id")
      .lean();

      if (!brand) {
        const err = new Error("Brand not found");
        err.statusCode = 404;
        throw err;
      }

      filter.brand = brand._id;
    }

    /* =====================================================
       FETCH PRODUCTS
    ===================================================== */

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

    /* =====================================================
       RESPONSE
    ===================================================== */

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

    /* =====================================================
       STORE CACHE
    ===================================================== */
    await redisClient.set(
      cacheKey,
      result,
      {
        ex: 300,
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
};