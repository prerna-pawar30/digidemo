export const resetPasswordTemplate = (resetLink, userName) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #0078d7;">Password Reset Request</h2>

      <p>Hi ${userName || "User"},</p>

      <p>You recently requested to reset your password. Click the button below to reset it:</p>

      <a href="${resetLink}" 
         style="
           display: inline-block;
           padding: 10px 18px;
           background-color: #0078d7;
           color: white;
           text-decoration: none;
           border-radius: 5px;
           font-weight: bold;
         "
      >
        Reset Password
      </a>

      <p>
        If the button doesn't work, click or copy the link below into your browser:
        <br/>
        <a href="${resetLink}" style="color: #0078d7;">${resetLink}</a>
      </p>

      <p>This link will expire in <b>1 hour</b> for security reasons.</p>

      <p>If you did not request a password reset, please ignore this email.</p>

      <br/>
      <p style="font-weight: bold;">Best Regards,</p>
      <p>Your Team</p>
    </div>
  `;
};
