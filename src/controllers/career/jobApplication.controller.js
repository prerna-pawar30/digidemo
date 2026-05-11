import Employee from "../../models/manage/employee.model.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";
import JobApplication from "../../models/ecommarace/jobApplication.model.js";
import {
  submitJobApplicationValidator,
  updateApplicationStatusValidator,
  addApplicationNoteValidator,
} from "./jobApplication.validator.js";
import {
  submitJobApplicationService,
  getApplicationsService,
  getApplicationByIdService,
  updateApplicationStatusService,
  addApplicationNoteService,
  assignApplicationService,
  updateJobApplicationService
} from "../../services/jobApplication.service.js";
import { deleteFromS3, uploadToS3 } from "../../services/awsS3.service.js";
import { PermissionAudit } from "../../models/manage/permissionaudit.model.js";
import { v6 as uuidv6 } from "uuid";
import { sendZohoMail } from "../../services/ZohoEmail/zohoMail.service.js";
import { applicationSubmittedTemplate } from "../../config/templates/applicationSubmittedTemplate.js";


/**
 * @function submitJobApplication
 *
 * @description
 * Submit a job application for a published career job.
 * Uploads resume as mandatory file and additional files as optional attachments.
 *
 * @params
 * body: {
 *   jobId: string,
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   phone: string,
 *   city?: string,
 *   state?: string,
 *   country?: string,
 *   totalExperienceYears?: number,
 *   currentCompany?: string,
 *   currentCTC?: number,
 *   expectedCTC?: number,
 *   noticePeriodDays?: number,
 *   portfolioUrl?: string,
 *   linkedinUrl?: string,
 *   githubUrl?: string,
 *   coverLetter?: string,
 *   source?: "career_page" | "linkedin" | "naukri" | "referral" | "manual" | "other"
 * }
 *
 * files: {
 *   resume: File,                  // required
 *   additionalFiles?: File[]       // optional
 * }
 *
 * @process
 * 1. Validate request body using submitJobApplicationValidator
 * 2. Return validation error response if validation fails
 * 3. Check if resume file is present in req.files.resume
 * 4. Upload resume file to S3 under careers/resumes
 * 5. Upload additional files to S3 under careers/additional-files if provided
 * 6. Store uploaded S3 keys for rollback in case of failure
 * 7. Call submitJobApplicationService to save application in database
 * 8. Return success response with generated applicationId
 * 9. If any step fails after upload, delete uploaded S3 files using stored keys
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Application submitted successfully",
 *   data: {
 *     applicationId: string
 *   }
 * }
 *
 * 400 {
 *   success: false,
 *   message: "Validation failed"
 * }
 *
 * 400 {
 *   success: false,
 *   message: "Resume/CV file is required"
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
const uploadFiles = async (files = [], folder, additionalUploads = []) => {
  return Promise.all(
    files.map(async (file) => {
      if (!file) {
        throw new Error("Invalid file sent from frontend");
      }
      const uploaded = await uploadToS3(file, folder);
      if (!uploaded?.url){
        throw new Error("File upload failed");
      }
      if (uploaded?.key){
        additionalUploads.push(uploaded.key);
      }
      return uploaded.url;
    })
  );
}; 
export const submitJobApplication = async (req, res) => {
  const uploadedKeys = [];
  try {
    const { value, error } = submitJobApplicationValidator.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      });
    }
    if (!req.files?.resume || req.files.resume.length === 0) {
      return sendError(res, {
        message: "Resume/CV file is required",
        statusCode: 400,
        errorCode: "RESUME_REQUIRED",
      });
    }
    /* ---------- UPLOAD RESUME ---------- */
    const resumeUploaded = await uploadToS3(
      req.files.resume[0],
      "careers/resumes"
    );

    if (!resumeUploaded?.url) {
      throw new Error("Resume upload failed");
    }
    if (resumeUploaded?.key) {
      uploadedKeys.push(resumeUploaded.key);
    }
    /* ---------- UPLOAD ADDITIONAL FILES ---------- */
    const additionalUploads = req.files?.additionalFiles?.length
      ? await uploadFiles(
          req.files.additionalFiles,
          "careers/additional-files",
          uploadedKeys
        )
      : [];
    /* ---------- SAVE APPLICATION ---------- */
    const application = await submitJobApplicationService({
      data: value,
      resumeFile: resumeUploaded.url,
      additionalFiles: additionalUploads,
    });
     /* ---------- SEND EMAIL ---------- */
    const updateUrl = `${process.env.FRONTEND_URL}/career/application/${application.applicationId}`;

    const htmlBody = applicationSubmittedTemplate({
      candidateName: `${value.firstName} ${value.lastName}`.trim(),
      jobTitle: application.jobTitle || null,
      updateUrl,
    });

    await sendZohoMail(
      value.email,
      "Application Submitted Successfully",
      htmlBody
    );
    return sendSuccess(
      res,
      {
        applicationId: application.applicationId,
      },
      201,
      "Application submitted successfully"
    );
  } catch (error) {
    if (uploadedKeys.length) {
      await Promise.all(uploadedKeys.map((key) => deleteFromS3(key)));
    }
    return handleError(res, error);
  }
};

