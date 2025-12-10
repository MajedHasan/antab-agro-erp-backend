import multer from "multer";
import fs from "fs";
import path from "path";

export function createUploader(moduleName: string, folder: string) {
  if (!moduleName || !folder) {
    throw new Error("Missing module or folder");
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      const uploadPath = path.join(
        process.cwd(),
        "uploads",
        moduleName,
        folder,
        year,
        month
      );

      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },

    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

      cb(null, `${base}-${unique}${ext}`);
    },
  });

  return multer({ storage });
}
