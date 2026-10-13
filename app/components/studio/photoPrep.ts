/**
 * Prepare a phone photo before it is shown or uploaded:
 *   - accepts JPEG, PNG, WebP and HEIC/HEIF (HEIC is converted to JPEG when the
 *     browser can't read it itself; Safari can);
 *   - turns it upright (the camera's orientation flag is applied) and rotates it
 *     further if the person asked (rotate: 0, 90, 180, 270);
 *   - re-encodes it as a JPEG of at most 2400 px, which also drops the camera's
 *     metadata (location, device). The server re-checks and re-encodes anyway.
 */
const OK_TYPES = /^image\/(jpeg|jpg|pjpeg|png|webp|heic|heif|heic-sequence|heif-sequence)$/i;
const OK_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp";

export class PhotoError extends Error {}

export async function preparePhoto(file: File | Blob, { rotate = 0 }: { rotate?: number } = {}): Promise<Blob> {
  const name = (file as File).name || "";
  const type = file.type || "";
  if (!(OK_TYPES.test(type) || (!type && OK_EXT.test(name)) || OK_EXT.test(name))) throw new PhotoError("That file isn't a photo we can use. Please choose a JPEG, PNG, WebP or iPhone (HEIC) photo.");
  if (file.size > 40 * 1024 * 1024) throw new PhotoError("That photo is too large. Please choose one under 40 MB.");
  if (file.size < 2 * 1024) throw new PhotoError("That photo looks empty. Please choose another.");
  let blob: Blob = file;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    if (/heic|heif/i.test(type) || /\.(heic|heif)$/i.test(name)) {
      try {
        const heic2any = (await import("heic2any")).default;
        const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        blob = Array.isArray(out) ? out[0] : out;
        bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      } catch {
        throw new PhotoError("This browser can't open iPhone (HEIC) photos. Take a new photo here, or choose a JPEG.");
      }
    } else throw new PhotoError("That photo couldn't be opened. Please try another one.");
  }
  if (bmp.width < 320 || bmp.height < 320) throw new PhotoError("That photo is too small. Please use one at least 640 pixels wide.");
  const rot = ((Math.round(rotate / 90) % 4) + 4) % 4;
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas");
  c.width = rot % 2 ? h : w;
  c.height = rot % 2 ? w : h;
  const g = c.getContext("2d")!;
  g.translate(c.width / 2, c.height / 2);
  g.rotate((rot * Math.PI) / 2);
  g.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close?.();
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new PhotoError("That photo couldn't be prepared. Please try another one."))), "image/jpeg", 0.9));
}