/**
 * @function updateJobApplication
 *
 * @description
 * Update an existing job application.
 * Reuses old application data for fields not provided in the request body,
 * validates the merged payload, uploads new files if provided, and updates
 * the application record.
 *
 * @params
 * params: {
 *   applicationId: string
 * }
 *
 * body: {
 *   jobId?: string,
 *   firstName?: string,
 *   lastName?: string,
 *   email?: string,
 *   phone?: string,
 *   city?: string,
 *   state?: string,
 *   country?: string,
 *   totalExperienceYears?: number,
 *   currentCompany?: string,
 *   currentCTC?: number,
 *   expectedCTC?: number,
 *   noticePeriodDays?: number,
 *   portfolioUrl?: string,
 *   linkedinUrl?: string,
 *   githubUrl?: string,
 *   coverLetter?: string,
 *   source?: "career_page" | "linkedin" | "naukri" | "referral" | "manual" | "other"
 * }
 *
 * files: {
 *   resume?: File,                // optional new resume
 *   additionalFiles?: File[]      // optional new additional files
 * }
 *
 * @process
 * 1. Read applicationId from request params
 * 2. Validate applicationId exists
 * 3. Fetch existing application from database
 * 4. Return not found response if application does not exist
 * 5. Merge old application data with incoming request body
 * 6. Validate merged payload using submitJobApplicationValidator
 * 7. Upload new resume to S3 if provided
 * 8. Upload new additional files to S3 if provided
 * 9. Append new additional files to existing additionalFiles
 * 10. Call updateJobApplicationService to update application data
 * 11. Return success response with applicationId
 * 12. Roll back uploaded S3 files if any error occurs
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Application updated successfully",
 *   data: {
 *     applicationId: string
 *   }
 * }
 *
 * 400 {
 *   success: false,
 *   message: "Application ID is required"
 * }
 *
 * 400 {
 *   success: false,
 *   message: "Validation failed"
 * }
 *
 * 404 {
 *   success: false,
 *   message: "Application not found"
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const updateJobApplication = async (req, res) => {
  const uploadedKeys = [];
  try {
    /* ---------- PARAMS ---------- */
    const { applicationId } = req.params;
    if (!applicationId) {
      return sendError(res, {
        message: "Application ID is required",
        statusCode: 400,
        errorCode: "APPLICATION_ID_REQUIRED",
      });
    }
    /* ---------- FETCH EXISTING APPLICATION ---------- */
    const existingApplication = await JobApplication.findOne({
      applicationId,
      isDeleted: false,
    });
    if (!existingApplication) {
      return sendError(res, {
        message: "Application not found",
        statusCode: 404,
        errorCode: "APPLICATION_NOT_FOUND",
      });
    }

    /* ---------- MERGE OLD DATA + NEW DATA ---------- */
    const mergedData = {
      jobId: req.body.jobId ?? existingApplication.jobId,
      firstName:
        req.body.firstName ?? existingApplication.applicant?.firstName,
      lastName:
        req.body.lastName ?? existingApplication.applicant?.lastName,
      email: req.body.email ?? existingApplication.applicant?.email,
      phone: req.body.phone ?? existingApplication.applicant?.phone,
      city: req.body.city ?? existingApplication.applicant?.city,
      state: req.body.state ?? existingApplication.applicant?.state,
      country: req.body.country ?? existingApplication.applicant?.country,
      totalExperienceYears:
        req.body.totalExperienceYears ??
        existingApplication.applicant?.totalExperienceYears,
      currentCompany:
        req.body.currentCompany ??
        existingApplication.applicant?.currentCompany,
      currentCTC:
        req.body.currentCTC ?? existingApplication.applicant?.currentCTC,
      expectedCTC:
        req.body.expectedCTC ?? existingApplication.applicant?.expectedCTC,
      noticePeriodDays:
        req.body.noticePeriodDays ??
        existingApplication.applicant?.noticePeriodDays,
      portfolioUrl:
        req.body.portfolioUrl ?? existingApplication.applicant?.portfolioUrl,
      linkedinUrl:
        req.body.linkedinUrl ?? existingApplication.applicant?.linkedinUrl,
      githubUrl:
        req.body.githubUrl ?? existingApplication.applicant?.githubUrl,
      coverLetter: req.body.coverLetter ?? existingApplication.coverLetter,
      source: req.body.source ?? existingApplication.source,
    };
    /* ---------- VALIDATION ---------- */
    const { value, error } = submitJobApplicationValidator.validate(mergedData, {
      abortEarly: false,
    });

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      });
    }
    /* ---------- UPLOAD RESUME IF PROVIDED ---------- */
    let resumeUrl = existingApplication.resume;
    if (req.files?.resume?.length) {
      const resumeUploaded = await uploadToS3(
        req.files.resume[0],
        "careers/resumes"
      );
      if (!resumeUploaded?.url) {
        throw new Error("Resume upload failed");
      }
      if (resumeUploaded?.key) {
        uploadedKeys.push(resumeUploaded.key);
      }
      resumeUrl = resumeUploaded.url;
    }
    /* ---------- UPLOAD ADDITIONAL FILES IF PROVIDED ---------- */
    let additionalFiles = existingApplication.additionalFiles || [];

    if (req.files?.additionalFiles?.length) {
      const additionalUploads = await uploadFiles(
        req.files.additionalFiles,
        "careers/additional-files",
        uploadedKeys
      );
      additionalFiles = [...additionalFiles, ...additionalUploads];
    }
    /* ---------- UPDATE APPLICATION ---------- */
    const application = await updateJobApplicationService({
      applicationId,
      data: value,
      resumeFile: resumeUrl,
      additionalFiles,
    });
    return sendSuccess(
      res,
      {
        applicationId: application.applicationId,
      },
      200,
      "Application updated successfully"
    );
  } catch (error) {
    if (uploadedKeys.length) {
      await Promise.all(uploadedKeys.map((key) => deleteFromS3(key)));
    }
    return handleError(res, error);
  }
};

