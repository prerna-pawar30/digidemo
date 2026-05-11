import Employee from "../../models/manage/employee.model.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { getPagination} from "../../helpers/pagination.helper.js";
import { v6 as uuidv6 } from "uuid";
import {
  createJobValidator,
  updateJobValidator,
} from "./job.validator.js";
import {
  createJobService,
  updateJobService,
  getJobsService,
  getPublishedJobsService,
  getJobByIdService,
  getJobBySlugService,
  deleteJobService,
} from "../../services/job.service.js";
import { PermissionAudit } from "../../models/manage/permissionaudit.model.js";

/**
 * @function createJob
 *
 * @description
 * Create a new job posting in the career module.
 *
 * @params
 * headers: {
 *   authorization: "Bearer <access_token>"
 * }
 *
 * body: {
 *   title: string,
 *   department: string,
 *   location: string,
 *   workplaceType: "onsite" | "remote" | "hybrid",
 *   employmentType: "full_time" | "part_time" | "contract" | "internship",
 *   experienceLevel: "junior" | "mid" | "senior",
 *   minExperienceYears?: number,
 *   maxExperienceYears?: number,
 *   openings?: number,
 *   salary?: {
 *     min?: number,
 *     max?: number,
 *     currency?: string,
 *     isVisible?: boolean
 *   },
 *   shortDescription: string,
 *   description: Array<{
 *     text: string
 *   }>,
 *   responsibilities?: string[],
 *   requirements?: string[],
 *   skills?: string[],
 *   benefits?: string[],
 *   status?: "draft" | "published" | "closed",
 *   applicationDeadline?: string,
 *   isFeatured?: boolean,
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate request body using createJobValidator
 * 2. Return validation error response if validation fails
 * 3. Fetch logged-in employee using req.user.email
 * 4. Return employee not found response if employee does not exist
 * 5. Create new job using createJobService
 * 6. Create permission audit log for job creation
 * 7. Return success response with created job data
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Job created successfully",
 *   data: job
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
 */
export const createJob = async (req, res) => {
  try {
    const { value, error } = createJobValidator.validate(req.body, {
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
    const job = await createJobService({
      data: value,
      employee,
    });
      /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: job._id,
      actionForEmail: null,
      action: job.title,
      permission: value.permission || "career.job.create",
      actionType: "Create",
    });
    return sendSuccess(res, job, 201, "Job created successfully");
  } catch (error) {
    return handleError(res, error);
  }
};


/**
 * @function updateJob
 *
 * @description
 * Update an existing job posting in the career module.
 *
 * @params
 * headers: {
 *   authorization: "Bearer <access_token>"
 * }
 *
 * params: {
 *   jobId: string
 * }
 *
 * body: {
 *   title?: string,
 *   department?: string,
 *   location?: string,
 *   workplaceType?: "onsite" | "remote" | "hybrid",
 *   employmentType?: "full_time" | "part_time" | "contract" | "internship",
 *   experienceLevel?: "junior" | "mid" | "senior",
 *   minExperienceYears?: number,
 *   maxExperienceYears?: number,
 *   openings?: number,
 *   salary?: {
 *     min?: number,
 *     max?: number,
 *     currency?: string,
 *     isVisible?: boolean
 *   },
 *   shortDescription?: string,
 *   description?: Array<{
 *     text: string
 *   }>,
 *   responsibilities?: string[],
 *   requirements?: string[],
 *   skills?: string[],
 *   benefits?: string[],
 *   status?: "draft" | "published" | "closed",
 *   applicationDeadline?: string,
 *   isFeatured?: boolean,
 *   permission?: string
 * }
 *
 * @process
 * 1. Validate request body using updateJobValidator
 * 2. Return validation error response if validation fails
 * 3. Fetch logged-in employee using req.user.email
 * 4. Return employee not found response if employee does not exist
 * 5. Update job using updateJobService with req.params.jobId
 * 6. Create permission audit log for job update
 * 7. Return success response with updated job data
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Job updated successfully",
 *   data: job
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
 */
