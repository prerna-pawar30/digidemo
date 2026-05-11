import Brand from "../models/manage/brand.model.js";
import { v6 as uuidv6 } from "uuid";
import { uploadToS3, deleteFromS3 } from "./awsS3.service.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
const ALLOWED_CATEGORIES = ["Abutment-Level", "General", "Screw-Retained"];

export const createBrandService = async ({
  brandName,
  categories,
  files,
  logoFile,
  employee,
  permission
}) => {
  let logoUpload;
  const fileUploads = [];
  try {
    if(!brandName){
      const err = new Error("Brand brandName is required");
      err.statusCode = 400;
      err.errorCode = "VALIDATION_ERROR";
      throw err;
    }
    if(!logoFile){
      const err = new Error("Logo is required");
      err.statusCode = 400;
      err.errorCode = "VALIDATION_ERROR";
      throw err;
    }
    const existingBrand = await Brand.findOne({ brandName });
    if (existingBrand) {
      const err = new Error("Brand already exists");
      err.statusCode = 409;
      err.errorCode = "BRAND_ALREADY_EXISTS";
      throw err;
    }
    /* ---------- UPLOAD LOGO ---------- */
    logoUpload = await uploadToS3(logoFile, "brands");
    const hasFiles = files && files.length > 0;
    if(!hasFiles && categories){
      const err = new Error("Category not allowed without files");
      err.statusCode = 400;
      err.errorCode = "VALIDATION_ERROR";
      throw err;
    }
    /* ---------- FILE PROCESS ---------- */
    if (hasFiles) {
      if (!categories) {
        const err = new Error("Categories required when uploading files");
        err.statusCode = 400;
        err.errorCode = "VALIDATION_ERROR";
        throw err;
      }
      const categoriesArray = Array.isArray(categories)
        ? categories
        : [categories];
      if (categoriesArray.length !== files.length) {
        const err = new Error("Each file must have a corresponding category");
        err.statusCode = 400;
        err.errorCode = "VALIDATION_ERROR";
        throw err;
      }
      for (const cat of categoriesArray) {
        if (!ALLOWED_CATEGORIES.includes(cat)) {
          const err = new Error(`Invalid category: ${cat}`);
          err.statusCode = 400;
          err.errorCode = "INVALID_CATEGORY";
          throw err;
        }
      }
      for (let i = 0; i < files.length; i++) {
        const upload = await uploadToS3(files[i], "brands/file");
        fileUploads.push({
          fileId: uuidv6(),
          category: categoriesArray[i],
          fileLink: upload.url,
        });
      }
    }
    /* ---------- SAVE BRAND ---------- */
    const brand = await Brand.create({
      brandId: uuidv6(),
      brandName,
      logoUrl: logoUpload.url,
      files: fileUploads,
    });
    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: brand._id,
      action: brand.brandName,
      permission: permission || "create_brand",
      actionType: "Create",
    });
    return brand;
  } catch (error) {
    /* ---------- ROLLBACK ---------- */
    if (logoUpload?.url) await deleteFromS3(logoUpload.url);
    for (const f of fileUploads) {
      await deleteFromS3(f.fileLink);
    }
    throw error;
  }
};

export const updateBrandService = async ({
  brandId,
  brandName,
  categories,
  removeFileIds,
  files,
  logoFile,
  employee,
  permission
}) => {

  let newLogoUpload;
  const newFileUploads = [];

  try {
    /* ---------- FIND BRAND ---------- */
    const brand = await Brand.findOne({ brandId });
    if (!brand) {
      const err = new Error("Brand not found");
      err.statusCode = 404;
      throw err;
    }
    /* ---------- DUPLICATE brandName CHECK ---------- */
    if (brandName && brandName !== brand.brandName) {
      const exist = await Brand.findOne({ brandName });
      if (exist) {
        const err = new Error("Brand brandName already exists");
        err.statusCode = 409;
        throw err;
      }
      brand.brandName = brandName;
    }

    /* ---------- UPDATE LOGO ---------- */
    if (logoFile) {
      if (brand.logoUrl) await deleteFromS3(brand.logoUrl);
      newLogoUpload = await uploadToS3(logoFile, "brands");
      brand.logoUrl = newLogoUpload.url;
    }

    /* ---------- REMOVE FILES ---------- */
    if (removeFileIds) {
      const ids = Array.isArray(removeFileIds)
        ? removeFileIds
        : [removeFileIds];

      const remainingFiles = [];

      for (const file of brand.files || []) {
        if (ids.includes(file.fileId)) {
          await deleteFromS3(file.fileLink);
        } else {
          remainingFiles.push(file);
        }
      }

      brand.files = remainingFiles;
    }

    /* ---------- ADD NEW FILES ---------- */
    if (files && files.length > 0) {

      if (!categories) {
        const err = new Error("Category is required when uploading files");
        err.statusCode = 400;
        throw err;
      }

      const categoriesArray = Array.isArray(categories)
        ? categories
        : [categories];

      if (categoriesArray.length !== files.length) {
        const err = new Error("Each file must have a corresponding category");
        err.statusCode = 400;
        throw err;
      }

      for (const cat of categoriesArray) {
        if (!ALLOWED_CATEGORIES.includes(cat)) {
          const err = new Error(`Invalid category: ${cat}`);
          err.statusCode = 400;
          throw err;
        }
      }

      for (let i = 0; i < files.length; i++) {
        const upload = await uploadToS3(files[i], "brands/file");

        newFileUploads.push({
          fileId: uuidv6(),
          category: categoriesArray[i],
          fileLink: upload.url,
        });
      }

      brand.files = brand.files || [];
      brand.files.push(...newFileUploads);
    }

    /* ---------- SAVE ---------- */
    await brand.save();

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: brand._id,
      action: brand.brandName,
      permission: permission || "update_brand",
      actionType: "Update",
    });

    return brand;

  } catch (error) {

    /* ---------- ROLLBACK ---------- */
    if (newLogoUpload?.url) await deleteFromS3(newLogoUpload.url);

    for (const f of newFileUploads) {
      await deleteFromS3(f.fileLink);
    }

    throw error;
  }
};


