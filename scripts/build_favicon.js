/**
 * Builds app/favicon.ico from the authoritative ProFixter logo.
 *
 * Why this exists
 * ---------------
 * app/favicon.ico used to be a 1.1MB, 1024x1024 PNG of the retired
 * "Mr. Fixter" mascot with a .ico extension. Next.js serves app/favicon.ico at
 * /favicon.ico - the exact URL Google fetches for the Search favicon - so that
 * mascot was the icon Google associated with the site, no matter how correct
 * every other asset was.
 *
 * Source of truth
 * ---------------
 * public/images/LogoSquare.png, 1254x1254, verified pixel-identical artwork to
 * public/icon.png and public/manifest-icon-512.png. The logo is not redrawn
 * here. The only change is framing: the wordmark occupies 71% of the source
 * width and 55% of its height, so at 16px the surrounding dead space was
 * costing legibility. Cropping to the artwork and re-squaring it with an even
 * margin makes the mark meaningfully larger at the same rendered size while
 * leaving the logo itself untouched.
 *
 * Output
 * ------
 * A real multi-resolution ICO. 16/32/48 are stored as 32-bit BMP and 64/128/256
 * as PNG, which is what mainstream favicon tooling emits: PNG keeps the large
 * entries small, BMP keeps the small entries readable to the oldest parsers
 * that never learned PNG-in-ICO.
 *
 * Google's requirements this satisfies (developers.google.com/search/docs/
 * appearance/favicon-in-search): square 1:1, well above the 48x48 they
 * recommend, a stable URL, and crawlable by Googlebot-Image.
 *
 * Run: node scripts/build_favicon.js
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "images", "LogoSquare.png");
const OUT_ICO = path.join(ROOT, "app", "favicon.ico");

/** BMP below this, PNG at and above it. */
const PNG_FROM = 64;
const SIZES = [16, 32, 48, 64, 128, 256];

/**
 * Share of the canvas the wordmark should occupy on its longest axis.
 * Enough margin that the mark never collides with the rounded corners some
 * surfaces apply, tight enough that it is not swimming in black.
 */
const CONTENT_RATIO = 0.84;

/* ------------------------------------------------------------------ */
/* ICO container                                                       */
/* ------------------------------------------------------------------ */

/**
 * 32-bit BMP for an ICO entry.
 *
 * Inside an ICO the header's height is doubled: the colour bitmap is followed
 * by a 1bpp AND mask. The logo is fully opaque so the mask is all zeros, but
 * it still has to be present and still has to be padded to 4-byte rows.
 */
function bmpEntry(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight, colour + mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // BI_RGB

  // BGRA, bottom-up.
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4;
    const dst = y * size * 4;
    for (let x = 0; x < size; x++) {
      pixels[dst + x * 4 + 0] = rgba[src + x * 4 + 2];
      pixels[dst + x * 4 + 1] = rgba[src + x * 4 + 1];
      pixels[dst + x * 4 + 2] = rgba[src + x * 4 + 0];
      pixels[dst + x * 4 + 3] = rgba[src + x * 4 + 3];
    }
  }

  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)]);
}

function buildIco(entries) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // 1 = icon
  dir.writeUInt16LE(entries.length, 4);

  // 256 is stored as 0 in a single byte, which is the whole reason the format
  // tops out there.
  let offset = 6 + entries.length * 16;
  const table = entries.map((entry) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);
    e.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(entry.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += entry.data.length;
    return e;
  });

  return Buffer.concat([dir, ...table, ...entries.map((e) => e.data)]);
}

/* ------------------------------------------------------------------ */

async function build() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`❌ Source logo not found: ${SOURCE}`);
    process.exitCode = 1;
    return;
  }

  const source = sharp(SOURCE).removeAlpha();
  const { width, height } = await source.metadata();

  // The flat brand background, taken from the source rather than assumed, so
  // the padding is the same black the logo already sits on.
  const corner = await sharp(SOURCE).removeAlpha().extract({ left: 0, top: 0, width: 8, height: 8 }).raw().toBuffer();
  const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };

  // Bounding box of everything that is not that background.
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const delta =
        Math.abs(data[i] - background.r) +
        Math.abs(data[i + 1] - background.g) +
        Math.abs(data[i + 2] - background.b);
      if (delta > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    console.error("❌ Could not find any artwork against the background.");
    process.exitCode = 1;
    return;
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const canvas = Math.round(Math.max(contentW, contentH) / CONTENT_RATIO);

  console.log(`source   ${width}x${height}, background rgb(${background.r},${background.g},${background.b})`);
  console.log(`artwork  ${contentW}x${contentH} at (${minX},${minY}) — ${Math.round((100 * contentW) / width)}% of source width`);
  console.log(`canvas   ${canvas}x${canvas} — artwork now ${Math.round((100 * contentW) / canvas)}% of width\n`);

  const master = await sharp(SOURCE)
    .removeAlpha()
    .extract({ left: minX, top: minY, width: contentW, height: contentH })
    .extend({
      top: Math.floor((canvas - contentH) / 2),
      bottom: Math.ceil((canvas - contentH) / 2),
      left: Math.floor((canvas - contentW) / 2),
      right: Math.ceil((canvas - contentW) / 2),
      background,
    })
    .png()
    .toBuffer();

  const entries = [];
  for (const size of SIZES) {
    const resized = sharp(master).resize(size, size, { fit: "fill", kernel: "lanczos3" });
    if (size >= PNG_FROM) {
      // ensureAlpha, because the logo is opaque and sharp would otherwise emit
      // a 24-bit PNG. Next's own ICO decoder reads this file at build time to
      // fill in the sizes attribute, and it rejects any non-RGBA PNG inside an
      // ICO with "The PNG is not in RGBA format!".
      const png = await resized.ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
      entries.push({ size, data: png, kind: "PNG" });
    } else {
      const rgba = await resized.ensureAlpha().raw().toBuffer();
      entries.push({ size, data: bmpEntry(rgba, size), kind: "BMP" });
    }
  }

  const ico = buildIco(entries);
  fs.writeFileSync(OUT_ICO, ico);

  for (const e of entries) {
    console.log(`  ${String(e.size).padStart(3)}x${String(e.size).padEnd(3)} ${e.kind}  ${String(e.data.length).padStart(7)} bytes`);
  }
  console.log(
    `\n✅ ${path.relative(ROOT, OUT_ICO)} — ${entries.length} resolutions, ${(ico.length / 1024).toFixed(0)}KB total`
  );
}

build().catch((error) => {
  console.error(`❌ ${error.stack || error.message}`);
  process.exitCode = 1;
});
