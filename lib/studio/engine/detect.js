// Photo analysis for the marking step: corner/edge snapping and a first guess
// at where the alcove is. Everything here is a SUGGESTION - the salesperson
// always sees the dots and confirms them; nothing is solved silently.
//
// Works on ImageData-like objects ({ width, height, data: RGBA }), so it runs
// the same in the browser and in Node tests.

const DEG = Math.PI / 180;

function luma(d, i) {
  return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
}

function percentile(arr, q) {
  const step = Math.max(1, Math.floor(arr.length / 20000));
  const s = [];
  for (let i = 0; i < arr.length; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0;
}

// ---------------------------------------------------------------------------
// Snapping (full resolution, local window)
// ---------------------------------------------------------------------------

/** Gray, gradients and the Shi-Tomasi corner response in a window around (cx, cy). */
function localTensor(img, cx, cy, r) {
  const { width: W, height: H, data } = img;
  const pad = 3;
  const x0 = Math.max(0, Math.floor(cx - r - pad)), x1 = Math.min(W - 1, Math.ceil(cx + r + pad));
  const y0 = Math.max(0, Math.floor(cy - r - pad)), y1 = Math.min(H - 1, Math.ceil(cy + r + pad));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = luma(data, ((y + y0) * W + x + x0) * 4);
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1]) / 8;
      gy[i] = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1]) / 8;
    }
  // 5x5 box-summed structure tensor -> smallest eigenvalue
  const R = new Float32Array(w * h), M = new Float32Array(w * h);
  for (let y = 3; y < h - 3; y++)
    for (let x = 3; x < w - 3; x++) {
      let a = 0, b = 0, c = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const k = (y + dy) * w + x + dx;
          a += gx[k] * gx[k]; b += gx[k] * gy[k]; c += gy[k] * gy[k];
        }
      const i = y * w + x;
      R[i] = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);
      M[i] = Math.hypot(gx[i], gy[i]);
    }
  return { x0, y0, w, h, R, M, gx, gy };
}

function subpixel(F, w, i) {
  // 1-D quadratic peak fit in x and y
  const fx = (F[i - 1] - F[i + 1]) / (2 * (F[i - 1] - 2 * F[i] + F[i + 1]) || 1);
  const fy = (F[i - w] - F[i + w]) / (2 * (F[i - w] - 2 * F[i] + F[i + w]) || 1);
  return [Math.max(-0.5, Math.min(0.5, fx)), Math.max(-0.5, Math.min(0.5, fy))];
}

/**
 * Pull a tapped/dragged point onto the nearest clear corner (a wall corner
 * meeting the tub, the top of a tile line...). The nearer of two equally
 * strong corners wins. Returns the original point when nothing clear is near.
 */
export function snapCorner(img, p, { radius } = {}) {
  const r = Math.max(4, radius ?? 0.018 * Math.max(img.width, img.height));
  const T = localTensor(img, p[0], p[1], r);
  let peak = 0;
  for (let i = 0; i < T.R.length; i++) if (T.R[i] > peak) peak = T.R[i];
  // a real corner has a strong response in absolute terms (contrast ~0.1 on both edges)
  const minAbs = 0.0004;
  if (peak < minAbs) return { point: p, snapped: false, strength: 0 };
  const sigma = r * 0.6;
  let best = -1, bs = 0;
  for (let y = 3; y < T.h - 3; y++)
    for (let x = 3; x < T.w - 3; x++) {
      const i = y * T.w + x;
      const d2 = (x + T.x0 - p[0]) ** 2 + (y + T.y0 - p[1]) ** 2;
      if (d2 > r * r) continue;
      const s = T.R[i] * Math.exp(-d2 / (2 * sigma * sigma));
      if (s > bs) { bs = s; best = i; }
    }
  if (best < 0 || T.R[best] < Math.max(minAbs, 0.25 * peak)) return { point: p, snapped: false, strength: 0 };
  const [fx, fy] = subpixel(T.R, T.w, best);
  const point = [T.x0 + (best % T.w) + fx, T.y0 + Math.floor(best / T.w) + fy];
  return { point, snapped: true, strength: Math.min(1, T.R[best] / 0.004) };
}

