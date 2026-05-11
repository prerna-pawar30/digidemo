export const employeeWelcomeEmail = ( firstName, email, password ) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb; color: #333;">
      <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #0078d7; color: white; padding: 16px 20px;">
          <h2>Welcome to Digident</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hi <b>${firstName}</b>,</p>
          <p>Your Digident company account has been created successfully. Below are your login credentials:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><b>Company Email</b></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><b>Temporary Password</b></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${password}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Please log in using the credentials above and change your password immediately for security.</p>

          <p style="margin-top: 25px;">
            <a href="https://manage.digident.in/login" 
               style="background-color: #0078d7; color: white; padding: 10px 16px; border-radius: 5px; text-decoration: none;">
              Login to Your Account
            </a>
          </p>

          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            If you didn’t request this account, please contact the admin team immediately.
          </p>
        </div>
      </div>
    </div>
  `;
};
