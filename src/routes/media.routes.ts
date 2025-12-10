import { Router, Request, Response, NextFunction } from "express";
import MediaModel from "../models/media.model";
import { createUploader } from "../utils/multer.util";
import { createCrudRouter } from "./crud.routes";
import { mediaController } from "../controllers/media.controller";

const router = Router();

router.post("/upload", (req: Request, res: Response, next: NextFunction) => {
  const moduleName = req.query.module as string;
  const folder = req.query.folder as string;

  if (!moduleName || !folder) {
    return res.status(400).json({
      success: false,
      message: "module and folder are required",
    });
  }

  const upload = createUploader(moduleName, folder);

  upload.single("file")(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    const file = req.file;

    const url =
      "/" +
      file.path
        .replace(process.cwd(), "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    const media = await MediaModel.create({
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      fileType: file.mimetype.split("/")[0],
      size: file.size,
      module: moduleName,
      folder: folder,
      url,
      uploadedBy: (req as any).user?._id || null,
    });

    res.json({ success: true, data: media });
  });
});

router.use("/", createCrudRouter(mediaController));

export default router;
