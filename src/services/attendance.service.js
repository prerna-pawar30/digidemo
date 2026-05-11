import Employee from "../models/manage/employee.model.js"
import {EmployeeRecord} from "../models/manage/attendance.model.js"
import { getISTDateString, getISTNow } from "../constants/date.js";
import { v6 as uuidv6 } from "uuid";
import { AdminApproval } from "../models/manage/attendanceapproval.model.js";

export const punchInService = async (user) => {
  const normalizedEmail = user.email.toLowerCase().trim();

  /* ===== FIND EMPLOYEE ===== */
  const employee = await Employee.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_NOT_FOUND",
    };
  }

  const nowIST = getISTNow();
  const today = getISTDateString(nowIST);

  /* ===== FIND OR CREATE RECORD DOC ===== */
  let recordDoc = await EmployeeRecord.findOne({
    employee: employee._id,
  });

  if (!recordDoc) {
    recordDoc = await EmployeeRecord.create({
      employee: employee._id,
      records: [],
    });
  }

  /* ===== FIND TODAY RECORD ===== */
  let todayRecord = recordDoc.records.find((r) => r.date === today);

  if (todayRecord) {
    /* ===== ALREADY PUNCHED IN ===== */
    if (todayRecord.punchIn) {
      throw {
        message: "Already punched in for today",
        statusCode: 400,
        errorCode: "ALREADY_PUNCHED_IN",
      };
    }

    /* ===== HOLIDAY BLOCK ===== */
    if (todayRecord.dayType?.includes("HOLIDAY")) {
      throw {
        message: "Today is a Holiday. Punch-in disabled.",
        statusCode: 403,
        errorCode: "HOLIDAY_BLOCK",
      };
    }

    /* ===== FULL DAY LEAVE BLOCK ===== */
    if (
      todayRecord.dayType?.includes("LEAVE") &&
      todayRecord.leaveDuration === "FULL_DAY"
    ) {
      throw {
        message: "You are on Full-Day Leave",
        statusCode: 403,
        errorCode: "FULL_DAY_LEAVE",
      };
    }

    /* ===== HALF DAY LEAVE → ADD WORKING ===== */
    todayRecord.dayType = [
      ...new Set([...(todayRecord.dayType || []), "WORKING"]),
    ];

    todayRecord.punchIn = nowIST;
  } else {
    /* ===== CREATE NEW RECORD ===== */
    todayRecord = {
      recordId: uuidv6(),
      date: today,
      dayType: ["WORKING"],
      punchIn: nowIST,
      punchOut: null,
      status: [],
      totalWorkedTime: { hours: 0, minutes: 0 },
    };

    recordDoc.records.push(todayRecord);
    todayRecord = recordDoc.records[recordDoc.records.length - 1];
  }

  /* ===== LATE MARK (After 9:30 AM IST) ===== */
  const isLate =
    nowIST.getHours() > 9 ||
    (nowIST.getHours() === 9 && nowIST.getMinutes() > 30);

  if (isLate) {
    todayRecord.status = [
      ...new Set([...(todayRecord.status || []), "LATE"]),
    ];
  }

  /* ===== SAVE ===== */
  await recordDoc.save();

  /* ===== RESPONSE ===== */
  return {
    date: today,
    time: nowIST,
    dayType: todayRecord.dayType,
    status: todayRecord.status,
  };
};

