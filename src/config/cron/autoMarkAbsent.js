import cron from "node-cron";
import  EmployeeRecord  from "../../models/manage/employee.model.js";
import { v6 as uuidv6 } from "uuid";

export const autoAbsentCronJob = () => {
  const getISTDate = () => {
    const now = new Date();
    const istNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    return istNow.toISOString().split("T")[0]; // YYYY-MM-DD
  };
  cron.schedule(
    "0 0 19 * * *", // 7:00 PM IST daily
    async () => {
      try {
        console.log("Running Auto Absent Cron Job...");

        const today = getISTDate();
        const allEmployeeRecords = await EmployeeRecord.find();

        if(!allEmployeeRecords.length){
          console.log("No Employee Records Found. Skipping...");
          return;
        }
        let updatedCount = 0;
        for (const empRecord of allEmployeeRecords) {
            // if employee never started attendance (new employee)
            if (!empRecord.records || empRecord.records.length === 0) {
              continue;
            }
          // if today's record already exists, skip
          const todayRecord = empRecord.records.find((r) => r.date === today);
          // If already exists skip
          if (todayRecord) continue;
          empRecord.records.push({
            recordId: uuidv6(),
            date: today,
            dayType: ["WORKING"],
            punchIn: null,
            punchOut: null,
            status: ["ABSENT"],
            totalWorkedTime: { hours: 0, minutes: 0 },

            leaveType: null,
            leaveDuration: null,
            fromDate: null,
            toDate: null,
            leaveStatus: null,
            leaveReason: null,

            requiresAdminApproval: false,
            adminAdjusted: false,
          });

          empRecord.markModified("records");
          await empRecord.save();
          updatedCount++;
        }

        console.log(
          `Auto Absent Cron Completed | Date: ${today} | Absent Marked: ${updatedCount}`
        );
      } catch (error) {
        console.error("Auto Absent Cron Job Error:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};


