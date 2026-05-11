export const lowStockAlertTemplate = (lowStockProducts) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: red;">⚠ Low Stock Alert</h2>

      <p>The following products are below <b>50 stock</b>. Please restock soon.</p>

      <table border="1" cellpadding="10" cellspacing="0" 
        style="border-collapse: collapse; width: 100%; text-align: left;">
        
        <thead style="background-color: #f2f2f2;">
          <tr>
            <th>Product Name</th>
            <th>Variant</th>
            <th>SKU</th>
            <th>Stock Left</th>
          </tr>
        </thead>

        <tbody>
          ${lowStockProducts
            .map(
              (p) => `
                <tr>
                  <td>${p.productName}</td>
                  <td>${p.variantName || "-"}</td>
                  <td>${p.sku || "-"}</td>
                  <td style="color:red; font-weight:bold;">${p.stockLeft}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      <br/>
      <p style="font-size: 14px; color: gray;">
        This is an automated alert from the system.
      </p>
    </div>
  `;
};
