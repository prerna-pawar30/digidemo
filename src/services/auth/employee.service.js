import { v6 as uuidv6 } from "uuid";
import Employee from "../../models/manage/employee.model.js";
import {PermissionAudit} from "../../models/manage/permissionaudit.model.js";
import { sendZohoMail } from "../ZohoEmail/zohoMail.service.js";
import { employeeWelcomeEmail } from "../../config/templates/employeeWelcomeEmail.js";
import bcrypt from "bcrypt";
import { generateTokens } from "../../helpers/token.helper.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { resetPasswordTemplate } from "../../config/templates/resetPasswordTemplate.js";

export const createEmployeeService = async (data, adminEmail) => {
  const {
    firstName,
    lastName,
    email,
    password,
    personalEmail,
    role,
    permission
  } = data;

  /* Check existing employee */

  const existingEmployee = await Employee.findOne({ email });
  if (existingEmployee) {
    throw new Error("EMPLOYEE_ALREADY_EXISTS");
  }
  /* Check admin */
  const admin = await Employee.findOne({
    email: adminEmail,
  });

  if (!admin) {
    throw new Error("UNAUTHORIZED_ADMIN");
  }

  /* Create employee */

  const newEmployee = await Employee.create({
    employeeId: uuidv6(),
    firstName,
    lastName,
    email,
    password,
    personalEmail,
    role,
    createdBy:" dharmik@digident.in",
    createdBy: adminEmail,
    isNewEmployee: true,
  });

  /* Send welcome email */

  const htmlBody = employeeWelcomeEmail(firstName, email, password);

  await sendZohoMail(
    personalEmail,
    "Login to your Company Account",
    htmlBody
  );

  /* Permission audit */

  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,
    actionFor: newEmployee._id,
    action: newEmployee.email,
    permission: permission || "create_employee",
    actionType: "Create",
  });
  return newEmployee;
};

export const loginEmployeeService = async (email, password) => {
  const employee = await Employee
    .findOne({ email, isDeleted: false })
    .select("+password");
  if (!employee) {
    throw new Error("USER_NOT_FOUND");
  }
  const isMatch = await bcrypt.compare(password, employee.password);
  if (!isMatch) {
    throw new Error("INVALID_CREDENTIALS");
  }
  const { accessToken, refreshToken } = generateTokens(employee);
  return {
    employee,
    accessToken,
    refreshToken
  };
};

export const changeEmployeePasswordService = async (email, password) => {
  const employee = await Employee.findOne({
    email,
    isDeleted: false
  });
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }
  /* Update password */
  employee.password = password; // hashed in pre-save middleware
  employee.isNewEmployee = false;
  await employee.save();
  return employee;
};

export const verifyEmailService = async (token) => {
  const employee = await Employee.findOne({
    "emailVerificationToken.token": token,
    "emailVerificationToken.expiresAt": { $gt: Date.now() },
    isDeleted: false
  });
  if (!employee) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }
  employee.emailVerified = true;
  employee.emailVerificationToken = undefined;
  await employee.save();
  return employee;
};

export const resetEmployeePasswordService = async (token, newPassword) => {
  const employee = await Employee.findOne({
    resetPasswordToken: token,
    resetPasswordExpiresAt: { $gt: Date.now() },
    isDeleted: false
  });
  if (!employee) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }
  employee.password = newPassword; 
  employee.resetPasswordToken = null;
  employee.resetPasswordExpiresAt = null;
  employee.isNewEmployee = false;
  await employee.save();
  return employee;
};

export const forgotEmployeePasswordService = async (email) => {
  const employee = await Employee.findOne({
    email,
    isDeleted: false
  });
  if (!employee) {
    return;
  }
  const resetToken = crypto.randomBytes(32).toString("hex");
  employee.resetPasswordToken = resetToken;
  employee.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await employee.save();
  const resetURL = `https://manage.digident.in/reset-password/${resetToken}`;
  await sendZohoMail(
    employee.email,
    "Reset Your Password",
    resetPasswordTemplate(resetURL, employee.firstName)
  );

};

export const getEmployeeService = async (email) => {
  if (email) {
    const employee = await Employee
      .findOne({ email, isDeleted: false })
      .select("-password")
      .lean();
    return employee;
  }
  const employees = await Employee
    .find({ isDeleted: false })
    .select("-password")
    .lean();
  return employees;

};

export const deleteEmployeeService = async (
  employeeId,
  adminEmail,
  permission
) => {
  const employee = await Employee.findOne({
    employeeId,
    isDeleted: false
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }
  const admin = await Employee.findOne({
    email: adminEmail,
    isDeleted: false
  });

  if (!admin) {
    throw new Error("UNAUTHORIZED_ACTION");
  }
  employee.isDeleted = true;
  employee.deletedAt = new Date();
  await employee.save();
  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,

    actionFor: employee._id,
    action: employee.email,

    permission: permission?.toLowerCase() || "delete_employee",
    actionType: "Delete"
  });
  return {
    employeeId: employee.employeeId
  };
};

export const updateEmployeeRoleService = async (
  employeeEmail,
  role,
  adminEmail,
  permission
) => {
console.log("Updating role for:", employeeEmail, "to role:", role, "by admin:", adminEmail);
  /* Find admin */

  const admin = await Employee.findOne({
    email: adminEmail,
    isDeleted: false
  });
console.log("Admin found:", admin);
  if (!admin) {
    throw new Error("UNAUTHORIZED_ACTION");
  }

  /* Find employee */

  const employee = await Employee.findOne({
    email: employeeEmail,
    isDeleted: false
  });
console.log("Employee found:", employee);

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  /* Update role */

  employee.role = role;

  await employee.save();

  /* Save permission audit */

  await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy: admin._id,
    actionByEmail: admin.email,

    actionFor: employee._id,
    action: employee.email,

    permission: permission?.toLowerCase(),
    actionType: "Update"
  });

  return {
    email: employee.email,
    updatedRole: role,
    updatedBy: admin.email
  };

};

export const refreshEmployeeAccessTokenService = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
  } catch (error) {
    throw new Error("INVALID_OR_EXPIRED_REFRESH_TOKEN");
  }
  const employee = await Employee.findOne({
    email: decoded.email,
    isDeleted: false
  });
  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }
  const { accessToken } = generateTokens(employee);
  return accessToken;

};