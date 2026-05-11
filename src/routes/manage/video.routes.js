import express from "express";
import {
  addVideo,
  getAllVideos,
  updateVideo,
  deleteVideo,
} from "../../controllers/video/video.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import { checkPermission } from "../../middlewares/permission.middleware.js";

const router = express.Router();

router.post("/add",auth,checkPermission, addVideo);
router.get("/get",getAllVideos);
router.put("/update/:ytVideoId",auth,checkPermission, updateVideo);
router.delete("/delete/:ytVideoId",auth,checkPermission, deleteVideo);

export default router;
