import { solveCamera, project } from "./geometry.js";
import {
  toLinearDownscaled, projectPolygon, rasterizePolygon, wallIllumination, referenceColour,
} from "./illum.js";
import { StudioRenderer, illumTexture, SURF, openSideOf } from "./render.js";
import { inpaintPatch, fillMasked } from "./composite.js";

const LIGHT_SCALE = 0.35; // illumination is smooth; estimate it on a smaller image

function medianColour(img, mask) {
  const ch = [[], [], []];
  for (let i = 0; i < img.width * img.height; i++) {
    if (!mask[i]) continue;
    for (let c = 0; c < 3; c++) ch[c].push(img.data[i * 3 + c]);
  }
  return ch.map((v) => { if (!v.length) return NaN; v.sort((a, b) => a - b); return v[v.length >> 1]; });
}

// Image point -> point on the facing wall plane (z = 0), in wall inches.
export function imageToFacingWall(cam, u, v) {
  const R = cam.R, C = cam.position;
  const d = [(u - cam.cx) / cam.f, (v - cam.cy) / cam.f, 1];
  // world direction = R^T d
  const w = [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]];
  const s = -C[2] / w[2];
  return [C[0] + s * w[0], C[1] + s * w[1]];
}

/**
 * Image point -> the wall it lies on: the facing wall, or a side wall when the
 * point is beyond the facing wall's edge. Returns { wall, u, y } in wall inches
 * (side walls: u = distance from the facing wall).
 */
export function imageToWall(cam, px, py, layout) {
  const R = cam.R, C = cam.position;
  const d = [(px - cam.cx) / cam.f, (py - cam.cy) / cam.f, 1];
  const w = [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]];
  const W = layout.facingWidth, L = layout.sideLength;
  const hits = [];
  if (Math.abs(w[2]) > 1e-9) { const s = -C[2] / w[2]; const x = C[0] + s * w[0]; if (s > 0 && x >= 0 && x <= W) hits.push({ s, wall: "facing", u: x, y: C[1] + s * w[1] }); }
  for (const [wall, X, ok] of [["left", 0, layout.leftWall], ["right", W, layout.rightWall]]) {
    if (!ok || Math.abs(w[0]) < 1e-9) continue;
    const s = (X - C[0]) / w[0]; const z = C[2] + s * w[2];
    if (s > 0 && z >= 0 && z <= L) hits.push({ s, wall, u: z, y: C[1] + s * w[1] });
  }
  if (!hits.length) { const [u, y] = imageToFacingWall(cam, px, py); return { wall: "facing", u, y }; }
  hits.sort((a, b) => a.s - b.s);
  const h = hits[0];
  return { wall: h.wall, u: h.u, y: h.y };
}

export class Pipeline {
  constructor(glCanvas) {
    this.renderer = new StudioRenderer(glCanvas);
    this.timings = {};
  }

  setPhoto(imageData) {
    this.photo = imageData;
    this.renderer.setSize(imageData.width, imageData.height);
    this.linear = toLinearDownscaled(imageData.data, imageData.width, imageData.height, LIGHT_SCALE);
    this.fillCache = null;
  }

  // Everything that depends on the marks and measurements (not on product choice).
  prepare({ marks, measure, camera = null, modelLight = null }) {
    const t0 = performance.now();
    const img = { width: this.photo.width, height: this.photo.height };
    if (camera) {
      // a modelled room: the camera is known exactly and the light comes from its white render
      this.cam = camera;
      this.renderer.setCamera(camera);
      this.light = modelLight;
      this.timings.solveMs = 0; this.timings.lightMs = 0;
      return camera;
    }
    const cam = solveCamera(marks, {
      wallWidth: measure.facingWidth, lowHeight: measure.rimHeight,
      highHeight: Number.isFinite(measure.markHeight) ? measure.markHeight : undefined,
    }, img);
    this.cam = cam;
    this.renderer.setCamera(cam);
    const t1 = performance.now();
    this.light = this.estimateLight(cam, measure);
    this.timings.solveMs = t1 - t0;
    this.timings.lightMs = performance.now() - t1;
    return cam;
  }

