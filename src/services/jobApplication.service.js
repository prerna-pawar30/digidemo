import Job from "../models/manage/job.model.js";
import JobApplication from "../models/ecommarace/jobApplication.model.js";
import { v6 as uuidv6 } from "uuid";


export const submitJobApplicationService = async ({
  data,
  resumeFile,
  additionalFiles = [],
}) => {
  const job = await Job.findOne({
    jobId: data.jobId,
    status: "published",
  });

  if (!job) {
    throw new Error("Job not found or not open for application");
  }

  const existingApplication = await JobApplication.findOne({
    jobId: data.jobId,
    "applicant.email": data.email.toLowerCase(),
    isDeleted: false,
  });

  if (existingApplication) {
    throw new Error("You have already applied for this job");
  }

  const application = await JobApplication.create({
    job: job._id,
    jobId: job.jobId,
    applicationId:uuidv6(),
    applicant: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      totalExperienceYears: data.totalExperienceYears || 0,
      currentCompany: data.currentCompany || null,
      currentCTC: data.currentCTC || 0,
      expectedCTC: data.expectedCTC || 0,
      noticePeriodDays: data.noticePeriodDays || 0,
      portfolioUrl: data.portfolioUrl || null,
      linkedinUrl: data.linkedinUrl || null,
      githubUrl: data.githubUrl || null,
    },
    coverLetter: data.coverLetter || null,
    resume: resumeFile,
    additionalFiles,
    source: data.source || "career_page",
  });

  return application;
};

/**
 * @function updateJobApplicationService
 *
 * @description
 * Update existing job application data in database.
 *
 * @process
 * 1. Find published job by jobId
 * 2. Find existing application by applicationId
 * 3. Check duplicate application for same job + email except current one
 * 4. Update application fields
 * 5. Save application
 *
 * @returns {Promise<Object>} Updated application document
 */
export const updateJobApplicationService = async ({
  applicationId,
  data,
  resumeFile,
  additionalFiles = [],
}) => {
  /* ---------- FIND JOB ---------- */
  const job = await Job.findOne({
    jobId: data.jobId,
    status: "published",
  });

  if (!job) {
    throw new Error("Job not found or not open for application");
  }

  /* ---------- FIND APPLICATION ---------- */
  const application = await JobApplication.findOne({
    applicationId,
    isDeleted: false,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  /* ---------- DUPLICATE CHECK ---------- */
  // const existingApplication = await JobApplication.findOne({
  //   _id: { $ne: application._id },
  //   jobId: data.jobId,
  //   "applicant.email": data.email.toLowerCase(),
  //   isDeleted: false,
  // });

  // if (existingApplication) {
  //   throw new Error("You have already applied for this job");
  // }

  /* ---------- UPDATE DATA ---------- */
  application.job = job._id;
  application.jobId = job.jobId;

  application.applicant.firstName = data.firstName;
  application.applicant.lastName = data.lastName;
  application.applicant.email = data.email.toLowerCase();
  application.applicant.phone = data.phone;
  application.applicant.city = data.city || null;
  application.applicant.state = data.state || null;
  application.applicant.country = data.country || null;
  application.applicant.totalExperienceYears = data.totalExperienceYears || 0;
  application.applicant.currentCompany = data.currentCompany || null;
  application.applicant.currentCTC = data.currentCTC || 0;
  application.applicant.expectedCTC = data.expectedCTC || 0;
  application.applicant.noticePeriodDays = data.noticePeriodDays || 0;
  application.applicant.portfolioUrl = data.portfolioUrl || null;
  application.applicant.linkedinUrl = data.linkedinUrl || null;
  application.applicant.githubUrl = data.githubUrl || null;

  application.coverLetter = data.coverLetter || null;
  application.resume = resumeFile;
  application.additionalFiles = additionalFiles;
  application.source = data.source || "career_page";

  await application.save();

  return application;
};

export const getApplicationsService = async ({ pagination, filters }) => {
  const { skip, limit, page } = pagination;
  const { jobId, status, search, source } = filters;

  const query = {
    isDeleted: false,
  };

  if (jobId) {
    query.jobId = jobId;
  }

  if (status && status !== "all") {
    query.status = status;
  }

  if (source) {
    query.source = source;
  }

  if (search) {
    query.$or = [
      { "applicant.firstName": { $regex: search, $options: "i" } },
      { "applicant.lastName": { $regex: search, $options: "i" } },
      { "applicant.email": { $regex: search, $options: "i" } },
      { "applicant.phone": { $regex: search, $options: "i" } },
    ];
  }

  const totalApplications = await JobApplication.countDocuments(query);

  const applications = await JobApplication.find(query)
    .populate("job", "jobId title department location employmentType workplaceType status")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    applications,
    totalApplications,
    currentPage: page,
  };
};

export const getApplicationByIdService = async ({ applicationId }) => {
  const application = await JobApplication.findOne({
    applicationId,
    isDeleted: false,
  })
    .populate("job", "jobId title department location employmentType workplaceType status")
    .lean();

  if (!application) {
    throw new Error("Application not found");
  }

  return application;
};

export const updateApplicationStatusService = async ({
  applicationId,
  status,
  note,
  employee,
}) => {
  const application = await JobApplication.findOne({
    applicationId,
    isDeleted: false,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  application.status = status;
  application.reviewedAt = new Date();

  if (note) {
    application.notes.push({
      note,
      addedBy: {
        employeeId: employee?.employeeId || null,
        employeeRef: employee?._id || null,
        name: employee?.name || null,
        email: employee?.email || null,
      },
    });
  }

  await application.save();
  return application;
};

export const addApplicationNoteService = async ({
  applicationId,
  note,
  employee,
}) => {
  const application = await JobApplication.findOne({
    applicationId,
    isDeleted: false,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  application.notes.push({
    note,
    addedBy: {
      employeeId: employee?.employeeId || null,
      employeeRef: employee?._id || null,
      name: employee?.name || null,
      email: employee?.email || null,
    },
  });

  await application.save();

  return application;
};

export const assignApplicationService = async ({
  applicationId,
  employeeToAssign,
}) => {
  const application = await JobApplication.findOne({
    applicationId,
    isDeleted: false,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  application.assignedTo = {
    employeeId: employeeToAssign?.employeeId || null,
    employeeRef: employeeToAssign?._id || null,
    name: employeeToAssign?.name || null,
    email: employeeToAssign?.email || null,
  };

  await application.save();

  return application;
};