export const getAllBrandsService = async ({ page, limit, skip }) => {
  try {

    const brands = await Brand.find()
      .sort({ brandName: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalBrands = await Brand.countDocuments();

    return {
      brands,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBrands / limit),
        totalBrands,
        limit,
      },
    };

  } catch (error) {
    throw error;
  }
};

export const getBrandByIdService = async (brandId) => {
  try {

    if (!brandId) {
      const err = new Error("BrandId is required");
      err.statusCode = 400;
      err.errorCode = "VALIDATION_ERROR";
      throw err;
    }

    const brand = await Brand.findOne({ brandId }).lean();

    if (!brand) {
      const err = new Error("Brand not found");
      err.statusCode = 404;
      err.errorCode = "BRAND_NOT_FOUND";
      throw err;
    }

    return brand;

  } catch (error) {
    throw error;
  }
};

export const deleteBrandService = async ({ brandId, employee, permission }) => {
  try {

    if (!brandId) {
      const err = new Error("BrandId is required");
      err.statusCode = 400;
      throw err;
    }

    /* ---------- PERMISSION CHECK ---------- */
    if (permission && permission !== "delete_brand") {
      const err = new Error("Unauthorized permission");
      err.statusCode = 403;
      throw err;
    }

    /* ---------- FIND BRAND ---------- */
    const brand = await Brand.findOne({ brandId });

    if (!brand) {
      const err = new Error("Brand not found");
      err.statusCode = 404;
      throw err;
    }

    /* ---------- DELETE LOGO ---------- */
    if (brand.logoUrl) {
      await deleteFromS3(brand.logoUrl);
    }

    /* ---------- DELETE FILES ---------- */
    if (brand.files?.length > 0) {
      for (const file of brand.files) {
        if (file.fileLink) {
          await deleteFromS3(file.fileLink);
        }
      }
    }

    /* ---------- DELETE BRAND ---------- */
    await Brand.deleteOne({ brandId });

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: brand._id,
      action: brand.brandName,
      permission: permission || "delete_brand",
      actionType: "Delete",
    });

    return true;

  } catch (error) {
    throw error;
  }
};

export const deleteAllBrandsService = async ({ employee, permission }) => {
  try {

    /* ---------- PERMISSION CHECK ---------- */
    if (permission && permission !== "delete_brand") {
      const err = new Error("Unauthorized permission");
      err.statusCode = 403;
      throw err;
    }

    const brands = await Brand.find({});

    /* ---------- DELETE FROM S3 ---------- */
    for (const brand of brands) {

      // Delete logo
      if (brand.logoUrl) {
        await deleteFromS3(brand.logoUrl);
      }

      // Delete multiple files (FIXED: brand.files instead of brand.file)
      if (brand.files && brand.files.length > 0) {
        for (const file of brand.files) {
          if (file.fileLink) {
            await deleteFromS3(file.fileLink);
          }
        }
      }
    }

    /* ---------- DELETE ALL FROM DB ---------- */
    const result = await Brand.deleteMany({});

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: null,
      action: "All Brands",
      permission: permission || "delete_brand",
      actionType: "Delete",
    });

    return {
      deletedCount: result.deletedCount
    };

  } catch (error) {
    throw error;
  }
};