/**
 * @function getManageApplications
 *
 * @description
 * Fetch paginated job applications for the manage/admin system.
 * Supports filtering by jobId, application status, applicant search, and source.
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number,
 *   jobId?: string,
 *   status?: "pending" | "reviewed" | "shortlisted" | "rejected" | "hired" | "all",
 *   search?: string,          // applicant name, email, or phone
 *   source?: "career_page" | "linkedin" | "naukri" | "referral" | "manual" | "other"
 * }
 *
 * @process
 * 1. Parse pagination parameters using getPagination(req.query)
 * 2. Extract filters (jobId, status, search, source) from query
 * 3. Call getApplicationsService with pagination and filters
 * 4. Calculate pagination metadata
 * 5. Return paginated list of applications
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Applications fetched successfully",
 *   data: {
 *     pagination: {
 *       totalItems: number,
 *       totalPages: number,
 *       currentPage: number,
 *       nextPage: number | null,
 *       prevPage: number | null,
 *       limit: number
 *     },
 *     applications: []
 *   }
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const getManageApplications = async (req, res) => {
  try {
    const pagination = getPagination(req.query);
    const {
      jobId,
      status = "all",
      search,
      source,
    } = req.query;
    const result = await getApplicationsService({
      pagination,
      filters: {
        jobId,
        status,
        search,
        source,
      },
    });
      /* ---------- PAGINATION META ---------- */
    const totalItems = result.totalApplications;
    const currentPage = pagination.page;
    const totalPages = Math.ceil(totalItems / pagination.limit);

    const paginationMeta = {
      totalItems,
      totalPages,
      currentPage,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      limit: pagination.limit,
    };

    return sendSuccess(
      res,
      {
        pagination: paginationMeta,
        applications: result.applications,
      },
      200,
      "Applications fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getApplicationById
 *
 * @description
 * Fetch a single job application by its applicationId.
 * Used in the manage/admin system to view detailed information
 * about a specific candidate's application.
 *
 * @params
 * params: {
 *   applicationId: string
 * }
 *
 * @process
 * 1. Extract applicationId from request parameters
 * 2. Call getApplicationByIdService to fetch application data
 * 3. Return application details if found
 * 4. Handle error if application is not found
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Application fetched successfully",
 *   data: application
 * }
 *
 * 404 {
 *   success: false,
 *   message: "Application not found"
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const getApplicationById = async (req, res) => {
  try {
    const application = await getApplicationByIdService({
      applicationId: req.params.applicationId,
    });

    return sendSuccess(
      res,
      application,
      200,
      "Application fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateApplicationStatus
 *
 * @description
 * Update the status of a job application from the manage/admin system.
 * Also records a permission audit log for tracking status changes.
 *
 * @params
 * headers: {
 *   authorization: "Bearer <access_token>"
 * }
 *
 * params: {
 *   applicationId: string
 * }
 *
 * body: {
 *   status: "pending" | "reviewed" | "shortlisted" | "rejected" | "hired",
 *   note?: string,
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate request body using updateApplicationStatusValidator
 * 2. Return validation error if validation fails
 * 3. Fetch logged-in employee using req.user.email
 * 4. Return error if employee does not exist
 * 5. Call updateApplicationStatusService to update application status
 * 6. Create permission audit log for the status update
 * 7. Return updated application in success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Application status updated successfully",
 *   data: application
 * }
 *
 * 400 {
 *   success: false,
 *   message: "Validation failed"
 * }
 *
 * 404 {
 *   success: false,
 *   message: "Employee not found"
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { value, error } = updateApplicationStatusValidator.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      });
    }
    const employee = await Employee.findOne({ email: req.user.email });
    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND",
      });
    }

    const application = await updateApplicationStatusService({
      applicationId: req.params.applicationId,
      status: value.status,
      note: value.note,
      employee,
    });
      /* ---------- AUDIT ---------- */
        await PermissionAudit.create({
          permissionAuditId: uuidv6(),
          actionBy: employee._id,
          actionByEmail: employee.email,
          actionFor: application._id,
          actionForEmail: application.applicant?.email || null,
          action: `Application status updated to ${application.status}`,
          permission: value.permission || "career.application.status.update",
          actionType: "Update",
        });

    return sendSuccess(
      res,
      application,
      200,
      "Application status updated successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const addApplicationNote = async (req, res) => {
  try {
    const { value, error } = addApplicationNoteValidator.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((e) => e.message),
      });
    }

    const employee = await Employee.findOne({ email: req.user.email });

    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND",
      });
    }

    const application = await addApplicationNoteService({
      applicationId: req.params.applicationId,
      note: value.note,
      employee,
    });

    return sendSuccess(res, application, 200, "Note added successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

export const assignApplication = async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return sendError(res, {
        message: "employeeId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    const employeeToAssign = await Employee.findOne({ employeeId });

    if (!employeeToAssign) {
      return sendError(res, {
        message: "Employee to assign not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND",
      });
    }

    const application = await assignApplicationService({
      applicationId: req.params.applicationId,
      employeeToAssign,
    });

    return sendSuccess(
      res,
      application,
      200,
      "Application assigned successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};