import cron from "node-cron";
import Employee from "../../models/manage/employee.model.js";
import  DeletedEmployee  from "../../models/manage/deleteemployee.model.js";

cron.schedule(" 0 0 * * *", async () => {
  try {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // const cutoffDate = new Date(Date.now() - 5 * 60 * 1000);
    const employeesToArchive = await Employee.find({
      isDeleted: true,
      deletedAt: { $lte: cutoffDate }
    });
    for (const emp of employeesToArchive) {
      await DeletedEmployee.create({
        originalEmployeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        personalEmail: emp.personalEmail,
        role: emp.role,
        permissions: emp.permissions,
        createdBy: emp.createdBy,
        isNewEmployee: emp.isNewEmployee,
        deletedAt: emp.deletedAt
      });
      await Employee.deleteOne({ _id: emp._id });
    }
    console.log(`Archived ${employeesToArchive.length} deleted employees`);
    // console.log("Cleanup check running every 5 seconds...");
  } catch (err) {
    console.error("Cron Job Error:", err);
  }
});


