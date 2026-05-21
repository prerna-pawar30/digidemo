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
    const cached = await redisClient.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    console.error("REDIS GET CACHE ERROR:", err.message);
    return null;
  }
};

const setCache = async (key, data) => {
  try {
    await redisClient.set(key, JSON.stringify(data), { ex: CACHE_TTL });
  } catch (err) {
    console.error("REDIS SET CACHE ERROR:", err.message);
  }
};

const clearYTVideoCache = async () => {
  try {
    const keys = await redisClient.keys("YTVIDEO:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("YT VIDEO CACHE CLEARED:", keys);
    }
  } catch (err) {
    console.error("REDIS CLEAR CACHE ERROR:", err.message);
  }
};

/* =========================================================
   GET ALL VIDEOS
========================================================= */
export const getYTDocService = async ({ page = 1, limit = 10, skip = 0 }) => {
  const pageNum  = Math.max(Number(page)  || 1,  1);
  const limitNum = Math.max(Number(limit) || 10, 1);
  const skipNum  = (pageNum - 1) * limitNum;

  /* ---------- CACHE KEY ---------- */
  const cacheKey = `YTVIDEO:ALL:${pageNum}:${limitNum}`;

  /* ---------- CACHE CHECK ---------- */
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("YT VIDEO CACHE HIT:", cacheKey);
    return cached;
  }

  /* ---------- GET OR CREATE DOC ---------- */
  let doc = await YTVideo.findOne().lean();
  if (!doc) {
    const created = await YTVideo.create({ videos: [] });
    doc = created.toObject();
  }

  /* ---------- EDGE CASE: empty videos ---------- */
  if (!Array.isArray(doc.videos) || doc.videos.length === 0) {
    return {
      videos: [],
      pagination: {
        totalItems: 0,
        totalPages: 0,
        currentPage: pageNum,
        nextPage: null,
        prevPage: null,
        limit: limitNum,
      },
    };
  }

  /* ---------- PAGINATION ---------- */
  const totalItems = doc.videos.length;
  const totalPages = Math.ceil(totalItems / limitNum);

  /* ---------- EDGE CASE: page out of range ---------- */
  if (pageNum > totalPages) {
    const err = new Error(`Page ${pageNum} does not exist. Total pages: ${totalPages}`);
    err.statusCode = 400;
    err.errorCode = "PAGE_OUT_OF_RANGE";
    throw err;
  }

  const paginatedVideos = doc.videos.slice(skipNum, skipNum + limitNum);

  const result = {
    videos: paginatedVideos,
    pagination: {
      totalItems,
      totalPages,
      currentPage: pageNum,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      prevPage: pageNum > 1 ? pageNum - 1 : null,
      limit: limitNum,
    },
  };

  /* ---------- STORE CACHE ---------- */
  await setCache(cacheKey, result);

  return result;
};

/* =========================================================
   ADD VIDEO
========================================================= */
export const addVideoService = async ({ title, link, permission, userEmail }) => {
  /* ---------- EDGE CASE: missing fields ---------- */
  if (!title?.trim() || !link?.trim()) {
    const err = new Error("Title and link are required");
    err.statusCode = 400;
    err.errorCode = "VALIDATION_ERROR";
    throw err;
  }

  /* ---------- EDGE CASE: basic URL check ---------- */
  try {
    new URL(link);
  } catch {
    const err = new Error("Invalid video link URL");
    err.statusCode = 400;
    err.errorCode = "INVALID_URL";
    throw err;
  }

  /* ---------- FETCH EMPLOYEE ---------- */
  const employee = await Employee.findOne({ email: userEmail, isDeleted: false });
  if (!employee) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    err.errorCode = "EMPLOYEE_NOT_FOUND";
    throw err;
  }

  /* ---------- GET OR CREATE DOC ---------- */
  let doc = await YTVideo.findOne();
  if (!doc) {
    doc = await YTVideo.create({ videos: [] });
  }

  /* ---------- EDGE CASE: duplicate link ---------- */
  const duplicateLink = doc.videos.find(
    (v) => v.link.trim().toLowerCase() === link.trim().toLowerCase()
  );
  if (duplicateLink) {
    const err = new Error("A video with this link already exists");
    err.statusCode = 409;
    err.errorCode = "DUPLICATE_VIDEO_LINK";
    throw err;
  }

  /* ---------- CREATE VIDEO ---------- */
  const newVideo = {
    ytVideoId: uuidv6(),
    title:     title.trim(),
    link:      link.trim(),
  };

  doc.videos.push(newVideo);
  await doc.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearYTVideoCache();

  /* ---------- AUDIT ---------- */
  const audit = await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy:          employee._id,
    actionByEmail:     employee.email,
    actionFor:         doc._id,
    action:            `Added YouTube Video | ${newVideo.title}`,
    permission:        permission || "video.create",
    actionType:        "Create",
    metadata: {
      ytVideoId: newVideo.ytVideoId,
      title:     newVideo.title,
      link:      newVideo.link,
    },
  });

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender:      employee._id,
      permission:  "video.listing.read",
      title:       "New YouTube Video Added",
      message:     `YouTube video "${newVideo.title}" added by ${employee.email}`,
      type:        "YOUTUBE_VIDEO_CREATED",
      entityId:    newVideo.ytVideoId,
      entityModel: "YTVideo",
      metadata: {
        ytVideoId:  newVideo.ytVideoId,
        title:      newVideo.title,
        link:       newVideo.link,
        createdBy:  employee.email,
        auditId:    audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on video add:", err.message);
  }

  return { video: newVideo };
};

