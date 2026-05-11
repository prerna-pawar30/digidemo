import { handleError, sendError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { cancelLeaveRequestService, createHolidayService, getAllAttendancesService, getAllLeaveRequestsForAdminService, getAllPunchOutRequestsForAdminService, getAttendanceApprovalsByStatusService, getHolidaysService, getLeaveRequestsByStatusService, getMyAttendancesService, getMyAttendanceStatsService, getMyLeaveRequestsService, getMyPunchOutRequestsService, punchInService, punchOutService, requestLeaveService, sendPunchOutRequestService, updateLeaveRequestStatusService, updatePunchOutRequestStatusService } from "../../services/attendance.service.js";

/**
 * @function punchIn
 *
 * @params
 * body: none
 * auth: required (req.user.email)
 *
 * @process
 * 1. Fetch employee using `req.user.email` where `isDeleted = false`.
 *    - If not found → return 404 error.
 * 2. Get current IST time (`nowIST`) and extract today's date (`YYYY-MM-DD`).
 * 3. Fetch EmployeeRecord document:
 *    - If not exists → create new record document with empty records array.
 * 4. Check if today's attendance record exists:
 *
 *    CASE A: Record exists
 *    --------------------------------
 *    a. If `punchIn` already exists → return error (already punched in).
 *    b. If `dayType` includes "HOLIDAY" → block punch-in.
 *    c. If full-day leave → block punch-in.
 *    d. If half-day leave → allow punch-in and ensure "WORKING" is added to dayType.
 *    e. Set `punchIn = nowIST`.
 *
 *    CASE B: Record does NOT exist
 *    --------------------------------
 *    a. Create new record:
 *       - recordId (UUID)
 *       - date = today
 *       - dayType = ["WORKING"]
 *       - punchIn = nowIST
 *       - punchOut = null
 *       - status = []
 *       - totalWorkedTime = { hours: 0, minutes: 0 }
 *    b. Push into records array.
 *
 * 5. Late Mark Logic:
 *    - If time is after 09:30 AM IST:
 *      → Add "LATE" to status (avoid duplicates).
 *
 * 6. Save EmployeeRecord document.
 *
 * 7. Return success response with punch-in details.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Punch-in successful",
 *   data: {
 *     date: string,
 *     time: string,
 *     dayType: string[],
 *     status: string[]
 *   }
 * }
 *
 * @errors
 * 400 { message: "Already punched in for today", errorCode: "ALREADY_PUNCHED_IN" }
 * 403 { message: "Today is a Holiday. Punch-in disabled.", errorCode: "HOLIDAY_RESTRICTION" }
 * 403 { message: "You are on Full-Day Leave", errorCode: "FULL_DAY_LEAVE" }
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const punchIn = async (req, res) => {
  try {
    // optional: if you have validation schema, plug here
    if (!req.user?.email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }
    const result = await punchInService(req.user);
    return sendSuccess(
      res,
      result,
      200,
      "Punch-in successful"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function punchOut
 *
 * @params
 * body: none
 * auth: required (req.user.email)
 *
 * @process
 * 1. Validate that `req.user.email` exists (authenticated user).
 *    - If missing → return UNAUTHORIZED error.
 * 2. Call `punchOutService(req.user)` to handle business logic:
 *    - Service handles:
 *      a. Employee lookup
 *      b. Today's attendance record validation
 *      c. Punch-in existence check
 *      d. Prevent duplicate punch-out
 *      e. Calculate totalWorkedTime
 *      f. Update punchOut time
 * 3. Return success response with updated attendance data.
 * 4. Handle errors using centralized `handleError`.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Punch-out successful",
 *   data: {
 *     date: string,
 *     punchIn: string,
 *     punchOut: string,
 *     totalWorkedTime: {
 *       hours: number,
 *       minutes: number
 *     },
 *     status: string[]
 *   }
 * }
 *
 * @errors
 * 401 { message: "Unauthorized", errorCode: "UNAUTHORIZED" }
 * 400 { message: "Punch-in not found", errorCode: "NO_PUNCH_IN" }
 * 400 { message: "Already punched out", errorCode: "ALREADY_PUNCHED_OUT" }
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 404 { message: "Attendance record not found", errorCode: "RECORD_NOT_FOUND" }
 * 500 { message: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const punchOut = async (req, res) => {
  try {
    if (!req.user?.email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }

    const data = await punchOutService(req.user);

    return sendSuccess(res, data, 200, "Punch-out successful");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function sendPunchOutRequest
 *
 * @params
 * body: {
 *   requestedPunchOut: string // Required: DateTime (YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm)
 * }
 *
 * @process
 * 1. Validate that `requestedPunchOut` is provided.
 * 2. Ensure the value contains time (HH:mm format).
 *    - Reject if only date is provided.
 * 3. Convert `requestedPunchOut` into a Date object.
 *    - Return error if invalid format.
 * 4. Validate that punch-out time is not in the future.
 * 5. Extract the date (YYYY-MM-DD) from the punch-out time.
 * 6. Ensure the request is not for a future date.
 * 7. Fetch the logged-in employee using `req.user.email`.
 *    - Return 404 if employee not found.
 * 8. Fetch EmployeeRecord for the employee.
 *    - Return 404 if not found.
 * 9. Find the attendance record for the given date.
 *    - Return error if no record found.
 * 10. Validate conditions before allowing request:
 *     - Punch-in must exist.
 *     - Punch-out must not already exist.
 *     - Day must not be a holiday.
 *     - Must not be a full-day leave.
 *     - Request must not already be sent for admin approval.
 * 11. Check if a pending punch-out request already exists:
 *     - If yes, return duplicate request error.
 * 12. Mark the record as requiring admin approval.
 * 13. Create a new AdminApproval entry:
 *     - requestType: "FORGOT_PUNCH_OUT"
 *     - recordDate: extracted date
 *     - requestData: { requestedPunchOut }
 *     - status: "PENDING"
 * 14. Save the EmployeeRecord.
 * 15. Return success response with request details.
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Punch-out approval request sent",
 *   data: {
 *     date: string,
 *     requestedPunchOut: string,
 *     status: "PENDING"
 *   }
 * }
 *
 * @errors
 * 400 { message: "Punch-out date and time is required", errorCode: "MISSING_PUNCH_OUT" }
 * 400 { message: "Punch-out must include time", errorCode: "INVALID_TIME_FORMAT" }
 * 400 { message: "Invalid punch-out time format", errorCode: "INVALID_DATE_FORMAT" }
 * 400 { message: "Punch-out time cannot be greater than current time", errorCode: "FUTURE_TIME_NOT_ALLOWED" }
 * 400 { message: "Cannot request for future date", errorCode: "FUTURE_DATE_NOT_ALLOWED" }
 * 400 { message: "No record found for this date", errorCode: "RECORD_NOT_FOUND" }
 * 400 { message: "No punch-in found for this date", errorCode: "NO_PUNCH_IN" }
 * 400 { message: "Punch-out already exists", errorCode: "ALREADY_PUNCHED_OUT" }
 * 400 { message: "This date is a holiday", errorCode: "HOLIDAY_RESTRICTION" }
 * 400 { message: "You were on full-day leave", errorCode: "FULL_DAY_LEAVE" }
 * 400 { message: "Already sent for admin approval", errorCode: "ALREADY_REQUESTED" }
 * 400 { message: "Request already pending", errorCode: "DUPLICATE_REQUEST" }
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 404 { message: "Attendance not found", errorCode: "EMPLOYEE_RECORD_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const sendPunchOutRequest = async (req, res) => {
  try {
    const { requestedPunchOut } = req.body;

    if (!requestedPunchOut) {
      return sendError(res, {
        message: "Punch-out date and time is required",
        statusCode: 400,
        errorCode: "PUNCH_OUT_REQUIRED",
      });
    }
    const result = await sendPunchOutRequestService(req.user, requestedPunchOut);
    return sendSuccess(res, result, 201, "Punch-out approval request sent");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getMyAttendances
 *
 * @params
 * query: none
 *
 * @process
 * 1. Fetch the logged-in employee using `req.user.email`.
 * 2. If employee is not found or marked as deleted, return 404 error.
 * 3. Fetch the EmployeeRecord document for the employee.
 * 4. If no record exists:
 *    - Return success response with an empty array.
 * 5. If record exists:
 *    - Extract the `records` array (daily attendance entries).
 * 6. Return the attendance history for the employee.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Attendance history fetched successfully",
 *   data: [
 *     {
 *       recordId: string,
 *       date: string,
 *       dayType: string[],
 *       status: string[],
 *       leaveType: string | null,
 *       leaveDuration: string,
 *       leaveStatus: string | null,
 *       fromDate: string | null,
 *       toDate: string | null,
 *       leaveReason: string | null,
 *       punchIn: string | null,
 *       punchOut: string | null,
 *       totalWorkedTime: {
 *         hours: number,
 *         minutes: number
 *       },
 *       requiresAdminApproval: boolean,
 *       adminAdjusted: boolean
 *     },
 *     ...
 *   ]
 * }
 *
 * 200 (No Records) {
 *   success: true,
 *   message: "No attendance records found",
 *   data: []
 * }
 *
 * @errors
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getMyAttendances = async (req, res) => {
  try {
    if (!req.user?.email) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 401,
        errorCode: "UNAUTHORIZED",
      });
    }
    const attendances = await getMyAttendancesService(req.user);
    return sendSuccess(
      res,
      attendances,
      200,
      attendances.length
        ? "Attendance history fetched successfully"
        : "No attendance records found"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getAllAttendances
 *
 * @params
 * query: none
 *
 * @process
 * 1. Fetch all EmployeeRecord documents from the database.
 * 2. Populate employee details: `firstName`, `lastName`, `email`, `role`.
 * 3. Sort records by `createdAt` in descending order.
 * 4. Flatten the records:
 *    - Iterate through each EmployeeRecord.
 *    - Map each `records` array (daily entries) into individual attendance entries.
 *    - Attach employee details to each day record.
 * 5. Return the flattened list of attendance records.
 *    (Alternatively, grouped data can be returned if required.)
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All attendances fetched successfully",
 *   data: [
 *     {
 *       employee: {
 *         firstName: string,
 *         lastName: string,
 *         email: string,
 *         role: string
 *       },
 *       recordId: string,
 *       date: string,
 *       dayType: string[],
 *       status: string[],
 *       leaveType: string | null,
 *       leaveDuration: string,
 *       leaveStatus: string | null,
 *       fromDate: string | null,
 *       toDate: string | null,
 *       leaveReason: string | null,
 *       punchIn: string | null,
 *       punchOut: string | null,
 *       totalWorkedTime: {
 *         hours: number,
 *         minutes: number
 *       },
 *       requiresAdminApproval: boolean,
 *       adminAdjusted: boolean
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 500 { message: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getAllAttendances = async (req, res) => {
  try {
    const attendances = await getAllAttendancesService();

    return sendSuccess(
      res,
      attendances,
      200,
      attendances.length
        ? "All attendances fetched successfully"
        : "No attendance records found"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function requestLeave
 *
 * @params
 * body: {
 *   leaveType: string,
 *   leaveDuration?: string, // "FULL_DAY" | "HALF_DAY", default: "FULL_DAY"
 *   fromDate: string,       // YYYY-MM-DD
 *   toDate: string,         // YYYY-MM-DD
 *   leaveReason?: string
 * }
 *
 * @process
 * 1. Validate required fields: `leaveType`, `fromDate`, and `toDate`.
 * 2. Get current date in IST format.
 * 3. Validate that `fromDate` and `toDate` are not in the past.
 * 4. Convert `fromDate` and `toDate` into Date objects.
 *    - Return error if invalid date format.
 *    - Ensure `toDate` is not before `fromDate`.
 * 5. Fetch the logged-in employee using `req.user.email`.
 *    - Return 404 if employee not found.
 * 6. Fetch EmployeeRecord for the employee (if exists).
 * 7. Generate all dates between `fromDate` and `toDate`.
 * 8. Check if any record already exists for those dates:
 *    - If yes, return error (leave cannot be requested on existing records).
 * 9. Check for overlapping pending leave requests:
 *    - Query AdminApproval for existing PENDING leave requests
 *    - If overlapping date range found, return error.
 * 10. Create a new AdminApproval document:
 *     - requestType: "LEAVE"
 *     - recordDate: fromDate
 *     - requestData: { leaveType, leaveDuration, fromDate, toDate, leaveReason }
 *     - status: "PENDING"
 * 11. Return success response with leave request details.
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Leave request sent to admin for approval",
 *   data: {
 *     approvalId: string,
 *     leaveType: string,
 *     leaveDuration: string,
 *     fromDate: string,
 *     toDate: string,
 *     status: "PENDING"
 *   }
 * }
 *
 * @errors
 * 400 { message: "leaveType, fromDate and toDate are required", errorCode: "MISSING_FIELDS" }
 * 400 { message: "Past dates are not allowed", errorCode: "INVALID_DATE_RANGE" }
 * 400 { message: "Invalid date format", errorCode: "INVALID_DATE_FORMAT" }
 * 400 { message: "toDate cannot be before fromDate", errorCode: "INVALID_DATE_ORDER" }
 * 400 { message: "Record already exists for <date>. Cannot request leave.", errorCode: "RECORD_EXISTS" }
 * 400 { message: "A leave request for this date range is already pending", errorCode: "DUPLICATE_REQUEST" }
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const requestLeave = async (req, res) => {
  try {
    const { leaveType, leaveDuration, fromDate, toDate, leaveReason } = req.body;

    if (!leaveType || !fromDate || !toDate) {
      return sendError(res, {
        message: "leaveType, fromDate and toDate are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }

    const result = await requestLeaveService(
      req.user,
      { leaveType, leaveDuration, fromDate, toDate, leaveReason }
    );

    return sendSuccess(res, result, 201, "Leave request sent to admin for approval");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getAllLeaveRequestsForAdmin
 *
 * @params
 * query: None
 *
 * @process
 * 1. Fetch all leave approval requests with:
 *    - requestType: "LEAVE"
 * 2. Populate employee details: `firstName`, `lastName`, `email`, `role`.
 * 3. Sort requests by `createdAt` in descending order.
 * 4. Map each approval to a simplified response format containing:
 *    - approvalId
 *    - employee
 *    - leaveType
 *    - leaveDuration
 *    - fromDate
 *    - toDate
 *    - leaveReason
 *    - status
 *    - actionBy
 *    - actionAt
 *    - createdAt
 * 5. Return success response with the list of leave requests.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Leave requests fetched successfully",
 *   data: [
 *     {
 *       approvalId: string,
 *       employee: { firstName: string, lastName: string, email: string, role: string },
 *       leaveType: string,
 *       leaveDuration: string,
 *       fromDate: string,
 *       toDate: string,
 *       leaveReason: string,
 *       status: string,
 *       actionBy: string | null,
 *       actionAt: string | null,
 *       createdAt: string
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getAllLeaveRequestsForAdmin = async (req, res) => {
  try {
    const leaveRequests = await getAllLeaveRequestsForAdminService();

    return sendSuccess(
      res,
      leaveRequests,
      200,
      leaveRequests.length
        ? "Leave requests fetched successfully"
        : "No leave requests found"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getAllPunchOutRequestsForAdmin
 *
 * @params
 * query: None
 *
 * @process
 * 1. Fetch all punch-out approval requests with:
 *    - requestType: "FORGOT_PUNCH_OUT"
 *    - status: "PENDING"
 * 2. Populate employee details: `firstName`, `lastName`, `email`, `role`.
 * 3. Sort requests by `createdAt` in descending order.
 * 4. Map each approval to a simplified response format containing:
 *    - approvalId
 *    - employee
 *    - date (recordDate)
 *    - requestedPunchOut
 *    - status
 *    - createdAt
 * 5. Return success response with the list of requests.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Punch-out approval requests fetched successfully",
 *   data: [
 *     {
 *       approvalId: string,
 *       employee: { firstName: string, lastName: string, email: string, role: string },
 *       date: string,
 *       requestedPunchOut: string,
 *       status: string,
 *       createdAt: string
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getAllPunchOutRequestsForAdmin = async (req, res) => {
  try {
    const requests = await getAllPunchOutRequestsForAdminService();

    return sendSuccess(
      res,
      requests,
      200,
      requests.length
        ? "Punch-out approval requests fetched successfully"
        : "No punch-out requests found"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updatePunchOutRequestStatus
 *
 * @params
 * params: {
 *   approvalId: string   // Unique ID of the punch-out approval request
 * }
 * body: {
 *   action: string       // "APPROVED" or "REJECTED"
 *   rejectionReason?: string  // Optional, required if action is "REJECTED"
 * }
 *
 * @process
 * 1. Validate that `approvalId` is provided and `action` is valid ("APPROVED" or "REJECTED").
 * 2. Find the admin performing the action using `req.user.email`.
 *    - Return 403 if admin not found.
 * 3. Fetch the punch-out approval request by `approvalId`.
 *    - Return 404 if approval not found.
 *    - Return 400 if approval status is not PENDING.
 * 4. Update basic approval info:
 *    - Set `status` to the provided action.
 *    - Set `actionBy` to admin ID and `actionAt` to current timestamp.
 * 5. If `action` is "REJECTED":
 *    - Save `rejectionReason`.
 *    - Return success response with updated approval.
 * 6. If `action` is "APPROVED":
 *    - Extract employee, `recordDate`, and `requestedPunchOut` from approval request.
 *    - Validate `requestedPunchOut` exists.
 *    - Fetch EmployeeRecord for the employee.
 *      - Return 404 if not found.
 *    - Fetch the day record for `recordDate`.
 *      - Return 404 if not found.
 *      - Return 400 if punch-in is missing or punch-out already exists.
 *    - Apply punch-out:
 *      - Validate punch-out time format and ensure it is after punch-in.
 *      - Update `punchOut`, `requiresAdminApproval`, and `adminAdjusted`.
 *    - Recompute worked hours and status:
 *      - Calculate total hours and minutes worked.
 *      - Update `status` based on worked hours and weekday.
 *      - Update `totalWorkedTime`.
 *    - Save EmployeeRecord and AdminApproval.
 * 7. Return success response with punch-out details.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Punch-out request approved",
 *   data: {
 *     approvalId: string,
 *     employee: ObjectId,
 *     date: string,
 *     punchOut: string,
 *     worked: { hours: number, minutes: number },
 *     status: string[],
 *     actionBy: string
 *   }
 * }
 *
 * 200 (Rejected) {
 *   success: true,
 *   message: "Punch-out request rejected",
 *   data: { ...updated approval object }
 * }
 *
 * @errors
 * 400 { message: "Invalid approval action", errorCode: "INVALID_ACTION" }
 * 400 { message: "Request already processed", errorCode: "ALREADY_PROCESSED" }
 * 400 { message: "Cannot punch-out without punch-in", errorCode: "NO_PUNCH_IN" }
 * 400 { message: "Punch-out already exists", errorCode: "ALREADY_PUNCHED_OUT" }
 * 400 { message: "Invalid punch-out time", errorCode: "INVALID_PUNCH_OUT" }
 * 400 { message: "Punch-out request before punch-in not allowed", errorCode: "INVALID_PUNCH_OUT_ORDER" }
 * 403 { message: "Admin not found", errorCode: "ADMIN_NOT_FOUND" }
 * 404 { message: "Approval request not found", errorCode: "APPROVAL_NOT_FOUND" }
 * 404 { message: "Employee record not found", errorCode: "EMPLOYEE_RECORD_NOT_FOUND" }
 * 404 { message: "Day record not found", errorCode: "DAY_RECORD_NOT_FOUND" }
 * 500 { message: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const updatePunchOutRequestStatus = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!approvalId || !["APPROVED", "REJECTED"].includes(action)) {
      return sendError(res, {
        message: "Invalid approval action",
        statusCode: 400,
        errorCode: "INVALID_ACTION",
      });
    }

    const result = await updatePunchOutRequestStatusService(
      req.user,
      approvalId,
      action,
      rejectionReason
    );

    return sendSuccess(
      res,
      result,
      200,
      `Punch-out request ${action.toLowerCase()} successfully`
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function updateLeaveRequestStatus
 *
 * @params
 * params: {
 *   approvalId: string   // Unique ID of the leave approval request
 * }
 * body: {
 *   action: string       // "APPROVED" or "REJECTED"
 *   rejectionReason?: string  // Optional, required if action is "REJECTED"
 * }
 *
 * @process
 * 1. Validate that `approvalId` and valid `action` are provided.
 * 2. Find the admin performing the action using `req.user.email`.
 *    - Return 403 if admin not found.
 * 3. Fetch the leave approval request by `approvalId` and requestType "LEAVE".
 *    - Return 404 if approval not found.
 *    - Return 400 if approval is already processed (not PENDING).
 * 4. If `action` is "REJECTED":
 *    - Update approval status to REJECTED.
 *    - Save `rejectionReason`.
 *    - Return success response with updated approval.
 * 5. If `action` is "APPROVED":
 *    - Extract employee and leave details (`leaveType`, `leaveDuration`, `fromDate`, `toDate`, `leaveReason`) from the approval request.
 *    - Fetch the EmployeeRecord for the employee.
 *      - Return 404 if not found.
 *    - Generate all dates in the leave range (from `fromDate` to `toDate`).
 *    - For each date:
 *       - Check if an attendance record already exists; return 400 if exists.
 *       - Otherwise, push a new record with:
 *         - dayType: ["LEAVE"], status: ["LEAVE"], leaveType, leaveDuration, leaveStatus: "APPROVED", etc.
 *    - Save the EmployeeRecord and the approval.
 * 6. Return success response with approved leave details.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Leave request approved",
 *   data: {
 *     approvalId: string,
 *     employee: ObjectId,
 *     fromDate: string,
 *     toDate: string,
 *     leaveType: string,
 *     leaveDuration: string,
 *     status: "APPROVED",
 *     actionBy: string
 *   }
 * }
 *
 * 200 (Rejected) {
 *   success: true,
 *   message: "Leave request rejected",
 *   data: { ...updated approval object }
 * }
 *
 * @errors
 * 400 { message: "Invalid approval action", errorCode: "INVALID_ACTION" }
 * 400 { message: "Request already processed", errorCode: "ALREADY_PROCESSED" }
 * 400 { message: "Attendance already exists for <date>", errorCode: "ATTENDANCE_EXISTS" }
 * 403 { message: "Admin not found", errorCode: "ADMIN_NOT_FOUND" }
 * 404 { message: "Leave request not found", errorCode: "APPROVAL_NOT_FOUND" }
 * 404 { message: "Employee record not found", errorCode: "EMPLOYEE_RECORD_NOT_FOUND" }
 * 500 { message: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const updateLeaveRequestStatus = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!approvalId || !["APPROVED", "REJECTED"].includes(action)) {
      return sendError(res, {
        message: "Invalid approval action",
        statusCode: 400,
        errorCode: "INVALID_ACTION",
      });
    }

    const result = await updateLeaveRequestStatusService(
      req.user,
      approvalId,
      action,
      rejectionReason
    );

    return sendSuccess(
      res,
      result,
      200,
      `Leave request ${action.toLowerCase()} successfully`
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function createHoliday
 *
 * @params
 * body: {
 *   date: string,   // Holiday date in YYYY-MM-DD format
 *   title: string   // Name or reason for the holiday (e.g., "Diwali")
 * }
 *
 * @process
 * 1. Validate that `date` and `title` are provided in the request body.
 * 2. Validate that `date` is a valid date format.
 * 3. Convert `date` to ISO string format (YYYY-MM-DD).
 * 4. Fetch all active (non-deleted) employees.
 * 5. Initialize counters: `updated` and `skipped`.
 * 6. Loop through each employee:
 *    - Fetch EmployeeRecord for that employee.
 *    - If no record exists, increment `skipped` and continue.
 *    - If a record for the given date exists:
 *       - Update the day to be a full-day holiday with the provided `title`.
 *       - Set dayType, status, leaveType, leaveDuration, punchIn/punchOut, etc.
 *    - If no record exists for that date:
 *       - Create a new day entry in the record marked as full-day holiday.
 *    - Save the EmployeeRecord.
 * 7. After processing all employees, return a summary including:
 *    - Total employees
 *    - Number of records updated
 *    - Number of employees skipped
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Holiday stored successfully",
 *   data: {
 *     date: string,
 *     title: string,
 *     totalEmployees: number,
 *     updated: number,
 *     skipped: number
 *   }
 * }
 *
 * @errors
 * 400 { message: "date and title are required", errorCode: "MISSING_FIELDS" }
 * 400 { message: "Invalid date format", errorCode: "INVALID_DATE_FORMAT" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const createHoliday = async (req, res) => {
  try {
    const { date, title } = req.body;
    if (!date || !title) {
      return sendError(res, {
        message: "date and title are required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const result = await createHolidayService(date, title);
    return sendSuccess(res, result, 201, "Holiday stored successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getHolidays
 *
 * @params
 * query: {
 *   type?: string // "all" | "past" | "upcoming", default: "all"
 * }
 *
 * @process
 * 1. Determine the current date in IST format.
 * 2. Fetch the logged-in employee using req.user.email.
 * 3. If employee not found or marked deleted, return 404 Employee not found.
 * 4. Fetch the EmployeeRecord for this employee.
 * 5. If no record found, return an empty holiday list.
 * 6. Iterate through the employee records:
 *    - Include only days where dayType includes "HOLIDAY".
 *    - Filter holidays based on the "type" query param:
 *       - "past": include only holidays before today.
 *       - "upcoming": include only holidays on/after today.
 *       - "all": include all holidays.
 *    - Map each holiday to { date, reason }.
 * 7. Sort the holidays by date in ascending order.
 * 8. Return the filtered and sorted holiday list.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "My holiday list fetched successfully",
 *   data: [
 *     { date: string, reason: string },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getHolidays = async (req, res) => {
  try {
    const { type = "all" } = req.query; // all | past | upcoming
    const employeeEmail = req.user.email;
    if (!employeeEmail) {
      return sendError(res, {
        message: "Employee email missing in request",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const holidays = await getHolidaysService(employeeEmail, type);
    return sendSuccess(res, holidays, 200, "My holiday list fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getMyLeaveRequests
 *
 * @params
 * query: none
 *
 * @process
 * 1. Fetch the logged-in employee using req.user.email.
 * 2. If employee not found or marked deleted, return 404 Employee not found.
 * 3. Query the AdminApproval collection for records with:
 *    - employee: employee._id
 *    - requestType: "LEAVE"
 * 4. Sort the requests by createdAt in descending order.
 * 5. Return the list of leave requests.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "My leave requests",
 *   data: [
 *     {
 *       approvalId: string,
 *       employee: ObjectId,
 *       requestType: "LEAVE",
 *       recordDate: string,
 *       requestData: object,
 *       status: string,
 *       actionBy: ObjectId | null,
 *       actionAt: string | null,
 *       rejectionReason: string | null,
 *       createdAt: string
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getMyLeaveRequests = async (req, res) => {
  try {
    const employeeEmail = req.user.email;
    if (!employeeEmail) {
      return sendError(res, {
        message: "Employee email missing in request",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const leaveRequests = await getMyLeaveRequestsService(employeeEmail);
    return sendSuccess(res, leaveRequests, 200, "My leave requests fetched successfully");
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getMyPunchOutRequests
 *
 * @params
 * query: none
 *
 * @process
 * 1. Fetch the logged-in employee using req.user.email.
 * 2. If employee not found or marked deleted, return 404 Employee not found.
 * 3. Query the AdminApproval collection for records with:
 *    - employee: employee._id
 *    - requestType: "FORGOT_PUNCH_OUT"
 * 4. Sort the requests by createdAt in descending order.
 * 5. Return the list of punch-out requests.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "My punch-out requests",
 *   data: [
 *     {
 *       approvalId: string,
 *       employee: ObjectId,
 *       requestType: "FORGOT_PUNCH_OUT",
 *       recordDate: string,
 *       requestData: object,
 *       status: string,
 *       actionBy: ObjectId | null,
 *       actionAt: string | null,
 *       rejectionReason: string | null,
 *       createdAt: string
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getMyPunchOutRequests = async (req, res) => {
  try {
    const employeeEmail = req.user.email;
    if (!employeeEmail) {
      return sendError(res, {
        message: "Employee email missing in request",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    const punchOutRequests = await getMyPunchOutRequestsService(employeeEmail);
    return sendSuccess(
      res,
      punchOutRequests,
      200,
      "My punch-out requests fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getAttendanceApprovalsByStatus
 *
 * @params
 * body: {
 *   status?: string // Optional: Filter by approval status. Allowed values: "PENDING", "APPROVED", "REJECTED"
 * }
 *
 * @process
 * 1. Validate that the logged-in user is an admin.
 * 2. If not an admin, return 403 Unauthorized.
 * 3. Prepare a filter object for AdminApproval requests.
 * 4. If status is provided, validate it and add to the filter.
 * 5. Fetch approval requests from AdminApproval collection, populating employee and actionBy details.
 * 6. Sort results by createdAt in descending order.
 * 7. Map each record to include approvalId, employee info, request type, record date, request data, status, actionBy info, actionAt, rejectionReason, createdAt.
 * 8. Return the filtered approval requests in the response.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Filtered approval requests fetched",
 *   data: [
 *     {
 *       approvalId: string,
 *       employee: { firstName, lastName, email, role },
 *       requestType: string,
 *       recordDate: string,
 *       requestData: object,
 *       status: string,
 *       actionBy: { firstName, lastName, email },
 *       actionAt: string,
 *       rejectionReason: string,
 *       createdAt: string
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 400 { message: "Invalid status filter", errorCode: "INVALID_STATUS" }
 * 403 { message: "Unauthorized", errorCode: "UNAUTHORIZED" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getAttendanceApprovalsByStatus = async (req, res) => {
  try {
    const { status } = req.body; // PENDING | APPROVED | REJECTED
    const adminEmail = req.user.email;

    if (!adminEmail) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 403,
        errorCode: "UNAUTHORIZED",
      });
    }

    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return sendError(res, {
        message: "Invalid status filter",
        statusCode: 400,
        errorCode: "INVALID_STATUS",
      });
    }

    const approvals = await getAttendanceApprovalsByStatusService(
      adminEmail,
      status
    );

    return sendSuccess(
      res,
      approvals,
      200,
      "Filtered approval requests fetched"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getLeaveRequestsByStatus
 *
 * @params
 * query: {
 *   status?: string // Optional: Filter by leave status. Allowed values: "PENDING", "APPROVED", "REJECTED"
 * }
 *
 * @process
 * 1. Validate that the logged-in user is an admin.
 * 2. If not an admin, return 403 Unauthorized.
 * 3. Prepare a filter for leave requests with requestType "LEAVE".
 * 4. If status query is provided, validate it against allowed values.
 * 5. Apply the status filter if valid.
 * 6. Fetch leave requests from AdminApproval collection, populating employee and actionBy fields.
 * 7. Sort the results by createdAt in descending order.
 * 8. Map each record to include approvalId, employee details, leave type/duration/dates/reason, status, action info, rejection reason, and createdAt.
 * 9. Return the formatted leave requests list in response.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Leave requests fetched successfully",
 *   data: [
 *     {
 *       approvalId: string,
 *       employee: { firstName, lastName, email, role },
 *       leaveType: string,
 *       leaveDuration: string,
 *       fromDate: string,
 *       toDate: string,
 *       leaveReason: string,
 *       status: string,
 *       actionBy: { firstName, lastName, email },
 *       actionAt: string,
 *       rejectionReason: string,
 *       createdAt: string
 *     },
 *     ...
 *   ]
 * }
 *
 * @errors
 * 400 { message: "Invalid status filter", errorCode: "INVALID_STATUS" }
 * 403 { message: "Unauthorized", errorCode: "UNAUTHORIZED" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getLeaveRequestsByStatus = async (req, res) => {
  try {
    const adminEmail = req.user.email;
    const { status } = req.query;

    if (!adminEmail) {
      return sendError(res, {
        message: "Unauthorized",
        statusCode: 403,
        errorCode: "UNAUTHORIZED",
      });
    }

    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return sendError(res, {
        message: "Invalid status filter",
        statusCode: 400,
        errorCode: "INVALID_STATUS",
      });
    }

    const result = await getLeaveRequestsByStatusService(
      adminEmail,
      status
    );

    return sendSuccess(
      res,
      result,
      200,
      "Leave requests fetched successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function cancelLeaveRequest
 *
 * @params
 * path: {
 *   approvalId: string // Required: ID of the leave request to cancel
 * }
 *
 * @process
 * 1. Validate that approvalId is provided.
 * 2. Fetch logged-in employee using req.user.email.
 * 3. Throw 404 if employee not found.
 * 4. Find pending leave request for this employee and approvalId.
 * 5. Throw 404 if request not found or already processed.
 * 6. Delete the leave request.
 * 7. Return success response with cancelled approvalId.
 *
 * @response
 * 200 { 
 *   success: true,
 *   message: "Leave request cancelled successfully",
 *   data: { approvalId: string }
 * }
 *
 * @errors
 * 400 { message: "approvalId is required", errorCode: "MISSING_APPROVAL_ID" }
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 404 { message: "Pending leave request not found or already processed", errorCode: "LEAVE_REQUEST_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const cancelLeaveRequest = async (req, res) => {
  try {
    const { approvalId } = req.params;

    if (!approvalId) {
      return sendError(res, {
        message: "approvalId is required",
        statusCode: 400,
        errorCode: "MISSING_APPROVAL_ID",
      });
    }

    const employeeEmail = req.user.email;
    const result = await cancelLeaveRequestService(employeeEmail, approvalId);
    return sendSuccess(
      res,
      result,
      200,
      "Leave request cancelled successfully"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getMyAttendanceStats
 *
 * @params
 * query: {
 *   month?: number, // optional, 1-12, defaults to current month
 *   year?: number   // optional, defaults to current year
 * }
 *
 * @process
 * 1. Fetch logged-in employee using req.user.email.
 * 2. Validate that employee exists; throw 404 if not found.
 * 3. Fetch employee's attendance record document (EmployeeRecord).
 * 4. Determine the selected month and year:
 *    - month defaults to current month
 *    - year defaults to current year
 * 5. Initialize statistics object with default counters:
 *    - presentDays, absentDays, halfDays, lateDays
 *    - leaveDays, leaveSummary (FULL_DAY/HALF_DAY)
 *    - leaveTypeCount (SICK, CASUAL, EMERGENCY)
 *    - totalHoursWorked
 * 6. Filter records for the selected month and year.
 * 7. Iterate over monthly records and compute:
 *    - Attendance counts: present, absent, half-day, late
 *    - Leave calculation including duration and type
 *    - Total worked hours from totalWorkedTime
 * 8. Format and return the statistics in a structured response.
 *
 * @response
 * 200 { 
 *   success: true,
 *   message: "Dashboard stats fetched",
 *   data: {
 *     month: string,           // Month name, e.g., "March"
 *     year: number,            // Selected year
 *     presentDays: number,
 *     absentDays: number,
 *     halfDays: number,
 *     lateDays: number,
 *     leaveDays: number,
 *     leaveSummary: { FULL_DAY: number, HALF_DAY: number },
 *     leaveTypeCount: { SICK: number, CASUAL: number, EMERGENCY: number },
 *     totalHoursWorked: number // Total hours worked in decimal
 *   }
 * }
 *
 * @errors
 * 404 { message: "Employee not found", errorCode: "EMPLOYEE_NOT_FOUND" }
 * 500 { message: "Server error", errorCode: "INTERNAL_SERVER_ERROR" }
 */
export const getMyAttendanceStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const result = await getMyAttendanceStatsService(req.user, month, year);
    return sendSuccess(
      res,
      {
        presentDays: result.stats.presentDays,
        absentDays: result.stats.absentDays,
        halfDays: result.stats.halfDays,
        lateDays: result.stats.lateDays,
        leaveDays: Number(result.stats.leaveDays.toFixed(1)),
        leaveSummary: {
          FULL_DAY: Number(result.stats.leaveSummary.FULL_DAY.toFixed(1)),
          HALF_DAY: Number(result.stats.leaveSummary.HALF_DAY.toFixed(1)),
        },
        leaveTypeCount: {
          SICK: Number(result.stats.leaveTypeCount.SICK.toFixed(1)),
          CASUAL: Number(result.stats.leaveTypeCount.CASUAL.toFixed(1)),
          EMERGENCY: Number(result.stats.leaveTypeCount.EMERGENCY.toFixed(1)),
        },
        totalHoursWorked: Number(result.stats.totalHoursWorked.toFixed(2)),
        month: result.month,
        year: result.year,
      },
      200,
      "Attendance dashboard stats fetched"
    );
  } catch (error) {
    return handleError(res, error);
  }
};

