// utils/emailTemplates/orderConfirmationTemplate.js
export const orderConfirmationTemplate = (name, orderId, totalAmount, items) => {
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td>${item.productName} (${item.variantName})</td>
          <td>${item.quantity}</td>
          <td>₹${item.price}</td>
        </tr>
      `
    )
    .join("");

  return `
    <h2>Thank you for your order, ${name} 🎉</h2>
    <p>Your order <strong>${orderId}</strong> has been placed successfully.</p>

    <h3>Order Summary</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Price</th>
      </tr>
      ${itemsHtml}
    </table>

    <p><strong>Total Amount:</strong> ₹${totalAmount}</p>

    <p>We’ll notify you once your order is shipped 🚚</p>
    <p>The Digident Support Team</p>
  `;
};
