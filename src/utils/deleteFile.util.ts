// src/utils/deleteFile.util.ts
import fs from "fs";
import path from "path";

export function deleteFile(fileUrl: string) {
  if (!fileUrl) return;
  // Convert URL to absolute path
  const filePath = path.join(process.cwd(), fileUrl.replace(/^\/+/, ""));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  } else {
    console.warn("File not found for deletion:", filePath);
  }
}