/** Pull a point onto the nearest strong edge (for points that lie on a line, not a corner). */
export function snapEdge(img, p, { radius } = {}) {
  const r = Math.max(3, radius ?? 0.012 * Math.max(img.width, img.height));
  const T = localTensor(img, p[0], p[1], r);
  const sigma = r * 0.6;
  let best = -1, bs = 0;
  for (let y = 3; y < T.h - 3; y++)
    for (let x = 3; x < T.w - 3; x++) {
      const i = y * T.w + x;
      const d2 = (x + T.x0 - p[0]) ** 2 + (y + T.y0 - p[1]) ** 2;
      if (d2 > r * r) continue;
      const s = T.M[i] * Math.exp(-d2 / (2 * sigma * sigma));
      if (s > bs) { bs = s; best = i; }
    }
  if (best < 0 || T.M[best] < 0.03) return { point: p, snapped: false, strength: 0 };
  // sub-pixel along the gradient direction
  const gx = T.gx[best], gy = T.gy[best], n = Math.hypot(gx, gy) || 1;
  const ux = gx / n, uy = gy / n;
  const bx = best % T.w, by = Math.floor(best / T.w);
  const at = (o) => {
    const x = Math.round(bx + ux * o), y = Math.round(by + uy * o);
    return x >= 0 && y >= 0 && x < T.w && y < T.h ? T.M[y * T.w + x] : 0;
  };
  const a = at(-1), c = at(1), b = T.M[best];
  const off = Math.max(-0.5, Math.min(0.5, (a - c) / (2 * (a - 2 * b + c) || 1)));
  return { point: [T.x0 + bx + ux * off, T.y0 + by + uy * off], snapped: true, strength: Math.min(1, b / 0.2) };
}

// ---------------------------------------------------------------------------
// Low-resolution analysis field
// ---------------------------------------------------------------------------

export function buildField(img, maxSide = 420) {
  const { width: W0, height: H0, data } = img;
  const s = Math.min(1, maxSide / Math.max(W0, H0));
  const w = Math.max(8, Math.round(W0 * s)), h = Math.max(8, Math.round(H0 * s));
  const n = w * h;
  const raw = new Float32Array(n), o1 = new Float32Array(n), o2 = new Float32Array(n);
  const sat = new Float32Array(n), val = new Float32Array(n), cnt = new Float32Array(n);
  const nr = new Float32Array(n), ng = new Float32Array(n); // shading-invariant chromaticity
  for (let y = 0; y < H0; y++) {
    const ty = Math.min(h - 1, Math.floor((y * h) / H0));
    for (let x = 0; x < W0; x++) {
      const tx = Math.min(w - 1, Math.floor((x * w) / W0));
      const i = (y * W0 + x) * 4, k = ty * w + tx;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      raw[k] += 0.299 * r + 0.587 * g + 0.114 * b;
      o1[k] += 0.5 * (r - g);
      o2[k] += 0.5 * (0.5 * (r + g) - b);
      sat[k] += mx > 0.02 ? (mx - mn) / mx : 0;
      const sum = r + g + b + 1e-3;
      nr[k] += r / sum; ng[k] += g / sum;
      val[k] += mx;
      cnt[k]++;
    }
  }
  for (let k = 0; k < n; k++) { const c = cnt[k] || 1; raw[k] /= c; nr[k] /= c; ng[k] /= c; o1[k] /= c; o2[k] /= c; sat[k] /= c; val[k] /= c; }
  const blur = (src) => {
    const out = new Float32Array(n);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let acc = 0, wt = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const k = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
            acc += src[yy * w + xx] * k; wt += k;
          }
        out[y * w + x] = acc / wt;
      }
    return out;
  };
  const gray = blur(raw), c1 = blur(o1), c2 = blur(o2);
  // Colour-aware gradient: the strongest of brightness and two opponent-colour
  // channels, so a yellow-tile corner against beige paint (same brightness) is found.
  const gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      for (const ch of [gray, c1, c2]) {
        const ex = (ch[i - w + 1] + 2 * ch[i + 1] + ch[i + w + 1] - ch[i - w - 1] - 2 * ch[i - 1] - ch[i + w - 1]) / 8;
        const ey = (ch[i + w - 1] + 2 * ch[i + w] + ch[i + w + 1] - ch[i - w - 1] - 2 * ch[i - w] - ch[i - w + 1]) / 8;
        const m = Math.hypot(ex, ey);
        if (m > mag[i]) { mag[i] = m; gx[i] = ex; gy[i] = ey; }
      }
    }
  return { w, h, sx: w / W0, sy: h / H0, gray, c1, c2, nr, ng, sat, val, gx, gy, mag };
}

