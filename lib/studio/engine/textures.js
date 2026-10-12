// Original, procedurally drawn finish textures, generated from a product's
// published pattern geometry (tile size, bond, grout width) and an
// approximate colour. No manufacturer imagery is copied.
//
// Every texture is one repeat cell, sized in real inches, so the renderer can
// tile it at true scale on a wall of known size.

const PX_PER_INCH = 24;

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb = (c, k = 1) => {
  // k > 1 lightens toward white, k < 1 darkens toward black, so bevels show on any colour.
  const f = (v) => (k >= 1 ? v + (255 - v) * (k - 1) * 2.2 : v * k);
  return `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(f(v))))).join(",")})`;
};

// Small deterministic noise so two renders of the same finish are identical.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, w, h, amount, seed) {
  if (!amount) return;
  const rnd = mulberry32(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/**
 * spec.pattern:
 *   { type: "smooth" }
 *   { type: "tile", tileW, tileH, bond: "running" | "stack", groutW, groutColor? }
 *   { type: "beadboard", boardW, grooveW }
 * spec.color: approximate surface colour (hex)
 * Returns { canvas, repeatW, repeatH } with repeat sizes in inches.
 */
export function makeFinishTexture(spec) {
  // A catalog texture image (uploaded by the owner): one repeat of the real
  // surface, of known size in inches. Drawn patterns below are the fallback.
  if (spec.texture?.image && spec.texture.widthIn > 0 && spec.texture.heightIn > 0) {
    const repeatW = spec.texture.widthIn, repeatH = spec.texture.heightIn;
    const k = Math.min(1, 2048 / Math.max(repeatW, repeatH) / PX_PER_INCH);
    const w = Math.max(8, Math.round(repeatW * PX_PER_INCH * k)), h = Math.max(8, Math.round(repeatH * PX_PER_INCH * k));
    const c = makeCanvas(w, h), g = c.getContext("2d");
    g.drawImage(spec.texture.image, 0, 0, w, h);
    return { canvas: c, repeatW, repeatH };
  }
  const p = spec.pattern || { type: "smooth" };
  const base = hexToRgb(spec.color || "#f2f1ec");

  if (p.type === "tile" && p.orientation === "vertical") {
    // Vertical tiles; neighbouring columns offset by half a tile (running bond on its side).
    const repeatW = p.tileW * 2, repeatH = p.tileH;
    const w = Math.round(repeatW * PX_PER_INCH), h = Math.round(repeatH * PX_PER_INCH);
    const c = makeCanvas(w, h), g = c.getContext("2d");
    const grout = p.groutColor ? hexToRgb(p.groutColor) : base.map((v) => v * 0.86);
    g.fillStyle = rgb(grout); g.fillRect(0, 0, w, h);
    const gw = Math.max(1, p.groutW * PX_PER_INCH);
    const tw = p.tileW * PX_PER_INCH, th = p.tileH * PX_PER_INCH;
    for (let col = 0; col < 2; col++) {
      const off = col === 1 && p.bond !== "stack" ? th / 2 : 0;
      for (const y0 of [off - th, off, off + th]) {
        const x = col * tw + gw / 2, y = y0 + gw / 2, ww = tw - gw, hh = th - gw;
        g.fillStyle = rgb(base); g.fillRect(x, y, ww, hh);
        const bev = Math.max(1, 0.12 * PX_PER_INCH);
        g.fillStyle = rgb(base, 1.04); g.fillRect(x, y, bev, hh);
        g.fillStyle = rgb(base, 1.03); g.fillRect(x, y, ww, bev);
        g.fillStyle = rgb(base, 0.92); g.fillRect(x + ww - bev, y, bev, hh);
        g.fillStyle = rgb(base, 0.94); g.fillRect(x, y + hh - bev, ww, bev);
      }
    }
    speckle(g, w, h, spec.speckle ?? 3, 19);
    return { canvas: c, repeatW, repeatH };
  }

  if (p.type === "tile") {
    const repeatW = p.tileW;
    const repeatH = p.bond === "running" ? p.tileH * 2 : p.tileH;
    const w = Math.round(repeatW * PX_PER_INCH), h = Math.round(repeatH * PX_PER_INCH);
    const c = makeCanvas(w, h), g = c.getContext("2d");
    const grout = p.groutColor ? hexToRgb(p.groutColor) : base.map((v) => v * 0.86);
    g.fillStyle = rgb(grout); g.fillRect(0, 0, w, h);
    const gw = Math.max(1, p.groutW * PX_PER_INCH);
    const tw = p.tileW * PX_PER_INCH, th = p.tileH * PX_PER_INCH;
    const rows = p.bond === "running" ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const off = r === 1 ? tw / 2 : 0;
      for (const x0 of [off - tw, off, off + tw]) {
        const x = x0 + gw / 2, y = r * th + gw / 2, ww = tw - gw, hh = th - gw;
        // Molded tile face with a soft bevel: light from above, shade below.
        g.fillStyle = rgb(base); g.fillRect(x, y, ww, hh);
        const bev = Math.max(1, 0.12 * PX_PER_INCH);
        g.fillStyle = rgb(base, 1.035); g.fillRect(x, y, ww, bev);
        g.fillStyle = rgb(base, 0.93); g.fillRect(x, y + hh - bev, ww, bev);
        g.fillStyle = rgb(base, 0.97); g.fillRect(x + ww - bev, y, bev, hh);
      }
    }
    speckle(g, w, h, spec.speckle ?? 3, 11);
    return { canvas: c, repeatW, repeatH };
  }

  if (p.type === "beadboard") {
    const repeatW = p.boardW, repeatH = 12;
    const w = Math.round(repeatW * PX_PER_INCH), h = Math.round(repeatH * PX_PER_INCH);
    const c = makeCanvas(w, h), g = c.getContext("2d");
    g.fillStyle = rgb(base); g.fillRect(0, 0, w, h);
    const gw = p.grooveW * PX_PER_INCH;
    g.fillStyle = rgb(base, 0.88); g.fillRect(0, 0, gw, h);
    g.fillStyle = rgb(base, 1.03); g.fillRect(gw, 0, gw * 0.5, h);
    speckle(g, w, h, spec.speckle ?? 3, 13);
    return { canvas: c, repeatW, repeatH };
  }

  // Smooth acrylic: flat colour with very faint texture.
  const repeatW = 24, repeatH = 24;
  const w = repeatW * 8, h = repeatH * 8;
  const c = makeCanvas(w, h), g = c.getContext("2d");
  g.fillStyle = rgb(base); g.fillRect(0, 0, w, h);
  speckle(g, w, h, spec.speckle ?? 2, 17);
  return { canvas: c, repeatW, repeatH };
}

// A small flat swatch for the selector UI, drawn from the same generator so the
// button shows exactly what the renderer will tile.
export function swatchDataUrl(spec, sizeInches = 18, px = 120) {
  const t = makeFinishTexture(spec);
  const c = document.createElement("canvas");
  c.width = px; c.height = px;
  const g = c.getContext("2d");
  const pat = g.createPattern(t.canvas, "repeat");
  const k = px / sizeInches / PX_PER_INCH;
  pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  g.fillStyle = pat; g.fillRect(0, 0, px, px);
  return c.toDataURL("image/png");
}

export { PX_PER_INCH };
