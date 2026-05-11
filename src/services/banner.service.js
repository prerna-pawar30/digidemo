import { v6 as uuidv6 } from "uuid";
import Banner from "../models/manage/banner.model.js";
import { deleteFromS3, uploadToS3 } from "./awsS3.service.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import Category from "../models/manage/category.model.js";
import Brand from "../models/manage/brand.model.js";
import Product from "../models/manage/product.model.js";

export const createBannerService = async ({
  filterBy,
  filterId,
  isActive = true,
  displayOrder,
  file,
  employee,
  permission
}) => {
  let imageUpload;
  try {
    if (!file) {
      const err = new Error("Banner image is required");
      err.statusCode = 400;
      throw err;
    }
    /* ---------- DISPLAY ORDER CHECK ---------- */
    if (isActive === true || isActive === "true") {
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

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: banner._id,
      action: `Banner-${banner.bannerId} | ${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,
      permission: permission || "create_banner",
      actionType: "Create",
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

export const getProductsByBannerService = async ({
  bannerId,
  page,
  limit,
  skip
}) => {
  try {
    if (!bannerId) {
      const err = new Error("BannerId is required");
      err.statusCode = 400;
      throw err;
    }
    /* ---------- FIND BANNER ---------- */
    const banner = await Banner.findOne({
      bannerId,
      isActive: true,
    });

    if (!banner) {
      const err = new Error("Banner not found or inactive");
      err.statusCode = 404;
      throw err;
    }

    let filter = { status: "active" };

    /* ---------- CATEGORY FILTER ---------- */
    if (banner.filterBy === "category") {
      const category = await Category.findOne({
        categoryId: banner.filterId,
      });

      if (!category) {
        const err = new Error("Category not found");
        err.statusCode = 404;
        throw err;
      }

      filter.category = category._id;
    }

    /* ---------- BRAND FILTER ---------- */
    if (banner.filterBy === "brand") {
      const brand = await Brand.findOne({
        brandId: banner.filterId,
      });

      if (!brand) {
        const err = new Error("Brand not found");
        err.statusCode = 404;
        throw err;
      }

      filter.brand = brand._id;
    }

    /* ---------- FETCH PRODUCTS ---------- */
    const products = await Product.find(filter)
      .populate("category", "categoryId name")
      .populate("brand", "brandId brandName logoUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await Product.countDocuments(filter);

    return {
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        limit,
      },
    };

  } catch (error) {
    throw error;
  }
};

export const getAllBannersService = async ({ page, limit, skip }) => {
  try {
    const banners = await Banner.find({})
      .sort({ displayOrder: 1 }) // better than createdAt for banners
      .skip(skip)
      .limit(limit)
      .lean();

    const totalBanners = await Banner.countDocuments({ isActive: true });

    return {
      banners,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBanners / limit),
        totalBanners,
        limit,
      },
    };

  } catch (error) {
    throw error;
  }
};

export const updateBannerService = async ({
  bannerId,
  filterBy,
  filterId,
  isActive,
  displayOrder,
  file,
  employee,
  permission
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
    const shouldBeActive = isActive ? isActive : banner.isActive;
 

    if (displayOrder && shouldBeActive) {
      const conflict = await Banner.findOne({
        bannerId: { $ne: bannerId },
        displayOrder,
        isActive: true,
      });

      if (conflict) {
        const err = new Error(
          `displayOrder ${displayOrder} already used by another active banner`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    /* ---------- IMAGE UPDATE ---------- */
    if (file) {
      if (banner.imageUrl) {
        await deleteFromS3(banner.imageUrl);
      }

      newImageUpload = await uploadToS3(file, "banners");
      banner.imageUrl = newImageUpload.url;
    }

    /* ---------- UPDATE FIELDS ---------- */
    if (filterBy) banner.filterBy = filterBy;
    if (filterId) banner.filterId = filterId;
    if (displayOrder) banner.displayOrder = displayOrder;
    if (isActive) banner.isActive = isActive;

    await banner.save();  

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: banner._id,
      action: `Banner-${banner.bannerId} | ${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,
      permission: permission || "update_banner",
      actionType: "Update",
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

export const updateBannerDisplayOrderService = async ({
  bannerId,
  displayOrder,
  employee,
  permission
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

    /* ---------- FIND BANNER ---------- */
    const banner = await Banner.findOne({ bannerId });

    if (!banner) {
      const err = new Error("Banner not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- CONFLICT CHECK ---------- */
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

    /* ---------- UPDATE ORDER ---------- */
    banner.displayOrder = displayOrder;
    await banner.save();

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: banner._id,
      action: `Banner-${banner.bannerId} | ${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,
      permission: permission || "update_banner",
      actionType: "Update",
    });

    return banner;

  } catch (error) {
    throw error;
  }
};

export const deleteBannerService = async ({
  bannerId,
  employee,
  permission
}) => {
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

    /* ---------- DELETE IMAGE FROM S3 ---------- */
    if (banner.imageUrl) {
      await deleteFromS3(banner.imageUrl);
    }

    /* ---------- DELETE BANNER ---------- */
    await Banner.deleteOne({ bannerId });

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: banner._id,
      action: `Banner-${banner.bannerId} | ${banner.filterBy}:${banner.filterId} | Order:${banner.displayOrder}`,
      permission: permission || "delete_banner",
      actionType: "Delete",
    });

    return true;

  } catch (error) {
    throw error;
  }
};

export const getBannersByIsActiveService = async ({
  isActive,
  page,
  limit,
  skip
}) => {
  try {

    if (typeof isActive !== "boolean") {
      const err = new Error("isActive must be boolean");
      err.statusCode = 400;
      throw err;
    }

    const filter = { isActive };

    const banners = await Banner.find(filter)
      .sort({ displayOrder: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalBanners = await Banner.countDocuments(filter);

    return {
      banners,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBanners / limit),
        totalBanners,
        limit,
      },
    };

  } catch (error) {
    throw error;
  }
};