/*
 * Builds every app icon from the owner's hammer artwork (owner decision Q-11).
 *
 *   node scripts/build_admin_icons.js
 *
 * Source: public/images/profixter-logo-2026.png (1254x1254, transparent: the
 * hammer + "PROFIXTER / Handyman Membership" badge, centred). Copied from the
 * OneDrive checkout, unchanged. sharp ships with Next (no new dependency).
 *
 * Output (all opaque, so iOS never shows transparency as black):
 *   Customer app (navy #0B1628, the site's theme colour) - start_url "/" unchanged:
 *     public/manifest-icon-192.png, manifest-icon-512.png        purpose "any", ~8% padding
 *     public/manifest-icon-maskable-192.png, -512.png             badge inside the 80% safe circle
 *     public/apple-icon.png (180), public/icon.png (512)
 *     public/favicon-16.png, -32.png, -48.png and app/favicon.ico (16/32/48)
 *   Admin app (accent blue #306EEC, so the two installed icons differ side by side):
 *     public/icons/admin-192.png, admin-512.png, admin-maskable-192.png, admin-maskable-512.png,
 *     public/icons/admin-apple-touch-180.png
 *   The header and loader mark (transparent): public/images/profixter-hammer-mark.png
 *   PROPOSED, not wired up (needs the owner's approval): public/proposed/hammer-*.png,
 *     the same icons built from the hammer head alone, which stays legible at
 *     16-48px where the full badge does not.
 *
 * The badge is about 2.4:1, so in a square it is small, and its lettering is
 * illegible below ~96px. That is why the hammer-head set exists as a proposal.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public/images/profixter-logo-2026.png");
const NAVY = "#0B1628";
const BLUE = "#306EEC";

const out = (rel) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

async function trimmedBadge() {
  return sharp(SRC).trim().png().toBuffer();
}

/* The hammer head (claw, face and the stub of the blue handle), cut from the badge. */
async function hammerHead() {
  const L = 16, T = 345, W = 505, H = 525;
  const { data } = await sharp(SRC).extract({ left: L, top: T, width: W, height: H }).raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ax = x + L, ay = y + T;
      // Below the claw, everything right of the handle stub is the lettering panel: drop it.
      if ((ay >= 505 && ax > 296) || (ax > 238 && ay > 712)) data[(y * W + x) * 4 + 3] = 0;
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim().png().toBuffer();
}

/**
 * A square icon: `art` scaled to fit `fill` of the side (fraction of the
 * width for wide art), centred on `bg`. `maskable` keeps the art's corners
 * inside the 80% safe circle.
 */
async function square(art, size, bg, { fill = 0.84, maskable = false } = {}) {
  const meta = await sharp(art).metadata();
  const ratio = meta.width / meta.height;
  let w, h;
  if (maskable) {
    // Corners of a w x h box inside a circle of diameter 0.8*size: sqrt(w^2+h^2) <= 0.8*size (with 2% margin).
    const diag = 0.78 * size;
    h = diag / Math.sqrt(ratio * ratio + 1);
    w = h * ratio;
  } else {
    w = ratio >= 1 ? size * fill : size * fill * ratio;
    h = w / ratio;
  }
  const resized = await sharp(art).resize({ width: Math.round(w), height: Math.round(h), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const m = await sharp(resized).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: resized, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .flatten({ background: bg })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* A Windows/browser .ico holding PNG images (supported everywhere since Vista). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

async function write(rel, buffer) {
  fs.writeFileSync(out(rel), buffer);
  console.log("wrote", rel, buffer.length, "bytes");
}

(async () => {
  const badge = await trimmedBadge();
  const head = await hammerHead();

  // Customer app: navy.
  await write("public/manifest-icon-192.png", await square(badge, 192, NAVY, { fill: 0.84 }));
  await write("public/manifest-icon-512.png", await square(badge, 512, NAVY, { fill: 0.84 }));
  await write("public/manifest-icon-maskable-192.png", await square(badge, 192, NAVY, { maskable: true }));
  await write("public/manifest-icon-maskable-512.png", await square(badge, 512, NAVY, { maskable: true }));
  await write("public/icon.png", await square(badge, 512, NAVY, { fill: 0.84 }));
  await write("public/apple-icon.png", await square(badge, 180, NAVY, { fill: 0.8 }));
  const fav = [];
  for (const size of [16, 32, 48]) {
    const data = await square(badge, size, NAVY, { fill: 0.96 });
    fav.push({ size, data });
    await write(`public/favicon-${size}.png`, data);
  }
  await write("app/favicon.ico", ico(fav));

  // Admin app: accent blue.
  await write("public/icons/admin-192.png", await square(badge, 192, BLUE, { fill: 0.84 }));
  await write("public/icons/admin-512.png", await square(badge, 512, BLUE, { fill: 0.84 }));
  await write("public/icons/admin-maskable-192.png", await square(badge, 192, BLUE, { maskable: true }));
  await write("public/icons/admin-maskable-512.png", await square(badge, 512, BLUE, { maskable: true }));
  await write("public/icons/admin-apple-touch-180.png", await square(badge, 180, BLUE, { fill: 0.8 }));

  // The mark for the admin header and loader (transparent, square canvas).
  const markSize = 256;
  const markArt = await sharp(head).resize({ width: markSize, height: markSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
  await write("public/images/profixter-hammer-mark.png", markArt);

  // PROPOSED hammer-head icons (owner approval needed before use).
  for (const [name, bg] of [["navy", NAVY], ["blue", BLUE]]) {
    for (const size of [16, 32, 48, 180, 192, 512]) {
      await write(`public/proposed/hammer-${name}-${size}.png`, await square(head, size, bg, { fill: size <= 48 ? 0.94 : 0.8 }));
    }
    await write(`public/proposed/hammer-${name}-maskable-512.png`, await square(head, 512, bg, { maskable: true }));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
