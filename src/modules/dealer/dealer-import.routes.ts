import { Router } from "express";
import multer from "multer";

import { dealerImportController } from "./dealer-import.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Download Excel template
router.get(
  "/template",
  dealerImportController.template,
);

// Upload Excel and preview validation results
router.post(
  "/preview",
  upload.single("file"),
  dealerImportController.preview,
);

// Confirm and create valid dealer rows
router.post(
  "/confirm",
  dealerImportController.confirm,
);

export default router;