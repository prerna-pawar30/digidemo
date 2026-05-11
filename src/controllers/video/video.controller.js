import { addVideoService, deleteVideoService, getVideoByIdService, getYTDocService, updateVideoService } from "../../services/video.service.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { handleError, sendError } from "../../helpers/error.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";
import { validateAddVideoBody, validateUpdateVideo } from "./video.validator.js";

/**
 * @function getYTDoc
 *
 * @params
 * query: {
 *   page?: number (default: 1),
 *   limit?: number (default: 12)
 * }
 *
 * @process
 * 1. Extract pagination using getPagination helper
 * 2. Fetch single YouTube document:
 *    - If not exists → create new document with empty videos array
 * 3. Apply in-memory pagination on videos array:
 *    - Use slice(skip, skip + limit)
 * 4. Return paginated videos with metadata
 *
 * @response
 * 200 {
 *   videos: [
 *     {
 *       title: string,
 *       url: string,
 *       thumbnail: string,
 *       createdAt: string
 *     }
 *   ],
 *   pagination: {
 *     totalRecords: number,
 *     totalPages: number,
 *     currentPage: number,
 *     limit: number
 *   }
 * }
 */

export const getAllVideos = async (req, res) => {
  try {
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    const result = await getYTDocService({
      page,
      limit,
      skip
    });

    return res.status(200).json({
      success: true,
      message: "YouTube videos fetched successfully",
      statusCode: 200,
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function addVideo
 *
 * @params
 * body: {
 *   title: string (required),
 *   link: string (required),
 *   permission?: string
 * }
 *
 * headers:
 *   Authorization: Bearer token (required)
 *
 * @process
 * 1. Validate request body (title, link required)
 * 2. Extract logged-in user email from req.user
 * 3. Fetch employee from database
 *    - Throw error if employee not found
 * 4. Fetch YouTube document:
 *    - If not exists → create new document
 * 5. Create new video object:
 *    - Generate unique ytVideoId (UUID v6)
 * 6. Push video into videos array
 * 7. Save updated document
 * 8. Create permission audit log:
 *    - Track who added the video
 *    - Store action metadata
 * 9. Return newly added video
 *
 * @response
 * 201 {
 *   video: {
 *     ytVideoId: string,
 *     title: string,
 *     link: string
 *   }
 * }
 */
export const addVideo = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = validateAddVideoBody(req.body);
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    /* ---------- SERVICE ---------- */
    const result = await addVideoService({
      ...value,
      userEmail: req.user.email
    });

    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      result,
      201,
      "Video added successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateVideo
 *
 * @params
 * params: {
 *   ytVideoId: string (required)
 * }
 *
 * body: {
 *   title?: string,
 *   link?: string,
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate ytVideoId and at least one field (title or link)
 * 2. Fetch employee using logged-in user email
 * 3. Fetch YouTube document
 * 4. Find video by ytVideoId
 * 5. Update title and/or link
 * 6. Save document
 * 7. Create permission audit log
 * 8. Return updated video
 *
 * @response
 * 200 {
 *   video: {
 *     ytVideoId: string,
 *     title: string,
 *     link: string
 *   }
 * }
 */

export const updateVideo = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { value, error } = validateUpdateVideo({
      ytVideoId: req.params.ytVideoId,
      ...req.body
    });

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map(err => err.message)
      });
    }

    /* ---------- SERVICE ---------- */
    const result = await updateVideoService({
      ...value,
      userEmail: req.user.email
    });

    return sendSuccess(
      res,
      result,
      200,
      "Video updated successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getVideoById
 *
 * @params
 * params: {
 *   ytVideoId: string (required)
 * }
 *
 * @process
 * 1. Validate ytVideoId (basic check in controller)
 * 2. Fetch document
 * 3. Find video by ytVideoId
 * 4. Return video
 *
 * @response
 * 200 {
 *   video: { ytVideoId, title, link }
 * }
 */
export const getVideoById = async (req, res) => {
  try {
    const { ytVideoId } = req.params;

    /* ---------- BASIC VALIDATION ---------- */
    if (!ytVideoId) {
      return sendError(res, {
        message: "ytVideoId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }

    /* ---------- SERVICE ---------- */
    const result = await getVideoByIdService({ ytVideoId });

    return sendSuccess(
      res,
      result,
      200,
      "Video fetched successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deleteVideo
 *
 * @params
 * params: {
 *   ytVideoId: string (required)
 * }
 *
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate ytVideoId (basic check)
 * 2. Fetch employee
 * 3. Fetch document
 * 4. Find and remove video
 * 5. Save document
 * 6. Create audit log
 * 7. Return deleted video id
 *
 * @response
 * 200 {
 *   deletedVideoId: string
 * }
 */
export const deleteVideo = async (req, res) => {
  try {
    const { ytVideoId } = req.params;
    const { permission } = req.body;

    /* ---------- BASIC VALIDATION ---------- */
    if (!ytVideoId) {
      return sendError(res, {
        message: "ytVideoId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }

    /* ---------- SERVICE ---------- */
    const result = await deleteVideoService({
      ytVideoId,
      permission,
      userEmail: req.user.email
    });

    return sendSuccess(
      res,
      result,
      200,
      "Video deleted successfully"
    );

  } catch (error) {
    return handleError(res, error);
  }
};