export const verifyEmailTemplate = (verificationLink,firstName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb; color: #333;">
      <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background-color: #0078d7; color: white; padding: 16px 20px;">
          <h2 style="margin: 0;">Verify Your Email Address</h2>
        </div>
        
        <!-- Body -->
        <div style="padding: 20px;">
          <p>Hi <b>${firstName}</b>,</p>
          
          <p>Welcome to ${process.env.APP_NAME || "Our Platform"}! To activate your account, please verify your email address by clicking the button below:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #0078d7; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Verify Email
            </a>
          </div>

          <p>If the button above doesn’t work, you can copy and paste the following link into your browser:</p>
            <a href="${verificationLink}">
              click here ->
            </a>

          <p style="margin-top: 25px;">This link will expire in <b>1 hour</b>. If it expires, you can request a new verification email from your account settings.</p>

          <p style="margin-top: 25px; font-size: 12px; color: #666;">
            If you didn’t create an account with us, you can safely ignore this message.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f1f1f1; text-align: center; padding: 12px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} ${process.env.APP_NAME || "Your Company"}. All rights reserved.
        </div>

      </div>
    </div>
  `;
};
