import express from "express";
import { generateDownloadPresignedUrl, generatePresignedUrl } from "../../services/awsS3.service.js";

const router = express.Router();

// router.get("/presigned-url", generatePresignedUrl);
router.get("/download-presigned-url", generateDownloadPresignedUrl);

export default router;