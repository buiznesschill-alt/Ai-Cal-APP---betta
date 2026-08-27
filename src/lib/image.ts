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

// Zero-copy variant — vracia Blob priamo (pre FormData, bez base64 prevodu)
export async function fileToCompressedBlob(file: File, maxSize = 1024, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  // OffscreenCanvas ak je k dispozícii (Worker-friendly, rýchlejší)
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: any;
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      canvas = new OffscreenCanvas(w, h) as any;
      ctx = (canvas as OffscreenCanvas).getContext("2d");
      if (ctx) ctx.drawImage(bitmap as any, 0, 0, w, h);
      bitmap.close?.();
      if (ctx) {
        const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: "image/webp", quality } as any).catch(async () => {
          // fallback na jpeg ak webp nie je podporovaný
          return (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality } as any);
        });
        if (blob && blob.size > 0) return blob;
      }
    } catch {}
  }
  // fallback — klasický HTMLCanvas
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cctx = c.getContext("2d")!;
  cctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await canvasToBlobSafe(c, quality);
  if (!blob) throw new Error("Image encoding failed");
  return blob;
}

export async function fileToThumbnailBlob(file: File): Promise<Blob> {
  return fileToCompressedBlob(file, 256, 0.45);
}

// Thumbnail 256px (stored in DB)
export async function fileToThumbnailBase64(file: File): Promise<string> {
  return fileToCompressedBase64(file, 256, 0.45);
}

export function base64SizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.round((base64.length * 3) / 4 / 1024);
}

// Rýchly hash súboru pre deduplikáciu (IndexedDB) — SHA-256 prvých 64KB + size
export async function hashFile(file: File): Promise<string> {
  try {
    const slice = file.slice(0, 64 * 1024);
    const buf = await slice.arrayBuffer();
    const ext = `${file.size}-${file.type}`;
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const arr = Array.from(new Uint8Array(hashBuf));
      return arr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16) + "-" + file.size;
    }
    // fallback simple
    let h = 0;
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < Math.min(u8.length, 4096); i++) h = (h * 31 + u8[i]) % 1000000007;
    return h.toString(36) + "-" + ext;
  } catch {
    return `${file.size}-${file.name}`.slice(0, 32);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
