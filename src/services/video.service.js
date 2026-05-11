import YTVideo from "../models/manage/video.model.js";
import Employee from "../models/manage/employee.model.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { v6 as uuidv6 } from "uuid";

export const getYTDocService = async ({
  page,
  limit,
  skip
}) => {
  try {
    /* ---------- GET OR CREATE DOC ---------- */
    let doc = await YTVideo.findOne().lean();

    if (!doc) {
      doc = await YTVideo.create({ videos: [] });
      doc = doc.toObject();
    }

    /* ---------- PAGINATION ON VIDEOS ARRAY ---------- */
    const totalVideos = doc.videos.length;

    const paginatedVideos = doc.videos.slice(skip, skip + limit);

    /* ---------- RESPONSE ---------- */
    return {
      videos: paginatedVideos,
      pagination: {
        totalRecords: totalVideos,
        totalPages: Math.ceil(totalVideos / limit),
        currentPage: page,
        limit
      }
    };

  } catch (error) {
    console.error("Get YT Doc Service Error:", error);

    throw {
      message: "Failed to fetch YouTube videos",
      statusCode: 500,
      errorCode: "GET_YT_DOC_FAILED",
      details: error.message
    };
  }
};

export const addVideoService = async ({
  title,
  link,
  permission,
  userEmail
}) => {
  console.log("title:", title, "link:", link, "permission:", permission, "userEmail:", userEmail);
  try {
    /* ---------- VALIDATION ---------- */
    if (!title || !link) {
      throw {
        message: "Title and link are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      };
    }
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({ email: userEmail });
    if(!employee){
      throw {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      };
    }
    /* ---------- GET OR CREATE DOC ---------- */
    let doc = await YTVideo.findOne();
    if (!doc) {
      doc = await YTVideo.create({ videos: [] });
    }
    /* ---------- ADD VIDEO ---------- */
    const newVideo = {
      ytVideoId: uuidv6(),
      title,
      link
    };
    doc.videos.push(newVideo);
    await doc.save();
    /* ---------- AUDIT LOG ---------- */
    console.log("actionBy:", employee._id, "actionByEmail:", employee.email, "actionFor:", doc._id, "action:", `Added YouTube video: ${title}`, "permission:", permission, "actionType: Create");
    // await PermissionAudit.create({
    //   permissionAuditId: uuidv6(),
    //   actionBy: employee._id,
    //   actionByEmail: employee.email,
    //   // actionFor: doc._id,
    //   actionFor:"video_document",
    //   action: `Added YouTube video: ${title}`,
    //   permission: permission,
    //   actionType: "Create"
    // });
    /* ---------- RESPONSE ---------- */
    return {
      video: newVideo
    };
  } catch (error) {
    console.error("Add Video Service Error:", error);
    throw {
      message: error.message || "Failed to add video",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "ADD_VIDEO_FAILED",
      details: error.message
    };
  }
};

export const getVideoByIdService = async ({ ytVideoId }) => {
  try {
    /* ---------- FETCH DOC ---------- */
    const doc = await YTVideo.findOne().lean();

    if (!doc) {
      throw {
        message: "No video document found",
        statusCode: 404,
        errorCode: "DOC_NOT_FOUND"
      };
    }

    /* ---------- FIND VIDEO ---------- */
    const video = doc.videos.find(
      (v) => v.ytVideoId === ytVideoId
    );

    if (!video) {
      throw {
        message: "Video not found",
        statusCode: 404,
        errorCode: "VIDEO_NOT_FOUND"
      };
    }

    /* ---------- RETURN ---------- */
    return { video };

  } catch (error) {
    console.error("Get Video Error:", error);

    throw {
      message: error.message || "Failed to fetch video",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "GET_VIDEO_FAILED",
      details: error.message
    };
  }
};

export const deleteVideoService = async ({
  ytVideoId,
  permission,
  userEmail
}) => {
  try {
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({ email: userEmail });

    if (!employee) {
      throw {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      };
    }

    /* ---------- FETCH DOC ---------- */
    const doc = await YTVideo.findOne();

    if (!doc) {
      throw {
        message: "No video document found",
        statusCode: 404,
        errorCode: "DOC_NOT_FOUND"
      };
    }

    /* ---------- FIND VIDEO ---------- */
    const videoToDelete = doc.videos.find(
      (v) => v.ytVideoId === ytVideoId
    );

    if (!videoToDelete) {
      throw {
        message: "Video not found",
        statusCode: 404,
        errorCode: "VIDEO_NOT_FOUND"
      };
    }

    /* ---------- REMOVE VIDEO ---------- */
    doc.videos = doc.videos.filter(
      (v) => v.ytVideoId !== ytVideoId
    );

    await doc.save();

    /* ---------- AUDIT LOG ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: doc._id,
      action: `Deleted YouTube video: ${videoToDelete.title}`,
      permission: permission || "delete_video",
      actionType: "DELETE"
    });

    /* ---------- RETURN ---------- */
    return {
      deletedVideoId: ytVideoId
    };

  } catch (error) {
    console.error("Delete Video Error:", error);

    throw {
      message: error.message || "Failed to delete video",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "DELETE_VIDEO_FAILED",
      details: error.message
    };
  }
};

export const updateVideoService = async ({
  ytVideoId,
  title,
  link,
  permission,
  userEmail
}) => {
  try {
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({ email: userEmail });

    if (!employee) {
      throw {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND"
      };
    }

    /* ---------- FETCH DOC ---------- */
    const doc = await YTVideo.findOne();

    if (!doc) {
      throw {
        message: "No video document found",
        statusCode: 404,
        errorCode: "DOC_NOT_FOUND"
      };
    }

    /* ---------- FIND VIDEO ---------- */
    const video = doc.videos.find(
      (v) => v.ytVideoId === ytVideoId
    );

    if (!video) {
      throw {
        message: "Video not found",
        statusCode: 404,
        errorCode: "VIDEO_NOT_FOUND"
      };
    }

    /* ---------- UPDATE FIELDS ---------- */
    if (title) video.title = title;
    if (link) video.link = link;

    await doc.save();

    /* ---------- AUDIT LOG ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: doc._id,
      action: `Updated YouTube video: ${video.title}`,
      permission: permission || "update_video",
      actionType: "UPDATE"
    });

    /* ---------- RETURN ---------- */
    return { video };

  } catch (error) {
    console.error("Update Video Error:", error);

    throw {
      message: error.message || "Failed to update video",
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || "UPDATE_VIDEO_FAILED",
      details: error.message
    };
  }
};