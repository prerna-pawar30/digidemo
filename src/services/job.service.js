import Job from "../models/manage/job.model.js";
import { generateSlug } from "../helpers/slug.helper.js";
import { v6 as uuidv6 } from "uuid";

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

  return job;
};

export const updateJobService = async ({ jobId, data, employee }) => {
  const job = await Job.findOne({ jobId });

  if (!job) {
    throw new Error("Job not found");
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

  return job;
};

export const getJobsService = async ({ pagination, filters }) => {
  const { skip, limit, page } = pagination;
  const {
    search,
    status,
    department,
    employmentType,
    workplaceType,
    experienceLevel,
  } = filters;

  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (department) {
    query.department = department;
  }

  if (employmentType) {
    query.employmentType = employmentType;
  }

  if (workplaceType) {
    query.workplaceType = workplaceType;
  }

  if (experienceLevel) {
    query.experienceLevel = experienceLevel;
  }

  if (search) {
    query.$text = { $search: search };
  }

  const totalJobs = await Job.countDocuments(query);

  const jobs = await Job.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    jobs,
    totalJobs,
    currentPage: page,
  };
};

export const getPublishedJobsService = async ({ pagination, filters }) => {
  const { skip, limit, page } = pagination;
  const { search, department, employmentType, workplaceType, experienceLevel } = filters;

  const query = {
    status: "published",
  };

  if (department) {
    query.department = department;
  }

  if (employmentType) {
    query.employmentType = employmentType;
  }

  if (workplaceType) {
    query.workplaceType = workplaceType;
  }

  if (experienceLevel) {
    query.experienceLevel = experienceLevel;
  }

  if (search) {
    query.$text = { $search: search };
  }

  const totalJobs = await Job.countDocuments(query);

  const jobs = await Job.find(query)
    .sort({ isFeatured: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    jobs,
    totalJobs,
    currentPage: page,
  };
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

export const deleteJobService = async ({ jobId }) => {
  const job = await Job.findOne({ jobId });

  if (!job) {
    throw new Error("Job not found");
  }
  await job.deleteOne();

  return job;
};