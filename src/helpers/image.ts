// Shrinks a photo in the browser before upload: longest side at most `maxSide`,
// re-encoded as WebP (JPEG where the browser can't encode WebP). A 5 MB phone
// photo comes out around 200–400 KB, well under the upload limit.
export async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  // from-image applies the EXIF rotation, so portrait phone photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Browsers that can't encode WebP silently return PNG instead, so check the type.
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("Could not encode the image");
  return jpeg;
}
