import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, awsConfig } from "../config/aws.config.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

export const uploadToS3 = async (file, folder) => {
  try {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
    });
    await s3Client.send(command);
    fs.unlinkSync(file.path);
    return {
      key,
      url: `https://${awsConfig.bucket}.s3.amazonaws.com/${key}`,
    };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw error;
  }
};

// Generate pre-signed URL for uploading file to S3
export const generatePresignedUrl = async (req, res) => {
  try {
    const { fileType, folder } = req.query;
     if (!fileType || !folder) {
    return res.status(400).json({ message: "fileType and folder are required" });
     }
      // file extension
      const extension = fileType.split("/")[1];
      const fileName = `${folder}/${Date.now()}-${Math.random()}.${extension}`;
      const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: fileName,
      ContentType: fileType,
    });
    // get object command
    
    // Generate URL
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return res.json({
      uploadUrl,
      fileUrl: `https://${awsConfig.bucket}.s3.amazonaws.com/${fileName}`
    });
  } catch (error) {
    console.error("AWS Upload Error:", error);
    return res.status(500).json({ message: "Failed to generate pre-signed URL" });
  }
};

/**
 * Delete file from S3 using full file URL
 */
export const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) return;
  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = decodeURIComponent(url.pathname.substring(1));
    const command = new DeleteObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("S3 Delete Error:", error.message);
  }
};

export const generateDownloadPresignedUrl = async (req, res) => {
  try {
    const { file } = req.query;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "file is required",
      });
    }
    // Extract S3 key from full URL
    const url = new URL(file);
    const key = decodeURIComponent(url.pathname.slice(1)); // remove '/'
    const command = new GetObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key
    });
    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 10, // 10 minutes
    });
    return res.status(200).json({
      success: true,
      downloadUrl,
    });
  } catch (error) {
    console.error("AWS Download Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate download URL",
    });
  }
};
