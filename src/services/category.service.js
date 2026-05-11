import { v6 as uuidv6 } from "uuid";
import Category from "../models/manage/category.model.js";
import { uploadToS3, deleteFromS3 } from "./awsS3.service.js";
import { PermissionAudit}  from "../models/manage/permissionaudit.model.js";

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

    return true;

  } catch (error) {
    throw error;
  }
};

export const getAllCategoriesService = async ({ page, limit, skip }) => {
  try {

    const categories = await Category.find()
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCategories = await Category.countDocuments();

    return {
      categories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCategories / limit),
        totalCategories,
        limit,
      },
    };

  } catch (error) {
    throw error;
  }
};