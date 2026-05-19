import Employee from "../models/manage/employee.model.js";
import { getIO } from "../sockets/socket.js";
import { onlineUsers } from "../sockets/socket.js";
import Notification from "../models/manage/notification.model.js";



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