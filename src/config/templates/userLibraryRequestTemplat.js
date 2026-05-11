export const userLibraryRequestTemplate = (brandName, category) => {
  return `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:auto;">
    
    <h2 style="color:#0f4c81;">Library Request Received</h2>

    <p>Dear Customer,</p>

    <p>
      Thank you for contacting <strong>Digident</strong>.
      We have successfully received your request for the following library:
    </p>

    <table style="border-collapse:collapse; width:100%; margin-top:15px;">
      <tr>
        <td style="border:1px solid #ddd; padding:8px;"><strong>Brand</strong></td>
        <td style="border:1px solid #ddd; padding:8px;">${brandName}</td>
      </tr>
      <tr>
        <td style="border:1px solid #ddd; padding:8px;"><strong>Category</strong></td>
        <td style="border:1px solid #ddd; padding:8px;">${category}</td>
      </tr>
    </table>

    <p style="margin-top:20px;">
      Our team is currently processing your request.
      The requested library will be shared with you within 
      <strong>24 hours</strong>.
    </p>

    <p>
      If you have any questions, feel free to contact our support team.
    </p>

    <br>

    <p>
      Best Regards,<br>
      <strong>Digident Support Team</strong>
    </p>

  </div>
  `;
};