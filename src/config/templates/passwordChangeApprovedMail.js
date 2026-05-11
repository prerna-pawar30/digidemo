
export const passwordChangeApprovedTemplate = (employee, adminEmail) => {
  return `
    <p>Hi ${employee.firstName || ""},</p>
    <p>Your password change request has been <strong>approved</strong> by ${adminEmail}.</p>
    <p>You can now log in using your new password.</p>
    <br/>
    <p>Best regards,<br/>E-commerce Admin Team</p>
  `;
};