export const punchOutService = async (user) => {
  const normalizedEmail = user.email.toLowerCase().trim();

  /* ===== FETCH EMPLOYEE ===== */
  const employee = await Employee.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_NOT_FOUND",
    };
  }

  const nowIST = getISTNow();
  const today = getISTDateString(nowIST);
  const dayOfWeek = nowIST.getDay(); // 0 = Sunday, 6 = Saturday

  /* ===== FETCH RECORD ===== */
  const recordDoc = await EmployeeRecord.findOne({ employee: employee._id });
  if (!recordDoc) {
    throw {
      message: "Attendance record not found",
      statusCode: 400,
      errorCode: "RECORD_NOT_FOUND",
    };
  }

  /* ===== FIND TODAY RECORD ===== */
  const todayRecord = recordDoc.records.find((r) => r.date === today);

  if (!todayRecord || !todayRecord.punchIn) {
    throw {
      message: "You have not punched in today",
      statusCode: 400,
      errorCode: "NOT_PUNCHED_IN",
    };
  }
  if (todayRecord.punchOut) {
    throw {
      message: "Already punched out today",
      statusCode: 400,
      errorCode: "ALREADY_PUNCHED_OUT",
    };
  }
  if (nowIST <= new Date(todayRecord.punchIn)) {
    throw {
      message: "Invalid punch-out time",
      statusCode: 400,
      errorCode: "INVALID_PUNCH_OUT",
    };
  }

  /* ===== CALCULATE WORK TIME ===== */
  const diffMs = nowIST - new Date(todayRecord.punchIn);
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = totalMinutes / 60;

  /* ===== DECIDE STATUS ===== */
  let workStatus = "PRESENT";

  if (dayOfWeek === 6) {
    // Saturday rule
    if (totalMinutes < 330) workStatus = "ABSENT";
  } else {
    // Weekday rule
    if (totalHours < 4) workStatus = "ABSENT";
    else if (totalHours < 6) workStatus = "HALF_DAY";
    else if (totalHours < 8) workStatus = "EARLY_GOING";
  }

  /* ===== UPDATE RECORD ===== */
  todayRecord.punchOut = nowIST;
  todayRecord.totalWorkedTime = {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };

  // Remove old attendance statuses
  todayRecord.status = todayRecord.status.filter(
    (s) => !["PRESENT", "ABSENT", "HALF_DAY", "EARLY_GOING"].includes(s)
  );

  // Add new status
  todayRecord.status.push(workStatus);

  await recordDoc.save();

  return {
    time: nowIST,
    worked: todayRecord.totalWorkedTime,
    status: todayRecord.status,
  };
};

export const sendPunchOutRequestService = async (user, requestedPunchOut) => {
  const normalizedEmail = user.email.toLowerCase().trim();

  // ===== Validate format =====
  const hasTime =
    /T\d{2}:\d{2}/.test(requestedPunchOut) || /\d{2}:\d{2}/.test(requestedPunchOut);

  if (!hasTime) {
    throw {
      message:
        "Punch-out must include time (format: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm)",
      statusCode: 400,
      errorCode: "INVALID_PUNCH_OUT_FORMAT",
    };
  }

  const punchOutTime = new Date(requestedPunchOut);
  if (isNaN(punchOutTime)) {
    throw {
      message: "Invalid punch-out time format",
      statusCode: 400,
      errorCode: "INVALID_PUNCH_OUT",
    };
  }

  const now = getISTNow();
  if (punchOutTime > now) {
    throw {
      message: "Punch-out time cannot be in the future",
      statusCode: 400,
      errorCode: "FUTURE_PUNCH_OUT",
    };
  }

  const date = punchOutTime.toISOString().split("T")[0];
  const today = getISTDateString(now);
  if (date > today) {
    throw {
      message: "Cannot request punch-out for a future date",
      statusCode: 400,
      errorCode: "FUTURE_DATE",
    };
  }

  // ===== Find employee =====
  const employee = await Employee.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_NOT_FOUND",
    };
  }

  // ===== Fetch attendance record =====
  const empRecord = await EmployeeRecord.findOne({ employee: employee._id });
  if (!empRecord) {
    throw {
      message: "Attendance not found",
      statusCode: 404,
      errorCode: "RECORD_NOT_FOUND",
    };
  }

  // ===== Find specific day record =====
  const record = empRecord.records.find((r) => r.date === date);
  if (!record) {
    throw {
      message: "No record found for this date",
      statusCode: 400,
      errorCode: "RECORD_NOT_FOUND_FOR_DATE",
    };
  }

  if (!record.punchIn) {
    throw {
      message: "No punch-in found for this date",
      statusCode: 400,
      errorCode: "NO_PUNCH_IN",
    };
  }

  if (record.punchOut) {
    throw {
      message: "Punch-out already exists",
      statusCode: 400,
      errorCode: "ALREADY_PUNCHED_OUT",
    };
  }

  if (record.dayType.includes("HOLIDAY")) {
    throw {
      message: "This date is a holiday",
      statusCode: 400,
      errorCode: "HOLIDAY_BLOCK",
    };
  }

  if (record.dayType.includes("LEAVE") && record.leaveDuration === "FULL_DAY") {
    throw {
      message: "You were on full-day leave",
      statusCode: 400,
      errorCode: "FULL_DAY_LEAVE",
    };
  }

  if (record.requiresAdminApproval) {
    throw {
      message: "Already sent for admin approval",
      statusCode: 400,
      errorCode: "ALREADY_PENDING_APPROVAL",
    };
  }

  // ===== Check for duplicate admin request =====
  const exists = await AdminApproval.findOne({
    employee: employee._id,
    requestType: "FORGOT_PUNCH_OUT",
    recordDate: date,
    status: "PENDING",
  });

  if (exists) {
    throw {
      message: "Request already pending",
      statusCode: 400,
      errorCode: "DUPLICATE_REQUEST",
    };
  }

  // ===== Mark record for admin approval =====
  record.requiresAdminApproval = true;

  // ===== Create admin approval request =====
  await AdminApproval.create({
    approvalId: uuidv6(),
    employee: employee._id,
    requestType: "FORGOT_PUNCH_OUT",
    recordDate: date,
    requestData: { requestedPunchOut },
    status: "PENDING",
  });

  await empRecord.save();

  return {
    date,
    requestedPunchOut,
    status: "PENDING",
  };
};

