import express from "express";
import { assignPermissionToEmployee, createPermission,deletePermission, getAllPermissions, getPermissionAuditLogs, removePermissionFromEmployee } from "../../controllers/permission/permission.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
import checkAdminRole from "../../middlewares/checkAdminRole.middleware.js";

const router  = express.Router();
router.post("/create", auth,checkAdminRole ,createPermission);
router.get("/all", auth, checkAdminRole, getAllPermissions);
router.delete("/delete/:permissionId", auth,checkAdminRole ,deletePermission);


router.post("/assign", auth,checkPermission,assignPermissionToEmployee);
router.post("/remove" ,auth,checkPermission,removePermissionFromEmployee);
router.get("/audit-logs", auth, checkAdminRole, getPermissionAuditLogs);
export default router;