// ---------------------------------------------------------------------------
// Straight lines (Hough, then supported segments)
// ---------------------------------------------------------------------------

export function findSegments(field, { maxLines = 90 } = {}) {
  const { w, h, gx, gy, mag } = field;
  const thr = Math.max(0.02, percentile(mag, 0.86));
  const edge = new Uint8Array(w * h), ang = new Float32Array(w * h);
  const diag = Math.ceil(Math.hypot(w, h));
  const NT = 180, NR = 2 * diag + 1;
  const cosT = new Float32Array(NT), sinT = new Float32Array(NT);
  for (let t = 0; t < NT; t++) { cosT[t] = Math.cos(t * DEG); sinT[t] = Math.sin(t * DEG); }
  const acc = new Float32Array(NT * NR);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (mag[i] < thr) continue;
      edge[i] = 1;
      let a = Math.atan2(gy[i], gx[i]) / DEG;
      if (a < 0) a += 180;
      if (a >= 180) a -= 180;
      ang[i] = a;
      const wt = Math.min(mag[i], 3 * thr) / thr;
      const t0 = Math.round(a);
      for (let dt = -3; dt <= 3; dt++) {
        const t = (t0 + dt + NT) % NT;
        const r = Math.round(x * cosT[t] + y * sinT[t]) + diag;
        acc[t * NR + r] += wt;
      }
    }
  // peaks with non-maximum suppression
  let amax = 0;
  for (let i = 0; i < acc.length; i++) if (acc[i] > amax) amax = acc[i];
  const peaks = [];
  const minVotes = Math.max(6, 0.05 * amax);
  for (let t = 0; t < NT; t++)
    for (let r = 0; r < NR; r++) {
      const v = acc[t * NR + r];
      if (v < minVotes) continue;
      let isMax = true;
      for (let dt = -3; dt <= 3 && isMax; dt++)
        for (let dr = -5; dr <= 5; dr++) {
          if (!dt && !dr) continue;
          const tt = (t + dt + NT) % NT, rr = r + dr;
          if (rr < 0 || rr >= NR) continue;
          const u = acc[tt * NR + rr];
          if (u > v || (u === v && (tt * NR + rr) < t * NR + r)) { isMax = false; break; }
        }
      if (isMax) peaks.push({ t, r: r - diag, v });
    }
  peaks.sort((a, b) => b.v - a.v);
  const segs = [];
  // faint stretches (a corner fading into the tub, a towel in front) are bridged;
  // a run must still be at least half supported along its length
  const gap = Math.max(4, 0.06 * diag), minLen = 0.05 * diag;
  for (const pk of peaks.slice(0, maxLines)) {
    const c = cosT[pk.t], s = sinT[pk.t];
    const dx = -s, dy = c, px = pk.r * c, py = pk.r * s;
    let run = null, lastHit = -Infinity;
    const flush = () => {
      if (run && run.hits >= 0.5 * (run.b - run.a) && run.b - run.a >= minLen) segs.push(makeSeg(pk.t, pk.r, px, py, dx, dy, run, field));
    };
    for (let k = -diag; k <= diag; k++) {
      const x = px + dx * k, y = py + dy * k;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      let hit = false;
      for (let o = -1; o <= 1 && !hit; o++) {
        const xx = Math.round(x + c * o), yy = Math.round(y + s * o);
        const i = yy * w + xx;
        if (!edge[i]) continue;
        let da = Math.abs(ang[i] - pk.t);
        if (da > 90) da = 180 - da;
        if (da <= 12) hit = true;
      }
      if (hit) {
        if (!run || k - lastHit > gap) { flush(); run = { a: k, b: k, hits: 0 }; }
        run.b = k; run.hits++; lastHit = k;
      }
    }
    flush();
  }
  return segs;
}

