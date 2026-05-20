import YTVideo from "../models/manage/video.model.js";
import Employee from "../models/manage/employee.model.js";

import { PermissionAudit } from "../models/manage/permissionaudit.model.js";

import { v6 as uuidv6 } from "uuid";

import { sendNotification } from "./notification.service.js";

import { redis as redisClient } from "../config/redis.config.js";

/* =========================================================
   CACHE CONFIG
========================================================= */

const CACHE_TTL = 60 * 60;

/* =========================================================
   CACHE HELPERS
========================================================= */

const getCache = async (key) => {
  try {
    const cachedData = await redisClient.get(key);

    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData);
  } catch (error) {
    console.log(
      "REDIS GET CACHE ERROR:",
      error.message
    );

    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(
      key,
      JSON.stringify(data),
      {
        ex: CACHE_TTL,
      }
    );
  } catch (error) {
    console.log(
      "REDIS SET CACHE ERROR:",
      error.message
    );
  }
};

const clearYTVideoCache = async () => {
  try {
    const keys = await redisClient.keys(
      "YTVIDEO:*"
    );

    if (keys.length > 0) {
      await redisClient.del(...keys);

      console.log(
        "YT VIDEO CACHE CLEARED:",
        keys
      );
    }
  } catch (error) {
    console.log(
      "REDIS CLEAR CACHE ERROR:",
      error.message
    );
  }
};

/* =========================================================
   GET ALL VIDEOS
========================================================= */

export const getYTDocService = async ({
  page = 1,
  limit = 10,
  skip = 0,
}) => {
  try {
    page = Number(page);

    limit = Number(limit);

    skip = Number(skip);

    /* ---------- CACHE KEY ---------- */

    const cacheKey = `YTVIDEO:ALL:${page}:${limit}`;

    /* ---------- CACHE CHECK ---------- */

    const cachedData =
      await getCache(cacheKey);

    if (cachedData) {
      console.log(
        "YT VIDEO CACHE HIT:",
        cacheKey
      );

      return cachedData;
    }

    /* ---------- GET OR CREATE DOC ---------- */

    let doc =
      await YTVideo.findOne().lean();

    if (!doc) {
      const createdDoc =
        await YTVideo.create({
          videos: [],
        });

      doc = createdDoc.toObject();
    }

    /* ---------- PAGINATION ---------- */

    const totalVideos =
      doc.videos.length;

    const paginatedVideos =
      doc.videos.slice(
        skip,
        skip + limit
      );

    /* ---------- RESPONSE ---------- */

    const result = {
      videos: paginatedVideos,

      pagination: {
        totalRecords:
          totalVideos,

        totalPages:
          Math.ceil(
            totalVideos / limit
          ),

        currentPage: page,

        nextPage:
          page <
          Math.ceil(
            totalVideos / limit
          )
            ? page + 1
            : null,

        prevPage:
          page > 1
            ? page - 1
            : null,

        limit,
      },
    };

    /* ---------- STORE CACHE ---------- */

    await setCache(
      cacheKey,
      result
    );

    return result;
  } catch (error) {
    console.error(
      "Get YT Doc Service Error:",
      error
    );

    throw {
      message:
        "Failed to fetch YouTube videos",

      statusCode: 500,

      errorCode:
        "GET_YT_DOC_FAILED",

      details: error.message,
    };
  }
};

/* =========================================================
   ADD VIDEO
========================================================= */

