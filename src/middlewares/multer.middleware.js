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
export default upload;

