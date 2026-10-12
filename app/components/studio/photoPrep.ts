/**
 * Prepare a phone photo for upload: HEIC -> JPEG when the browser can't read
 * it, and a gentle downscale (the server re-encodes to 1600 px anyway, and
 * strips camera metadata). Smaller uploads are faster on a phone connection.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) throw new Error("Please choose a photo.");
  if (file.size > 40 * 1024 * 1024) throw new Error("That photo is too large. Please choose one under 40 MB.");
  let blob: Blob = file;
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    try {
      const heic2any = (await import("heic2any")).default;
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      blob = Array.isArray(out) ? out[0] : out;
    } catch {
      // Safari reads HEIC itself; the server can try too.
      return file;
    }
  }
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (k === 1 && blob.size < 6 * 1024 * 1024) return blob;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read that photo."))), "image/jpeg", 0.9));
  } catch {
    return blob;
  }
}