  estimateLight(cam, m) {
    const L = this.linear, w = L.width, h = L.height, s = LIGHT_SCALE;
    const W = m.facingWidth, D = m.sideLength, rim = m.rimHeight, oldTop = cam.highHeight;
    const panTop = m.panHeight, newTop = Math.max(m.panHeight + m.wallHeight, cam.highHeight);
    const mask = (pts) => rasterizePolygon(projectPolygon(cam, pts, s), w, h);

    // White references on the existing tub: its inner end wall (vertical, next to
    // the facing wall) for walls, and its floor for horizontal surfaces.
    const whiteWall = referenceColour(L, mask([[4, rim - 7, 2.5], [W - 4, rim - 7, 2.5], [W - 4, rim - 2, 2.5], [4, rim - 2, 2.5]]));
    const whiteFloor = referenceColour(L, mask([[6, 2, 10], [W - 6, 2, 10], [W - 6, 2, D - 14], [6, 2, D - 14]])) || whiteWall;
    // Old wall colour just above the rim, where it shares light with the tub's end wall.
    const tile = medianColour(L, mask([[2, rim + 1, 0], [W - 2, rim + 1, 0], [W - 2, rim + 10, 0], [2, rim + 10, 0]]));
    const ratio = tile.map((v, c) => Math.min(1.3, Math.max(0.15, v / Math.max(1e-4, whiteWall[c]))));

    const walls = {
      facing: { old: [[0, rim + 0.5, 0], [W, rim + 0.5, 0], [W, oldTop, 0], [0, oldTop, 0]], neu: [[0, panTop, 0], [W, panTop, 0], [W, newTop, 0], [0, newTop, 0]] },
      left: { old: [[0, rim + 0.5, D], [0, rim + 0.5, 0], [0, oldTop, 0], [0, oldTop, D]], neu: [[0, panTop, D], [0, panTop, 0], [0, newTop, 0], [0, newTop, D]] },
      right: { old: [[W, rim + 0.5, 0], [W, rim + 0.5, D], [W, oldTop, D], [W, oldTop, 0]], neu: [[W, panTop, 0], [W, panTop, D], [W, newTop, D], [W, newTop, 0]] },
    };
    // Paint colour of the wall just above the old tile, relative to the white reference.
    const paint = medianColour(L, mask([[2, oldTop + 2, 0], [W - 2, oldTop + 2, 0], [W - 2, oldTop + 9, 0], [2, oldTop + 9, 0]]));
    const paintRatio = paint.map((v, c) => Math.min(1.3, Math.max(0.1, v / Math.max(1e-4, whiteWall[c]))));
    const out = { whiteWall, whiteFloor, tile, ratio, paint, paintRatio, maps: {} };
    for (const key of ["facing", "left", "right"]) {
      if (key === "left" && !m.leftWall) continue;
      if (key === "right" && !m.rightWall) continue;
      const valid = mask(walls[key].old), target = mask(walls[key].neu);
      // Keep the old-wall samples off fixtures the rep marked (valve, spout, head) and off the protect brush.
      if (this.excludeLowRes) for (let i = 0; i < valid.length; i++) if (this.excludeLowRes[i]) valid[i] = 0;
      const map = wallIllumination(L, valid, target, ratio);
      out.maps[key] = { map, tex: illumTexture(map) };
    }
    return out;
  }

