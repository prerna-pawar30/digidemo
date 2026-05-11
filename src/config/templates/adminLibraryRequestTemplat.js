export const adminLibraryRequestTemplate = (
  email,
  brandName,
  category
) => {
  return `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:auto;">

    <h2 style="color:#c0392b;">New ScanBridge Library Request</h2>

    <p>A new library request has been submitted.</p>

    <table style="border-collapse:collapse; width:100%; margin-top:15px;">
      <tr>
        <td style="border:1px solid #ddd; padding:8px;"><strong>Email</strong></td>
        <td style="border:1px solid #ddd; padding:8px;">${email}</td>
      </tr>

      <tr>
        <td style="border:1px solid #ddd; padding:8px;"><strong>Brand</strong></td>
        <td style="border:1px solid #ddd; padding:8px;">${brandName}</td>
      </tr>

      <tr>
        <td style="border:1px solid #ddd; padding:8px;"><strong>Category</strong></td>
        <td style="border:1px solid #ddd; padding:8px;">${category}</td>
      </tr>

      <tr>
        <td style="border:1px solid #ddd; padding:8px;"><strong>Requested At</strong></td>
        <td style="border:1px solid #ddd; padding:8px;">${new Date().toLocaleString()}</td>
      </tr>

    </table>

    <p style="margin-top:20px;">
      Please process this request and provide the requested library to the user
      within <strong>24 hours</strong>.
    </p>

  </div>
  `;
};