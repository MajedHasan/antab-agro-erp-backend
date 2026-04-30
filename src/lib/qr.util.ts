import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";

export async function generateQrImage(qrPayload: string): Promise<string> {
  return QRCode.toDataURL(qrPayload, {
    type: "image/png",
    margin: 2,
    width: 260,
    errorCorrectionLevel: "M",
  });
}

export async function extractQrPayloadFromBuffer(
  fileBuffer: Buffer,
): Promise<string> {
  const { data, info } = await sharp(fileBuffer)
    .rotate()
    .resize({ width: 1600, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const expected = info.width * info.height * 4;

  if (data.length !== expected) {
    throw new Error(
      `Invalid QR image buffer: expected ${expected} bytes, got ${data.length}`,
    );
  }

  const rgba = Uint8ClampedArray.from(data);
  const result = jsQR(rgba, info.width, info.height);

  if (!result?.data) {
    throw new Error("QR code not found in uploaded document");
  }

  return result.data;
}

// export async function buildQrPayload(invoice: any, order: any) {
//   return JSON.stringify({
//     invoiceId: String(invoice._id),
//     orderId: String(order._id),
//     invoiceNo: String(invoice.invoiceNo),
//     grandTotal: Number(invoice.grandTotal || 0),
//   });
// }

export function buildQrPayload<T extends Record<string, any>>(data: T): string {
  return JSON.stringify({
    ...data,
    _meta: {
      generatedAt: new Date().toISOString(),
    },
  });
}

export function parseQrPayload<T = any>(payload: string): T {
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("Invalid QR payload format");
  }
}
