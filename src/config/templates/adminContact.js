export const adminContactTemplate = (firstName, lastName, email, phone, message) => `
<!DOCTYPE html> 
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Contact Form Submission</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f4f7fa; margin:0; padding:40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:#fff; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.1);">
      <tr>
        <td style="padding:30px;">
          <h2 style="color:#1976D2;">📩 New Contact Form Submission</h2>
          <p style="font-size:16px; color:#333;">A new user has contacted Digident through the website form.</p>

          <table style="width:100%; margin-top:15px; border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0; font-weight:bold;">Name:</td>
              <td>${firstName} ${lastName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; font-weight:bold;">Email:</td>
              <td>${email}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; font-weight:bold;">Phone:</td>
              <td>${phone}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; font-weight:bold;">Message:</td>
              <td>${message}</td>
            </tr>
          </table>

          <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;" />
          <p style="font-size:14px; color:#888;">
            <b>Digident Contact System</b><br/>
            This is an automated notification for internal use.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