export const getMyAttendancesService = async (user) => {
  const normalizedEmail = user.email.toLowerCase().trim();
  /* ---------- FIND EMPLOYEE ---------- */
  const employee = await Employee.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_NOT_FOUND",
    };
  }
  /* ---------- FETCH EMPLOYEE RECORD ---------- */
  const recordDoc = await EmployeeRecord.findOne({
    employee: employee._id,
  });

  if (!recordDoc || !recordDoc.records.length) {
    return [];
  }

  /* ---------- RETURN RECORDS ---------- */
  return recordDoc.records;
};

export const getAllAttendancesService = async () => {
  const records = await EmployeeRecord.find()
    .populate("employee", "firstName lastName email role")
    .sort({ createdAt: -1 });

  if (!records.length) return [];

  // Flatten each record into per-day entries with employee info
  const allDays = records.flatMap((r) =>
    r.records.map((day) => ({
      employee: r.employee,
      ...day,
    }))
  );

  return allDays;
};

export const requestLeaveService = async (user, data) => {
  const { leaveType, leaveDuration = "FULL_DAY", fromDate, toDate, leaveReason } = data;

  const normalizedEmail = user.email.toLowerCase().trim();
  const today = getISTDateString(getISTNow());

  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (isNaN(start) || isNaN(end)) {
    throw {
      message: "Invalid date format",
      statusCode: 400,
      errorCode: "INVALID_DATE",
    };
  }

  if (start < new Date(today) || end < new Date(today)) {
    throw {
      message: "Past dates are not allowed",
      statusCode: 400,
      errorCode: "PAST_DATE",
    };
  }

  if (end < start) {
    throw {
      message: "toDate cannot be before fromDate",
      statusCode: 400,
      errorCode: "INVALID_DATE_RANGE",
    };
  }

  /* ---------- FIND EMPLOYEE ---------- */
  const employee = await Employee.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_NOT_FOUND",
    };
  }

  /* ---------- FETCH EMPLOYEE RECORD ---------- */
  const record = await EmployeeRecord.findOne({ employee: employee._id });

  /* ---------- GENERATE ALL DATES ---------- */
  const leaveDates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    leaveDates.push(d.toISOString().split("T")[0]);
  }

  /* ---------- CHECK EXISTING DAY RECORDS ---------- */
  if (record && Array.isArray(record.records)) {
    for (const date of leaveDates) {
      const existing = record.records.find((r) => r.date === date);
      if (existing) {
        throw {
          message: `Record already exists for ${date}. Cannot request leave.`,
          statusCode: 400,
          errorCode: "RECORD_EXISTS",
        };
      }
    }
  }

  /* ---------- CHECK DUPLICATE LEAVE REQUEST ---------- */
  const existingReq = await AdminApproval.findOne({
    employee: employee._id,
    requestType: "LEAVE",
    status: "PENDING",
    $expr: {
      $and: [
        { $lte: ["$requestData.fromDate", toDate] },
        { $gte: ["$requestData.toDate", fromDate] },
      ],
    },
  });

  if (existingReq) {
    throw {
      message: "A leave request for this date range is already pending",
      statusCode: 400,
      errorCode: "DUPLICATE_REQUEST",
    };
  }

  /* ---------- CREATE ADMIN APPROVAL ---------- */
  const approval = await AdminApproval.create({
    approvalId: uuidv6(),
    employee: employee._id,
    requestType: "LEAVE",
    recordDate: fromDate,
    requestData: {
      leaveType,
      leaveDuration,
      fromDate,
      toDate,
      leaveReason: leaveReason || null,
    },
    status: "PENDING",
  });

  return {
    approvalId: approval.approvalId,
    leaveType,
    leaveDuration,
    fromDate,
    toDate,
    status: "PENDING",
  };
};

