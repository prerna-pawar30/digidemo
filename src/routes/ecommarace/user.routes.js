import express from "express";
import {
  registerUser,
  verifyEmail,
  loginUser,
  logoutUser,
  refreshAccessToken,
  googleAuth,
  googleCallback,
  microsoftAuth,
  microsoftCallback,
  forgotPassword,
  resetPassword,
  getAllUsers,
  getUserById,
  deleteUserById,
  getCurrentUser,
  updateUserProfile,
  getUserDashboard,
  changePassword,
} from "../../controllers/auth/ecommarace/user.controller.js";
import upload from "../../middlewares/multer.middleware.js";
import authToken from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* ===============================
   PUBLIC AUTH ROUTES
================================ */

router.post("/register", registerUser);
router.get("/verify-email/:token", verifyEmail);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/forget-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);


/* ===============================
   OAUTH ROUTES
================================ */

// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

// Microsoft OAuth
router.get("/microsoft", microsoftAuth);
router.get("/microsoft/callback", microsoftCallback);


/* ===============================
   PROTECTED USER ROUTES
================================ */

router.get("/me", authToken, getCurrentUser);
router.get("/dashboard", authToken, getUserDashboard);
router.post("/change-password", authToken, changePassword);
router.put("/profile-update",authToken,upload.fields([{ name: "avatar", maxCount: 1 }]),updateUserProfile);

/* ===============================
   USER MANAGEMENT
================================ */

router.get("/get", getAllUsers);
router.get("/get/:userId", getUserById);
router.delete("/delete/:userId", deleteUserById);

/* ===============================
   EXPORT ROUTER
================================ */

export default router;