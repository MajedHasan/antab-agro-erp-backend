import fs from "fs/promises";
import path from "path";

export async function readMediaBuffer(
  MediaModel: any,
  mediaId: string,
  session?: any,
): Promise<Buffer> {
  let query = MediaModel.findById(mediaId);
  if (session) query = query.session(session);

  const media = await query;
  if (!media) throw new Error("Media file not found");

  let filePath: string | undefined =
    media.filePath || media.path || media.localPath || media.storagePath;

  if (!filePath && media.url) {
    filePath = path.join(process.cwd(), media.url);
  }

  if (!filePath) {
    throw new Error("Media file path is missing");
  }

  return fs.readFile(filePath);
}

export async function getMediaFilePath(
  MediaModel: any,
  mediaId: string,
  session?: any,
): Promise<string> {
  let query = MediaModel.findById(mediaId);
  if (session) query = query.session(session);

  const media = await query;
  if (!media) throw new Error("Media file not found");

  let filePath: string | undefined =
    media.filePath || media.path || media.localPath || media.storagePath;

  if (!filePath && media.url) {
    filePath = path.join(process.cwd(), media.url);
  }

  if (!filePath) {
    throw new Error("Media file path is missing");
  }

  return filePath;
}
