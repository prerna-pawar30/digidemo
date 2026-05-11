import Permission from "../models/manage/permission.model.js";
import Employee from "../models/manage/employee.model.js";
import {PermissionAudit} from "../models/manage/permissionaudit.model.js";
import { v6 as uuidv6 } from "uuid";
import { getPagination } from "../helpers/pagination.helper.js";


export const createPermissionService = async (data, currentUser) => {
  const { name } = data;

  /* ---------- AUTH CHECK ---------- */
  const admin = await Employee.findOne({ email: currentUser.email });

  if (!admin) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  /* ---------- DUPLICATE CHECK ---------- */
  const exists = await Permission.findOne({ name });

  if (exists) {
    const err = new Error("Permission already exists");
    err.statusCode = 409;
    throw err;
  }

  /* ---------- CREATE PERMISSION ---------- */
  const permission = await Permission.create({
    name,
    permissionId: uuidv6(),
    createdBy: admin._id,
  });

  /* ---------- AUTO ASSIGN TO SUPER ADMIN ---------- */
  await Employee.updateMany(
    { role: "0" },
    { $addToSet: { permissions: name } }
  );

  /* ---------- AUDIT LOG ---------- */
  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,
    permission: permission.name,
    action: "create",
  });

  return permission;
};

export const getAllPermissionsService = async ({ page, limit }) => {
  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  if (pageNumber < 1 || limitNumber < 1) {
    const err = new Error("Page and limit must be positive numbers");
    err.statusCode = 400;
    throw err;
  }

  const skip = (pageNumber - 1) * limitNumber;

  const [permissions, total] = await Promise.all([
    Permission.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    Permission.countDocuments(),
  ]);

  if (!permissions.length) {
    const err = new Error("No permissions found");
    err.statusCode = 404;
    throw err;
  }

  const pagination = getPagination({
    total,
    page: pageNumber,
    limit: limitNumber,
  });

  return {
    pagination,
    count: permissions.length,
    permissions,
  };
};

export const deletePermissionService = async (
  permissionId,
  currentUser,
  action
) => {
  /* ---------- AUTH CHECK ---------- */
  const admin = await Employee.findOne({ email: currentUser.email });

  if (!admin) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  /* ---------- FIND PERMISSION ---------- */
  const permission = await Permission.findOne({ permissionId });

  if (!permission) {
    const err = new Error("Permission not found");
    err.statusCode = 404;
    throw err;
  }

  /* ---------- DELETE PERMISSION ---------- */
  await Permission.deleteOne({ permissionId });

  /* ---------- REMOVE FROM ALL EMPLOYEES ---------- */
  await Employee.updateMany(
    { permissions: permission.name },
    { $pull: { permissions: permission.name } }
  );

  /* ---------- AUDIT LOG ---------- */
  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,
    permission: permission.name,
    action: action || "delete",
  });

  return permission;
};

export const assignPermissionToEmployeeService = async (
  data,
  currentUser
) => {
  const { email, permission } = data;

  /* ---------- AUTH CHECK ---------- */
  const admin = await Employee.findOne({ email: currentUser.email });

  if (!admin) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  /* ---------- TARGET EMPLOYEE ---------- */
  const target = await Employee.findOne({ email });

  if (!target) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    throw err;
  }

  /* ---------- PERMISSION CHECK ---------- */
  const permExists = await Permission.findOne({ name: permission });

  if (!permExists) {
    const err = new Error("Permission not found");
    err.statusCode = 400;
    throw err;
  }

  /* ---------- DUPLICATE CHECK ---------- */
  if (target.permissions.includes(permission)) {
    const err = new Error("Permission already assigned");
    err.statusCode = 409;
    throw err;
  }

  /* ---------- ASSIGN PERMISSION ---------- */
  await Employee.updateOne(
    { email },
    { $addToSet: { permissions: permission } }
  );

  /* ---------- AUDIT LOG ---------- */
  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,

    actionFor: target._id,
    actionForEmail: target.email,

    permission: permission,
    action: "assign",
  });

  return {
    email,
    permission,
  };
};

export const removePermissionFromEmployeeService = async (
  data,
  currentUser
) => {
  const { email, permission } = data;

  /* ---------- AUTH CHECK ---------- */
  const admin = await Employee.findOne({ email: currentUser.email });

  if (!admin) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  /* ---------- TARGET EMPLOYEE ---------- */
  const target = await Employee.findOne({ email });

  if (!target) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    throw err;
  }

  /* ---------- CHECK PERMISSION EXISTS ON USER ---------- */
  if (!target.permissions.includes(permission)) {
    const err = new Error("Permission not assigned");
    err.statusCode = 400;
    throw err;
  }

  /* ---------- REMOVE PERMISSION ---------- */
  await Employee.updateOne(
    { email },
    { $pull: { permissions: permission } }
  );

  /* ---------- AUDIT LOG ---------- */
  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,

    actionFor: target._id,
    actionForEmail: target.email,

    permission: permission,
    action: "revoke",
  });

  return {
    email,
    permission,
  };
};


export const getPermissionAuditLogsService = async ({ page, limit }) => {
  const skip = (page - 1) * limit;

  /* ---------- TOTAL COUNT ---------- */
  const totalItems = await PermissionAudit.countDocuments();

  /* ---------- FETCH LOGS ---------- */
  const logs = await PermissionAudit.find()
    .populate("actionBy", "email firstName lastName name")
    .populate("actionFor", "email firstName lastName name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  /* ---------- PAGINATION META ---------- */
  const pagination = {
    totalItems,
    currentPage: page,
    limit,
  };

  return {
    logs,
    pagination,
  };
};

export const deleteAllPermissionsService = async (currentUser) => {
  /* ---------- AUTH CHECK ---------- */
  const admin = await Employee.findOne({ email: currentUser.email });

  if (!admin) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  /* ---------- COUNT BEFORE DELETE (for response clarity) ---------- */
  const totalPermissions = await Permission.countDocuments();

  /* ---------- DELETE ALL PERMISSIONS ---------- */
  await Permission.deleteMany({});

  /* ---------- REMOVE FROM ALL EMPLOYEES ---------- */
  await Employee.updateMany({}, { $set: { permissions: [] } });

  /* ---------- AUDIT LOG ---------- */
  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,
    permission: "ALL",
    action: "delete_all",
  });

  return {
    deletedPermissions: totalPermissions,
  };
};