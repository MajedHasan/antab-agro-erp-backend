import {
  readMediaBuffer as readMedia,
  getMediaFilePath as getMediaPath,
} from "./media-file.util";

import {
  normalizeToImageBuffer,
  normalizeSignatureBuffer,
} from "./image-normalizer.util";

import {
  buildQrPayload,
  generateQrImage,
  extractQrPayloadFromBuffer,
} from "./qr.util";

import {
  extractSignatureCropBuffer,
  compareImageSimilarity,
} from "./signature-verification.util";

/* ---------------- QR ---------------- */

export const generateQrPayload = buildQrPayload;
export const createQrImage = generateQrImage;

export async function extractQr(buffer: Buffer) {
  return extractQrPayloadFromBuffer(buffer);
}

/* ---------------- MEDIA ---------------- */

export async function readMediaBuffer(
  MediaModel: any,
  mediaId: string,
  session?: any,
) {
  return readMedia(MediaModel, mediaId, session);
}

export async function getMediaFilePath(
  MediaModel: any,
  mediaId: string,
  session?: any,
) {
  return getMediaPath(MediaModel, mediaId, session);
}

/* ---------------- NORMALIZATION ---------------- */

export async function normalizeMediaBuffer(buffer: Buffer, mimeType?: string) {
  return normalizeToImageBuffer(buffer, mimeType);
}

export async function normalizeSignature(buffer: Buffer) {
  return normalizeSignatureBuffer(buffer);
}

/* ---------------- SIGNATURE ---------------- */

export async function extractSignatureCrop(buffer: Buffer) {
  return extractSignatureCropBuffer(buffer);
}

export async function compareSignatures(bufferA: Buffer, bufferB: Buffer) {
  return compareImageSimilarity(bufferA, bufferB);
}
