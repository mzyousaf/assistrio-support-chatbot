/**
 * Client-only: resize + compress image for local draft storage (data URL in profile.avatarUrl).
 * Prompt 6 can replace with uploaded asset URL from the API.
 */

const DEFAULT_MAX_EDGE = 512;
const DEFAULT_MAX_BYTES = 420_000;

export async function trialImageFileToDataUrl(
  file: File,
  options?: { maxEdge?: number; maxBytes?: number },
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("trialImageFileToDataUrl is browser-only");
  }

  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return readFileAsDataUrlFallback(file, maxBytes);
  }
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas unsupported");
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    let quality = 0.88;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > maxBytes * 1.35 && quality > 0.45) {
      quality -= 0.07;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

function readFileAsDataUrlFallback(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      if (typeof s !== "string") {
        reject(new Error("Unexpected read result"));
        return;
      }
      if (s.length > maxBytes * 1.4) {
        reject(new Error("Image too large"));
        return;
      }
      resolve(s);
    };
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}
