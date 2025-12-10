import fs from "fs";
import { Router } from "express";
import {
  uploadMiddleware,
  uploadSingleHandler,
} from "../controllers/upload.controller";
import path from "path";

const router = Router();

router.post("/", uploadMiddleware.single("file"), uploadSingleHandler);

router.delete("/", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url)
      return res
        .status(400)
        .json({ success: false, message: "File URL required" });

    // Remove leading slash
    const filePath = path.join(
      process.cwd(),
      url.toString().replace(/^\/+/, "")
    );

    if (!fs.existsSync(filePath))
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    fs.unlinkSync(filePath);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Delete failed" });
  }
});

export default router;
