"use client";

// Compress image to space-efficient thumbnail + analysis image
// iOS Safari cannot encode canvas -> webp, so we try webp first and fall back to jpeg/png.
function canvasToBlobSafe(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  const types = ["image/webp", "image/jpeg", "image/png"];
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= types.length) {
        resolve(null);
        return;
      }
      const type = types[i++];
      try {
        canvas.toBlob((b) => {
          if (b && b.size > 0) resolve(b);
          else tryNext();
        }, type, quality);
      } catch {
        tryNext();
      }
    };
    tryNext();
  });
}

async function compressToDataUrl(file: File | Blob, maxSize: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await canvasToBlobSafe(canvas, quality);
  if (!blob) throw new Error("Image encoding failed");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Analysis image ~1024px (sent to AI)
export async function fileToCompressedBase64(file: File, maxSize = 1024, quality = 0.8): Promise<string> {
  return compressToDataUrl(file, maxSize, quality);
}

// Thumbnail 256px (stored in DB)
export async function fileToThumbnailBase64(file: File): Promise<string> {
  return fileToCompressedBase64(file, 256, 0.45);
}

export function base64SizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.round((base64.length * 3) / 4 / 1024);
}
