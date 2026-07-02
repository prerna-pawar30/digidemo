import Permission from "../models/manage/permission.model.js";
import Employee from "../models/manage/employee.model.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { v6 as uuidv6 } from "uuid";
import { getPagination } from "../helpers/pagination.helper.js";
import { sendNotification } from "./notification.service.js"; // ← ADD THIS

/* =========================================================
   CREATE PERMISSION
========================================================= */
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

  /* ---------- AUTO ASSIGN TO SUPER ADMIN & ADMIN ---------- */
await Employee.updateMany(
  { role: { $in: [0, 1] } },
  { $addToSet: { permissions: name } }
);


  /* ---------- AUDIT LOG ---------- */
  const audit = await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,
    permission: permission.name,
    action: "create",
  });

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: admin._id,
      permission: "system.permission.create",
      title: "Permission Created",
      message: `Permission "${permission.name}" was created by ${admin.email}`,
      type: "PERMISSION_CREATED",
      entityId: permission._id,
      entityModel: "Permission",
      metadata: {
        permissionId: permission.permissionId,
        permissionName: permission.name,
        createdBy: admin.email,
        auditId: audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on permission create:", err.message);
  }

  return permission;
};

/* =========================================================
   GET ALL PERMISSIONS
========================================================= */
export const getAllPermissionsService = async ({ page, limit }) => {
  const [permissions, totalItems] = await Promise.all([
    Permission.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Permission.countDocuments(),
  ]);

  if (!permissions.length) {
    const err = new Error("No permissions found");
    err.statusCode = 404;
    throw err;
  }

  const totalPages = Math.ceil(totalItems / limit);

  return {
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
    count: permissions.length,
    permissions,
  };
};

/* =========================================================
   DELETE PERMISSION
========================================================= */
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
  const audit = await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,
    permission: permission.name,
    action: action || "delete",
  });

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: admin._id,
      permission: "system.permission.delete",
      title: "Permission Deleted",
      message: `Permission "${permission.name}" was deleted by ${admin.email}`,
      type: "PERMISSION_DELETED",
      entityId: permission._id,
      entityModel: "Permission",
      metadata: {
        permissionId: permission.permissionId,
        permissionName: permission.name,
        deletedBy: admin.email,
        action: action || "delete",
        auditId: audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on permission delete:", err.message);
  }

  return permission;
};

/* =========================================================
   ASSIGN PERMISSION TO EMPLOYEE
========================================================= */
export const assignPermissionToEmployeeService = async (data, currentUser) => {
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
    permission,
    action: "assign",
  });
  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: admin._id,
      permission: "system.permission.assign",
      title: "Permission Assigned",
      message: `Permission "${permission.name}" was assigned to ${target.email} by ${admin.email}`,
      type: "PERMISSION_ASSIGNED",
      entityId: target._id,
      entityModel: "Employee",
      metadata: {
        permissionId: permission.permissionId,
        permissionName: permission.name,
        createdBy: admin.email,
        auditId: audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on permission assign:", err.message);
  }

  return { email, permission };
};

/* =========================================================
   REMOVE PERMISSION FROM EMPLOYEE
========================================================= */
export const removePermissionFromEmployeeService = async (data, currentUser) => {
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
    permission,
    action: "revoke",
  });
  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: admin._id,
      permission: "system.permission.revoke",
      title: "Permission Revoked",
      message: `Permission "${permission.name}" was revoked from ${target.email} by ${admin.email}`,
      type: "PERMISSION_REVOKED",
      entityId: target._id,
      entityModel: "Employee",
      metadata: {
        permissionId: permission.permissionId,
        permissionName: permission.name,
        createdBy: admin.email,
        auditId: audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on permission revoke:", err.message);
  }

  return { email, permission };
};

/* =========================================================
   GET PERMISSION AUDIT LOGS
========================================================= */
export const getPermissionAuditLogsService = async ({ page, limit }) => {
  const skip = (page - 1) * limit;
  const totalItems = await PermissionAudit.countDocuments();

  const logs = await PermissionAudit.find()
    .populate("actionBy", "email firstName lastName name")
    .populate("actionFor", "email firstName lastName name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalPages = Math.ceil(totalItems / limit);

  const pagination = {
    totalItems,
    totalPages,
    currentPage: page,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
    limit,
  };

  return { logs, pagination };
};

/* =========================================================
   DELETE ALL PERMISSIONS
========================================================= */
export const deleteAllPermissionsService = async (currentUser) => {
  /* ---------- AUTH CHECK ---------- */
  const admin = await Employee.findOne({ email: currentUser.email });
  if (!admin) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  /* ---------- COUNT BEFORE DELETE ---------- */
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

  return { deletedPermissions: totalPermissions };
};