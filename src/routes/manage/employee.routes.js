import express from "express";
import { changeEmployeePassword, createEmployee,  deleteEmployee, forgotEmployeePassword, getAllDeletedEmployee, getEmployee, loginEmployee, logoutEmployee, refreshEmployeeAccessToken, resetEmployeePassword, updateEmployeeRole, verifyEmail } from "../../controllers/auth/manage/employee.controller.js";
import hierarchyMiddleware from "../../middlewares/hierarchy.middleware.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";
const router = express.Router();
// Update Role
router.put("/role-update",auth,hierarchyMiddleware, checkPermission, updateEmployeeRole); //ROLE_UPDATE
router.delete("/deleted", checkPermission, getAllDeletedEmployee);
router.post("/create", auth,hierarchyMiddleware, checkPermission, createEmployee ); //"CREATE_EMPLOYEE"
// Login Employee
router.post("/login",loginEmployee);
// Logout
router.post("/logout" , auth, logoutEmployee);
// change password
router.post("/change-password",auth,changeEmployeePassword);
router.post("/reset-password/:token", resetEmployeePassword);
router.post("/forget-password", forgotEmployeePassword);
//Get all employees
router.get("/get",auth, getEmployee); // "VIEW_EMPLOYEE"
router.get('/verify-email/:token',  verifyEmail); // "VIEW_EMPLOYEE"
// Get employee by email
router.get("/get/:email",auth, getEmployee); //"VIEW_EMPLOYEE"
// Delete all employees
router.delete("/delete/:employeeId",auth, hierarchyMiddleware, checkPermission, deleteEmployee); //"DELETE_EMPLOYEE"
// Get all the deleted Employee
router.get( "/deleted",auth, checkPermission , getAllDeletedEmployee); //
// "VIEW_DELETED_EMPLOYEE"
router.post("/refresh-token",refreshEmployeeAccessToken);
export default router;
