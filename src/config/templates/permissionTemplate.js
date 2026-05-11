export const returnStockNotificationTemplate = (
  employeeName,
  orderId,
  customerName,
  items
) => {
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.productId}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.variantId}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.reason || "-"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; padding:20px;">
      <h2 style="color:#333;">Return Request Notification</h2>

      <p>Hello ${employeeName},</p>

      <p>A new return request has been submitted.</p>

      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Customer Name:</strong> ${customerName}</p>

      <h3>Returned Items:</h3>

      <table style="border-collapse: collapse; width:100%;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;border:1px solid #ddd;">Product ID</th>
            <th style="padding:8px;border:1px solid #ddd;">Variant ID</th>
            <th style="padding:8px;border:1px solid #ddd;">Quantity</th>
            <th style="padding:8px;border:1px solid #ddd;">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <br/>

      <p>Please review and update stock accordingly.</p>

      <p style="margin-top:30px;">Regards,<br/><strong>System Notification</strong></p>
    </div>
  `;
};