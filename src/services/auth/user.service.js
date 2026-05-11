import User from "../../models/ecommarace/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v6 as uuidv6 } from "uuid";
import { generateTokens } from "../../helpers/token.helper.js";
import { verifyEmailTemplate } from "../../config/templates/verifyUserEmail.js";
import { resetPasswordTemplate } from "../../config/templates/resetPasswordTemplate.js";
import { sendZohoMail } from "../ZohoEmail/zohoMail.service.js";
import jwt from "jsonwebtoken";
import { uploadToS3 } from "../awsS3.service.js";
import Order from "../../models/ecommarace/order.model.js";
import Cart from "../../models/ecommarace/cart.model.js";


// REGISTER
export const registerUserService = async (data) => {
 const { firstName, lastName, email, password, instituteName } = data;
 const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("This email already exist.");
  }
  const user = await User.create({
    userId: uuidv6(),
    firstName,
    lastName,
    email,
    password,
    instituteName,
  });
  const token = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = {
    token,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  await user.save();
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  const htmlBody = verifyEmailTemplate(verifyUrl, firstName);
  await sendZohoMail(email, "Verify your Email", htmlBody);
  return user;
};

// LOGIN
export const loginUserService = async (data) => {
  const { email, password } = data;
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user) {
    throw new Error("Invalid email, Enter a correct Email");
  }
  if (!user.emailVerified) {
    throw new Error("Please verify your email first");
  }
  if (!user.isActive) {
    throw new Error("Your account is deactivated");
  }
  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new Error("Incorrect password, Enter correct password.");
  }
  const { accessToken, refreshToken } = generateTokens(user);
  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      instituteName: user.instituteName,
    },
  };
};

// VERIFY EMAIL
export const verifyEmailService = async (token) => {
  const user = await User.findOne({
    "emailVerificationToken.token": token,
    "emailVerificationToken.expiresAt": { $gt: Date.now() }
  });
  if (!user) {
    throw new Error("Invalid or expired verification link");
  }
  user.emailVerified = true;
  // clear token after successful verification
  user.emailVerificationToken = undefined;
  await user.save();
  return user;
};

export const refreshAccessTokenService = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error){
    throw new Error("Invalid or expired refresh token");
  }
  const user = await User.findOne({ userId: decoded.id });
  if (!user) {
    throw new Error("User not found. Please login again");
  }
  const { accessToken } = generateTokens(user);
  return accessToken;
};

export const forgotPasswordService = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  await sendZohoMail(
    email,
    "Reset Password",
    resetPasswordTemplate(resetURL, user.firstName)
  );
  return true;
};

export const resetPasswordService = async (token, newPassword) => {
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpiresAt: { $gt: Date.now() },
  }).select("+password");
  if (!user) {
    throw new Error("Invalid or expired reset token");
  }
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();
  return true;
};

export const getUserDashboardService = async (email) => {
  const user = await User.findOne({ email })
    .select(
      "-password -resetPasswordToken -resetPasswordExpiresAt -emailVerificationToken "
    )
    .populate({
      path: "orderHistory.orderId",
      select: "orderId orderStatus paymentStatus grandTotal items createdAt iId",
    })
    .populate({
      path: "cart",
    })
    .lean();
  if (!user || user.deletedAt) {
    throw new Error("USER_NOT_FOUND");
  }
  let cartProducts = [];
  if (user.cart && user.cart.items?.length > 0) {
    cartProducts = user.cart.items;
  }
  return  user
}

export const updateUserProfileService = async (email, updates, files) => {
  const user = await User.findOne({ email }).select(
    "-password -resetPasswordToken -resetPasswordExpiresAt -emailVerificationToken -__v"
  );
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  if (updates.password) {
    throw new Error("PASSWORD_UPDATE_NOT_ALLOWED");
  }
  /* ---------------- PHONE UPDATE ---------------- */
  if (updates.phone && updates.phone !== user.phone) {
    user.phone = updates.phone;
    user.phoneVerified = false;
  }
  /* ---------------- AVATAR UPLOAD ---------------- */
  if (files?.avatar?.length) {
    const newFile = files.avatar[0];
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(newFile.mimetype)) {
      throw new Error("INVALID_IMAGE_TYPE");
    }
    const uploaded = await uploadToS3(newFile, "user/profile");
    if (user.avatar) {
      try {
        await deleteFromS3(user.avatar);
      } catch (err) {
        console.error("Old avatar delete failed:", err.message);
      }
    }
    user.avatar = uploaded.url;
  }
  /* ---------------- OTHER FIELDS ---------------- */
  const allowedFields = [
    "firstName",
    "lastName",
    "instituteName",
  ];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      user[field] = updates[field];
    }
  }
  await user.save();
  return user
};

export const changePasswordService = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new Error("INVALID_OLD_PASSWORD");
  }
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  // invalidate refresh tokens if stored
  user.refreshToken = null;
  await user.save();
  return true;
};