// Server action payloads are capped (see next.config.ts), so large photos are scaled down in
// the browser before upload. The server then re-encodes them into the stored format.
const PRE_UPLOAD_MAX_DIMENSION = 1600;
const PRE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const PRE_UPLOAD_JPEG_QUALITY = 0.92;

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIndex = result.indexOf(",");
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : "";

      if (base64) {
        resolve(base64);
      } else {
        reject(new Error("Unable to read image file"));
      }
    };

    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(blob);
  });
}

async function downscaleInBrowser(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  try {
    const scale = Math.min(1, PRE_UPLOAD_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size <= PRE_UPLOAD_MAX_BYTES) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;

    // JPEG has no transparency; paint white first so transparent areas don't turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PRE_UPLOAD_JPEG_QUALITY),
    );
  } finally {
    bitmap.close();
  }
}

/** Reads a user-selected image as base64, shrinking very large photos first. */
export async function readImageFileForUpload(file: File) {
  const downscaled = await downscaleInBrowser(file);
  return blobToBase64(downscaled ?? file);
}
