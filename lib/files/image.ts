// Client-side image engine for the file tools: decode, resize, convert, and
// compress-to-target-size, all with native browser APIs (no libraries). Files
// never leave the visitor's device.

export type ImageOutputFormat = "jpeg" | "png" | "webp";

export const IMAGE_MAX_BYTES = 80 * 1024 * 1024;
export const IMAGE_MAX_PIXELS = 50_000_000;
export const IMAGE_MAX_FILES = 20;

const MIME_BY_FORMAT: Record<ImageOutputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const EXTENSION_BY_FORMAT: Record<ImageOutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export class ImageTooLargeError extends Error {}
export class ImageDecodeError extends Error {}

/** WebP ENCODING is missing in Safari; detect once so the option can hide. */
let webpEncodeSupport: boolean | null = null;
export function canEncodeWebp(): boolean {
  if (webpEncodeSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      webpEncodeSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpEncodeSupport = false;
    }
  }
  return webpEncodeSupport;
}

/**
 * Decode an image file to a bitmap, honoring EXIF orientation. Safari's
 * createImageBitmap has orientation quirks, so any failure (or HEIC and other
 * undecodable inputs) falls back to an <img> decode, which always honors EXIF.
 */
export async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (file.size > IMAGE_MAX_BYTES) throw new ImageTooLargeError();
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > IMAGE_MAX_PIXELS) {
      bitmap.close();
      throw new ImageTooLargeError();
    }
    return bitmap;
  } catch (error) {
    if (error instanceof ImageTooLargeError) throw error;
    return decodeViaImgElement(file);
  }
}

function decodeViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth * img.naturalHeight > IMAGE_MAX_PIXELS) {
        reject(new ImageTooLargeError());
      } else if (!img.naturalWidth) {
        reject(new ImageDecodeError());
      } else {
        resolve(img);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageDecodeError());
    };
    img.src = url;
  });
}

export function sourceSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

/**
 * Draw the source at the requested dimensions. "contain" letterboxes inside
 * the box keeping aspect (canvas shrinks to the fitted size, no bars);
 * "cover" center-crops to fill the exact box. JPEG has no alpha, so it gets a
 * white backing instead of black.
 */
export function drawResized(
  source: ImageBitmap | HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  fit: "cover" | "contain",
  format: ImageOutputFormat,
): HTMLCanvasElement {
  const { width: sw, height: sh } = sourceSize(source);
  const canvas = document.createElement("canvas");

  if (fit === "contain") {
    const scale = Math.min(targetWidth / sw, targetHeight / sh, 1);
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext("2d")!;
    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  const scale = Math.max(targetWidth / sw, targetHeight / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (targetWidth - dw) / 2, (targetHeight - dh) / 2, dw, dh);
  return canvas;
}

export function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: ImageOutputFormat,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageDecodeError())),
      MIME_BY_FORMAT[format],
      quality,
    );
  });
}

export type CompressResult = { blob: Blob; quality: number; width: number; height: number };

/**
 * Compress to a byte budget: binary-search JPEG/WebP quality in [0.30, 0.95]
 * (accept within [0.85·target, target]); if even q=0.30 is too big, downscale
 * by sqrt(target/actual) and search once more. PNG has no quality knob, so
 * target-size compression always encodes lossy.
 */
export async function compressToTarget(
  source: ImageBitmap | HTMLImageElement,
  targetBytes: number,
  format: "jpeg" | "webp",
): Promise<CompressResult> {
  let { width, height } = sourceSize(source);
  let canvas = drawResized(source, width, height, "cover", format);

  for (let pass = 0; pass < 2; pass += 1) {
    let lo = 0.3;
    let hi = 0.95;
    let best: { blob: Blob; quality: number } | null = null;

    for (let i = 0; i < 8; i += 1) {
      const q = (lo + hi) / 2;
      const blob = await encodeCanvas(canvas, format, q);
      if (blob.size <= targetBytes) {
        best = { blob, quality: q };
        if (blob.size >= targetBytes * 0.85) break;
        lo = q;
      } else {
        hi = q;
      }
    }

    if (best) return { ...best, width: canvas.width, height: canvas.height };

    // Even q≈0.30 is over budget: shrink dimensions and try one more pass.
    const lowest = await encodeCanvas(canvas, format, 0.3);
    if (pass === 1) {
      return { blob: lowest, quality: 0.3, width: canvas.width, height: canvas.height };
    }
    const shrink = Math.sqrt(targetBytes / lowest.size);
    width = Math.max(64, Math.round(canvas.width * shrink));
    height = Math.max(64, Math.round(canvas.height * shrink));
    canvas = drawResized(source, width, height, "cover", format);
  }

  // Unreachable, but satisfies the compiler.
  throw new ImageDecodeError();
}

export function releaseSource(source: ImageBitmap | HTMLImageElement): void {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) source.close();
}

export function replaceExtension(name: string, format: ImageOutputFormat): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.${EXTENSION_BY_FORMAT[format]}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
