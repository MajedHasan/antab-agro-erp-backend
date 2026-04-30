import sharp from "sharp";

export async function extractSignatureCropBuffer(
  fileBuffer: Buffer,
): Promise<Buffer> {
  const meta = await sharp(fileBuffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  if (!width || !height) {
    throw new Error("Unable to read uploaded document dimensions");
  }

  const left = Math.max(0, Math.floor(width * 0.5));
  const top = Math.max(0, Math.floor(height * 0.62));
  const cropWidth = Math.max(1, Math.floor(width * 0.45));
  const cropHeight = Math.max(1, Math.floor(height * 0.3));

  return sharp(fileBuffer)
    .rotate()
    .extract({
      left,
      top,
      width: Math.min(cropWidth, width - left),
      height: Math.min(cropHeight, height - top),
    })
    .flatten({ background: "#ffffff" })
    .resize(700, 300, {
      fit: "contain",
      background: "#ffffff",
    })
    .greyscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export async function compareImageSimilarity(
  bufferA: Buffer,
  bufferB: Buffer,
): Promise<number> {
  const width = 300;
  const height = 120;

  const a = await sharp(bufferA)
    .resize(width, height, { fit: "contain", background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer();

  const b = await sharp(bufferB)
    .resize(width, height, { fit: "contain", background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer();

  const len = Math.min(a.length, b.length);
  if (!len) return 0;

  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff += Math.abs(a[i] - b[i]) / 255;
  }

  const avgDiff = diff / len;
  return Math.max(0, 1 - avgDiff);
}
