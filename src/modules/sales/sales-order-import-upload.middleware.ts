import multer from "multer";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = [
  ".xlsx",
  ".xls",
];

const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
];

const storage = multer.memoryStorage();

function isAllowedExcelFile(
  file: Express.Multer.File,
): boolean {
  const extension =
    path
      .extname(file.originalname)
      .toLowerCase();

  const mimeType =
    (file.mimetype || "").toLowerCase();

  return (
    ALLOWED_EXTENSIONS.includes(
      extension,
    ) &&
    (
      ALLOWED_MIME_TYPES.includes(
        mimeType,
      ) ||
      mimeType === ""
    )
  );
}

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    parts: 11,
  },

  fileFilter: (
    _req,
    file,
    callback,
  ) => {
    if (
      !isAllowedExcelFile(file)
    ) {
      callback(
        new Error(
          "Only Excel files (.xlsx or .xls) are allowed",
        ),
      );

      return;
    }

    callback(
      null,
      true,
    );
  },
});

export const salesOrderImportUpload =
  upload.single(
    "file",
  );

export default salesOrderImportUpload;