export const updateJob = async (req, res) => {
  try {
    const { value, error } = updateJobValidator.validate(req.body, {
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

    const job = await updateJobService({
      jobId: req.params.jobId,
      data: value,
      employee,
    });

         /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: job._id,
      actionForEmail: null,
      action: job.title,
      permission: value.permission || "career.job.update",
      actionType: "Update",
    });


    return sendSuccess(res, job, 200, "Job updated successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getManageJobs
 *
 * @description
 * Fetch paginated job listings for the manage/admin system with filtering support.
 *
 * @params
 * headers: {
 *   authorization: "Bearer <access_token>"
 * }
 *
 * query: {
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   status?: "draft" | "published" | "closed" | "all",
 *   department?: string,
 *   employmentType?: "full_time" | "part_time" | "contract" | "internship",
 *   workplaceType?: "onsite" | "remote" | "hybrid",
 *   experienceLevel?: "junior" | "mid" | "senior"
 * }
 *
 * @process
 * 1. Parse pagination parameters using getPagination(req.query)
 * 2. Extract filter values from query parameters
 * 3. Call getJobsService with pagination and filters
 * 4. Calculate pagination metadata (totalItems, totalPages, nextPage, prevPage)
 * 5. Return jobs list along with pagination metadata
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Jobs fetched successfully",
 *   data: {
 *     pagination: {
 *       totalItems: number,
 *       totalPages: number,
 *       currentPage: number,
 *       nextPage: number | null,
 *       prevPage: number | null,
 *       limit: number
 *     },
 *     jobs: []
 *   }
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const getManageJobs = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    const {
      search,
      status = "all",
      department,
      employmentType,
      workplaceType,
      experienceLevel,
    } = req.query;

    const result = await getJobsService({
      pagination,
      filters: {
        search,
        status,
        department,
        employmentType,
        workplaceType,
        experienceLevel,
      },
    });

  /* ---------- PAGINATION META ---------- */
    const totalItems = result.totalJobs;
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
        jobs: result.jobs,
      },
      200,
      "Jobs fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getCareerJobs
 *
 * @description
 * Fetch paginated list of published career jobs for the public career page.
 * Supports search and filtering by department, employment type, workplace type, and experience level.
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   department?: string,
 *   employmentType?: "full_time" | "part_time" | "contract" | "internship",
 *   workplaceType?: "onsite" | "remote" | "hybrid",
 *   experienceLevel?: "junior" | "mid" | "senior"
 * }
 *
 * @process
 * 1. Parse pagination parameters using getPagination(req.query)
 * 2. Extract filter parameters from query
 * 3. Call getPublishedJobsService with pagination and filters
 * 4. Calculate pagination metadata
 * 5. Return paginated list of published jobs
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Career jobs fetched successfully",
 *   data: {
 *     pagination: {
 *       totalItems: number,
 *       totalPages: number,
 *       currentPage: number,
 *       nextPage: number | null,
 *       prevPage: number | null,
 *       limit: number
 *     },
 *     jobs: []
 *   }
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const getCareerJobs = async (req, res) => {
  try {
    const pagination = getPagination(req.query);

    const { search, department, employmentType, workplaceType, experienceLevel } = req.query;

    const result = await getPublishedJobsService({
      pagination,
      filters: {
        search,
        department,
        employmentType,
        workplaceType,
        experienceLevel,
      },
    });

    /* ---------- PAGINATION META ---------- */
    const totalItems = result.totalJobs;
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
        jobs: result.jobs,
      },
      200,
      "Career jobs fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getJobById
 *
 * @description
 * Fetch a single job by its jobId.
 * This API is typically used on the career page to display detailed information about a specific job.
 *
 * @params
 * params: {
 *   jobId: string
 * }
 *
 * @process
 * 1. Extract jobId from request parameters
 * 2. Call getJobByIdService to fetch job details from database
 * 3. Return the job data if found
 * 4. Handle errors if job is not found or service fails
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Job fetched successfully",
 *   data: job
 * }
 *
 * 404 {
 *   success: false,
 *   message: "Job not found"
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const getJobById = async (req, res) => {
  try {
    const job = await getJobByIdService({
      jobId: req.params.jobId,
    });

    return sendSuccess(res, job, 200, "Job fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getJobBySlug
 *
 * @description
 * Fetch a single job using its slug.
 * This API is mainly used for the public career page where jobs are accessed by SEO-friendly URLs.
 *
 * @params
 * params: {
 *   slug: string
 * }
 *
 * @process
 * 1. Extract slug from request parameters
 * 2. Call getJobBySlugService to fetch the job from the database
 * 3. Return job details if found
 * 4. Handle errors if the job does not exist or any unexpected error occurs
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Job fetched successfully",
 *   data: job
 * }
 *
 * 404 {
 *   success: false,
 *   message: "Job not found"
 * }
 *
 * 500 {
 *   success: false,
 *   message: "Internal server error"
 * }
 */
export const getJobBySlug = async (req, res) => {
  try {
    const job = await getJobBySlugService({
      slug: req.params.slug,
    });

    return sendSuccess(res, job, 200, "Job fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function deleteJob
 *
 * @description
 * Delete an existing job from the career module.
 *
 * @params
 * headers: {
 *   authorization: "Bearer <access_token>"
 * }
 *
 * params: {
 *   jobId: string
 * }
 *
 * body: {
 *   permission?: string
 * }
 *
 * @process
 * 1. Fetch logged-in employee using req.user.email
 * 2. Return error if employee does not exist
 * 3. Call deleteJobService to delete the job using jobId
 * 4. Create permission audit log for job deletion
 * 5. Return success response
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Job deleted successfully"
 * }
 *
 * 404 {
 *   success: false,
 *   message: "Employee not found"
 * }
 */
export const deleteJob = async (req, res) => {
  try {
    /* ---------- FETCH EMPLOYEE ---------- */
    const employee = await Employee.findOne({ email: req.user.email });

    if (!employee) {
      return sendError(res, {
        message: "Employee not found",
        statusCode: 404,
        errorCode: "EMPLOYEE_NOT_FOUND",
      });
    }
    /* ---------- DELETE JOB ---------- */
    const job = await deleteJobService({
      jobId: req.params.jobId,
    });

    /* ---------- AUDIT ---------- */
    await PermissionAudit.create({
      permissionAuditId: uuidv6(),
      actionBy: employee._id,
      actionByEmail: employee.email,
      actionFor: job?._id || null,
      actionForEmail: null,
      action: job?.title || "Job deleted",
      permission: req.body.permission || "career.job.delete",
      actionType: "Delete",
    });
    return sendSuccess(res, null, 200, "Job deleted successfully");
  } catch (error) {
    return handleError(res, error);
  }
};