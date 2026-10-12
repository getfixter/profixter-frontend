// Pixel-level tools shared by the controlled layer and the AI layer:
// basic object removal, pixel lock, and the automatic accuracy check.
// Pure functions on ImageData-like objects ({ data, width, height }).

const mk = (w, h) => (typeof ImageData !== "undefined"
  ? new ImageData(w, h)
  : { data: new Uint8ClampedArray(w * h * 4), width: w, height: h });

/**
 * Fill masked pixels from their surroundings (push-pull interpolation).
 * Good for small, simple backgrounds; it smears texture, so large removals
 * are a job for the AI layer.
 */
export function fillMasked(img, mask) {
  const { width: W, height: H } = img;
  // Level 0: premultiplied colour + weight.
  let levels = [];
  let w = W, h = H;
  let col = new Float32Array(W * H * 3), wt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i]) continue;
    wt[i] = 1;
    col[i * 3] = img.data[i * 4]; col[i * 3 + 1] = img.data[i * 4 + 1]; col[i * 3 + 2] = img.data[i * 4 + 2];
  }
  levels.push({ col, wt, w, h });
  while (w > 2 && h > 2) {
    const nw = Math.ceil(w / 2), nh = Math.ceil(h / 2);
    const nc = new Float32Array(nw * nh * 3), nwt = new Float32Array(nw * nh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = (y >> 1) * nw + (x >> 1);
      nwt[j] += wt[i];
      nc[j * 3] += col[i * 3]; nc[j * 3 + 1] += col[i * 3 + 1]; nc[j * 3 + 2] += col[i * 3 + 2];
    }
    // Normalise to weight <= 1 so coarse levels stay averages.
    for (let j = 0; j < nw * nh; j++) {
      if (nwt[j] > 1) { const k = 1 / nwt[j]; nc[j * 3] *= k; nc[j * 3 + 1] *= k; nc[j * 3 + 2] *= k; nwt[j] = 1; }
    }
    levels.push({ col: nc, wt: nwt, w: nw, h: nh });
    col = nc; wt = nwt; w = nw; h = nh;
  }
  // Pull: fill missing weight from the coarser level (bilinear).
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l], coarse = levels[l + 1];
    for (let y = 0; y < fine.h; y++) for (let x = 0; x < fine.w; x++) {
      const i = y * fine.w + x;
      const miss = 1 - fine.wt[i];
      if (miss <= 1e-6) continue;
      const fx = Math.min(coarse.w - 1, Math.max(0, (x - 0.5) / 2)), fy = Math.min(coarse.h - 1, Math.max(0, (y - 0.5) / 2));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(coarse.w - 1, x0 + 1), y1 = Math.min(coarse.h - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      const s = (xx, yy, c) => {
        const j = yy * coarse.w + xx;
        return coarse.wt[j] > 0 ? coarse.col[j * 3 + c] / coarse.wt[j] : 0;
      };
      for (let c = 0; c < 3; c++) {
        const v = (1 - ay) * ((1 - ax) * s(x0, y0, c) + ax * s(x1, y0, c)) + ay * ((1 - ax) * s(x0, y1, c) + ax * s(x1, y1, c));
        fine.col[i * 3 + c] += miss * v;
      }
      fine.wt[i] = 1;
    }
  }
  const out = mk(W, H);
  const L0 = levels[0];
  let seed = 1;
  for (let i = 0; i < W * H; i++) {
    const n = mask[i] ? (((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5) * 4 : 0;
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = mask[i] ? L0.col[i * 3 + c] + n : img.data[i * 4 + c];
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

/** Blend candidate into original through mask (0/1), with a feathered edge of `feather` px. */
export function pixelLock(original, candidate, mask, feather = 2) {
  const { width: W, height: H } = original;
  // Distance-limited alpha: 1 inside, ramps to 0 over `feather` px outside... we
  // feather inward so no candidate pixel ever lands outside the mask.
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = mask[i] ? 1 : 0;
  for (let pass = 0; pass < feather; pass++) {
    const next = alpha.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const m = Math.min(alpha[i - 1], alpha[i + 1], alpha[i - W], alpha[i + W]);
      next[i] = Math.min(alpha[i], m + 1 / (feather + 1));
    }
    alpha.set(next);
  }
  const out = mk(W, H);
  for (let i = 0; i < W * H; i++) {
    const a = alpha[i];
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = Math.round(original.data[i * 4 + c] * (1 - a) + candidate.data[i * 4 + c] * a);
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

function toLab(r, g, b) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  let X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  let Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  let Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = f(X); Y = f(Y); Z = f(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

function gradients(img, mask) {
  const { width: W, height: H, data } = img;
  const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  const L = (x, y) => { const i = (y * W + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    gx[i] = L(x + 1, y) - L(x - 1, y);
    gy[i] = L(x, y + 1) - L(x, y - 1);
  }
  return { gx, gy };
}

/**
 * Automatic check of an AI-enhanced image against the controlled render.
 * Returns colour drift (CIE76 dE) on the walls, structural agreement (gradient
 * correlation) inside the walls, and how many pixels changed outside
 * it before pixel lock.
 */
export function checkAgainstControlled(controlled, candidate, workMask, wallMask, original = null) {
  const { width: W, height: H } = controlled;
  const dE = [];
  for (let i = 0; i < W * H; i++) {
    if (!wallMask[i]) continue;
    const a = toLab(controlled.data[i * 4], controlled.data[i * 4 + 1], controlled.data[i * 4 + 2]);
    const b = toLab(candidate.data[i * 4], candidate.data[i * 4 + 1], candidate.data[i * 4 + 2]);
    dE.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  dE.sort((p, q) => p - q);
  // Structure is measured on the wall interior only (eroded 2 px), where the
  // panel pattern lives; the outline of the work area is in every candidate
  // and would hide a lost pattern.
  const inner = new Uint8Array(W * H);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    let all = 1;
    for (let d = -2; d <= 2 && all; d++) all = wallMask[(y + d) * W + x] && wallMask[y * W + x + d] ? 1 : 0;
    inner[y * W + x] = all;
  }
  const ga = gradients(controlled, inner), gb = gradients(candidate, inner);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < W * H; i++) {
    if (!inner[i]) continue;
    sab += ga.gx[i] * gb.gx[i] + ga.gy[i] * gb.gy[i];
    saa += ga.gx[i] ** 2 + ga.gy[i] ** 2;
    sbb += gb.gx[i] ** 2 + gb.gy[i] ** 2;
  }
  let outsideChanged = null;
  if (original) {
    outsideChanged = 0;
    for (let i = 0; i < W * H; i++) {
      if (workMask[i]) continue;
      const d = Math.abs(original.data[i * 4] - candidate.data[i * 4]) + Math.abs(original.data[i * 4 + 1] - candidate.data[i * 4 + 1]) + Math.abs(original.data[i * 4 + 2] - candidate.data[i * 4 + 2]);
      if (d > 24) outsideChanged++;
    }
  }
  const meanDE = dE.reduce((s, v) => s + v, 0) / Math.max(1, dE.length);
  const p95DE = dE.length ? dE[Math.floor(dE.length * 0.95)] : 0;
  const structure = sab / Math.sqrt(Math.max(1e-9, saa * sbb));
  return {
    meanDE, p95DE, structure, outsideChanged,
    pass: meanDE <= 8 && p95DE <= 20 && structure >= 0.6,
  };
}

/** Count pixels that differ between two images outside a mask (should be 0 after pixel lock). */
export function diffOutside(a, b, mask) {
  let n = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    if (mask && mask[i]) continue;
    if (a.data[i * 4] !== b.data[i * 4] || a.data[i * 4 + 1] !== b.data[i * 4 + 1] || a.data[i * 4 + 2] !== b.data[i * 4 + 2]) n++;
  }
  return n;
}

/**
 * Exemplar ("patch") fill: every hole pixel is copied from a matching patch of
 * the surrounding photo, filled from the edge inward, with neighbours reusing
 * each other's source offsets so texture (tile, floor, grain) continues instead
 * of smearing. A smooth push-pull fill guides the colour across large holes.
 * Holes larger than `maxPixels` fall back to the smooth fill.
 */
export function inpaintPatch(img, mask, { patch = 7, samples = 20, radius = 0, maxPixels = 250000, seed = 1, ignore = null } = {}) {
  const { width: W, height: H } = img;
  let holes = 0;
  for (let i = 0; i < W * H; i++) if (mask[i]) holes++;
  // "ignore": pixels that will be covered anyway (new work) - never copied from, never filled
  let blocked = mask;
  if (ignore) { blocked = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) blocked[i] = mask[i] || ignore[i] ? 1 : 0; }
  const guide = fillMasked(img, blocked);
  if (!holes || holes > maxPixels) return guide;
  const r = patch >> 1;
  const R = radius || Math.max(40, Math.round(Math.sqrt(holes) * 2.5));
  const out = new Uint8ClampedArray(guide.data);
  // a source centre is valid when its whole patch is original photo
  const S = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) { row += blocked[y * W + x] ? 1 : 0; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; }
  }
  const validSrc = (x, y) => {
    if (x < r || y < r || x >= W - r || y >= H - r) return false;
    const x0 = x - r, y0 = y - r, x1 = x + r + 1, y1 = y + r + 1;
    return S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0] === 0;
  };
  // onion-peel order: distance from the hole's edge
  const filled = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) filled[i] = blocked[i] ? 0 : 1;
  const offX = new Int32Array(W * H), offY = new Int32Array(W * H);
  let frontier = [];
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    const x = i % W, y = (i / W) | 0;
    if ((x > 0 && !blocked[i - 1]) || (x < W - 1 && !blocked[i + 1]) || (y > 0 && !blocked[i - W]) || (y < H - 1 && !blocked[i + W])) frontier.push(i);
  }
  let rnd = seed >>> 0 || 1;
  const rand = () => {
    rnd ^= rnd << 13; rnd ^= rnd >>> 17; rnd ^= rnd << 5;
    return (rnd >>> 0) / 4294967296;
  };
  const queued = new Uint8Array(W * H);
  for (const i of frontier) queued[i] = 1;
  const gd = guide.data, src = img.data;
  const cost = (px, py, sx, sy, best) => {
    let e = 0;
    for (let dy = -r; dy <= r; dy++) {
      const ty = py + dy; if (ty < 0 || ty >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const tx = px + dx; if (tx < 0 || tx >= W) continue;
        const t = ty * W + tx;
        if (!filled[t]) continue;
        const a = t * 4, b = ((sy + dy) * W + sx + dx) * 4;
        const d0 = out[a] - src[b], d1 = out[a + 1] - src[b + 1], d2 = out[a + 2] - src[b + 2];
        e += d0 * d0 + d1 * d1 + d2 * d2;
        if (e >= best) return e;
      }
    }
    // keep the low-frequency colour of the smooth fill across large holes
    const g = (py * W + px) * 4, s = (sy * W + sx) * 4;
    const q0 = gd[g] - src[s], q1 = gd[g + 1] - src[s + 1], q2 = gd[g + 2] - src[s + 2];
    return e + 2 * (q0 * q0 + q1 * q1 + q2 * q2);
  };
  while (frontier.length) {
    const next = [];
    for (const i of frontier) {
      const px = i % W, py = (i / W) | 0;
      let best = Infinity, bx = -1, by = -1;
      const tryS = (sx, sy) => {
        if (!validSrc(sx, sy)) return;
        const c = cost(px, py, sx, sy, best);
        if (c < best) { best = c; bx = sx; by = sy; }
      };
      // coherence: continue a neighbour's copy
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (!mask[n] || !filled[n]) continue;
          tryS(px + offX[n], py + offY[n]);
        }
      for (let k = 0, tries = 0; k < samples && tries < samples * 6; tries++) {
        const sx = Math.round(px + (rand() * 2 - 1) * R), sy = Math.round(py + (rand() * 2 - 1) * R);
        if (!validSrc(sx, sy)) continue;
        k++;
        tryS(sx, sy);
      }
      if (bx >= 0) {
        const a = i * 4, b = (by * W + bx) * 4;
        out[a] = src[b]; out[a + 1] = src[b + 1]; out[a + 2] = src[b + 2];
        offX[i] = bx - px; offY[i] = by - py;
      }
      filled[i] = 1;
    }
    for (const i of frontier) {
      const x = i % W, y = (i / W) | 0;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (n < 0 || !mask[n] || queued[n]) continue;
        queued[n] = 1; next.push(n);
      }
    }
    frontier = next;
  }
  const res = mk(W, H);
  res.data.set(out);
  for (let i = 0; i < W * H; i++) {
    res.data[i * 4 + 3] = 255;
    // ignored pixels keep the photo (the new work is drawn over them)
    if (ignore && ignore[i] && !mask[i]) { res.data[i * 4] = src[i * 4]; res.data[i * 4 + 1] = src[i * 4 + 1]; res.data[i * 4 + 2] = src[i * 4 + 2]; }
  }
  return res;
}