export const getAllLeaveRequestsForAdminService = async () => {
  const requests = await AdminApproval.find({ requestType: "LEAVE" })
    .populate("employee", "firstName lastName email role")
    .sort({ createdAt: -1 });

  if (!requests.length) return [];

  const data = requests.map((r) => ({
    approvalId: r.approvalId,
    employee: r.employee,
    leaveType: r.requestData.leaveType,
    leaveDuration: r.requestData.leaveDuration,
    fromDate: r.requestData.fromDate,
    toDate: r.requestData.toDate,
    leaveReason: r.requestData.leaveReason,
    status: r.status,
    actionBy: r.actionBy || null,
    actionAt: r.actionAt || null,
    createdAt: r.createdAt,
  }));

  return data;
};

export const getAllPunchOutRequestsForAdminService = async () => {
  const approvals = await AdminApproval.find({
    requestType: "FORGOT_PUNCH_OUT",
    status: "PENDING",
  })
    .populate("employee", "firstName lastName email role")
    .sort({ createdAt: -1 });

  if (!approvals.length) return [];

  return approvals.map((a) => ({
    approvalId: a.approvalId,
    employee: a.employee,
    date: a.recordDate,
    requestedPunchOut: a.requestData.requestedPunchOut,
    status: a.status,
    createdAt: a.createdAt,
  }));
};

