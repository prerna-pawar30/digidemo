import express from "express";
<<<<<<< HEAD
import { createInvoice, getInvoiceById, getInvoices, updateInvoice,deleteInvoice, createInvoiceFromOrder, getInvoiceByIdForUser, deleteInvoiceByUser, updateInvoiceByUser, getInvoiceCustomers } from "../../controllers/invoice/invoice.controller.js";
=======
import { createInvoice, getInvoiceById, getInvoices, updateInvoice,deleteInvoice, createInvoiceFromOrder, getInvoiceByIdForUser, deleteInvoiceByUser, updateInvoiceByUser } from "../../controllers/invoice/invoice.controller.js";
>>>>>>> b17a9100d3b45c984a0a3837d8ee403056c39ac0
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
const router = express.Router();

router.post("/manage/create", auth,
  checkPermission,
   createInvoice);
router.put("/manage/update/:invoiceId", auth,
  checkPermission,
   updateInvoice);
router.get("/manage/get/:permission", auth,
  checkPermission,
   getInvoices);
router.get("/manage/get/:invoiceId/:permission", auth,
  checkPermission,
   getInvoiceById);
router.delete("/manage/delete/:invoiceId", auth,checkPermission, deleteInvoice);  

router.post("/create", auth, createInvoiceFromOrder);
   router.get("/get/:invoiceId", auth, getInvoiceByIdForUser);
   router.delete("/delete/:invoiceId", auth, deleteInvoiceByUser); // Allow users to delete their own invoices
   router.put("/update/:invoiceId", auth, updateInvoiceByUser); // Allow users to update their own invoices
<<<<<<< HEAD

   router.get(
  "/customers",
  auth,
  getInvoiceCustomers
);
   

=======
>>>>>>> b17a9100d3b45c984a0a3837d8ee403056c39ac0
export default router;