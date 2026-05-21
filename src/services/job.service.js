import Job from "../models/manage/job.model.js";
import { generateSlug } from "../helpers/slug.helper.js";
import { v6 as uuidv6 } from "uuid";
import { sendNotification } from "./notification.service.js";
import { redis as redisClient } from "../config/redis.config.js";
import { PermissionAudit } from "../models/manage/permissionaudit.model.js";

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

export const clearJobCache = async () => {
  try {
    const keys = await redisClient.keys("JOB:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log("JOB CACHE CLEARED:", keys);
    }
  } catch (err) {
    console.error("REDIS CACHE CLEAR ERROR:", err.message);
  }
};

/* =========================================================
   CREATE JOB
========================================================= */
export const createJobService = async ({ data, employee }) => {
  let baseSlug = generateSlug(data.title);
  let slug = baseSlug;
  let counter = 1;
  while (await Job.findOne({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const job = await Job.create({
    ...data,
    jobId: uuidv6(),
    slug,
    createdBy: {
      employeeId: employee?.employeeId || null,
      employeeRef: employee?._id || null,
      name: employee?.firstName || null,
      email: employee?.email || null,
    },
    updatedBy: {
      employeeId: employee?.employeeId || null,
      employeeRef: employee?._id || null,
      name: employee?.firstName || null,
      email: employee?.email || null,
    },
  });

  /* ---------- CLEAR CACHE ---------- */
  await clearJobCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: job._id,
      actionForEmail: null,
      action: job.title,
      permission: "career.job.create",
      actionType: "Create",
    });
  } catch (err) {
    console.error("Audit log failed on create job:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id,
      permission: "job.listing.read",
      title: "Job Created",
      message: `New job opening added for ${job.title}`,
      type: "JOB_CREATED",
      entityId: job._id,
      entityModel: "Job",
      metadata: {
        jobId: job.jobId,
        title: job.title,
        slug: job.slug,
        createdBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on create job:", err.message);
  }

  return job;
};

/* =========================================================
   UPDATE JOB
========================================================= */
export const updateJobService = async ({ jobId, data, employee }) => {
  const job = await Job.findOne({ jobId });
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    error.errorCode = "JOB_NOT_FOUND";
    throw error;
  }

  if (data.title && data.title !== job.title) {
    let baseSlug = generateSlug(data.title);
    let slug = baseSlug;
    let counter = 1;
    while (await Job.findOne({ slug, _id: { $ne: job._id } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    data.slug = slug;
  }

  Object.assign(job, data);

  job.updatedBy = {
    employeeId: employee?.employeeId || null,
    employeeRef: employee?._id || null,
    name: employee?.firstName || null,
    email: employee?.email || null,
  };

  await job.save();

  /* ---------- CLEAR CACHE ---------- */
  await clearJobCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: job._id,
      actionForEmail: null,
      action: job.title,
      permission: "career.job.update",
      actionType: "Update",
    });
  } catch (err) {
    console.error("Audit log failed on update job:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id,
      permission: "job.listing.read",
      title: "Job Updated",
      message: `Job "${job.title}" has been updated`,
      type: "JOB_UPDATED",
      entityId: job._id,
      entityModel: "Job",
      metadata: {
        jobId: job.jobId,
        title: job.title,
        slug: job.slug,
        updatedBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on update job:", err.message);
  }

  return job;
};

/* =========================================================
   GET JOBS
========================================================= */
export const getJobsService = async ({ pagination, filters }) => {
  const { skip, limit, page } = pagination;
  const { search, status, department, employmentType, workplaceType, experienceLevel } = filters;

  const query = {};

  if (status && status !== "all") query.status = status;
  if (department) query.department = department;
  if (employmentType) query.employmentType = employmentType;
  if (workplaceType) query.workplaceType = workplaceType;
  if (experienceLevel) query.experienceLevel = experienceLevel;
  if (search) query.$text = { $search: search };

  /* ---------- CACHE KEY ---------- */
  const cacheKey = !search
    ? `JOB:LIST:${page}:${limit}:${status || "all"}:${department || "all"}:${employmentType || "all"}:${workplaceType || "all"}:${experienceLevel || "all"}`
    : null;

  /* ---------- CACHE CHECK ---------- */
  if (cacheKey) {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("CACHE HIT:", cacheKey);
      return cached;
    }
  }

  /* ---------- FETCH ---------- */
  const [jobs, totalItems] = await Promise.all([
    Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const result = {
    jobs,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
  };

  /* ---------- STORE CACHE ---------- */
  if (cacheKey) await setCache(cacheKey, result);

  return result;
};

/* =========================================================
   GET PUBLISHED JOBS
========================================================= */
export const getPublishedJobsService = async ({ pagination, filters }) => {
  const { skip, limit, page } = pagination;
  const { search, department, employmentType, workplaceType, experienceLevel } = filters;

  const query = { status: "published" };

  if (department) query.department = department;
  if (employmentType) query.employmentType = employmentType;
  if (workplaceType) query.workplaceType = workplaceType;
  if (experienceLevel) query.experienceLevel = experienceLevel;
  if (search) query.$text = { $search: search };

  /* ---------- CACHE KEY ---------- */
  const cacheKey = !search
    ? `JOB:PUBLISHED:${page}:${limit}:${department || "all"}:${employmentType || "all"}:${workplaceType || "all"}:${experienceLevel || "all"}`
    : null;

  /* ---------- CACHE CHECK ---------- */
  if (cacheKey) {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("CACHE HIT:", cacheKey);
      return cached;
    }
  }

  /* ---------- FETCH ---------- */
  const [jobs, totalItems] = await Promise.all([
    Job.find(query).sort({ isFeatured: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  const result = {
    jobs,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      limit,
    },
  };

  /* ---------- STORE CACHE ---------- */
  if (cacheKey) await setCache(cacheKey, result);

  return result;
};

/* =========================================================
   GET JOB BY ID
========================================================= */
export const getJobByIdService = async ({ jobId }) => {
  /* ---------- FETCH ---------- */
  const job = await Job.findOne({ jobId }).lean();
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    error.errorCode = "JOB_NOT_FOUND";
    throw error;
  }
  return job;
};

/* =========================================================
   GET JOB BY SLUG
========================================================= */
export const getJobBySlugService = async ({ slug }) => {
  /* ---------- FETCH ---------- */
  const job = await Job.findOne({ slug, status: "published" }).lean();
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    error.errorCode = "JOB_NOT_FOUND";
    throw error;
  }
  return job;
};

/* =========================================================
   DELETE JOB
========================================================= */
export const deleteJobService = async ({ jobId, employee }) => {
  const job = await Job.findOne({ jobId });
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    error.errorCode = "JOB_NOT_FOUND";
    throw error;
  }

  await job.deleteOne();

  /* ---------- CLEAR CACHE ---------- */
  await clearJobCache();

  /* ---------- AUDIT ---------- */
  try {
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee?._id,
      actionByEmail: employee?.email,
      actionFor: job._id,
      actionForEmail: null,
      action: job.title,
      permission: "career.job.delete",
      actionType: "Delete",
    });
  } catch (err) {
    console.error("Audit log failed on delete job:", err.message);
  }

  /* ---------- NOTIFICATION ---------- */
  try {
    await sendNotification({
      sender: employee?._id || null,
      permission: "job.listing.read",
      title: "Job Deleted",
      message: `Job "${job.title}" has been deleted`,
      type: "JOB_DELETED",
      entityId: job._id,
      entityModel: "Job",
      metadata: {
        jobId: job.jobId,
        title: job.title,
        deletedBy: employee?.email || null,
      },
    });
  } catch (err) {
    console.error("Notification failed on delete job:", err.message);
  }

  return job;
};