export const updatePunchOutRequestStatusService = async (
  adminUser,
  approvalId,
  action,
  rejectionReason
) => {
  // ===== FIND ADMIN =====
  const admin = await Employee.findOne({ email: adminUser.email });
  if (!admin) {
    throw {
      message: "Admin not found",
      statusCode: 403,
      errorCode: "ADMIN_NOT_FOUND",
    };
  }
  // ===== FIND APPROVAL =====
  const approval = await AdminApproval.findOne({ approvalId });
  if (!approval) {
    throw {
      message: "Approval request not found",
      statusCode: 404,
      errorCode: "APPROVAL_NOT_FOUND",
    };
  }

  if (approval.status !== "PENDING") {
    throw {
      message: "Request already processed",
      statusCode: 400,
      errorCode: "ALREADY_PROCESSED",
    };
  }

  const { employee, recordDate, requestData } = approval;

  // ===== FIND EMPLOYEE RECORD =====
  const record = await EmployeeRecord.findOne({ employee });
  if (!record) {
    throw {
      message: "Employee record not found",
      statusCode: 404,
      errorCode: "RECORD_NOT_FOUND",
    };
  }

  const day = record.records.find((r) => r.date === recordDate);
  if (!day) {
    throw {
      message: "Day record not found",
      statusCode: 404,
      errorCode: "DAY_RECORD_NOT_FOUND",
    };
  }

  // ===== HANDLE REJECTION =====
  if (action === "REJECTED") {
    day.requiresAdminApproval = false;
    day.adminAdjusted = true;
    day.punchOut = null;
    day.totalWorkedTime = {
      hours: 0,
      minutes: 0,
    };

    day.status = day.status.filter(
      (s) => !["PRESENT", "ABSENT", "HALF_DAY", "EARLY_GOING"].includes(s)
    );
    day.status.push("ABSENT");

    await record.save();

    approval.status = "REJECTED";
    approval.actionBy = admin._id;
    approval.actionAt = new Date();
    approval.rejectionReason = rejectionReason || "Not specified";
    await approval.save();

    return {
      approvalId: approval.approvalId,
      employee: approval.employee,
      date: recordDate,
      status: day.status,
      actionBy: admin.email,
      actionAt: approval.actionAt,
      rejectionReason: approval.rejectionReason,
    };
  }

  // ===== APPROVAL FLOW =====
  const requestedPunchOut = requestData?.requestedPunchOut;
  if (!requestedPunchOut) {
    throw {
      message: "Invalid punch-out request data",
      statusCode: 400,
      errorCode: "INVALID_REQUEST_DATA",
    };
  }

  if (!day.punchIn) {
    throw {
      message: "Cannot punch-out without punch-in",
      statusCode: 400,
      errorCode: "NO_PUNCH_IN",
    };
  }

  if (day.punchOut) {
    throw {
      message: "Punch-out already exists",
      statusCode: 400,
      errorCode: "PUNCH_OUT_EXISTS",
    };
  }

  // ===== APPLY PUNCH-OUT =====
  const punchOutTime = new Date(requestedPunchOut);
  if (isNaN(punchOutTime.getTime())) {
    throw {
      message: "Invalid punch-out time",
      statusCode: 400,
      errorCode: "INVALID_TIME",
    };
  }

  if (punchOutTime < new Date(day.punchIn)) {
    throw {
      message: "Punch-out cannot be before punch-in",
      statusCode: 400,
      errorCode: "INVALID_PUNCH_OUT",
    };
  }

  day.punchOut = punchOutTime;
  day.requiresAdminApproval = false;
  day.adminAdjusted = true;

  // ===== RECOMPUTE STATUS =====
  const diffMs = punchOutTime - new Date(day.punchIn);
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = totalMinutes / 60;

  let newStatus = "PRESENT";
  const weekday = new Date(day.date).getDay();

  if (weekday === 6) {
    if (totalMinutes < 330) newStatus = "ABSENT";
  } else {
    if (totalHours < 4) newStatus = "ABSENT";
    else if (totalHours < 6) newStatus = "HALF_DAY";
    else if (totalHours < 8) newStatus = "EARLY_GOING";
  }

  day.totalWorkedTime = {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };

  day.status = day.status.filter(
    (s) => !["PRESENT", "ABSENT", "HALF_DAY", "EARLY_GOING"].includes(s)
  );
  day.status.push(newStatus);

  // ===== SAVE =====
  await record.save();

  approval.status = "APPROVED";
  approval.actionBy = admin._id;
  approval.actionAt = new Date();
  await approval.save();

  return {
    approvalId: approval.approvalId,
    employee,
    date: recordDate,
    punchOut: punchOutTime,
    worked: day.totalWorkedTime,
    status: day.status,
    actionBy: admin.email,
    actionAt: approval.actionAt,
  };
};

