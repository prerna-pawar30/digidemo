import express from "express";
import  authToken  from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

import {
  createJob,
  updateJob,
  getManageJobs,
  getCareerJobs,
  getJobById,
  getJobBySlug,
  deleteJob,
} from "../../controllers/career/job.controller.js";

import {
  submitJobApplication,
  getManageApplications,
  getApplicationById,
  updateApplicationStatus,
  addApplicationNote,
  assignApplication,
  updateJobApplication,
} from "../../controllers/career/jobApplication.controller.js";
import upload from "../../middlewares/multer.middleware.js";
const router = express.Router();

/* ================= PUBLIC CAREER ROUTES ================= */
router.get("/jobs", getCareerJobs);
router.get("/jobs/:slug", getJobBySlug);
router.get("/jobs/id/:jobId", getJobById);
router.get("/application/:applicationId", getApplicationById);
router.put(
  "/application/:applicationId",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 10 },
  ]),
  updateJobApplication
);

router.post(
  "/apply",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 5 },
  ]),
  submitJobApplication
);

/* ================= MANAGE JOB ROUTES ================= */
router.post(
  "/manage/jobs",
  authToken,
  checkPermission,
  createJob
);

router.get(
  "/manage/jobs/:permission",
  authToken,
  checkPermission,
  getManageJobs
);


router.get(
  "/manage/jobs/:jobId/:permission",
  authToken,
  checkPermission,
  getJobById
);

router.put(
  "/manage/jobs/:jobId",
  authToken,
  checkPermission,
  updateJob
);

router.delete(
  "/manage/jobs/:jobId",
  authToken,
  checkPermission,
  deleteJob
);

/* ================= MANAGE APPLICATION ROUTES ================= */
router.get(
  "/manage/applications/:permission",
  authToken,
  checkPermission,
  getManageApplications
);

router.get(
  "/manage/applications/:applicationId/:permission",
  authToken,
  checkPermission,
  getApplicationById
);

router.patch(
  "/manage/applications/:applicationId/status",
  authToken,
  checkPermission,
  updateApplicationStatus
);

router.post(
  "/manage/applications/:applicationId/note",
  authToken,
  checkPermission,
  addApplicationNote
);

router.patch(
  "/manage/applications/:applicationId/assign",
  authToken,
  checkPermission,
  assignApplication
);

export default router;