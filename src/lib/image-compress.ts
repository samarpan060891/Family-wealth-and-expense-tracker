// Client-side image compression using the canvas API — no external library, so it
// stays within the app's strict CSP and adds no bundle weight. Downscales large
// photos (phone cameras produce 4–12 MP JPEGs) and re-encodes them as JPEG so a
// captured bill stores in a few hundred KB instead of several megabytes.

export type CompressOptions = {
  maxDimension?: number; // longest edge in px
  quality?: number; // 0..1 JPEG quality
  maxBytes?: number; // if result is still bigger, step quality down
};

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.8,
  maxBytes: 1_500_000, // ~1.5 MB target
};

/**
 * Compress an image File. Non-image files (PDF/Excel/CSV) are returned untouched.
 * Falls back to the original file if anything goes wrong so uploads never break.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Don't bother re-encoding tiny images or formats canvas can't reliably read.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const { maxDimension, quality, maxBytes } = { ...DEFAULTS, ...opts };

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // White backdrop so transparent PNGs don't turn black when flattened to JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ("close" in bitmap) (bitmap as ImageBitmap).close();

    let q = quality;
    let blob = await toBlob(canvas, q);
    // If it's still heavy, drop quality a couple of steps.
    while (blob && blob.size > maxBytes && q > 0.4) {
      q -= 0.15;
      blob = await toBlob(canvas, q);
    }
    if (!blob || blob.size >= file.size) return file; // no win — keep original

    const baseName = file.name.replace(/\.[^./\\]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // imageOrientation honors EXIF rotation from phone cameras.
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}