export const updateLeaveRequestStatusService = async (
  adminUser,
  approvalId,
  action,
  rejectionReason
) => {
  // ===== FIND ADMIN =====
  const admin = await Employee.findOne({ email: adminUser.email });
  if (!admin) {
    throw {
      message: "Admin not found",
      statusCode: 403,
      errorCode: "ADMIN_NOT_FOUND",
    };
  }

  // ===== FIND LEAVE APPROVAL =====
  const approval = await AdminApproval.findOne({ approvalId, requestType: "LEAVE" });
  if (!approval) {
    throw {
      message: "Leave request not found",
      statusCode: 404,
      errorCode: "LEAVE_REQUEST_NOT_FOUND",
    };
  }

  if (approval.status !== "PENDING") {
    throw {
      message: "Request already processed",
      statusCode: 400,
      errorCode: "ALREADY_PROCESSED",
    };
  }

  // ===== HANDLE REJECTION =====
  if (action === "REJECTED") {
    approval.status = "REJECTED";
    approval.actionBy = admin._id;
    approval.actionAt = new Date();
    approval.rejectionReason = rejectionReason || "Not specified";
    await approval.save();

    return {
      approvalId: approval.approvalId,
      employee: approval.employee,
      status: "REJECTED",
      actionBy: admin.email,
      actionAt: approval.actionAt,
      rejectionReason: approval.rejectionReason,
    };
  }

  // ===== APPROVAL FLOW =====
  const { employee, requestData } = approval;
  const { leaveType, leaveDuration, fromDate, toDate, leaveReason } = requestData;

  const record = await EmployeeRecord.findOne({ employee });
  if (!record) {
    throw {
      message: "Employee record not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_RECORD_NOT_FOUND",
    };
  }
  const start = new Date(fromDate);
  const end = new Date(toDate);

  // Generate all leave dates
  const leaveDates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    leaveDates.push(d.toISOString().split("T")[0]);
  }

  // Check for conflicts
  for (const dateStr of leaveDates) {
    const existing = record.records.find(r => r.date === dateStr);
    if (existing) {
      throw {
        message: `Attendance already exists for ${dateStr}`,
        statusCode: 400,
        errorCode: "ATTENDANCE_EXISTS",
      };
    }

    // Push leave record
    record.records.push({
      recordId: approval.approvalId,
      date: dateStr,
      dayType: ["LEAVE"],
      status: ["LEAVE"],
      leaveType,
      leaveDuration,
      fromDate: start,
      toDate: end,
      leaveStatus: "APPROVED",
      leaveReason: leaveReason || null,
      requiresAdminApproval: false,
      adminAdjusted: true,
    });
  }

  approval.status = "APPROVED";
  approval.actionBy = admin._id;
  approval.actionAt = new Date();

  await record.save();
  await approval.save();

  return {
    approvalId: approval.approvalId,
    employee,
    fromDate,
    toDate,
    leaveType,
    leaveDuration,
    status: "APPROVED",
    actionBy: admin.email,
    actionAt: approval.actionAt,
  };
};

export const createHolidayService = async (date, title) => {
  const holidayDate = new Date(date);
  if (isNaN(holidayDate)) {
    throw {
      message: "Invalid date format",
      statusCode: 400,
      errorCode: "INVALID_DATE",
    };
  }

  const dateStr = holidayDate.toISOString().split("T")[0];

  const employees = await Employee.find({ isDeleted: false });

  let updated = 0;
  let skipped = 0;

  for (const emp of employees) {
    const record = await EmployeeRecord.findOne({ employee: emp._id });

    // If employee has no record document → skip
    if (!record) {
      skipped++;
      continue;
    }

    let day = record.records.find(r => r.date === dateStr);

    if (!day) {
      // Create new holiday entry
      record.records.push({
        recordId: `HOLIDAY-${dateStr}`,
        date: dateStr,
        dayType: ["HOLIDAY"],
        status: ["HOLIDAY"],
        leaveType: null,
        leaveDuration: "FULL_DAY",
        leaveStatus: null,
        fromDate: null,
        toDate: null,
        leaveReason: title,
        punchIn: null,
        punchOut: null,
        totalWorkedTime: { hours: 0, minutes: 0 },
        requiresAdminApproval: false,
        adminAdjusted: true,
      });
      updated++;
    } else {
      // Update existing record to holiday
      day.dayType = ["HOLIDAY"];
      day.status = ["HOLIDAY"];
      day.leaveType = null;
      day.leaveDuration = "FULL_DAY";
      day.leaveStatus = null;
      day.fromDate = null;
      day.toDate = null;
      day.leaveReason = title;
      day.punchIn = null;
      day.punchOut = null;
      day.totalWorkedTime = { hours: 0, minutes: 0 };
      day.requiresAdminApproval = false;
      day.adminAdjusted = true;
      updated++;
    }

    await record.save();
  }

  return {
    date: dateStr,
    title,
    totalEmployees: employees.length,
    updated,
    skipped,
  };
};

