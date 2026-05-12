import Invoice from "../models/manage/invoice.model.js";

export const generateInvoiceNumbers = async () => {
  const currentDate = new Date();

  const currentMonth = currentDate.getMonth() + 1; // Jan = 1
  const currentYear = currentDate.getFullYear();

  /*
    FINANCIAL YEAR LOGIC

    Apr 2026 -> Mar 2027  => 2027
    Apr 2027 -> Mar 2028  => 2028

    Jan/Feb/Mar belong to same FY ending year
  */

  const financialYear =
    currentMonth >= 4 ? currentYear + 1 : currentYear;

  const year = financialYear.toString();

  /* ---------- FINANCIAL YEAR DATE RANGE ---------- */

  const startDate =
    currentMonth >= 4
      ? new Date(currentYear, 3, 1) // 1 Apr current year
      : new Date(currentYear - 1, 3, 1); // 1 Apr previous year

  const endDate =
    currentMonth >= 4
      ? new Date(currentYear + 1, 2, 31, 23, 59, 59, 999) // 31 Mar next year
      : new Date(currentYear, 2, 31, 23, 59, 59, 999); // 31 Mar current year

  /* ---------- FIND LAST INVOICE OF SAME FY ---------- */

  const lastInvoice = await Invoice.findOne({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
    invoiceNumber: {
      $regex: `^#${year}`,
    },
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber")
    .lean();

  let sequence = 1;

  if (lastInvoice?.invoiceNumber) {
    const lastSeq = parseInt(
      lastInvoice.invoiceNumber.replace(`#${year}`, "")
    );

    sequence = lastSeq + 1;
  }

  /* ---------- PAD TO 2 DIGITS ---------- */

  const seq = String(sequence).padStart(2, "0");

  return {
    invoiceNumber: `#${year}${seq}`,
    orderNumber: `${year}11${seq}`,
  };
};