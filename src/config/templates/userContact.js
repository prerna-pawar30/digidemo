export const userContactTemplate = (firstName, message) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>We’ve received your message</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f7f9fb; margin:0; padding:40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:#fff; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.1);">
      <tr>
        <td style="padding:30px;">
          <h2 style="color:#2E7D32;">Hi ${firstName},</h2>
          <p style="font-size:16px; color:#333;">
            Thank you for getting in touch with <b>Digident</b>! 💬
          </p>
          <p style="font-size:16px; color:#333;">
            We’ve successfully received your message. Our support team will respond within <b>24 hours</b>.
          </p>

          <div style="background-color:#f3f4f6; padding:15px; border-left:4px solid #2E7D32; margin-top:15px; border-radius:5px;">
            <p style="margin:0; font-size:15px;"><strong>Your Message:</strong></p>
            <p style="margin:5px 0 0; color:#555;">${message}</p>
          </div>

          <p style="margin-top:25px; font-size:16px;">Warm regards,</p>
          <p style="font-weight:bold; color:#2E7D32;">The Digident Support Team</p>

          <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;" />
          <p style="font-size:13px; color:#888; text-align:center;">
            © ${new Date().getFullYear()} Digident. All rights reserved.<br />
            This is an automated message, please do not reply.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