export const getHolidaysService = async (email, type = "all") => {
  const todayStr = getISTDateString(getISTNow());

  // Find employee
  const employee = await Employee.findOne({ email, isDeleted: false });
  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "NOT_FOUND",
    };
  }

  // Fetch employee record
  const record = await EmployeeRecord.findOne({ employee: employee._id });
  if (!record || !Array.isArray(record.records)) {
    return [];
  }

  // Extract holiday records
  const holidays = record.records
    .filter(day => day.dayType.includes("HOLIDAY"))
    .filter(day => {
      if (type === "past") return day.date <= todayStr;
      if (type === "upcoming") return day.date >= todayStr;
      return true; // all
    })
    .map(day => ({
      date: day.date,
      reason: day.leaveReason || "Holiday",
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return holidays;
};

export const getMyLeaveRequestsService = async (email) => {
  // Find employee
  const employee = await Employee.findOne({ email, isDeleted: false });
  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "NOT_FOUND",
    };
  }

  // Fetch leave requests
  const requests = await AdminApproval.find({
    employee: employee._id,
    requestType: "LEAVE",
  })
    .sort({ createdAt: -1 });

  // Format response
  return requests.map(r => ({
    approvalId: r.approvalId,
    leaveType: r.requestData.leaveType,
    leaveDuration: r.requestData.leaveDuration,
    fromDate: r.requestData.fromDate,
    toDate: r.requestData.toDate,
    leaveReason: r.requestData.leaveReason,
    status: r.status,
    actionBy: r.actionBy,
    actionAt: r.actionAt,
    createdAt: r.createdAt,
  }));
};

export const getMyPunchOutRequestsService = async (email) => {
  // Find employee
  const employee = await Employee.findOne({ email, isDeleted: false });
  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "NOT_FOUND",
    };
  }

  // Fetch punch-out requests
  const requests = await AdminApproval.find({
    employee: employee._id,
    requestType: "FORGOT_PUNCH_OUT",
  })
    .sort({ createdAt: -1 });

  // Format response
  return requests.map(r => ({
    approvalId: r.approvalId,
    date: r.recordDate,
    requestedPunchOut: r.requestData.requestedPunchOut,
    status: r.status,
    actionBy: r.actionBy,
    actionAt: r.actionAt,
    createdAt: r.createdAt,
  }));
};


export const getAttendanceApprovalsByStatusService = async (
  email,
  status
) => {
  // ===== VERIFY ADMIN =====
  const admin = await Employee.findOne({ email });
  if (!admin) {
    throw {
      message: "Unauthorized",
      statusCode: 403,
      errorCode: "UNAUTHORIZED",
    };
  }

  // ===== BUILD FILTER =====
  const filter = {};
  if (status) {
    filter.status = status;
  }

  // ===== FETCH APPROVALS =====
  const approvals = await AdminApproval.find(filter)
    .populate("employee", "firstName lastName email role")
    .populate("actionBy", "firstName lastName email")
    .sort({ createdAt: -1 });

  if (!approvals.length) return [];

  // ===== FORMAT RESPONSE =====
  return approvals.map((doc) => ({
    approvalId: doc.approvalId,
    employee: doc.employee,
    requestType: doc.requestType,
    recordDate: doc.recordDate,
    requestData: doc.requestData,
    status: doc.status,
    actionBy: doc.actionBy,
    actionAt: doc.actionAt,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt,
  }));
};