  build(sel, measure) {
    const t0 = performance.now();
    const cam = this.cam;
    const layoutM = { facingWidth: measure.facingWidth, sideLength: measure.sideLength, leftWall: measure.leftWall, rightWall: measure.rightWall };
    // plumbing: from the design (a wall and heights) or from the two dots on the photo
    let pw;
    if (sel.plumbing) pw = sel.plumbing;
    else {
      const v = imageToWall(cam, sel.valvePx[0], sel.valvePx[1], layoutM);
      const h = imageToWall(cam, sel.headPx[0], sel.headPx[1], layoutM);
      pw = { wall: v.wall, valve: [v.u, v.y], head: h.wall === v.wall ? [h.u, h.y] : [v.u, Math.max(h.y, v.y + 30)] };
    }
    const valve = pw.valve, head = pw.head;
    this.valveWall = { wall: pw.wall, u: valve[0], y: valve[1] };
    this.headWall = { wall: pw.wall, u: head[0], y: head[1] };
    const light = {
      facing: this.light.maps.facing?.tex || null,
      left: this.light.maps.left?.tex || null,
      right: this.light.maps.right?.tex || null,
      floor: this.light.whiteFloor,
      apron: this.light.whiteWall.map((v) => v * 0.9),
      exposure: measure.exposure ?? 1,
    };
    const base = sel.base || sel.pan;
    const layout = { facingWidth: measure.facingWidth, sideLength: measure.sideLength, leftWall: measure.leftWall, rightWall: measure.rightWall };
    layout.openSide = openSideOf(layout);
    const enc = sel.enclosure;
    // a curtain is pushed to the end of the opening away from the plumbing
    const gatherEnd = (lay, wall) => (lay.openSide === "front" ? (wall === "left" ? "start" : "end") : lay.openSide === "left" ? "start" : "end");
    this.renderer.build({
      layout,
      pan: { ...base.geometry, kind: base.kind || "pan", height: measure.panHeight, color: base.color, drain: sel.drain },
      wall: { height: measure.wallHeight, finish: sel.finish },
      above: measure.aboveMode === "paint" && cam.highHeight > measure.panHeight + measure.wallHeight + 0.5
        ? { top: cam.highHeight, albedoRatio: this.light.paintRatio } : null,
      fixture: { ...sel.fixture.geometry, finishColor: sel.fixture.finishColor, wall: pw.wall, valve, head },
      enclosure: !enc ? null : enc.kind === "door"
        ? { kind: "door", glassHeight: enc.glassHeight, glassThickness: enc.glassThickness, frame: enc.frame, frameColor: enc.frameColor, overlap: enc.overlap }
        : { kind: "rod", height: enc.mountHeight, diameter: enc.diameter, bow: enc.bow || 0, finishColor: enc.finishColor, curtain: sel.curtain ? { color: enc.curtainColor || "#f2f2ef" } : null, gatherAt: gatherEnd(layout, pw.wall) },
      accessories: (sel.accessories || []).map(({ product: p, place }) => ({ ...p.render, type: p.type, ...place })),
      light,
    });
    this.timings.buildMs = performance.now() - t0;
    this.sel = sel;
    this.layout = layout;
    this.buildVersion = (this.buildVersion || 0) + 1;
  }

