// Estimate how the existing bathroom is lit, from the photo itself, so new
// panels can be shaded the way that room would shade them.
//
// Idea: a photo pixel is roughly albedo x illumination. The old wall gives us
// illumination wherever it is visible (after heavily blurring away grout lines
// and fixtures); a known white surface (the tub) tells us the colour of the
// light and how a white surface photographs in this room. Where the old wall
// is hidden (behind the tub), illumination is carried down from the lowest
// visible row with a gentle fall-off toward the floor.
//
// Pure functions on typed arrays; no DOM.

export const srgbToLinear = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

export function toLinearDownscaled(rgba, width, height, scale) {
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const out = new Float32Array(w * h * 3);
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i);
  const sx = width / w, sy = height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Box average of the source block.
      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.floor(x * sx), x1 = Math.min(width, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.min(height, Math.floor((y + 1) * sy));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * width + xx) * 4;
          r += lut[rgba[i]]; g += lut[rgba[i + 1]]; b += lut[rgba[i + 2]]; n++;
        }
      }
      const o = (y * w + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return { data: out, width: w, height: h };
}

// Clip a 3D polygon (camera space) against z >= near, then project.
export function projectPolygon(cam, worldPts, scale = 1, near = 1) {
  const R = cam.R, t = cam.t;
  const toCam = (P) => [
    R[0] * P[0] + R[1] * P[1] + R[2] * P[2] + t[0],
    R[3] * P[0] + R[4] * P[1] + R[5] * P[2] + t[1],
    R[6] * P[0] + R[7] * P[1] + R[8] * P[2] + t[2],
  ];
  const pts = worldPts.map(toCam);
  const clipped = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ain = a[2] >= near, bin = b[2] >= near;
    if (ain) clipped.push(a);
    if (ain !== bin) {
      const k = (near - a[2]) / (b[2] - a[2]);
      clipped.push([a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1]), near]);
    }
  }
  return clipped.map((c) => [(cam.f * c[0] / c[2] + cam.cx) * scale, (cam.f * c[1] / c[2] + cam.cy) * scale]);
}

export function rasterizePolygon(poly, w, h, out = new Uint8Array(w * h)) {
  if (poly.length < 3) return out;
  for (let y = 0; y < h; y++) {
    const py = y + 0.5;
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) {
        xs.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = x0; x <= x1; x++) out[y * w + x] = 1;
    }
  }
  return out;
}

function boxBlur(src, w, h, ch, r) {
  // Separable box blur, channels interleaved.
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[(y * w + Math.min(w - 1, Math.max(0, x))) * ch + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * ch + c] = acc / (2 * r + 1);
        const add = Math.min(w - 1, x + r + 1), sub = Math.max(0, x - r);
        acc += src[(y * w + add) * ch + c] - src[(y * w + sub) * ch + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * ch + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * ch + c] = acc / (2 * r + 1);
        const add = Math.min(h - 1, y + r + 1), sub = Math.max(0, y - r);
        acc += tmp[(add * w + x) * ch + c] - tmp[(sub * w + x) * ch + c];
      }
    }
  }
  return out;
}

function median(values) {
  if (!values.length) return NaN;
  const s = Float32Array.from(values).sort();
  return s[Math.floor(s.length / 2)];
}

/**
 * Illumination map for one wall, in "white-equivalent" linear RGB: the colour a
 * white surface of the tub's albedo would photograph at each pixel.
 *
 * img: linear downscaled photo { data, width, height }
 * validMask: where the old wall is visible
 * targetMask: where the new wall will be drawn (fill must cover it)
 * albedoRatio: [r,g,b] old-wall colour / white-reference colour
 */
export function wallIllumination(img, validMask, targetMask, albedoRatio, { radius, falloff = 0.2 } = {}) {
  const { data, width: w, height: h } = img;
  const r = radius ?? Math.max(2, Math.round(0.045 * w));
  const num = new Float32Array(w * h * 3), den = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!validMask[i]) continue;
    den[i] = 1;
    num[i * 3] = data[i * 3]; num[i * 3 + 1] = data[i * 3 + 1]; num[i * 3 + 2] = data[i * 3 + 2];
  }
  let N = num, D = den;
  for (let k = 0; k < 3; k++) { N = boxBlur(N, w, h, 3, r); D = boxBlur(D, w, h, 1, r); }

  const E = new Float32Array(w * h * 3);
  const ok = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (D[i] > 0.15 && validMask[i]) {
      for (let c = 0; c < 3; c++) E[i * 3 + c] = N[i * 3 + c] / D[i] / albedoRatio[c];
      ok[i] = 1;
    }
  }
  // Carry illumination down each column into hidden rows, fading toward the floor.
  for (let x = 0; x < w; x++) {
    let last = -1, lastY = 0, bottom = h - 1;
    for (let y = h - 1; y >= 0; y--) if (targetMask[y * w + x]) { bottom = y; break; }
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      if (ok[i]) { last = i; lastY = y; continue; }
      if (last < 0 || !targetMask[i]) continue;
      const span = Math.max(1, bottom - lastY);
      const k = 1 - falloff * Math.min(1, (y - lastY) / span);
      for (let c = 0; c < 3; c++) E[i * 3 + c] = E[last * 3 + c] * k;
      ok[i] = 2;
    }
  }
  // Any remaining target pixels: nearest filled pixel in the row, else the global median.
  const med = [0, 1, 2].map((c) => {
    const v = []; for (let i = 0; i < w * h; i++) if (ok[i] === 1) v.push(E[i * 3 + c]);
    return median(v);
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (ok[i] || !targetMask[i]) continue;
      let best = -1;
      for (let d = 1; d < w && best < 0; d++) {
        if (x - d >= 0 && ok[i - d]) best = i - d;
        else if (x + d < w && ok[i + d]) best = i + d;
      }
      for (let c = 0; c < 3; c++) E[i * 3 + c] = best >= 0 ? E[best * 3 + c] : med[c];
    }
  }
  // Fill everything else with the median so texture sampling at edges is sane, then soften.
  for (let i = 0; i < w * h; i++) {
    if (ok[i] || targetMask[i]) continue;
    for (let c = 0; c < 3; c++) E[i * 3 + c] = Number.isFinite(med[c]) ? med[c] : 0.5;
  }
  return { data: boxBlur(E, w, h, 3, Math.max(1, Math.round(r / 3))), width: w, height: h, median: med };
}

// Robust colour of a region: median of the brighter, less saturated half
// (skips shadows, drain hardware and coloured objects such as towels).
export function referenceColour(img, mask) {
  const px = [];
  for (let i = 0; i < img.width * img.height; i++) {
    if (!mask[i]) continue;
    const r = img.data[i * 3], g = img.data[i * 3 + 1], b = img.data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    px.push([r, g, b, (r + g + b) / 3, mx > 0 ? (mx - mn) / mx : 0]);
  }
  if (!px.length) return null;
  const satCut = median(px.map((p) => p[4]));
  let pool = px.filter((p) => p[4] <= satCut + 1e-6);
  const lumCut = median(pool.map((p) => p[3]));
  pool = pool.filter((p) => p[3] >= lumCut);
  return [0, 1, 2].map((c) => median(pool.map((p) => p[c])));
}