export const addVideoService = async ({
  title,
  link,
  permission,
  userEmail,
}) => {
  try {
    /* ---------- VALIDATION ---------- */

    if (!title || !link) {
      throw {
        message:
          "Title and link are required",

        statusCode: 400,

        errorCode:
          "VALIDATION_ERROR",
      };
    }

    /* ---------- FETCH EMPLOYEE ---------- */

    const employee =
      await Employee.findOne({
        email: userEmail,
      });

    if (!employee) {
      throw {
        message:
          "Employee not found",

        statusCode: 404,

        errorCode:
          "EMPLOYEE_NOT_FOUND",
      };
    }

    /* ---------- GET OR CREATE DOC ---------- */

    let doc =
      await YTVideo.findOne();

    if (!doc) {
      doc =
        await YTVideo.create({
          videos: [],
        });
    }

    /* ---------- CREATE VIDEO ---------- */

    const newVideo = {
      ytVideoId: uuidv6(),

      title,

      link,
    };

    doc.videos.push(newVideo);

    await doc.save();

    /* ---------- CLEAR CACHE ---------- */

    await clearYTVideoCache();

    /* ---------- AUDIT ---------- */

    await PermissionAudit.create({
      permissionAuditId: uuidv6(),

      actionBy: employee._id,

      actionByEmail:
        employee.email,

      actionFor: doc._id,

      action: `Added YouTube Video | ${title}`,

      permission:
        permission ||
        "video.create",

      actionType: "Create",
    });

    /* ---------- SEND NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,

      permission:
        "video.listing.read",

      title:
        "New YouTube Video Added",

      message: `YouTube video "${title}" added successfully`,

      type:
        "YOUTUBE_VIDEO_CREATED",

      entityId:
        newVideo.ytVideoId,

      entityModel: "YTVideo",

      metadata: {
        ytVideoId:
          newVideo.ytVideoId,

        title,

        link,

        createdBy:
          employee.email,
      },
    });

    /* ---------- RESPONSE ---------- */

    return {
      video: newVideo,
    };
  } catch (error) {
    console.error(
      "Add Video Service Error:",
      error
    );

    throw {
      message:
        error.message ||
        "Failed to add video",

      statusCode:
        error.statusCode || 500,

      errorCode:
        error.errorCode ||
        "ADD_VIDEO_FAILED",

      details: error.message,
    };
  }
};

/* =========================================================
   GET VIDEO BY ID
========================================================= */

export const getVideoByIdService =
  async ({ ytVideoId }) => {
    try {

      /* ---------- FETCH DOC ---------- */

      const doc =
        await YTVideo.findOne().lean();

      if (!doc) {
        throw {
          message:
            "No video document found",

          statusCode: 404,

          errorCode:
            "DOC_NOT_FOUND",
        };
      }

      /* ---------- FIND VIDEO ---------- */

      const video =
        doc.videos.find(
          (v) =>
            v.ytVideoId ===
            ytVideoId
        );

      if (!video) {
        throw {
          message:
            "Video not found",

          statusCode: 404,

          errorCode:
            "VIDEO_NOT_FOUND",
        };
      }

      const result = {
        video,
      };
      return result;
    } catch (error) {
      console.error(
        "Get Video Error:",
        error
      );

      throw {
        message:
          error.message ||
          "Failed to fetch video",

        statusCode:
          error.statusCode || 500,

        errorCode:
          error.errorCode ||
          "GET_VIDEO_FAILED",

        details: error.message,
      };
    }
  };

/* =========================================================
   UPDATE VIDEO
========================================================= */

