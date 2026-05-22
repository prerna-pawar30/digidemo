import Employee from "../models/manage/employee.model.js";
import { getIO } from "../sockets/socket.js";
import { onlineUsers } from "../sockets/socket.js";
import Notification from "../models/manage/notification.model.js";

export const getNotificationsService = async ({
  employeeId,
  page = 1,
  limit = 10,
}) => {

  page = Number(page) || 1;
  limit = Number(limit) || 10;

  const skip = (page - 1) * limit;

  /* ---------- GET NOTIFICATIONS ---------- */

  const notifications = await Notification.find({
    receiver: employeeId,
  })
    .populate("sender", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  /* ---------- TOTAL ITEMS ---------- */

  const totalItems =
    await Notification.countDocuments({
      receiver: employeeId,
    });

  /* ---------- TOTAL PAGES ---------- */

  const totalPages =
    Math.ceil(totalItems / limit);

  /* ---------- NEXT PAGE ---------- */
  const nextPage =
    page < totalPages
      ? page + 1
      : null;
  /* ---------- PREVIOUS PAGE ---------- */
  const prevPage =
    page > 1
      ? page - 1
      : null;
  return {
    notifications,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage,
      prevPage,
      limit,
    },
  };
};


export const getUnreadNotificationCountService =
  async ({ employeeId }) => {
    return Notification.countDocuments({
      receiver: employeeId,
      isRead: false,
    });
  };

export const markNotificationAsReadService =
  async ({
    notificationId,
    employeeId,
  }) => {
    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          receiver: employeeId,
        },
        {
          isRead: true,
        },
        {
          new: true,
        }
      );

    if (!notification) {
      const error = new Error(
        "Notification not found"
      );

      error.statusCode = 404;

      throw error;
    }

    return notification;
  };

export const markAllNotificationsAsReadService =
  async ({ employeeId }) => {
    await Notification.updateMany(
      {
        receiver: employeeId,
        isRead: false,
      },
      {
        isRead: true,
      }
    );

    return {
      success: true,
    };
  };

export const deleteNotificationService =
  async ({
    notificationId,
    employeeId,
  }) => {
    const notification =
      await Notification.findOneAndDelete({
        _id: notificationId,
        receiver: employeeId,
      });

    if (!notification) {
      const error = new Error(
        "Notification not found"
      );

      error.statusCode = 404;

      throw error;
    }

    return {
      success: true,
    };
  };

export const deleteAllNotificationsService =
  async ({ employeeId }) => {
    await Notification.deleteMany({
      receiver: employeeId,
    });

    return {
      success: true,
    };
  };


export const sendNotification = async ({
  receivers = [],
  permission = null,
  sender = null,
  title,
  message,
  type,
  entityId = null,
  entityModel = null,
  metadata = {},
}) => {
 const io = getIO();
  let employees = [];

  /* ---------- DIRECT RECEIVERS ---------- */

  if (receivers.length > 0) {

    employees = await Employee.find({
      _id: { $in: receivers }
    }).select("_id");

  }

  /* ---------- PERMISSION BASED ---------- */

  if (permission) {

    employees = await Employee.find({
      permissions: { $in: [permission] }
    }).select("_id");
  }

  /* ---------- REMOVE DUPLICATES ---------- */

  const uniqueEmployees = [
    ...new Map(
      employees.map((emp) => [
        emp._id.toString(),
        emp
      ])
    ).values()
  ];

  /* ---------- SAVE + SOCKET ---------- */

  for (const emp of uniqueEmployees) {

    const notification = await Notification.create({
      receiver: emp._id,
      sender,
      title,
      message,
      type,
      entityId,
      entityModel,
      metadata,
    });

const socketIds = onlineUsers.get(
  emp._id.toString()
);

if (socketIds?.length) {

  socketIds.forEach((socketId) => {

    io.to(socketId).emit(
      "newNotification",
      notification
    );

  });
}
  }
};