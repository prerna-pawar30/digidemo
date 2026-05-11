import express from "express";
import { createOrder,getUserOrders,getSingleOrder,cancelOrder,updateOrderStatus,getAllOrdersAdmin,getOrdersByStatus,markRefundCompleted,salesDashboard,verifyRazorpay,getAllOrders,markRefundCompleteAdmin,createReturnRequest,getAllReturnRequests,updatePendingReturnRequest,updateReturnRequestStatus,updateCourierDetails} from "../../controllers/order/order.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import { attachUser } from "../../middlewares/attechuser.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = express.Router();
// ADMIN ROUTES
router.get("/get/all", getAllOrdersAdmin);
router.patch("/:orderId/status",auth,checkPermission, updateOrderStatus);
router.get("/get/status/:status", getOrdersByStatus);
// USER ROUTES
router.post("/create",auth,attachUser, createOrder);
router.post('/verifyRazorpay',auth,attachUser,verifyRazorpay)
router.get("/my-orders",auth,attachUser, getUserOrders);
// router.post("/payment/initiate/:orderId", employeeVerifyAccessToken, initiatePayment);
router.put("/cancel/:orderId",auth, attachUser, cancelOrder);
router.get("/get/:orderId",auth,attachUser, getSingleOrder);
router.put("/refund/complete/admin/:orderId",auth,checkPermission,markRefundCompleteAdmin);
// router.delete("/delete", deleteAllOrders);
// add middleware to verify user and attach user
router.put("/refund/complete/:orderId",markRefundCompleted);
router.get("/dashboard", salesDashboard); 
router.get("/allorders",getAllOrders)
router.post("/return",auth,attachUser, createReturnRequest);
router.put("/return/update/:orderId/:requestId",auth,attachUser,updatePendingReturnRequest);
router.get("/return-req/get",getAllReturnRequests);
router.put("/return/update/status/:orderId/:requestId",auth,checkPermission, updateReturnRequestStatus);
router.put("/courier/:orderId",auth,checkPermission,updateCourierDetails);
export default router;  

