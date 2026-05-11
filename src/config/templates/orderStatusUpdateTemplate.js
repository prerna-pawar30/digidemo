// utils/emailTemplates/orderStatusUpdateTemplate.js

export const orderStatusUpdateTemplate = (name, orderId, status) => {
  const statusMap = {
    confirmed: {
      title: "Order Confirmed",
      message: "Your order has been confirmed and is now being prepared.",
    },
    packed: {
      title: "Order Packed",
      message: "Your order has been packed and is ready for shipment.",
    },
    shipped: {
      title: "Order Shipped",
      message: "Your order has been shipped and is on the way.",
    },
    delivered: {
      title: "Order Delivered",
      message: "Your order has been delivered successfully.",
    },
    returned: {
      title: "Order Returned",
      message:
        "Your order has been returned successfully. Our team will process your refund shortly.",
    },
    partial_returned: {
      title: "Partial Return Processed",
      message:
        "Some items from your order have been returned. Refund will be processed soon.",
    },
  };

  const currentStatus = statusMap[status] || {
    title: "Order Status Updated",
    message: "Your order status has been updated.",
  };

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;padding:20px">

    <h2 style="color:#333;">Order Status Update</h2>

    <p>Hello ${name},</p>

    <p>Your order status has been updated.</p>

    <p><strong>Order ID:</strong> ${orderId}</p>

    <p><strong>Status:</strong> ${currentStatus.title}</p>

    <p>${currentStatus.message}</p>

    <p>
      You can track your order here:<br/>
      <a href="https://shop.digident.in/order/${orderId}">
       See Order Details
      </a>
    </p>

    <p>If you have any questions, please contact our support team.</p>

    <p>
      Regards,<br/>
      <strong>Digident Team</strong>
    </p>

    <hr/>

    <p style="font-size:12px;color:#666;">
      Digident Pvt Ltd<br/>
      info@digident.com<br/>
      314, Sapna Sangeeta Rd, near Matlani Garden, Professor Colony, Indore, Madhya Pradesh 452001
    </p>

    <p style="font-size:11px;color:#888;">
      This is a transactional email regarding your order. You are receiving it because you placed an order on our website.
    </p>

  </div>
  `;
};