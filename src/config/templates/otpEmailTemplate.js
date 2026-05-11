export const otpVerificationTemplate = (email,otp) => {
  return `
  <div style="max-width:600px;margin:auto;background:#ffffff;padding:24px;border-radius:8px;
              font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;
              border:1px solid #e5e7eb;">
    
    <h2 style="color:#0078d7;margin-bottom:10px;">Email Verification</h2>

    <p>Hi ${email || "User"},</p>

    <p>
      Thank you for signing up. Please use the One-Time Password (OTP):
    </p>

    <div style="text-align:center;margin:24px 0;">
      <span style="
        display:inline-block;
        padding:14px 28px;
        background:#0078d7;
        color:#ffffff;
        font-size:26px;
        font-weight:bold;
        letter-spacing:6px;
        border-radius:6px;">
        ${otp}
      </span>
    </div>

    <p>This OTP is valid for <b>5 minutes</b> for security reasons.</p>

    <p>
      If you did not request this verification, you can safely ignore this email.
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>

    <p style="margin-bottom:4px;">Best Regards,</p>
    <p style="font-weight:bold;margin-top:0;">Digident India Team</p>

    <p style="font-size:12px;color:#6b7280;margin-top:20px;">
      This is an automated message, please do not reply.
    </p>
  </div>
  `;
};
