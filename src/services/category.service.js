import { v6 as uuidv6 } from "uuid";
import Category from "../models/manage/category.model.js";
import { uploadToS3, deleteFromS3 } from "./awsS3.service.js";
import { PermissionAudit}  from "../models/manage/permissionaudit.model.js";
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

    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData);
  } catch (error) {
    console.log(
      "REDIS GET CACHE ERROR:",
      error.message
    );

    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(
      key,
      JSON.stringify(data),
      {
        ex: CACHE_TTL,
      }
    );
  } catch (error) {
    console.log(
      "REDIS SET CACHE ERROR:",
      error.message
    );
  }
};

const clearCategoryCache = async () => {
  try {
    const keys = await redisClient.keys(
      "CATEGORY:*"
    );

    if (keys.length > 0) {
      await redisClient.del(...keys);

      console.log(
        "CATEGORY CACHE CLEARED:",
        keys
      );
    }
  } catch (error) {
    console.log(
      "REDIS CATEGORY CACHE CLEAR ERROR:",
      error.message
    );
  }
};

export const createCategoryService = async ({
  name,
  file,
  employee,
  permission
}) => {
  try {

    if (!name || !file) {
      const err = new Error("Category name and image are required");
      err.statusCode = 400;
      throw err;
    }

    const exist = await Category.findOne({ name });
    if (exist) {
      const err = new Error("Category already exists");
      err.statusCode = 409;
      throw err;
    }

    /* ---------- UPLOAD IMAGE ---------- */
    const uploadedImage = await uploadToS3(file, "category");

    /* ---------- CREATE CATEGORY ---------- */
    const category = await Category.create({
      categoryId: uuidv6(),
      name,
      image: uploadedImage.url,
    });
        /* ---------- CLEAR CACHE ---------- */
    await clearCategoryCache();

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: category._id,
      action: category.name,
      permission: permission,
      actionType: "Create",
    });
    /* ---------- NOTIFICATION ---------- */
await sendNotification({
  sender: employee._id,
  permission: "category.listing.read",
  title: "New Category Created",
  message: `${category.name} category has been created successfully`,
  type: "CATEGORY_CREATED",
  entityId: category._id,
  entityModel: "Category",
  metadata: {
    categoryId: category.categoryId,
    categoryName: category.name,
    image: category.image,
    createdBy: employee.email,
  },
});
    return category;
  } catch (error) {
    throw error;
  }
};

export const updateCategoryService = async ({
  categoryId,
  name,
  file,
  employee,
  permission
}) => {
  let newImageUpload;
  try {
    if (!categoryId) {
      const err = new Error("CategoryId is required");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- FIND CATEGORY ---------- */
    const category = await Category.findOne({ categoryId });

    if (!category) {
      const err = new Error("Category not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- DUPLICATE CHECK ---------- */
    if (name) {
      const duplicate = await Category.findOne({ name });

      if (duplicate && duplicate.categoryId !== categoryId) {
        const err = new Error("Category name already exists");
        err.statusCode = 409;
        throw err;
      }
    }

    /* ---------- UPDATE IMAGE ---------- */
    if (file) {
      if (category.image) {
        await deleteFromS3(category.image);
      }

      newImageUpload = await uploadToS3(file, "category");
      category.image = newImageUpload.url;
    }

    /* ---------- UPDATE NAME ---------- */
    category.name = name ?? category.name;

    await category.save();
  /* ---------- CLEAR CACHE ---------- */
    await clearCategoryCache();
    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: category._id,
      action: category.name,
      permission: permission || "update_category",
      actionType: "Update",
    });
/* ---------- NOTIFICATION ---------- */
    await sendNotification({
      sender: employee._id,
      permission:
        "category.listing.read",
      title: "Category Updated",
      message: `${category.name} category updated successfully`,
      type: "CATEGORY_UPDATED",
      entityId: category._id,
      entityModel: "Category",
      metadata: {
        categoryId:
          category.categoryId,
        categoryName:
          category.name,
        image:
          category.image,
        updatedBy:
          employee.email,
      },
    });
    return category;
  } catch (error) {

    /* ---------- ROLLBACK ---------- */
    if (newImageUpload?.url) {
      await deleteFromS3(newImageUpload.url);
    }

    throw error;
  }
};

export const deleteCategoryService = async ({
  categoryId,
  employee,
  permission
}) => {
  try {

    if (!categoryId) {
      const err = new Error("CategoryId is required");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- FIND CATEGORY ---------- */
    const category = await Category.findOne({ categoryId });

    if (!category) {
      const err = new Error("Category not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- DELETE IMAGE FROM S3 ---------- */
    if (category.image) {
      await deleteFromS3(category.image);
    }

    /* ---------- DELETE CATEGORY ---------- */
    await Category.deleteOne({ categoryId });
      /* ---------- CLEAR CACHE ---------- */
       await clearCategoryCache();
    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: category._id,
      action: category.name,
      permission: permission || "delete_category",
      actionType: "Delete",
    });
      /* ---------- NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,
      permission:
        "category.listing.read",
      title: "Category Deleted",
      message: `${category.name} category deleted successfully`,
      type: "CATEGORY_DELETED",
      entityId: category._id,
      entityModel: "Category",
      metadata: {
        categoryId:
          category.categoryId,
        categoryName:
          category.name,
        deletedBy:
          employee.email,
      },
    });
    return true;
  } catch (error) {
    throw error;
  }
};

export const getAllCategoriesService = async () => {
  try {
       /* ---------- CACHE KEY ---------- */

    const cacheKey = `CATEGORY:ALL`;

    /* ---------- CACHE CHECK ---------- */
    const cachedData =
      await getCache(cacheKey);
    if (cachedData) {
      console.log(
        "CATEGORY CACHE HIT:",
        cacheKey
      );
      return cachedData;
    }
    const categories = await Category.find()
      .sort({ name: 1 })
      .lean();
    const totalCategories = await Category.countDocuments();
     /* ---------- STORE CACHE ---------- */
    await setCache(
      cacheKey,
     categories,
    );
    return {
      categories,
    };
    

  } catch (error) {
    throw error;
  }
};