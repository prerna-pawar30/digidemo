export const applicationSubmittedTemplate = ({
  candidateName,
  jobTitle,
  updateUrl,
}) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Application Submitted</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,sans-serif;color:#222;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:30px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
              
              <tr>
                <td style="background:#111827;padding:24px 32px;text-align:center;">
                  <h1 style="margin:0;font-size:24px;color:#ffffff;">Application Submitted Successfully</h1>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                    Hi <strong>${candidateName || "Candidate"}</strong>,
                  </p>

                  <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                    Thank you for applying${
                      jobTitle ? ` for the <strong>${jobTitle}</strong> position` : ""
                    }. Your application has been submitted successfully.
                  </p>

                  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151;">
                    If you want to update your profile or application details later, use the button below.
                  </p>

                  <div style="text-align:center;margin:32px 0;">
                    <a href="${updateUrl}"
                      style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:bold;">
                      Update Your Profile
                    </a>
                  </div>

                  <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#6b7280;">
                    If the button does not work, copy and paste this link into your browser:
                  </p>

                  <p style="margin:8px 0 0;font-size:14px;word-break:break-all;color:#2563eb;">
                    ${updateUrl}
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
                    This is an automated email. Please do not reply directly.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};