function makeSeg(t, r, px, py, dx, dy, run, field) {
  const a = [px + dx * run.a, py + dy * run.a], b = [px + dx * run.b, py + dy * run.b];
  const len = run.b - run.a;
  // A real wall corner or the tub/wall line is a STEP (different surfaces on each
  // side); a tile grout line is a thin ridge with the same colour on both sides.
  const c = Math.cos(t * DEG), s = Math.sin(t * DEG);
  const off = 3.5;
  let dG = 0, dS = 0, dC = 0, n = 0, whiteNeg = 0, whitePos = 0, sN = 0, sP = 0, vN = 0, vP = 0;
  for (let k = 0.1; k <= 0.9; k += 0.05) {
    const x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k;
    const A = sample(field, x - c * off, y - s * off), B = sample(field, x + c * off, y + s * off);
    if (!A || !B) continue;
    dG += Math.max(Math.abs(A.g - B.g), Math.abs(A.c1 - B.c1), Math.abs(A.c2 - B.c2)); dS += Math.abs(A.s - B.s); dC += Math.abs(A.nr - B.nr) + Math.abs(A.ng - B.ng); n++;
    sN += A.s; sP += B.s; vN += A.v; vP += B.v;
    if (isWhite(A)) whiteNeg++;
    if (isWhite(B)) whitePos++;
  }
  const contrast = n ? (dG + 0.5 * dS) / n : 0;
  return { t, r, a, b, len, hits: run.hits, contrast, chroma: n ? dC / n : 0, satNeg: n ? sN / n : 0, satPos: n ? sP / n : 0, valNeg: n ? vN / n : 0, valPos: n ? vP / n : 0, whiteNeg: n ? whiteNeg / n : 0, whitePos: n ? whitePos / n : 0 };
}

function sample(field, x, y) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= field.w || yi >= field.h) return null;
  const i = yi * field.w + xi;
  return { g: field.gray[i], c1: field.c1[i], c2: field.c2[i], nr: field.nr[i], ng: field.ng[i], s: field.sat[i], v: field.val[i] };
}
const isWhite = (p) => p.s < 0.2 && p.v > 0.55;

const isVertical = (sg) => Math.abs(Math.cos(sg.t * DEG)) > Math.cos(25 * DEG);
const isHorizontal = (sg) => Math.abs(Math.sin(sg.t * DEG)) > Math.cos(40 * DEG);
const xAt = (sg, y) => (sg.r - y * Math.sin(sg.t * DEG)) / Math.cos(sg.t * DEG);
const yAt = (sg, x) => (sg.r - x * Math.cos(sg.t * DEG)) / Math.sin(sg.t * DEG);

export function intersect(l1, l2) {
  const a = Math.cos(l1.t * DEG), b = Math.sin(l1.t * DEG), c = Math.cos(l2.t * DEG), d = Math.sin(l2.t * DEG);
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-6) return null;
  return [(l1.r * d - b * l2.r) / det, (a * l2.r - l1.r * c) / det];
}

const segTop = (sg) => (sg.a[1] < sg.b[1] ? sg.a : sg.b);
const segBottom = (sg) => (sg.a[1] < sg.b[1] ? sg.b : sg.a);
const segLeft = (sg) => (sg.a[0] < sg.b[0] ? sg.a : sg.b);
const segRight = (sg) => (sg.a[0] < sg.b[0] ? sg.b : sg.a);

function overlap1(a0, a1, b0, b1) {
  return Math.max(0, Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1)));
}

