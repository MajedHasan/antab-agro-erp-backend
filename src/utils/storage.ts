// utils/storage.ts
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export interface UploadResult {
  url: string;
  key?: string;
}

export const StorageDriver = {
  // Local disk (development)
  async uploadLocal(
    fileBuffer: Buffer,
    filename: string,
    folder = "uploads"
  ): Promise<UploadResult> {
    const destDir = path.join(process.cwd(), folder);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const filePath = path.join(destDir, `${Date.now()}-${filename}`);
    await fs.promises.writeFile(filePath, fileBuffer);
    // return file:// or URL path depending on your static hosting
    return { url: `/static/${path.basename(filePath)}`, key: filePath };
  },

  // TODO: add S3 upload function for prod (return S3 url + key)
  async uploadS3(_: Buffer, __: string) {
    throw new Error(
      "S3 upload not implemented in this example - implement using AWS SDK."
    );
  },
};
