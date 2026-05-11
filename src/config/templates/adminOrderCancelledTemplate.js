export const adminOrderCancelledTemplate = (
  orderId,
  userName,
  userEmail,
  totalAmount,
  reason,
  paymentStatus,
  cancelledAt,
) => {
  return `
  <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;border:1px solid #eaeaea;border-radius:8px;overflow:hidden">

    <div style="background:#dc3545;color:#ffffff;padding:16px;text-align:center">
      <h2 style="margin:0;">Order Cancelled Alert</h2>
    </div>

    <div style="padding:24px;color:#333333">
      <p>Hello <strong>Admin</strong>,</p>

      <p>An order has been cancelled by the customer. Below are the details:</p>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
        <tr><td><strong>Order ID</strong></td><td>${orderId}</td></tr>
        <tr><td><strong>User Name</strong></td><td>${userName}</td></tr>
        <tr><td><strong>User Email</strong></td><td>${userEmail}</td></tr>
        <tr><td><strong>Total Amount</strong></td><td>₹${totalAmount}</td></tr>
        <tr><td><strong>Payment Status</strong></td><td>${paymentStatus}</td></tr>
        <tr><td><strong>Cancellation Reason</strong></td><td>${reason}</td></tr>
        <tr><td><strong>Cancelled At</strong></td><td>${cancelledAt}</td></tr>
      </table>

      <p style="margin-top:24px;">
        Please take the necessary actions regarding inventory, refund, and reporting.
      </p>

      <p>— <strong>System Notification</strong></p>
    </div>

    <div style="background:#f1f1f1;padding:12px;text-align:center;font-size:12px;color:#777">
      © ${new Date().getFullYear()} Your Store Admin Panel
    </div>
  </div>
  `;
};