/**
 * Where the photo's vertical lines meet (the vertical vanishing point), from
 * the detected near-vertical segments. Returns { vp } or { angle } when the
 * verticals are parallel in the image.
 */
function verticalDirection(verts, h = 400) {
  // Robust local model: the lean of long vertical edges as a linear function of x
  // (what a vertical vanishing point produces), fitted by weighted least squares.
  const long = verts.filter((v) => v.len > 0.15 * h);
  if (long.length >= 2) {
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const v of long) {
      const tilt = v.t > 90 ? v.t - 180 : v.t;
      const x = (v.a[0] + v.b[0]) / 2, wt = v.len * (0.05 + Math.min(v.contrast, 0.3));
      sw += wt; sx += wt * x; sy += wt * tilt; sxx += wt * x * x; sxy += wt * x * tilt;
    }
    const den = sw * sxx - sx * sx;
    const b = Math.abs(den) > 1e-9 ? (sw * sxy - sx * sy) / den : 0;
    const a = (sy - b * sx) / sw;
    // clamp the slope: lean changes by at most ~6 degrees across the photo
    const bb = Math.max(-6 / Math.max(1, h), Math.min(6 / Math.max(1, h), b));
    return { tiltAt: (x) => a + bb * x + (b - bb) * (sx / sw) };
  }
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0, wsum = 0, tsum = 0;
  for (const v of verts) {
    const c = Math.cos(v.t * DEG), sn = Math.sin(v.t * DEG), wt = v.len * (0.05 + Math.min(v.contrast, 0.3));
    a11 += wt * c * c; a12 += wt * c * sn; a22 += wt * sn * sn; b1 += wt * c * v.r; b2 += wt * sn * v.r;
    // signed tilt around vertical (t near 0 or 180)
    tsum += wt * (v.t > 90 ? v.t - 180 : v.t); wsum += wt;
  }
  const det = a11 * a22 - a12 * a12;
  const angle = wsum ? tsum / wsum : 0;
  if (Math.abs(det) < 1e-6 * (a11 * a22 + 1e-9)) return { angle };
  const vp = [(b1 * a22 - a12 * b2) / det, (a11 * b2 - a12 * b1) / det];
  return { vp, angle };
}

/** A line through P toward the vertical vanishing point, as a segment from P up to yTop. */
function virtualVertical(P, dir, yTop) {
  let dx, dy;
  if (dir.tiltAt) { const tl = dir.tiltAt(P[0]); dx = Math.sin(tl * DEG); dy = -Math.cos(tl * DEG); }
  else if (dir.vp && Math.abs(dir.vp[1] - P[1]) > 1) { dx = dir.vp[0] - P[0]; dy = dir.vp[1] - P[1]; if (dy > 0) { dx = -dx; dy = -dy; } }
  else { dx = Math.sin(dir.angle * DEG); dy = -Math.cos(dir.angle * DEG); }
  const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  // normal (cos t, sin t) perpendicular to (dx, dy)
  let t = Math.atan2(dx, -dy) / DEG; // normal = (-dy, dx) rotated: angle of (−dy, dx)
  let nx = -dy, ny = dx;
  t = Math.atan2(ny, nx) / DEG;
  if (t < 0) { t += 180; nx = -nx; ny = -ny; }
  if (t >= 180) t -= 180;
  const r = nx * P[0] + ny * P[1];
  const k = (P[1] - yTop) / Math.max(0.2, -dy);
  const top = [P[0] + dx * k, P[1] + dy * k];
  return { t, r, a: top, b: [...P], len: Math.hypot(top[0] - P[0], top[1] - P[1]), hits: 0, contrast: 0.06, chroma: 0, whiteNeg: 0, whitePos: 0, virtual: true };
}

// ---------------------------------------------------------------------------
// The alcove guess
// ---------------------------------------------------------------------------

/**
 * First guess for the four facing-wall dots and the side-wall lines.
 * The facing wall is found as two vertical corner lines that come down onto a
 * horizontal line with the white tub (or base) below it.
 *
 * Returns null when no plausible alcove is visible. Coordinates are in the
 * input image's pixels.
 */
