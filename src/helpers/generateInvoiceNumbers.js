import Invoice from "../models/manage/invoice.model.js";

export const generateInvoiceNumbers = async () => {
  const year = new Date().getFullYear().toString();

  /* ---------- FIND LAST INVOICE OF CURRENT YEAR ---------- */
  const lastInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^#${year}` },
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber")  
    .lean();

  let sequence = 1;

  if (lastInvoice?.invoiceNumber) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.replace(`#${year}`, ""));
    sequence = lastSeq + 1;
  }

  /* ---------- PAD ONLY TO 2 DIGITS ---------- */
  const seq = String(sequence).padStart(2, "0");

  return {
    invoiceNumber: `#${year}${seq}`,
    customerNo: `${year}01${seq}`,
    orderNumber: `${year}11${seq}`,
  };
};