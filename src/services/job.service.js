import Job from "../models/manage/job.model.js";
import { generateSlug } from "../helpers/slug.helper.js";
import { v6 as uuidv6 } from "uuid";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";
import { sendNotification } from "./notification.service.js";
import { redis as redisClient } from "../config/redis.config.js";

/* =========================================================
   CACHE CONFIG
========================================================= */

const CACHE_TTL = 60 * 10; // 10 min

/* =========================================================
   CACHE HELPERS
========================================================= */

const getCache = async (key) => {
  try {
    const cachedData = await redisClient.get(key);

    if (!cachedData) return null;

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

const clearJobCache = async () => {
  try {

    const keys = await redisClient.keys("JOB:*");

    if (keys.length > 0) {

      await redisClient.del(...keys);

      console.log(
        "JOB CACHE CLEARED:",
        keys
      );
    }

  } catch (error) {

    console.log(
      "REDIS JOB CACHE CLEAR ERROR:",
      error.message
    );

  }
};

/* =========================================================
   CREATE JOB
========================================================= */
export const createJobService = async ({
  data,
  employee,
}) => {

  try {

    /* ---------- VALIDATION ---------- */

    if (!data?.title) {

      const err = new Error(
        "Job title is required"
      );

      err.statusCode = 400;

      err.errorCode =
        "VALIDATION_ERROR";

      throw err;
    }

    /* ---------- GENERATE UNIQUE SLUG ---------- */

    let baseSlug = generateSlug(
      data.title
    );

    let slug = baseSlug;

    let counter = 1;

    while (
      await Job.findOne({ slug })
    ) {

      slug = `${baseSlug}-${counter++}`;

    }

    /* ---------- CREATE JOB ---------- */

    const job = await Job.create({
      ...data,

      jobId: uuidv6(),

      slug,

      createdBy: {
        employeeId:
          employee?.employeeId || null,

        employeeRef:
          employee?._id || null,

        name:
          employee?.firstName || null,

        email:
          employee?.email || null,
      },

      updatedBy: {
        employeeId:
          employee?.employeeId || null,

        employeeRef:
          employee?._id || null,

        name:
          employee?.firstName || null,

        email:
          employee?.email || null,
      },
    });

    /* ---------- AUDIT LOG ---------- */

    await PermissionAudit.create({
      permissionAuditId:
        uuidv6(),

      actionBy:
        employee?._id,

      actionByEmail:
        employee?.email,

      actionFor:
        job._id,

      action:
        `Job Created | Title:${job.title} | Department:${job.department} | Status:${job.status}`,

      permission:
        "create_job",

      actionType:
        "Create",
    });

    /* ---------- CLEAR CACHE ---------- */

    await clearJobCache();

    /* ---------- SEND NOTIFICATION ---------- */

    await sendNotification({
      sender:
        employee?._id,

      permission:
        "job.listing.read",

      title:
        "New Job Created",

      message:
        `${job.title} job has been created successfully`,

      type:
        "JOB_CREATED",

      entityId:
        job._id,

      entityModel:
        "Job",

      metadata: {
        jobId:
          job.jobId,

        title:
          job.title,

        slug:
          job.slug,

        department:
          job.department,

        employmentType:
          job.employmentType,

        workplaceType:
          job.workplaceType,

        status:
          job.status,

        createdBy:
          employee?.email,
      },
    });

    return job;

  } catch (error) {

    throw error;

  }
};

/* =========================================================
   UPDATE JOB
========================================================= */

export const updateJobService = async ({
  jobId,
  data,
  employee,
}) => {

  try {

    /* ---------- VALIDATION ---------- */

    if (!jobId) {

      const err = new Error(
        "JobId is required"
      );

      err.statusCode = 400;

      err.errorCode =
        "VALIDATION_ERROR";

      throw err;
    }

    /* ---------- FIND JOB ---------- */

    const job = await Job.findOne({
      jobId,
    });

    if (!job) {

      const err = new Error(
        "Job not found"
      );

      err.statusCode = 404;

      err.errorCode =
        "JOB_NOT_FOUND";

      throw err;
    }

    /* ---------- UPDATE SLUG ---------- */

    if (
      data.title &&
      data.title !== job.title
    ) {

      let baseSlug = generateSlug(
        data.title
      );

      let slug = baseSlug;

      let counter = 1;

      while (
        await Job.findOne({
          slug,
          _id: {
            $ne: job._id,
          },
        })
      ) {

        slug = `${baseSlug}-${counter++}`;

      }

      data.slug = slug;
    }

    /* ---------- STORE OLD DATA ---------- */

    const oldTitle = job.title;

    const oldStatus = job.status;

    /* ---------- UPDATE JOB ---------- */

    Object.assign(job, data);

    job.updatedBy = {
      employeeId:
        employee?.employeeId || null,

      employeeRef:
        employee?._id || null,

      name:
        employee?.firstName || null,

      email:
        employee?.email || null,
    };

    await job.save();

    /* ---------- AUDIT LOG ---------- */

    await PermissionAudit.create({
      permissionAuditId:
        uuidv6(),

      actionBy:
        employee?._id,

      actionByEmail:
        employee?.email,

      actionFor:
        job._id,

      action:
        `Job Updated | Old Title:${oldTitle} | New Title:${job.title} | Status:${oldStatus} -> ${job.status}`,

      permission:
        "update_job",

      actionType:
        "Update",
    });

    /* ---------- CLEAR CACHE ---------- */

    await clearJobCache();

    /* ---------- SEND NOTIFICATION ---------- */

    await sendNotification({
      sender:
        employee?._id,

      permission:
        "job.listing.read",

      title:
        "Job Updated",

      message:
        `${job.title} job has been updated successfully`,

      type:
        "JOB_UPDATED",

      entityId:
        job._id,

      entityModel:
        "Job",

      metadata: {
        jobId:
          job.jobId,

        title:
          job.title,

        slug:
          job.slug,

        department:
          job.department,

        employmentType:
          job.employmentType,

        workplaceType:
          job.workplaceType,

        experienceLevel:
          job.experienceLevel,

        status:
          job.status,

        updatedBy:
          employee?.email,
      },
    });

    return job;

  } catch (error) {

    throw error;

  }
};


/* =========================================================
   GET ALL JOBS
========================================================= */
export const getJobsService = async ({
  pagination,
  filters,
}) => {
  try {
    const {
      skip,
      limit,
      page,
    } = pagination;

    const {
      search,
      status,
      department,
      employmentType,
      workplaceType,
      experienceLevel,
    } = filters;

    /* ---------- CACHE KEY ---------- */

    const cacheKey = `JOB:ALL:${JSON.stringify({
      page,
      limit,
      search,
      status,
      department,
      employmentType,
      workplaceType,
      experienceLevel,
    })}`;

    /* ---------- CACHE CHECK ---------- */

    const cachedData =
      await getCache(cacheKey);

    if (cachedData) {

      console.log(
        "JOB CACHE HIT:",
        cacheKey
      );

      return cachedData;
    }

    /* ---------- QUERY ---------- */

    const query = {};

    if (
      status &&
      status !== "all"
    ) {
      query.status = status;
    }

    if (department) {
      query.department =
        department;
    }

    if (employmentType) {
      query.employmentType =
        employmentType;
    }

    if (workplaceType) {
      query.workplaceType =
        workplaceType;
    }

    if (experienceLevel) {
      query.experienceLevel =
        experienceLevel;
    }

    if (search) {
      query.$text = {
        $search: search,
      };
    }
    /* ---------- FETCH DATA ---------- */
    const [
      totalJobs,
      jobs,
    ] = await Promise.all([
      Job.countDocuments(query),

      Job.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    /* ---------- RESPONSE ---------- */

    const result = {
      jobs,

      pagination: {
        totalJobs,

        currentPage: page,

        totalPages:
          Math.ceil(
            totalJobs / limit
          ),

        limit,

        hasNextPage:
          page <
          Math.ceil(
            totalJobs / limit
          ),

        hasPrevPage:
          page > 1,
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
      "GET JOBS SERVICE ERROR:",
      error
    );

    throw {
      message:
        error.message ||
        "Failed to fetch jobs",

      statusCode:
        error.statusCode || 500,

      errorCode:
        error.errorCode ||
        "GET_JOBS_FAILED",

      details:
        error.message,
    };

  }
};


/* =========================================================
   GET PUBLISHED JOBS
========================================================= */

export const getPublishedJobsService =
  async ({
    pagination,
    filters,
  }) => {

    try {

      const {
        skip,
        limit,
        page,
      } = pagination;

      const {
        search,
        department,
        employmentType,
        workplaceType,
        experienceLevel,
      } = filters;

      /* ---------- CACHE KEY ---------- */

      const cacheKey = `JOB:PUBLISHED:${JSON.stringify({
        page,
        limit,
        search,
        department,
        employmentType,
        workplaceType,
        experienceLevel,
      })}`;

      /* ---------- CACHE CHECK ---------- */

      const cachedData =
        await getCache(cacheKey);

      if (cachedData) {

        console.log(
          "PUBLISHED JOB CACHE HIT:",
          cacheKey
        );

        return cachedData;
      }

      /* ---------- QUERY ---------- */

      const query = {
        status: "published",
      };

      if (department) {
        query.department =
          department;
      }

      if (employmentType) {
        query.employmentType =
          employmentType;
      }

      if (workplaceType) {
        query.workplaceType =
          workplaceType;
      }

      if (experienceLevel) {
        query.experienceLevel =
          experienceLevel;
      }

      if (search) {
        query.$text = {
          $search: search,
        };
      }

      /* ---------- FETCH DATA ---------- */

      const [
        totalJobs,
        jobs,
      ] = await Promise.all([
        Job.countDocuments(query),

        Job.find(query)
          .sort({
            isFeatured: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      /* ---------- RESPONSE ---------- */

      const result = {
        jobs,

        pagination: {
          totalJobs,

          currentPage: page,

          totalPages:
            Math.ceil(
              totalJobs / limit
            ),

          limit,

          hasNextPage:
            page <
            Math.ceil(
              totalJobs / limit
            ),

          hasPrevPage:
            page > 1,
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
        "GET PUBLISHED JOBS ERROR:",
        error
      );

      throw {
        message:
          error.message ||
          "Failed to fetch published jobs",

        statusCode:
          error.statusCode || 500,

        errorCode:
          error.errorCode ||
          "GET_PUBLISHED_JOBS_FAILED",

        details:
          error.message,
      };

    }
  };

export const getJobByIdService = async ({ jobId }) => {
  const job = await Job.findOne({ jobId }).lean();

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
};

export const getJobBySlugService = async ({ slug }) => {
  const job = await Job.findOne({ slug, status: "published" }).lean();

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
};

/* =========================================================
   DELETE JOB SERVICE
========================================================= */

export const deleteJobService = async ({
  jobId,
  employee,
  permission,
}) => {
  try {

    /* ---------- VALIDATION ---------- */

    if (!jobId) {

      const err = new Error(
        "JobId is required"
      );

      err.statusCode = 400;

      err.errorCode =
        "VALIDATION_ERROR";

      throw err;
    }

    /* ---------- FIND JOB ---------- */

    const job = await Job.findOne({
      jobId,
    });

    if (!job) {

      const err = new Error(
        "Job not found"
      );

      err.statusCode = 404;

      err.errorCode =
        "JOB_NOT_FOUND";

      throw err;
    }
    /* ---------- DELETE JOB ---------- */

    await job.deleteOne();

    /* ---------- CLEAR CACHE ---------- */

    await clearJobCache();

    /* ---------- AUDIT LOG ---------- */

    await PermissionAudit.create({
      permissionAuditId:
        uuidv6(),

      actionBy:
        employee._id,

      actionByEmail:
        employee.email,

      actionFor:
        job._id,

      actionForEmail:
        null,

      action: `Job Deleted | ${job.title}`,

      permission:
        permission ||
        "career.job.delete",

      actionType: "Delete",
    });

    /* ---------- SEND NOTIFICATION ---------- */

    await sendNotification({
      sender:
        employee._id,

      permission:
        "job.listing.read",

      title:
        "Job Deleted",

      message: `${job.title} job has been deleted successfully`,

      type: "JOB_DELETED",

      entityId:
        job._id,

      entityModel: "Job",

      metadata: {
        deletedJob:
          deletedJobData,

        deletedBy:
          employee.email,
      },
    });

    /* ---------- RESPONSE ---------- */

    return {
      deletedJobId:
        job.jobId,

      title:
        job.title,
    };

  } catch (error) {

    console.error(
      "Delete Job Service Error:",
      error
    );

    throw error;

  }
};