/* =========================================================
   GET VIDEO BY ID
========================================================= */
export const getVideoByIdService = async ({ ytVideoId }) => {
  /* ---------- EDGE CASE: missing id ---------- */
  if (!ytVideoId?.trim()) {
    const err = new Error("ytVideoId is required");
    err.statusCode = 400;
    err.errorCode = "VALIDATION_ERROR";
    throw err;
  }

  /* ---------- CACHE CHECK ---------- */
  const cacheKey = `YTVIDEO:ID:${ytVideoId}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("YT VIDEO CACHE HIT:", cacheKey);
    return cached;
  }

  /* ---------- FETCH DOC ---------- */
  const doc = await YTVideo.findOne().lean();
  if (!doc) {
    const err = new Error("No video document found");
    err.statusCode = 404;
    err.errorCode = "DOC_NOT_FOUND";
    throw err;
  }

  /* ---------- FIND VIDEO ---------- */
  const video = doc.videos.find((v) => v.ytVideoId === ytVideoId);
  if (!video) {
    const err = new Error("Video not found");
    err.statusCode = 404;
    err.errorCode = "VIDEO_NOT_FOUND";
    throw err;
  }

  const result = { video };

  /* ---------- STORE CACHE ---------- */
  await setCache(cacheKey, result);

  return result;
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
  /* ---------- EDGE CASE: nothing to update ---------- */
  if (!title?.trim() && !link?.trim()) {
    const err = new Error("At least one field (title or link) is required to update");
    err.statusCode = 400;
    err.errorCode = "NOTHING_TO_UPDATE";
    throw err;
  }

  /* ---------- EDGE CASE: URL validation ---------- */
  if (link) {
    try {
      new URL(link);
    } catch {
      const err = new Error("Invalid video link URL");
      err.statusCode = 400;
      err.errorCode = "INVALID_URL";
      throw err;
    }
  }

  /* ---------- FETCH EMPLOYEE ---------- */
  const employee = await Employee.findOne({ email: userEmail, isDeleted: false });
  if (!employee) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    err.errorCode = "EMPLOYEE_NOT_FOUND";
    throw err;
  }

  /* ---------- FETCH DOC ---------- */
  const doc = await YTVideo.findOne();
  if (!doc) {
    const err = new Error("No video document found");
    err.statusCode = 404;
    err.errorCode = "DOC_NOT_FOUND";
    throw err;
  }

  /* ---------- FIND VIDEO ---------- */
  const video = doc.videos.find((v) => v.ytVideoId === ytVideoId);
  if (!video) {
    const err = new Error("Video not found");
    err.statusCode = 404;
    err.errorCode = "VIDEO_NOT_FOUND";
    throw err;
  }

  /* ---------- EDGE CASE: duplicate link (excluding self) ---------- */
  if (link) {
    const duplicateLink = doc.videos.find(
      (v) =>
        v.link.trim().toLowerCase() === link.trim().toLowerCase() &&
        v.ytVideoId !== ytVideoId
    );
    if (duplicateLink) {
      const err = new Error("Another video with this link already exists");
      err.statusCode = 409;
      err.errorCode = "DUPLICATE_VIDEO_LINK";
      throw err;
    }
  }

  /* ---------- TRACK CHANGES FOR AUDIT ---------- */
  const changes = {};
  if (title?.trim() && title.trim() !== video.title) {
    changes.title = { from: video.title, to: title.trim() };
    video.title = title.trim();
  }
  if (link?.trim() && link.trim() !== video.link) {
    changes.link = { from: video.link, to: link.trim() };
    video.link = link.trim();
  }

  /* ---------- EDGE CASE: no actual change ---------- */
  if (Object.keys(changes).length === 0) {
    const err = new Error("No changes detected — values are the same as existing");
    err.statusCode = 400;
    err.errorCode = "NO_CHANGES_DETECTED";
    throw err;
  }

  await doc.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearYTVideoCache();

  /* ---------- AUDIT ---------- */
  const audit = await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy:          employee._id,
    actionByEmail:     employee.email,
    actionFor:         doc._id,
    action:            `Updated YouTube Video | ${video.title}`,
    permission:        permission || "video.update",
    actionType:        "Update",
    metadata: {
      ytVideoId: video.ytVideoId,
      changes,
    },
  });

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender:      employee._id,
      permission:  "video.listing.read",
      title:       "YouTube Video Updated",
      message:     `YouTube video "${video.title}" updated by ${employee.email}`,
      type:        "YOUTUBE_VIDEO_UPDATED",
      entityId:    video.ytVideoId,
      entityModel: "YTVideo",
      metadata: {
        ytVideoId:  video.ytVideoId,
        title:      video.title,
        link:       video.link,
        changes,
        updatedBy:  employee.email,
        auditId:    audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on video update:", err.message);
  }

  return { video };
};

/* =========================================================
   DELETE VIDEO
========================================================= */
export const deleteVideoService = async ({ ytVideoId, permission, userEmail }) => {
  /* ---------- FETCH EMPLOYEE ---------- */
  const employee = await Employee.findOne({ email: userEmail, isDeleted: false });
  if (!employee) {
    const err = new Error("Employee not found");
    err.statusCode = 404;
    err.errorCode = "EMPLOYEE_NOT_FOUND";
    throw err;
  }

  /* ---------- FETCH DOC ---------- */
  const doc = await YTVideo.findOne();
  if (!doc) {
    const err = new Error("No video document found");
    err.statusCode = 404;
    err.errorCode = "DOC_NOT_FOUND";
    throw err;
  }

  /* ---------- FIND VIDEO ---------- */
  const videoToDelete = doc.videos.find((v) => v.ytVideoId === ytVideoId);
  if (!videoToDelete) {
    const err = new Error("Video not found");
    err.statusCode = 404;
    err.errorCode = "VIDEO_NOT_FOUND";
    throw err;
  }

  /* ---------- DELETE VIDEO ---------- */
  doc.videos = doc.videos.filter((v) => v.ytVideoId !== ytVideoId);
  await doc.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearYTVideoCache();

  /* ---------- AUDIT ---------- */
  const audit = await PermissionAudit.create({
    permissionAuditId: uuidv6(),
    actionBy:          employee._id,
    actionByEmail:     employee.email,
    actionFor:         doc._id,
    action:            `Deleted YouTube Video | ${videoToDelete.title}`,
    permission:        permission || "video.delete",
    actionType:        "Delete",
    metadata: {
      ytVideoId: videoToDelete.ytVideoId,
      title:     videoToDelete.title,
      link:      videoToDelete.link,
    },
  });

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender:      employee._id,
      permission:  "video.listing.read",
      title:       "YouTube Video Deleted",
      message:     `YouTube video "${videoToDelete.title}" deleted by ${employee.email}`,
      type:        "YOUTUBE_VIDEO_DELETED",
      entityId:    videoToDelete.ytVideoId,
      entityModel: "YTVideo",
      metadata: {
        ytVideoId:  videoToDelete.ytVideoId,
        title:      videoToDelete.title,
        link:       videoToDelete.link,
        deletedBy:  employee.email,
        auditId:    audit._id,
      },
    });
  } catch (err) {
    console.error("Notification failed on video delete:", err.message);
  }

  return { deletedVideoId: ytVideoId };
};