/**
 * "Tap to remove": the object under a tap, grown by colour similarity from the
 * tapped point (bounded by `maxRadius`), slightly dilated. Returns a 0/1 mask.
 */
export function regionFromTap(img, x0, y0, { tolerance = 28, maxRadius = 0, dilate = 3 } = {}) {
  const { width: W, height: H, data } = img;
  const R = maxRadius || Math.max(W, H) * 0.25;
  const out = new Uint8Array(W * H);
  const sx = Math.round(x0), sy = Math.round(y0);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return out;
  // seed colour: median of a 5x5 neighbourhood (robust to noise)
  const ch = [[], [], []];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = Math.min(W - 1, Math.max(0, sx + dx)), y = Math.min(H - 1, Math.max(0, sy + dy));
    for (let c = 0; c < 3; c++) ch[c].push(data[(y * W + x) * 4 + c]);
  }
  const seedC = ch.map((v) => v.sort((a, b) => a - b)[12]);
  const tol2 = tolerance * tolerance;
  const stack = [sy * W + sx];
  out[sy * W + sx] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (out[n]) continue;
      if ((nx - sx) ** 2 + (ny - sy) ** 2 > R * R) continue;
      const a = n * 4;
      const d = (data[a] - seedC[0]) ** 2 + (data[a + 1] - seedC[1]) ** 2 + (data[a + 2] - seedC[2]) ** 2;
      if (d > tol2) continue;
      out[n] = 1;
      stack.push(n);
    }
  }
  if (dilate > 0) {
    const grown = new Uint8Array(out);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!out[y * W + x]) continue;
      for (let dy = -dilate; dy <= dilate; dy++) for (let dx = -dilate; dx <= dilate; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && dx * dx + dy * dy <= dilate * dilate) grown[yy * W + xx] = 1;
      }
    }
    return grown;
  }
  return out;
}
