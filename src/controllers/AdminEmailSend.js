import { lowStockAlertTemplate } from "../config/templates/lowStockAlertTemplate.js";
import Employee from "../models/employeeModel.js";
import { sendZohoMail } from "../services/ZohoEmail/zohoMail.service.js";

export const sendLowStockAlertToAdmins = async (lowStockProducts) => {
  try {
    if (!lowStockProducts || lowStockProducts.length === 0) return;

    // Fetch Admin & SuperAdmin
    const admins = await Employee.find({
      role: { $in: [0, 1] },
    }).select("email");

    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    if (adminEmails.length === 0) return;

    // Generate Email HTML
    const html = lowStockAlertTemplate(lowStockProducts);

    // Send Mail
    await sendZohoMail(
      adminEmails.join(","), 
      "⚠ Low Stock Alert (Below 50)",
      html
    );
    console.log("Low stock alert sent to:", adminEmails);
  } catch (error) {
    console.error("LOW STOCK ALERT ERROR:", error.message);
  }
};