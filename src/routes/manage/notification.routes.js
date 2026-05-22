// routes/notification.routes.js

import express from "express";
import auth from "../../middlewares/auth.middleware.js";


import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  sendCustomNotification,
} from "../../controllers/Notifaction/notification.controller.js";

const router = express.Router();

/* ---------- USER ---------- */

router.get(
  "/",
  auth,
  getNotifications
);

router.get(
  "/unread-count",
  auth,
  getUnreadNotificationCount
);

router.patch(
  "/:notificationId/read",
  auth,
  markNotificationAsRead
);

router.patch(
  "/read-all",
  auth,
  markAllNotificationsAsRead
);

router.delete(
  "/delete/:notificationId",
  auth,
  deleteNotification
);

router.delete(
  "/delete-all",
  auth,
  deleteAllNotifications
);

/* ---------- ADMIN ---------- */
router.post(
  "/send",
  auth,
  sendCustomNotification
);

export default router;