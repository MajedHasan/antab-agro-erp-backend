import sharp from "sharp";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  createCanvas,
  Image,
  ImageData,
  Path2D,
  DOMMatrix,
} from "@napi-rs/canvas";

(globalThis as any).Image = Image;
(globalThis as any).ImageData = ImageData;
(globalThis as any).Path2D = Path2D;
(globalThis as any).DOMMatrix = DOMMatrix;

function createPdfCanvasFactory() {
  return {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      return { canvas, context };
    },
    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };
}

export async function normalizeToImageBuffer(
  buffer: Buffer,
  mimeType?: string,
): Promise<Buffer> {
  if (mimeType?.startsWith("image/")) {
    return buffer;
  }

  if (mimeType === "application/pdf") {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 });

    const canvasFactory = createPdfCanvasFactory();
    const { canvas, context } = canvasFactory.create(
      viewport.width,
      viewport.height,
    );

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory,
    } as any).promise;

    const imageBuffer = canvas.toBuffer("image/png");

    await page.cleanup?.();
    await pdf.cleanup?.();

    return imageBuffer;
  }

  throw new Error("Unsupported file type. Only image or PDF allowed");
}

export async function normalizeSignatureBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .trim({ threshold: 10 })
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
