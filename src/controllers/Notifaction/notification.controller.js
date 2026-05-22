// controllers/notification.controller.js

import Employee from "../../models/manage/employee.model.js";

import {
  getNotificationsService,
  getUnreadNotificationCountService,
  markNotificationAsReadService,
  markAllNotificationsAsReadService,
  deleteNotificationService,
  deleteAllNotificationsService,sendNotification 
} from "../../services/notification.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { sendError, handleError } from "../../helpers/error.helper.js";

export const getNotifications = async (req, res) => {
  try {
    const employee = await Employee.findOne({
      email: req.user.email,
      isDeleted: false,
    });
    const notifications =
      await getNotificationsService({
        employeeId: employee._id,
        page: req.query.page,
        limit: req.query.limit,
      });
    return sendSuccess(
      res,
      notifications,
      200,
      "Notifications fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const getUnreadNotificationCount =
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        email: req.user.email,
        isDeleted: false,
      });

      const count =
        await getUnreadNotificationCountService({
          employeeId: employee._id,
        });

      return sendSuccess(
        res,
        { unreadCount: count },
        200,
        "Unread count fetched successfully"
      );
    } catch (error) {
      return handleError(res, error);
    }
  };

export const markNotificationAsRead =
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        email: req.user.email,
      });

      const result =
        await markNotificationAsReadService({
          notificationId: req.params.notificationId,
          employeeId: employee._id,
        });

      return sendSuccess(
        res,
        result,
        200,
        "Notification marked as read"
      );
    } catch (error) {
      return handleError(res, error);
    }
  };

export const markAllNotificationsAsRead =
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        email: req.user.email,
      });

      const result =
        await markAllNotificationsAsReadService({
          employeeId: employee._id,
        });

      return sendSuccess(
        res,
        result,
        200,
        "All notifications marked as read"
      );
    } catch (error) {
      return handleError(res, error);
    }
  };

export const deleteNotification =
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        email: req.user.email,
      });

      const result =
        await deleteNotificationService({
          notificationId: req.params.notificationId,
          employeeId: employee._id,
        });

      return sendSuccess(
        res,
        result,
        200,
        "Notification deleted successfully"
      );
    } catch (error) {
      return handleError(res, error);
    }
  };

export const deleteAllNotifications =
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        email: req.user.email,
      });

      const result =
        await deleteAllNotificationsService({
          employeeId: employee._id,
        });

      return sendSuccess(
        res,
        result,
        200,
        "All notifications deleted successfully"
      );
    } catch (error) {
      return handleError(res, error);
    }
  };

export const sendCustomNotification =
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        email: req.user.email,
      });

      const {
        receivers,
        permission,
        title,
        message,
        type,
        entityId,
        entityModel,
        metadata,
      } = req.body;

      await sendNotification({
        receivers,
        permission,
        sender: employee._id,
        title,
        message,
        type,
        entityId,
        entityModel,
        metadata,
      });

      return sendSuccess(
        res,
        null,
        200,
        "Notification sent successfully"
      );
    } catch (error) {
      return handleError(res, error);
    }
  };