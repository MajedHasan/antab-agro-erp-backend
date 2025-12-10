import { createUploader } from "../utils/multer.util";

export const uploadMiddleware = (req, res, next) => {
  const { module, type } = req.query;

  if (!module || !type) {
    return res.status(400).json({
      success: false,
      message: "module & type query parameters are required",
    });
  }

  const uploader = createUploader(module, type);

  uploader.single("file")(req, res, (err) => {
    if (err) return next(err);
    next();
  });
};

export const uploadSingleHandler = (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });

  const fileUrl = req.file.path.replace(process.cwd(), "").replace(/\\/g, "/");

  return res.json({
    success: true,
    url: fileUrl,
  });
};
