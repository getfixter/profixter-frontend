// Camera recovery for one photo of a tub/shower alcove.
//
// World units are inches. The wall the photo faces lies in the plane z = 0,
// x runs left to right along that wall (0 at its left corner, W at its right
// edge), y is up from the finished floor, +z comes out of the wall toward the
// photographer. Camera follows the OpenCV convention: x right, y down, looking
// down +z, pixel = f * (x/z, y/z) + principal point.
//
// Inputs are a few taps a salesperson can make on the photo:
//   - the four corners of a rectangle on the facing wall whose width and the
//     two heights are known (left/right edges at the tub rim and at a higher
//     mark such as the top of the existing tile),
//   - optionally two points along the tub rim on a side wall, which pins down
//     depth and therefore the focal length.
// Pure math, no DOM, so it runs in the browser and in node tests.

export function rodrigues(r) {
  const th = Math.hypot(r[0], r[1], r[2]);
  if (th < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const [x, y, z] = [r[0] / th, r[1] / th, r[2] / th];
  const c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}

export function rotationToRodrigues(R) {
  const tr = R[0] + R[4] + R[8];
  const th = Math.acos(Math.min(1, Math.max(-1, (tr - 1) / 2)));
  if (th < 1e-9) return [0, 0, 0];
  if (Math.PI - th < 1e-6) {
    // 180°: axis from the largest diagonal term.
    const xx = Math.sqrt(Math.max(0, (R[0] + 1) / 2));
    const yy = Math.sqrt(Math.max(0, (R[4] + 1) / 2));
    const zz = Math.sqrt(Math.max(0, (R[8] + 1) / 2));
    return [xx * th, Math.sign(R[1] || 1) * yy * th, Math.sign(R[2] || 1) * zz * th];
  }
  const k = th / (2 * Math.sin(th));
  return [(R[7] - R[5]) * k, (R[2] - R[6]) * k, (R[3] - R[1]) * k];
}

export function project(cam, P) {
  const R = cam.R;
  const x = R[0] * P[0] + R[1] * P[1] + R[2] * P[2] + cam.t[0];
  const y = R[3] * P[0] + R[4] * P[1] + R[5] * P[2] + cam.t[1];
  const z = R[6] * P[0] + R[7] * P[1] + R[8] * P[2] + cam.t[2];
  return [cam.f * x / z + cam.cx, cam.f * y / z + cam.cy, z];
}

// --- small linear algebra -------------------------------------------------

function solveLinear(A, b) {
  // Gaussian elimination with partial pivoting; A is n×n (array of rows).
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      if (k) for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// Homography H (row-major 3×3) mapping plane points (X, Y) to image (u, v),
// from exactly four correspondences, with h33 fixed to 1.
export function homography4(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [X, Y] = src[i], [u, v] = dst[i];
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
  }
  const h = solveLinear(A, b);
  if (!h) return null;
  return [...h, 1];
}

export function applyHomography(H, X, Y) {
  const w = H[6] * X + H[7] * Y + H[8];
  return [(H[0] * X + H[1] * Y + H[2]) / w, (H[3] * X + H[4] * Y + H[5]) / w];
}

function nearestRotation(M) {
  // Polar decomposition by iteration: R <- (R + R^-T) / 2.
  let R = M.slice();
  for (let it = 0; it < 30; it++) {
    const [a, b, c, d, e, f, g, h, i] = R;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-12) break;
    // inverse-transpose = cofactor / det
    const IT = [
      (e * i - f * h) / det, -(d * i - f * g) / det, (d * h - e * g) / det,
      -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
      (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det,
    ];
    R = R.map((v, k) => (v + IT[k]) / 2);
  }
  return R;
}

// Pose from a facing-wall homography for a given focal length.
function poseFromHomography(H, f, cx, cy) {
  // K^-1 H, with world plane axes X -> r1, Y(up) -> r2, translation -> t.
  const Ki = (u, v, w) => [(u - cx * w) / f, (v - cy * w) / f, w];
  const h1 = Ki(H[0], H[3], H[6]);
  const h2 = Ki(H[1], H[4], H[7]);
  const h3 = Ki(H[2], H[5], H[8]);
  let lam = 1 / Math.hypot(...h1);
  if (h3[2] * lam < 0) lam = -lam; // the wall must be in front of the camera
  const r1 = h1.map((v) => v * lam);
  const r2 = h2.map((v) => v * lam);
  const r3 = [
    r1[1] * r2[2] - r1[2] * r2[1],
    r1[2] * r2[0] - r1[0] * r2[2],
    r1[0] * r2[1] - r1[1] * r2[0],
  ];
  const R = nearestRotation([r1[0], r2[0], r3[0], r1[1], r2[1], r3[1], r1[2], r2[2], r3[2]]);
  return { R, t: h3.map((v) => v * lam) };
}

// Distance from point p to the infinite line through a and b (2D).
function pointLineDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  return ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

/**
 * Solve the camera.
 * marks: {
 *   wallTL, wallTR, wallBL, wallBR: [u, v]   // facing-wall rectangle
 *   leftRim?: [[u,v],[u,v]]                    // two points on the rim line of the left side wall (plane x = 0)
 *   rightRim?: [[u,v],[u,v]]                   // ... of the right side wall (plane x = W)
 *   leftTop?, rightTop?: [[u,v],[u,v]]         // two points along the side wall at the upper-dot height
 * }
 * dims: { wallWidth, lowHeight, highHeight? }  // inches; highHeight may be unknown
 * image: { width, height }
 * Returns { f, cx, cy, R, t, highHeight, rmsPx, residuals, fovY }.
 */
export function solveCamera(marks, dims, image) {
  const cx = image.width / 2, cy = image.height / 2;
  const W = dims.wallWidth, yLo = dims.lowHeight;
  const knownHigh = Number.isFinite(dims.highHeight);
  const longSide = Math.max(image.width, image.height);
  const f0 = 0.85 * longSide; // prior: a typical phone or kit-lens field of view

  const quadImg = [marks.wallBL, marks.wallBR, marks.wallTR, marks.wallTL];

  const residuals = (p) => {
    const f = Math.exp(p[0]);
    const R = rodrigues([p[1], p[2], p[3]]);
    const cam = { f, cx, cy, R, t: [p[4], p[5], p[6]] };
    const yHi = knownHigh ? dims.highHeight : Math.exp(p[7]);
    const world = [[0, yLo, 0], [W, yLo, 0], [W, yHi, 0], [0, yHi, 0]];
    const r = [];
    for (let i = 0; i < 4; i++) {
      const q = project(cam, world[i]);
      if (q[2] <= 1) { r.push(1e4, 1e4); continue; }
      r.push(q[0] - quadImg[i][0], q[1] - quadImg[i][1]);
    }
    // Lines along a side wall at a known height: the rim (low) and the top of
    // the old tile (same height as the upper wall dots).
    for (const [key, x, y] of [["leftRim", 0, yLo], ["rightRim", W, yLo], ["leftTop", 0, yHi], ["rightTop", W, yHi]]) {
      const pts = marks[key];
      if (!pts || pts.length < 2) continue;
      const a = project(cam, [x, y, 0]);
      const b = project(cam, [x, y, 24]);
      for (const p2 of pts) r.push(pointLineDistance(p2, a, b));
    }
    // Weak prior on focal length: one sigma is about 35%, weighted like 4 px.
    r.push(((p[0] - Math.log(f0)) / 0.35) * 4);
    if (!knownHigh) r.push(0); // keeps the residual count stable
    return r;
  };

  let best = null;
  for (const scale of [0.55, 0.75, 0.95, 1.2, 1.6]) {
    const f = scale * longSide;
    const world2 = [[0, yLo], [W, yLo], [W, knownHigh ? dims.highHeight : yLo + 60], [0, knownHigh ? dims.highHeight : yLo + 60]];
    const H = homography4(world2, quadImg);
    if (!H) continue;
    const { R, t } = poseFromHomography(H, f, cx, cy);
    const p0 = [Math.log(f), ...rotationToRodrigues(R), ...t];
    if (!knownHigh) p0.push(Math.log(yLo + 60));
    const out = levenbergMarquardt(residuals, p0);
    if (!best || out.cost < best.cost) best = out;
  }
  if (!best) throw new Error("Could not solve the camera from these marks");

  const p = best.p;
  const f = Math.exp(p[0]);
  const cam = {
    f, cx, cy,
    R: rodrigues([p[1], p[2], p[3]]),
    t: [p[4], p[5], p[6]],
    highHeight: knownHigh ? dims.highHeight : Math.exp(p[7]),
  };
  const r = residuals(p);
  const nPix = r.length - (knownHigh ? 1 : 2);
  let ss = 0;
  for (let i = 0; i < nPix; i++) ss += r[i] * r[i];
  cam.rmsPx = Math.sqrt(ss / Math.max(1, nPix));
  cam.fovY = (2 * Math.atan(image.height / 2 / f) * 180) / Math.PI;
  cam.position = cameraCenter(cam);
  return cam;
}

export function cameraCenter(cam) {
  // C = -R^T t
  const R = cam.R, t = cam.t;
  return [
    -(R[0] * t[0] + R[3] * t[1] + R[6] * t[2]),
    -(R[1] * t[0] + R[4] * t[1] + R[7] * t[2]),
    -(R[2] * t[0] + R[5] * t[1] + R[8] * t[2]),
  ];
}

export function levenbergMarquardt(fn, p0, { iters = 200, eps = 1e-6 } = {}) {
  let p = p0.slice();
  let r = fn(p);
  let cost = r.reduce((s, v) => s + v * v, 0);
  let lambda = 1e-3;
  const n = p.length;
  for (let it = 0; it < iters; it++) {
    // Numerical Jacobian.
    const J = r.map(() => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const h = 1e-6 * Math.max(1, Math.abs(p[j]));
      const pp = p.slice(); pp[j] += h;
      const rp = fn(pp);
      for (let i = 0; i < r.length; i++) J[i][j] = (rp[i] - r[i]) / h;
    }
    const JTJ = Array.from({ length: n }, () => new Array(n).fill(0));
    const JTr = new Array(n).fill(0);
    for (let i = 0; i < r.length; i++) {
      for (let a = 0; a < n; a++) {
        JTr[a] += J[i][a] * r[i];
        for (let b = a; b < n; b++) JTJ[a][b] += J[i][a] * J[i][b];
      }
    }
    for (let a = 0; a < n; a++) for (let b = 0; b < a; b++) JTJ[a][b] = JTJ[b][a];
    let improved = false;
    for (let tries = 0; tries < 10; tries++) {
      const A = JTJ.map((row, a) => row.map((v, b) => (a === b ? v * (1 + lambda) + 1e-12 : v)));
      const d = solveLinear(A, JTr.map((v) => -v));
      if (!d) { lambda *= 10; continue; }
      const pn = p.map((v, k) => v + d[k]);
      const rn = fn(pn);
      const cn = rn.reduce((s, v) => s + v * v, 0);
      if (cn < cost) {
        const rel = (cost - cn) / Math.max(cost, 1e-12);
        p = pn; r = rn; cost = cn; lambda = Math.max(lambda / 10, 1e-9); improved = true;
        if (rel < eps) return { p, cost, iterations: it + 1 };
        break;
      }
      lambda *= 10;
    }
    if (!improved) break;
  }
  return { p, cost };
}