  /**
   * The old tub (and old showerhead) as seen in the photo, minus what the new
   * work covers: these pixels are filled from the surroundings, because after
   * the renovation they show the room, not the old tub.
   */
  leftoverMask(measure, coverage, keepMask) {
    const W = this.photo.width, H = this.photo.height, cam = this.cam;
    const Wd = measure.facingWidth, L = measure.sideLength, rim = measure.rimHeight;
    const open = openSideOf({ ...measure });
    const old = new Uint8Array(W * H);
    const face = (pts) => rasterizePolygon(projectPolygon(cam, pts, 1), W, H, old);
    face([[0, rim, 0], [Wd, rim, 0], [Wd, rim, L], [0, rim, L]]); // deck
    if (open === "right") face([[Wd, 0, 0], [Wd, 0, L], [Wd, rim, L], [Wd, rim, 0]]);
    if (open === "left") face([[0, 0, 0], [0, 0, L], [0, rim, L], [0, rim, 0]]);
    face([[0, 0, L], [Wd, 0, L], [Wd, rim, L], [0, rim, L]]); // the end toward the camera (or the front apron)
    if (this.headWall && this.headWall.wall === "facing") {
      const p = project(cam, [this.headWall.u, this.headWall.y, 4]);
      if (p[2] > 1) {
        const r = (cam.f * 5) / p[2];
        for (let y = Math.max(0, Math.floor(p[1] - r)); y < Math.min(H, p[1] + r); y++)
          for (let x = Math.max(0, Math.floor(p[0] - r)); x < Math.min(W, p[0] + r); x++)
            if ((x - p[0]) ** 2 + (y - p[1]) ** 2 <= r * r) old[y * W + x] = 1;
      }
    }
    // grow by a few pixels to catch the old tub's edge, then drop what the new work covers
    const grown = new Uint8Array(W * H), g = 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!old[y * W + x]) continue;
      for (let dy = -g; dy <= g; dy++) for (let dx = -g; dx <= g; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) grown[yy * W + xx] = 1;
      }
    }
    let n = 0;
    for (let i = 0; i < W * H; i++) {
      if (grown[i] && !coverage[i] && !(keepMask && keepMask[i])) { grown[i] = 1; n++; } else grown[i] = 0;
    }
    return { mask: grown, pixels: n };
  }

  setFinish(finish) {
    this.renderer.setFinish(finish);
    this.sel = { ...this.sel, finish };
  }

  /**
   * Render and composite. removeMask/keepMask are full-resolution Uint8Arrays (or null).
   * Returns { canvas, ids, coverage } where outside the new work every pixel is the
   * original photo's.
   */
  compose(outCanvas, { removeMask = null, keepMask = null, autoRemove = true, measure = null, maskVersion = 0, quality = "full", reuseLeftover = false } = {}) {
    const t0 = performance.now();
    const W = this.photo.width, H = this.photo.height;
    // coverage and the old-tub leftovers depend only on geometry: once per build
    if (!this.coverCache || this.coverCache.version !== this.buildVersion || this.coverCache.keep !== keepMask || this.coverCache.maskVersion !== maskVersion) {
      const ids = this.renderer.renderIds();
      const coverage = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) coverage[i] = ids[i] > 0 ? 1 : 0;
      const prev = this.coverCache;
      this.coverCache = {
        version: this.buildVersion, keep: keepMask, maskVersion, ids, coverage,
        // while an accessory is dragged the old tub has not moved: keep its mask
        leftover: reuseLeftover && prev?.leftover ? prev.leftover : measure ? this.leftoverMask(measure, coverage, keepMask) : { mask: null, pixels: 0 },
      };
    }
    const gl = this.renderer.render();
    const t1 = performance.now();
    outCanvas.width = W; outCanvas.height = H;
    const g = outCanvas.getContext("2d", { willReadFrequently: true });
    g.putImageData(this.photo, 0, 0);
    const auto = autoRemove && this.coverCache.leftover.pixels ? this.coverCache.leftover.mask : null;
    let hole = removeMask;
    if (auto) {
      hole = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) hole[i] = (removeMask && removeMask[i]) || auto[i] ? 1 : 0;
    }
    this.lastHole = hole;
    this.fillQuality = hole ? this.fillQuality : "none";
    if (hole) {
      // "fast": smooth fill while dots are moving; "full": texture-continuing patch fill
      const key = reuseLeftover && this.fillCache ? this.fillCache.key : this.buildVersion + ":" + maskVersion + ":" + autoRemove;
      const have = this.fillCache && this.fillCache.key === key ? this.fillCache.quality : null;
      if (!have || (quality === "full" && have === "fast")) {
        const tf = performance.now();
        const image = quality === "full" ? inpaintPatch(this.photo, hole, { ignore: this.coverCache.coverage }) : fillMasked(this.photo, hole);
        this.fillCache = { key, quality, image };
        this.timings.fillMs = performance.now() - tf;
      }
      this.fillQuality = this.fillCache.quality;
      g.putImageData(this.fillCache.image, 0, 0);
    }
    g.drawImage(gl, 0, 0);
    if (keepMask) {
      const cur = g.getImageData(0, 0, W, H);
      const src = this.photo.data, d = cur.data;
      for (let i = 0; i < W * H; i++) {
        if (!keepMask[i]) continue;
        d[i * 4] = src[i * 4]; d[i * 4 + 1] = src[i * 4 + 1]; d[i * 4 + 2] = src[i * 4 + 2];
      }
      g.putImageData(cur, 0, 0);
    }
    this.timings.renderMs = t1 - t0;
    this.timings.composeMs = performance.now() - t1;
    return outCanvas;
  }

  ids() {
    return this.coverCache && this.coverCache.version === this.buildVersion ? this.coverCache.ids : this.renderer.renderIds();
  }

  // Corners of the new work, for drawing outlines on the photo.
  outline(measure) {
    const W = measure.facingWidth, D = measure.sideLength, top = measure.panHeight + measure.wallHeight;
    return {
      facing: [[0, 0, 0], [W, 0, 0], [W, top, 0], [0, top, 0]].map((p) => project(this.cam, p)),
      pan: [[0, measure.panHeight, 0], [W, measure.panHeight, 0], [W, measure.panHeight, D], [0, measure.panHeight, D]].map((p) => project(this.cam, p)),
    };
  }
}

export { SURF };