export const updateVideoService = async ({
  ytVideoId,
  title,
  link,
  permission,
  userEmail,
}) => {
  try {
    /* ---------- FETCH EMPLOYEE ---------- */

    const employee =
      await Employee.findOne({
        email: userEmail,
      });

    if (!employee) {
      throw {
        message:
          "Employee not found",

        statusCode: 404,

        errorCode:
          "EMPLOYEE_NOT_FOUND",
      };
    }

    /* ---------- FETCH DOC ---------- */

    const doc =
      await YTVideo.findOne();

    if (!doc) {
      throw {
        message:
          "No video document found",

        statusCode: 404,

        errorCode:
          "DOC_NOT_FOUND",
      };
    }

    /* ---------- FIND VIDEO ---------- */

    const video =
      doc.videos.find(
        (v) =>
          v.ytVideoId ===
          ytVideoId
      );

    if (!video) {
      throw {
        message:
          "Video not found",

        statusCode: 404,

        errorCode:
          "VIDEO_NOT_FOUND",
      };
    }

    /* ---------- UPDATE ---------- */

    if (title) {
      video.title = title;
    }

    if (link) {
      video.link = link;
    }

    await doc.save();

    /* ---------- CLEAR CACHE ---------- */

    await clearYTVideoCache();

    /* ---------- AUDIT ---------- */

    await PermissionAudit.create({
      permissionAuditId: uuidv6(),

      actionBy: employee._id,

      actionByEmail:
        employee.email,

      actionFor: doc._id,

      action: `Updated YouTube Video | ${video.title}`,

      permission:
        permission ||
        "update_video",

      actionType: "Update",
    });

    /* ---------- SEND NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,

      permission:
        "video.listing.read",

      title:
        "YouTube Video Updated",

      message: `YouTube video "${video.title}" updated successfully`,

      type:
        "YOUTUBE_VIDEO_UPDATED",

      entityId:
        video.ytVideoId,

      entityModel: "YTVideo",

      metadata: {
        ytVideoId:
          video.ytVideoId,

        title:
          video.title,

        link:
          video.link,

        updatedBy:
          employee.email,
      },
    });

    /* ---------- RESPONSE ---------- */

    return {
      video,
    };
  } catch (error) {
    console.error(
      "Update Video Error:",
      error
    );

    throw {
      message:
        error.message ||
        "Failed to update video",

      statusCode:
        error.statusCode || 500,

      errorCode:
        error.errorCode ||
        "UPDATE_VIDEO_FAILED",

      details: error.message,
    };
  }
};

/* =========================================================
   DELETE VIDEO
========================================================= */

export const deleteVideoService = async ({
  ytVideoId,
  permission,
  userEmail,
}) => {
  try {
    /* ---------- FETCH EMPLOYEE ---------- */

    const employee =
      await Employee.findOne({
        email: userEmail,
      });

    if (!employee) {
      throw {
        message:
          "Employee not found",

        statusCode: 404,

        errorCode:
          "EMPLOYEE_NOT_FOUND",
      };
    }

    /* ---------- FETCH DOC ---------- */

    const doc =
      await YTVideo.findOne();

    if (!doc) {
      throw {
        message:
          "No video document found",

        statusCode: 404,

        errorCode:
          "DOC_NOT_FOUND",
      };
    }

    /* ---------- FIND VIDEO ---------- */

    const videoToDelete =
      doc.videos.find(
        (v) =>
          v.ytVideoId ===
          ytVideoId
      );

    if (!videoToDelete) {
      throw {
        message:
          "Video not found",

        statusCode: 404,

        errorCode:
          "VIDEO_NOT_FOUND",
      };
    }

    /* ---------- DELETE VIDEO ---------- */

    doc.videos =
      doc.videos.filter(
        (v) =>
          v.ytVideoId !==
          ytVideoId
      );

    await doc.save();

    /* ---------- CLEAR CACHE ---------- */

    await clearYTVideoCache();

    /* ---------- AUDIT ---------- */

    await PermissionAudit.create({
      permissionAuditId: uuidv6(),

      actionBy: employee._id,

      actionByEmail:
        employee.email,

      actionFor: doc._id,

      action: `Deleted YouTube Video | ${videoToDelete.title}`,

      permission:
        permission ||
        "delete_video",

      actionType: "Delete",
    });

    /* ---------- SEND NOTIFICATION ---------- */

    await sendNotification({
      sender: employee._id,

      permission:
        "video.listing.read",

      title:
        "YouTube Video Deleted",

      message: `YouTube video "${videoToDelete.title}" deleted successfully`,

      type:
        "YOUTUBE_VIDEO_DELETED",

      entityId:
        videoToDelete.ytVideoId,

      entityModel: "YTVideo",

      metadata: {
        ytVideoId:
          videoToDelete.ytVideoId,

        title:
          videoToDelete.title,

        deletedBy:
          employee.email,
      },
    });

    /* ---------- RESPONSE ---------- */

    return {
      deletedVideoId:
        ytVideoId,
    };
  } catch (error) {
    console.error(
      "Delete Video Error:",
      error
    );

    throw {
      message:
        error.message ||
        "Failed to delete video",

      statusCode:
        error.statusCode || 500,

      errorCode:
        error.errorCode ||
        "DELETE_VIDEO_FAILED",

      details: error.message,
    };
  }
};