export function suggestMarks(img, { field: given, debug = false } = {}) {
  const field = given || buildField(img);
  const { w, h } = field;
  const diag = Math.hypot(w, h);
  const segs = findSegments(field);
  const verts = segs.filter(isVertical).filter((s) => s.contrast > 0.015).sort((a, b) => b.len * b.contrast - a.len * a.contrast).slice(0, 18);
  const hors = segs.filter((s) => isHorizontal(s) && !isVertical(s)).sort((a, b) => b.len - a.len).slice(0, 40);

  // Where the tub/wall line meets another line at an angle (the rim running along a
  // side wall), there is a wall corner - even when the corner edge itself is too
  // faint to see (same tile on both walls). Those junctions get virtual verticals.
  const dir = verticalDirection(verts, h);
  const junctions = [];
  for (const B of hors)
    for (const S of segs) {
      if (S === B || isVertical(S)) continue;
      let dt = Math.abs(S.t - B.t); if (dt > 90) dt = 180 - dt;
      if (dt < 12) continue;
      const P = intersect(B, S);
      if (!P || P[0] < 0 || P[1] < 0 || P[0] >= w || P[1] >= h) continue;
      const nearEnd = (sg) => Math.min(Math.hypot(sg.a[0] - P[0], sg.a[1] - P[1]), Math.hypot(sg.b[0] - P[0], sg.b[1] - P[1]));
      if (nearEnd(B) > 0.03 * diag || nearEnd(S) > 0.03 * diag) continue;
      junctions.push({ B, P });
    }
  const virt = junctions.map((j) => ({ ...virtualVertical(j.P, dir, 0.12 * h), junctionOf: j.B }));
  const allVerts = [...verts, ...virt];
  const nearJunction = (P) => junctions.some((j) => Math.hypot(j.P[0] - P[0], j.P[1] - P[1]) < 0.02 * diag);

  let best = null, cands = null;
  for (const B of hors) {
    // below the base line is the tub/base: whiter than what is above it
    const sinB = Math.sin(B.t * DEG);
    // orient: which side of B is "below" (larger y)
    const belowWhite = sinB > 0 ? B.whitePos : B.whiteNeg;
    const aboveWhite = sinB > 0 ? B.whiteNeg : B.whitePos;
    // relative too: a cream tub under warm light is not "white", but it is still
    // clearly less saturated and brighter than the tile above it
    const sAbove = sinB > 0 ? B.satNeg : B.satPos, sBelow = sinB > 0 ? B.satPos : B.satNeg;
    const vAbove = sinB > 0 ? B.valNeg : B.valPos, vBelow = sinB > 0 ? B.valPos : B.valNeg;
    const relative = Math.min(1, Math.max(0, sAbove - sBelow) / 0.12) * (vBelow >= vAbove - 0.04 ? 1 : 0.4);
    const white = Math.max(belowWhite - 0.7 * aboveWhite, 0.8 * relative);
    if (white < 0.15 && B.contrast < 0.06) continue;
    for (let i = 0; i < allVerts.length; i++)
      for (let j = 0; j < allVerts.length; j++) {
        if (i === j) continue;
        const L = allVerts[i], R = allVerts[j];
        if ((L.virtual && L.junctionOf !== B) || (R.virtual && R.junctionOf !== B)) continue;
        const BL = intersect(L, B), BR = intersect(R, B);
        if (!BL || !BR) continue;
        const gapX = BR[0] - BL[0];
        if (gapX < 0.12 * w) continue;
        if (BL[0] < -0.02 * w || BR[0] > 1.02 * w || BL[1] < 0.25 * h || BR[1] < 0.25 * h || BL[1] > h || BR[1] > h) continue;
        // both corner lines come down to the base line and rise well above it
        const lb = segBottom(L), rb = segBottom(R);
        // (an outside corner may carry on down past the tub - it must at least reach the base)
        if (lb[1] < BL[1] - 0.09 * h || rb[1] < BR[1] - 0.09 * h) continue;
        if (lb[1] > BL[1] + 0.09 * h && rb[1] > BR[1] + 0.09 * h) continue;
        const lRise = BL[1] - segTop(L)[1], rRise = BR[1] - segTop(R)[1];
        if (lRise < 0.18 * h || rRise < 0.18 * h) continue;
        // the base line spans the wall
        const cover = overlap1(B.a[0], B.b[0], BL[0], BR[0]) / gapX;
        if (cover < 0.5) continue;
        // corners are steps; verticals between them must not be stronger corners
        // the base line should run corner to corner (cover^2), and a corner where the
        // tub outline turns (a junction) is strong evidence
        const score =
          (0.25 + Math.min(L.contrast, 0.25)) * Math.min(lRise, L.len) +
          (0.25 + Math.min(R.contrast, 0.25)) * Math.min(rRise, R.len) +
          (0.6 + Math.max(0, white)) * cover * cover * gapX * 1.2 +
          0.15 * gapX +
          (nearJunction(BL) ? 0.3 * B.len : 0) + (nearJunction(BR) ? 0.3 * B.len : 0);
        // an inside corner (the line stops at the tub) joins two walls - usually the
        // same material in two shades; a different material there is more likely the
        // edge of a curtain, door or towel in front of the corner
        const lInside = lb[1] <= BL[1] + 0.035 * h, rInside = rb[1] <= BR[1] + 0.035 * h;
        const odd = (lInside && !L.virtual && L.chroma > 0.05 ? 1 : 0) + (rInside && !R.virtual && R.chroma > 0.05 ? 1 : 0);
        const sc2 = score * (odd ? 0.6 : 1);
        if (debug) (cands ||= []).push({ sc: Math.round(sc2), L: L.virtual ? "virtual" : Math.round(xAt(L, BL[1])), R: R.virtual ? "virtual" : Math.round(xAt(R, BR[1])), BL: BL.map(Math.round), BR: BR.map(Math.round), cover: +cover.toFixed(2), white: +white.toFixed(2) });
        if (!best || sc2 > best.score) best = { score: sc2, L, R, B, BL, BR, white, odd };
      }
  }
  if (!best) return null;

  // the top line: a horizontal line well above the base, spanning the wall
  const { L, R, B, BL, BR } = best;
  let T = null, tScore = 0;
  for (const S of hors) {
    if (S === B) continue;
    const TL = intersect(L, S), TR = intersect(R, S);
    if (!TL || !TR) continue;
    if (BL[1] - TL[1] < 0.22 * h || BR[1] - TR[1] < 0.22 * h || TL[1] < 0 || TR[1] < 0) continue;
    const cover = overlap1(S.a[0], S.b[0], TL[0], TR[0]) / Math.max(1, TR[0] - TL[0]);
    if (cover < 0.45) continue;
    // prefer lines close to where the corner edges end (top of tile, ceiling) and with a real step
    const reach = Math.min(TL[1] - segTop(L)[1], TR[1] - segTop(R)[1]);
    const sc = cover * (0.3 + Math.min(S.contrast, 0.3)) * (reach > -0.06 * h ? 1.4 : 1) * (1 + (BL[1] - TL[1]) / h);
    if (sc > tScore) { tScore = sc; T = S; }
  }
  let TL, TR, topReal = Boolean(T);
  if (T) {
    TL = intersect(L, T); TR = intersect(R, T);
  } else {
    // no clear top line: follow the corner lines up, keeping the base line's slant
    // high on the corner lines (the corners run up to the ceiling even where the
    // edge is not visible); the rep drags them onto a real line if one is there
    const y = Math.max(0.1 * h, Math.min(BL[1], BR[1]) - 0.6 * h);
    const xl = xAt(L, y), xr = xAt(R, y);
    const slope = (BR[1] - BL[1]) / Math.max(1, BR[0] - BL[0]);
    TL = [xl, y]; TR = [xr, y + slope * (xr - xl) * 0.5];
  }

  // side-wall lines through the left / right base corner (tub rim against the side wall)
  function sideLine(corner, dir, avoid) {
    let pick = null, ps = 0;
    for (const S of segs) {
      if (avoid.includes(S) || isVertical(S)) continue;
      const c = Math.cos(S.t * DEG), s = Math.sin(S.t * DEG);
      const dist = Math.abs(corner[0] * c + corner[1] * s - S.r);
      if (dist > 0.012 * diag + 2) continue;
      const near = dir < 0 ? segRight(S) : segLeft(S), far = dir < 0 ? segLeft(S) : segRight(S);
      if (Math.hypot(near[0] - corner[0], near[1] - corner[1]) > 0.08 * diag) continue;
      if ((far[0] - corner[0]) * dir < 0.06 * w) continue;
      const sc = S.len * (0.2 + Math.min(S.contrast, 0.3));
      if (sc > ps) { ps = sc; pick = S; }
    }
    if (!pick) return null;
    const far = dir < 0 ? segLeft(pick) : segRight(pick);
    const p1 = [corner[0] + (far[0] - corner[0]) * 0.35, 0];
    const p2 = [corner[0] + (far[0] - corner[0]) * 0.9, 0];
    p1[1] = yAt(pick, p1[0]); p2[1] = yAt(pick, p2[0]);
    return { line: pick, pts: [p1, p2], strength: Math.min(1, pick.len / (0.25 * diag)) };
  }
  const used = [L, R, B, T].filter(Boolean);
  const leftRim = sideLine(BL, -1, used), rightRim = sideLine(BR, +1, used);
  const leftTop = topReal ? sideLine(TL, -1, used) : null, rightTop = topReal ? sideLine(TR, +1, used) : null;

  const toImg = (p) => [p[0] / field.sx, p[1] / field.sy];
  const marks = { wallTL: toImg(TL), wallTR: toImg(TR), wallBL: toImg(BL), wallBR: toImg(BR) };
  // a side line is only trusted when it is a real step and long enough
  const sideOk = (x) => x && x.line.contrast > 0.03 && x.strength > 0.3;
  if (sideOk(leftRim)) marks.leftRim = leftRim.pts.map(toImg);
  if (sideOk(rightRim)) marks.rightRim = rightRim.pts.map(toImg);
  if (marks.leftRim && sideOk(leftTop)) marks.leftTop = leftTop.pts.map(toImg);
  if (marks.rightRim && sideOk(rightTop)) marks.rightTop = rightTop.pts.map(toImg);

  // refine the four corners at full resolution where a clear corner exists
  for (const k of ["wallBL", "wallBR", "wallTL", "wallTR"]) {
    const s = snapCorner(img, marks[k], { radius: 0.01 * Math.max(img.width, img.height) });
    if (s.snapped) marks[k] = s.point;
  }

  const confidence = (best.odd ? 0.4 : 1) * Math.max(0, Math.min(1,
    0.35 * Math.min(1, best.white / 0.5) + 0.25 * Math.min(1, ((L.virtual ? 0.08 : L.contrast) + (R.virtual ? 0.08 : R.contrast)) / 0.16) + 0.2 * (topReal ? 1 : 0) + 0.2 * Math.min(1, (BR[0] - BL[0]) / (0.3 * w))));
  const dbg = debug ? { L, R, B, T, BL, BR, white: best.white, score: best.score, dir, junctions: junctions.map((j) => j.P.map(Math.round)), top: (cands || []).sort((a, b) => b.sc - a.sc).slice(0, 8) } : undefined;
  return {
    debug: dbg,
    marks,
    walls: { left: Boolean(marks.leftRim), right: Boolean(marks.rightRim) },
    topFound: topReal,
    confidence,
    notes: [
      topReal ? null : "No clear top line on the wall - the upper dots follow the corner edges; please check them.",
      marks.leftRim || marks.rightRim ? null : "No side-wall line found - the camera is solved from the four dots only.",
      best.odd ? "Something may be in front of a wall corner (a curtain, door or towel) - please check the dots." : null,
      confidence < 0.5 ? "Low confidence - please check every dot." : null,
    ].filter(Boolean),
  };
}
