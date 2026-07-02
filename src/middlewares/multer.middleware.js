import multer from "multer";

/**
 * @module upload
 *
 * @description
 * Multer middleware for handling file uploads.
 * Stores files on disk using original filename.
 *
 * @process
 * 1. Configure disk storage with `multer.diskStorage`
 * 2. Use `originalname` for stored file names
 * 3. Export configured multer instance for route use
 *
 * @example
 * router.post("/upload", upload.single("file"), controllerFunction);
 */
const storage = multer.diskStorage({
  filename: (req, file, callback) => {
    callback(null, file.originalname);
  },
});

const upload = multer({ storage });
export default upload

export const uploadExcel = multer({
  storage: multer.memoryStorage(),          // file lives at req.file.buffer
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max

  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel",                                           // .xls
      "text/csv",                                                           // .csv
      "application/csv",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only .xlsx, .xls or .csv files are accepted"), false);
  },
});

