import express from "express";
import { punchIn, punchOut, sendPunchOutRequest, getAllAttendances, getMyAttendances, getAttendanceApprovalsByStatus, requestLeave, getAllLeaveRequestsForAdmin, getAllPunchOutRequestsForAdmin, updatePunchOutRequestStatus,  updateLeaveRequestStatus, cancelLeaveRequest,getMyAttendanceStats,getMyLeaveRequests,getHolidays,createHoliday } from "../../controllers/attendance/attendance.controller.js";

import auth from "../../middlewares/auth.middleware.js";
import checkAdminRole from "../../middlewares/checkAdminRole.middleware.js";
import { punchAccessMiddleware } from "../../middlewares/puchAccess.Middleware.js";
const router = express.Router();

/* ================= EMPLOYEE ROUTES ================= */
// Punch In
router.post("/punch-in",auth, punchIn);
// Punch Out (same day)
router.post("/punch-out",auth,  punchOut);
// Send punch-out request (forgot punch-out)
router.post("/punch-out/request", auth,sendPunchOutRequest);
// Get logged-in employee attendance
router.get("/my-attendance", auth, getMyAttendances);
// Dashboard stats
router.get("/my-dashboard",auth, getMyAttendanceStats);
// Request leave
router.post("/leave-request",auth, requestLeave);
router.get("/my-leave-requests",auth, getMyLeaveRequests);
// Cancel leave request (only if pending)
router.delete("/leave-request/:approvalId",auth, cancelLeaveRequest);
router.get("/holidays", auth, getHolidays);
/* ================= ADMIN ROUTES ================= */
// Get all employees attendance
router.get("/admin/attendances",auth,checkAdminRole,getAllAttendances);
// Filter attendance approvals by status
router.get("/admin/attendance-approvals/filter",auth,checkAdminRole,getAttendanceApprovalsByStatus);
// Get all leave requests
router.get("/admin/leave-requests",auth,checkAdminRole,getAllLeaveRequestsForAdmin);
// Get all punch-out requests
router.get("/admin/punchout-requests", auth,checkAdminRole,getAllPunchOutRequestsForAdmin);
// Approve / Reject punch-out request
router.post("/admin/punchout-requests/action/:approvalId",auth,checkAdminRole,updatePunchOutRequestStatus);
// Approve / Reject leave request
router.post("/admin/leave-requests/action/:approvalId",auth,checkAdminRole, updateLeaveRequestStatus);
router.post("/admin/holiday", auth, checkAdminRole, createHoliday);

export default router;