export const getLeaveRequestsByStatusService = async (email, status) => {
  // ===== VERIFY ADMIN =====
  const admin = await Employee.findOne({ email, role: "ADMIN" });
  if (!admin) {
    throw {
      message: "Unauthorized",
      statusCode: 403,
      errorCode: "UNAUTHORIZED",
    };
  }

  // ===== BUILD FILTER =====
  const filter = { requestType: "LEAVE" };
  if (status) {
    filter.status = status;
  }

  // ===== FETCH DATA =====
  const approvals = await AdminApproval.find(filter)
    .populate("employee", "firstName lastName email role")
    .populate("actionBy", "firstName lastName email")
    .sort({ createdAt: -1 });

  if (!approvals.length) return [];

  // ===== FORMAT RESPONSE =====
  return approvals.map((doc) => ({
    approvalId: doc.approvalId,
    employee: doc.employee,
    leaveType: doc.requestData.leaveType,
    leaveDuration: doc.requestData.leaveDuration,
    fromDate: doc.requestData.fromDate,
    toDate: doc.requestData.toDate,
    leaveReason: doc.requestData.leaveReason,
    status: doc.status,
    actionBy: doc.actionBy,
    actionAt: doc.actionAt,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt,
  }));
};

export const cancelLeaveRequestService = async (email, approvalId) => {
  // ===== FIND EMPLOYEE =====
  const employee = await Employee.findOne({ email, isDeleted: false });
  if (!employee) {
    throw { message: "Employee not found", statusCode: 404, errorCode: "EMP_NOT_FOUND" };
  }

  // ===== FIND PENDING LEAVE REQUEST =====
  const approval = await AdminApproval.findOne({
    approvalId,
    employee: employee._id,
    requestType: "LEAVE",
    status: "PENDING",
  });

  if (!approval) {
    throw {
      message: "Pending leave request not found or already processed",
      statusCode: 404,
      errorCode: "APPROVAL_NOT_FOUND",
    };
  }

  // ===== DELETE REQUEST =====
  await approval.deleteOne();

  return { approvalId };
};

export const getMyAttendanceStatsService = async (user, month, year) => {
  const normalizedEmail = user.email.toLowerCase().trim();

  // ===== Find Employee =====
  const employee = await Employee.findOne({ email: normalizedEmail, isDeleted: false });
  if (!employee) {
    throw {
      message: "Employee not found",
      statusCode: 404,
      errorCode: "EMPLOYEE_NOT_FOUND",
    };
  }

  // ===== Fetch Attendance Records =====
  const recordDoc = await EmployeeRecord.findOne({ employee: employee._id });

  const now = getISTNow();
  const selectedMonth = month ? Number(month) - 1 : now.getMonth();
  const selectedYear = year ? Number(year) : now.getFullYear();

  const stats = {
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    lateDays: 0,
    leaveDays: 0,
    leaveSummary: { FULL_DAY: 0, HALF_DAY: 0 },
    leaveTypeCount: { SICK: 0, CASUAL: 0, EMERGENCY: 0 },
    totalHoursWorked: 0,
  };

  if (!recordDoc?.records?.length) {
    return {
      month: new Date(selectedYear, selectedMonth).toLocaleString("default", { month: "long" }),
      year: selectedYear,
      stats,
    };
  }

  const monthlyRecords = recordDoc.records.filter((r) => {
    const d = new Date(r.date + "T00:00:00");
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  monthlyRecords.forEach((r) => {
    const status = r.status || [];
    const dayType = r.dayType || [];

    if (status.includes("PRESENT")) stats.presentDays++;
    if (status.includes("ABSENT")) stats.absentDays++;
    if (status.includes("HALF_DAY")) stats.halfDays++;
    if (status.includes("LATE")) stats.lateDays++;

    if (dayType.includes("LEAVE") || status.includes("LEAVE")) {
      const leaveValue = r.leaveDuration === "HALF_DAY" ? 0.5 : 1;
      stats.leaveDays += leaveValue;
      if (r.leaveDuration === "HALF_DAY") stats.leaveSummary.HALF_DAY += 0.5;
      else stats.leaveSummary.FULL_DAY += 1;

      if (r.leaveType && stats.leaveTypeCount[r.leaveType] !== undefined) {
        stats.leaveTypeCount[r.leaveType] += leaveValue;
      }
    }

    if (r.totalWorkedTime) {
      stats.totalHoursWorked += (r.totalWorkedTime.hours || 0) + ((r.totalWorkedTime.minutes || 0) / 60);
    }
  });

  return {
    month: new Date(selectedYear, selectedMonth).toLocaleString("default", { month: "long" }),
    year: selectedYear,
    stats,
  };
};