// The Shower Studio engine controller: one object that owns the canvases, the
// dot overlay, masks and the rendering pipeline, and keeps a design valid
// against the catalog. Framework-free: the public Studio and the employee
// Sales Studio both drive it and render their own panels from onChange().
//
// Ported from the Milestone 1b prototype (main.js) without changing the
// geometry, rendering or compositing.
import { Pipeline, imageToWall } from "./pipeline.js";
import { project } from "./geometry.js";
import { suggestMarks, snapCorner, snapEdge } from "./detect.js";
import { regionFromTap } from "./composite.js";
import { check, options, autoFix, checkMeasurements, alcoveFootprint, wallExists, wallLength } from "./compat.js";
import { encodeMask, decodeMask } from "./design.js";
import { renderRoom, lightAt } from "./room.js";
import { illumTexture } from "./render.js";

const COL = { wall: "#2f7bff", rim: "#13a39a", top: "#8a4dff", fix: "#ff8a1f" };
const byId = (list, id) => (list || []).find((x) => x.id === id) || null;

export const DEFAULT_DESIGN = () => ({
  measure: { facingWidth: 30, sideLength: 60, rimHeight: 15, markHeight: NaN, leftWall: true, rightWall: false, aboveMode: "paint", exposure: 1 },
  baseId: "", drainId: "", finishId: "", fixtureId: "", enclosureId: "none", curtain: false, accessories: [],
  plumbing: null, // { wall: "facing" | "left" | "right", u? } - null: the valve/head dots on the photo decide
});

/**
 * Plain-English versions of the compatibility problems, for homeowners (staff
 * keep the detailed wording, with model numbers and sizes).
 */
export function customerMessage(e, design, catalog) {
  const base = (catalog?.bases || []).find((b) => b.id === design?.baseId);
  const tub = base?.kind === "tub";
  switch (e?.code) {
    case "base_size": return `This ${tub ? "bathtub" : "shower base"} doesn't fit your space. Choose another size, or check your measurements.`;
    case "drain": return "This base doesn't come with a drain on that side. Choose another base.";
    case "kit_kind": case "kit_base": case "kit_size": return `These walls aren't made for this ${tub ? "bathtub" : "shower base"}. Choose another wall style.`;
    case "fixture_kind": return tub ? "A bathtub needs a faucet with a tub spout. Choose a tub & shower faucet." : "A walk-in shower needs a shower-only faucet. Choose another faucet.";
    case "enclosure_fit": case "threshold": return "This shower door doesn't fit the selected base. Choose another door.";
    case "missing_product": return "Choose your products to see the new look.";
    case "range": case "missing": case "order": return "One of the measurements looks off. Please check it.";
    case "walls": return "We need at least one side wall. Check your photo or measurements.";
    default: return "This combination doesn't work. Try another option.";
  }
}

export class StudioEngine {
  /**
   * els: { gl, before, after, svg, loupe (a canvas inside a fixed-position element) }
   * catalog: engine-shaped catalog from the API
   * onChange(snapshot): called after every meaningful change
   */
  constructor({ els, catalog, onChange = () => {}, interactive = true }) {
    this.els = els;
    this.catalog = catalog;
    this.onChange = onChange;
    this.pipeline = new Pipeline(els.gl);
    this.photoCanvas = document.createElement("canvas");
    this.S = {
      ready: false, marks: null, points: null, pointsDefault: true,
      removeMask: null, keepMask: null, maskHistory: [], maskVersion: 0,
      tool: "marks", tapQueue: null, snap: true, autoRemove: true,
      design: DEFAULT_DESIGN(), check: null, suggestion: null,
      messages: { mark: [], measure: [], design: [] }, busy: null, last: null,
    };
    this.accSeq = 1;
    this.timers = new Set();
    this.disposed = false;
    if (interactive) this.attachPointer();
    this.loadTextures();
  }

  // ------------------------------------------------------------------ catalog
  setCatalog(catalog) {
    this.catalog = catalog;
    this.loadTextures();
    this.fix();
    this.emit();
  }

  /** Uploaded wall textures: fetched once, then used instead of the drawn pattern. */
  loadTextures() {
    for (const f of this.catalog?.finishes || []) {
      if (!f.texture?.url || f.texture.image || f.texture.loading) continue;
      f.texture.loading = true;
      fetch(f.texture.url).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((img) => {
        f.texture.image = img;
        if (!this.disposed && this.S.ready && this.S.design.finishId === f.id) this.full();
      }).catch(() => { f.texture.failed = true; });
    }
  }

  cur() {
    const c = this.catalog, d = this.S.design;
    return {
      base: byId(c.bases, d.baseId), finish: byId(c.finishes, d.finishId), fixture: byId(c.fixtures, d.fixtureId),
      enclosure: d.enclosureId === "none" ? null : byId(c.enclosures, d.enclosureId),
    };
  }

  floorTop() {
    const b = this.cur().base;
    return b ? b.dims.height - (b.geometry?.floorDrop ?? 1.6) : 0;
  }

  // ------------------------------------------------------------------ snapshot for the UI
  emit() {
    if (this.disposed) return;
    const S = this.S;
    this.onChange({
      ready: S.ready, design: S.design, check: S.check, suggestion: S.suggestion,
      tool: S.tool, tapQueue: S.tapQueue ? [...S.tapQueue] : null, snap: S.snap, autoRemove: S.autoRemove,
      messages: S.messages, busy: S.busy, last: S.last,
      options: this.catalog ? options(S.design, this.catalog) : null,
      current: this.cur(),
      canUndoMask: S.maskHistory.length > 0,
      hasMasks: Boolean(S.removeMask?.some((v) => v) || S.keepMask?.some((v) => v)),
      canUndoMarks: Boolean(S.markHistory?.length), activeMark: S.activeMark || null, photoCheck: S.ready && !S.model ? this.photoCheck() : null,
      canUndoMove: Boolean(S.moveHistory?.length), blocked: S.lastBlocked || null, model: Boolean(S.model), dragging: S.dragging || null,
    });
  }

  // ------------------------------------------------------------------ photo
  /** Load the (already server-sanitized) photo. Uses a blob URL so the canvas is never tainted. */
  async loadPhoto(url, { state = null } = {}) {
    this.S.model = null;
    if (!state) { this.replaceAccessories(); this.S.design.plumbing = null; this.S.design.measure.aboveMode = "paint"; this.S.design.measure.markHeight = NaN; this.S.markHistory = []; this.S.suggestedMarks = null; this.S.pointsDefault = true; }
    const blob = await (await fetch(url, { credentials: "omit" })).blob();
    const obj = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = obj;
      await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight;
      for (const c of [this.els.before, this.photoCanvas]) { c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0); }
      const data = this.photoCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h);
      this.pipeline.setPhoto(data);
      this.pipeline.coverCache = null; this.pipeline.fillCache = null;
      this.els.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      this.S.removeMask = new Uint8Array(w * h);
      this.S.keepMask = new Uint8Array(w * h);
      this.S.maskHistory = []; this.S.maskVersion++;
      this.S.ready = true;
    } finally {
      URL.revokeObjectURL(obj);
    }
    if (state) this.applyState(state);
    else { this.S.pointsDefault = true; this.autoFind({ fallback: true }); }
  }

  /**
   * Start from an example bathroom (no photo, no measuring): its alcove is
   * already marked, its loose items are removed, and the base is chosen by
   * `kind` ("pan" for a walk-in shower, "tub" for a bathtub) unless `design`
   * (a saved one) is given.
   */
  async loadExample(scene, { kind = "pan", design = null } = {}) {
    if (scene.model) return this.loadModel(scene, { kind, design });
    const w = scene.width, h = scene.height;
    const remove = new Uint8Array(w * h);
    for (const [cx, cy, r] of scene.removeCircles || [])
      for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, cy + r); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r); x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) remove[y * w + x] = 1;
    let d = design ? structuredClone(design) : { ...DEFAULT_DESIGN(), measure: { ...DEFAULT_DESIGN().measure, ...scene.measure } };
    if (!design && this.catalog) {
      const b = options(d, this.catalog).bases.find((x) => x.kind === kind);
      if (b) d.baseId = b.id;
    }
    const state = { marks: scene.marks, points: scene.points, design: d, masks: { remove: encodeMask(remove), keep: null }, autoRemove: true };
    await this.loadPhoto(scene.src, { state });
  }

  /**
   * The modelled example bathroom: the room is drawn for the design's alcove
   * size (a customer's own measurements redraw it), the camera is known, and
   * nothing has to be marked or removed.
   */
  async loadModel(scene, { kind = "pan", design = null } = {}) {
    const d = design ? structuredClone(design) : { ...DEFAULT_DESIGN(), measure: { ...DEFAULT_DESIGN().measure, ...scene.measure }, plumbing: { wall: scene.plumbing || "left" } };
    if (!d.plumbing) d.plumbing = { wall: scene.plumbing || "left" };
    if (!design && this.catalog) {
      const b = options(d, this.catalog).bases.find((x) => x.kind === kind);
      if (b) d.baseId = b.id;
    }
    this.scene = scene;
    this.drawRoom(d.measure);
    this.S.design = d;
    this.accSeq = 1 + (d.accessories?.length || 0);
    this.fix();
    this.full();
    // accessories placed in another room (a photo) may not fit this one
    if ((this.S.check?.errors || []).some((e) => String(e.field).startsWith("accessory:"))) { this.replaceAccessories(); this.full(); }
  }

  /** (Re)draw the example room for an alcove size and use it as the "photo". */
  drawRoom(measure) {
    const t0 = performance.now();
    const room = renderRoom(measure);
    const w = room.beauty.width, h = room.beauty.height;
    for (const c of [this.els.before, this.photoCanvas]) { c.width = w; c.height = h; c.getContext("2d").putImageData(room.beauty, 0, 0); }
    this.pipeline.setPhoto(room.beauty);
    this.pipeline.coverCache = null; this.pipeline.fillCache = null;
    this.els.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    this.S.removeMask = new Uint8Array(w * h);
    this.S.keepMask = new Uint8Array(w * h);
    this.S.maskHistory = []; this.S.maskVersion++;
    this.S.autoRemove = false;
    const scale = (v) => v.map((c) => c * 0.82);
    const tex = illumTexture({ data: room.light.map((v) => v * 0.82), width: room.lw, height: room.lh });
    const W = measure.facingWidth, D = measure.sideLength;
    const whiteFloor = scale(lightAt(room, [W / 2, 6, D * 0.55]));
    const whiteWall = scale(lightAt(room, [W / 2, 8, D - 0.5]));
    this.S.model = { cam: room.cam, measureKey: JSON.stringify([W, D, measure.rimHeight, measure.leftWall, measure.rightWall]), light: { whiteFloor, whiteWall, maps: { facing: { tex }, left: { tex }, right: { tex } }, paintRatio: [1, 1, 1] } };
    this.S.marks = room.marks;
    this.S.points = this.S.points || { valve: [w / 2, h / 2], head: [w / 2, h / 3] };
    this.S.pointsDefault = false;
    this.S.ready = true;
    this.S.lastRoomMs = performance.now() - t0;
  }

  /** Plumbing wall for the modelled room (and photos where the person picked a wall). */
  setPlumbing(wall) {
    if (!["facing", "left", "right"].includes(wall)) return [];
    return this.applyChange((d) => { d.plumbing = { wall }; });
  }

  /** Valve and showerhead positions on the plumbing wall, in wall inches - or null when the photo's dots decide. */
  plumbingWorld() {
    const d = this.S.design, p = d.plumbing;
    if (!p || !p.wall) return null;
    const m = d.measure, { base, fixture, finish } = this.cur();
    if (!base || !fixture) return null;
    const wall = wallExists(p.wall, m) ? p.wall : "facing";
    const wl = wallLength(wall, m);
    const u = Number.isFinite(p.u) ? Math.min(wl - 4, Math.max(4, p.u)) : wl / 2;
    const H = base.dims.height;
    const kit = (finish?.kits || []).find((k) => k.for === base.kind);
    const wallTop = H + (kit?.height ?? 60);
    let valveY;
    if (base.kind === "tub") {
      const spout = fixture.geometry?.spout;
      const [lo, hi] = fixture.spoutBelowValve || [8, 12];
      valveY = H + (spout?.aboveRim ?? 4.5) + (lo + hi) / 2;
    } else valveY = this.floorTop() + 46;
    const headY = Math.min(80, wallTop - 3);
    return { wall, valve: [u, valveY], head: [u, headY] };
  }

  /** World point on a wall (wall inches -> world inches). */
  wallPoint(wall, u, y, out = 0) {
    const W = this.S.design.measure.facingWidth;
    if (wall === "left") return [out, y, u];
    if (wall === "right") return [W - out, y, u];
    return [u, y, out];
  }

  /** Switch between a walk-in shower and a bathtub (keeps the other choices where they still fit). */
  setKind(kind) {
    const b = options(this.S.design, this.catalog).bases.find((x) => x.kind === kind);
    if (!b) return null;
    return this.applyChange((d) => { if ((this.cur().base?.kind || "") !== kind) d.baseId = b.id; });
  }

  get photo() { return this.pipeline.photo; }

  /** A saved state (from the server) onto the loaded photo. */
  applyState(state) {
    const w = this.pipeline.photo.width, h = this.pipeline.photo.height;
    this.S.marks = structuredClone(state.marks);
    this.S.points = structuredClone(state.points);
    this.S.pointsDefault = false;
    this.S.removeMask = decodeMask(state.masks?.remove || null, w * h);
    this.S.keepMask = decodeMask(state.masks?.keep || null, w * h);
    this.S.maskVersion++;
    this.S.autoRemove = state.autoRemove !== false;
    const d = state.design || DEFAULT_DESIGN();
    if (!Number.isFinite(d.measure?.markHeight)) d.measure.markHeight = NaN;
    this.S.design = d;
    this.accSeq = 1 + (d.accessories?.length || 0);
    const changes = this.fix();
    this.full();
    return changes;
  }

  /** What is saved: dots, design, run-length-encoded masks. */
  getState() {
    const S = this.S;
    if (!S.marks || !S.points) return null;
    const design = structuredClone(S.design);
    if (!Number.isFinite(design.measure.markHeight)) design.measure.markHeight = null;
    return { marks: structuredClone(S.marks), points: structuredClone(S.points), design, masks: { remove: encodeMask(S.removeMask), keep: encodeMask(S.keepMask) }, autoRemove: S.autoRemove };
  }

  // ------------------------------------------------------------------ marks
  autoFind({ fallback = false } = {}) {
    if (!this.S.ready) return null;
    const t0 = performance.now();
    const s = suggestMarks(this.pipeline.photo);
    const ms = performance.now() - t0;
    this.S.suggestion = s ? { confidence: s.confidence, notes: s.notes, ms } : null;
    const w = this.els.before.width, h = this.els.before.height;
    if (!s) {
      if (fallback && !this.S.marks) this.S.marks = { wallTL: [w * 0.33, h * 0.15], wallTR: [w * 0.67, h * 0.14], wallBL: [w * 0.33, h * 0.68], wallBR: [w * 0.63, h * 0.72] };
      this.S.messages.mark = [{ kind: "warn", text: "We couldn't find the tub area automatically. Tap the 4 corners instead, or drag the dots." }];
    } else {
      this.S.marks = s.marks;
      this.S.suggestedMarks = structuredClone(s.marks);
      this.S.walls = s.walls;
      this.chooseOrientation(s.walls);
      const level = s.confidence >= 0.75 ? "ok" : s.confidence >= 0.5 ? "warn" : "err";
      this.S.messages.mark = [
        { kind: level, text: s.confidence >= 0.75 ? "Found it. Check that each dot sits on its corner." : "Found a likely match. Please check every dot." },
        ...s.notes.map((n) => ({ kind: "info", text: n })),
      ];
    }
    this.full();
    if (this.S.pointsDefault) { this.placeDefaultPoints(); this.full(); }
    return this.S.suggestion;
  }

  /**
   * A photo can face the long back wall (both short end walls visible) or the
   * end wall with the plumbing (the long wall on one side, open on the other).
   * Solve the camera for each reading of the same alcove size and keep the one
   * that is physically believable and fits the outline best.
   */
  chooseOrientation(walls = {}) {
    const m = this.S.design.measure;
    const fp = alcoveFootprint(m);
    const L = Math.max(fp.length, fp.width), Wd = Math.min(fp.length, fp.width);
    const cands = [];
    if (walls.left && walls.right) cands.push({ facingWidth: L, sideLength: Wd, leftWall: true, rightWall: true });
    const longOnLeft = walls.left || !walls.right;
    cands.push({ facingWidth: Wd, sideLength: L, leftWall: longOnLeft, rightWall: !longOnLeft });
    if (!(walls.left && walls.right)) cands.push({ facingWidth: L, sideLength: Wd, leftWall: true, rightWall: true });
    let best = null;
    for (const c of cands) {
      const test = { ...m, ...c };
      let score = Infinity;
      try {
        const kit = this.measureFull();
        const cam = this.pipeline.prepare({ marks: this.S.marks, measure: { ...test, panHeight: kit.panHeight, wallHeight: kit.wallHeight } });
        const C = cam.position;
        score = cam.rmsPx;
        if (!(cam.fovY > 22 && cam.fovY < 105)) score += 1000;
        if (!(C[1] > 12 && C[1] < 100)) score += 1000;
        if (!(C[2] > test.sideLength * 0.25)) score += 1000;
      } catch { /* this reading does not solve */ }
      if (!best || score < best.score) best = { c, score };
    }
    const changed = best && (m.facingWidth !== best.c.facingWidth || m.leftWall !== best.c.leftWall || m.rightWall !== best.c.rightWall);
    if (best) Object.assign(m, best.c);
    this.S.orientation = best ? { ...best.c, score: best.score } : null;
    if (changed) this.replaceAccessories();
  }

  placeDefaultPoints() {
    const cam = this.pipeline.cam, m = this.S.design.measure;
    const w = this.els.before.width, h = this.els.before.height;
    if (!cam) { this.S.points = { valve: [w * 0.48, h * 0.6], head: [w * 0.48, h * 0.2] }; return; }
    const v = project(cam, [m.facingWidth / 2, this.cur().base?.kind === "tub" ? 30 : 46, 0]);
    const hd = project(cam, [m.facingWidth / 2, 80, 0]);
    this.S.points = { valve: [v[0], v[1]], head: [hd[0], hd[1]] };
  }

  startTap4() {
    if (!this.S.ready) return;
    this.S.tapQueue = ["wallBL", "wallBR", "wallTR", "wallTL"];
    this.setTool("marks");
    this.tapHint();
    this.drawMarks();
    this.emit();
  }
  tapHint() {
    const HINT = {
      wallBL: "Tap 1 of 4: the lower LEFT corner of the back wall, where it meets the tub.",
      wallBR: "Tap 2 of 4: the lower RIGHT corner, where the wall meets the tub.",
      wallTR: "Tap 3 of 4: the upper RIGHT corner - the top of the tile, or any straight line high on the wall.",
      wallTL: "Tap 4 of 4: the upper LEFT corner, on the same line.",
    };
    const k = this.S.tapQueue?.[0];
    this.S.messages.mark = k ? [{ kind: "info", text: HINT[k] }] : [];
  }

  setTool(tool) {
    this.S.tool = tool;
    if (this.S.ready) this.drawBrushOverlay();
    this.emit();
  }
  setSnap(v) { this.S.snap = Boolean(v); this.emit(); }
  setAutoRemove(v) { this.S.autoRemove = Boolean(v); this.compose(); this.emit(); }

  handles() {
    const out = [["wallTL", COL.wall], ["wallTR", COL.wall], ["wallBL", COL.wall], ["wallBR", COL.wall]];
    if (this.S.simpleMarks) return out;
    for (const [k, c] of [["leftRim", COL.rim], ["rightRim", COL.rim], ["leftTop", COL.top], ["rightTop", COL.top]]) if (this.S.marks?.[k]) out.push([`${k}.0`, c], [`${k}.1`, c]);
    out.push(["valve", COL.fix], ["head", COL.fix]);
    return out;
  }
  getPt(key) {
    if (key === "valve" || key === "head") return this.S.points[key];
    const [k, i] = key.split(".");
    return i === undefined ? this.S.marks[k] : this.S.marks[k][+i];
  }
  setPt(key, p) {
    if (key === "valve" || key === "head") { this.S.points[key] = p; this.S.pointsDefault = false; return; }
    const [k, i] = key.split(".");
    if (i === undefined) this.S.marks[k] = p; else this.S.marks[k][+i] = p;
  }

  /** Pixels in the photo per pixel on screen (handles are sized for fingers, not for the photo). */
  photoScale() {
    const rect = this.els.before.getBoundingClientRect();
    return rect.width ? this.els.before.width / rect.width : 1;
  }

  drawMarks() {
    const svg = this.els.svg, m = this.S.marks;
    if (!m || !this.S.points) { svg.innerHTML = ""; return; }
    if (this.S.simpleMarks) { this.drawOutline(); return; }
    const w = this.els.before.width;
    const r = Math.max(10, w * 0.017);
    let html = `<polygon points="${[m.wallTL, m.wallTR, m.wallBR, m.wallBL].map((p) => p.join(",")).join(" ")}" fill="#2f7bff22" stroke="#2f7bff" stroke-width="${r / 4}"/>`;
    for (const [k, col] of [["leftRim", COL.rim], ["rightRim", COL.rim], ["leftTop", COL.top], ["rightTop", COL.top]]) {
      if (!m[k]) continue;
      html += `<line x1="${m[k][0][0]}" y1="${m[k][0][1]}" x2="${m[k][1][0]}" y2="${m[k][1][1]}" stroke="${col}" stroke-width="${r / 4}" stroke-dasharray="${r} ${r / 2}"/>`;
    }
    if (this.pipeline.cam && this.S.check?.measureOk && this.cur().base) {
      const ms = this.measureFull();
      const poly = [[0, ms.panHeight, 0], [ms.facingWidth, ms.panHeight, 0], [ms.facingWidth, ms.panHeight, ms.sideLength], [0, ms.panHeight, ms.sideLength]]
        .map((p) => project(this.pipeline.cam, p)).filter((p) => p[2] > 1).map((p) => `${p[0]},${p[1]}`).join(" ");
      html += `<polygon points="${poly}" fill="none" stroke="#ffffffcc" stroke-width="${r / 5}" stroke-dasharray="${r / 2} ${r / 2}"/>`;
    }
    if (!this.S.tapQueue) {
      for (const [key, col] of this.handles()) {
        const p = this.getPt(key);
        html += `<circle data-k="${key}" cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${col}" fill-opacity=".85" stroke="#fff" stroke-width="${r / 4}"/>`;
      }
    }
    svg.innerHTML = html;
  }

  /**
   * The customer-facing outline: the wall area that will be replaced (and the
   * new base's outline once it lines up), four large corner handles, the one to
   * move next highlighted.
   */
  drawOutline() {
    const svg = this.els.svg, m = this.S.marks, k = this.photoScale();
    const quad = [m.wallTL, m.wallTR, m.wallBR, m.wallBL];
    let html = `<polygon points="${quad.map((p) => p.join(",")).join(" ")}" fill="#ffffff" fill-opacity="0.18" stroke="#ffffff" stroke-width="${2.5 * k}" stroke-linejoin="round"/>`;
    if (this.pipeline.cam && this.S.check?.measureOk && this.cur().base) {
      const ms = this.measureFull();
      const poly = [[0, ms.panHeight, 0], [ms.facingWidth, ms.panHeight, 0], [ms.facingWidth, ms.panHeight, ms.sideLength], [0, ms.panHeight, ms.sideLength]]
        .map((p) => project(this.pipeline.cam, p)).filter((p) => p[2] > 1).map((p) => `${p[0]},${p[1]}`).join(" ");
      html += `<polygon points="${poly}" fill="#A47A3E" fill-opacity="0.16" stroke="#E9C88F" stroke-width="${2 * k}" stroke-dasharray="${8 * k} ${6 * k}"/>`;
    }
    const order = ["wallBL", "wallBR", "wallTR", "wallTL"];
    for (const key of order) {
      const p = m[key], on = this.S.activeMark === key;
      const R = (on ? 17 : 12) * k;
      if (on) html += `<circle cx="${p[0]}" cy="${p[1]}" r="${R * 1.9}" fill="#A47A3E" fill-opacity="0.22"><animate attributeName="r" values="${R * 1.4};${R * 2.1};${R * 1.4}" dur="1.6s" repeatCount="indefinite"/></circle>`;
      html += `<circle data-k="${key}" cx="${p[0]}" cy="${p[1]}" r="${R}" fill="${on ? "#A47A3E" : "#1C1B19"}" fill-opacity="${on ? 1 : 0.75}" stroke="#fff" stroke-width="${3 * k}"/>`;
      html += `<circle cx="${p[0]}" cy="${p[1]}" r="${2.2 * k}" fill="#fff"/>`;
    }
    svg.innerHTML = html;
  }
  setActiveMark(key) { this.S.activeMark = key; this.drawMarks(); this.emit(); }
  setSimpleMarks(v) { this.S.simpleMarks = Boolean(v); this.drawMarks(); }

  /**
   * Is the photo lined up believably? A camera that would have to be under the
   * floor, behind the wall or with a fish-eye lens means the outline is wrong.
   */
  photoCheck() {
    const cam = this.pipeline.cam;
    if (!cam || this.S.model) return { ok: true };
    const C = cam.position, m = this.S.design.measure;
    const reasons = [];
    if (!(cam.fovY > 22 && cam.fovY < 105)) reasons.push("lens");
    if (!(C[1] > 12 && C[1] < 100)) reasons.push("height");
    if (!(C[2] > m.sideLength * 0.25)) reasons.push("distance");
    if (cam.rmsPx > Math.max(this.els.before.width, this.els.before.height) * 0.02) reasons.push("fit");
    return { ok: reasons.length === 0, reasons };
  }

  eventPoint(ev) {
    const rect = this.els.before.getBoundingClientRect();
    return [((ev.clientX - rect.left) / rect.width) * this.els.before.width, ((ev.clientY - rect.top) / rect.height) * this.els.before.height];
  }

  showLoupe(ev, p) {
    const L = this.els.loupe;
    if (!L) return;
    const host = L.parentElement;
    const ctx = L.getContext("2d");
    const rect = this.els.before.getBoundingClientRect();
    const size = L.width, zoom = 3;
    const s = (size / zoom) * (this.els.before.width / rect.width);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.photoCanvas, p[0] - s / 2, p[1] - s / 2, s, s, 0, 0, size, size);
    ctx.strokeStyle = "#ffffffd0"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
    ctx.strokeStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2); ctx.stroke();
    const box = host.offsetWidth || size;
    const x = Math.min(window.innerWidth - box - 6, Math.max(6, ev.clientX - box / 2));
    const y = ev.clientY - box - 48 < 6 ? ev.clientY + 48 : ev.clientY - box - 48;
    host.style.left = `${x}px`; host.style.top = `${y}px`; host.style.display = "block";
  }
  hideLoupe() { if (this.els.loupe) this.els.loupe.parentElement.style.display = "none"; }

  snapped(key, p) {
    if (!this.S.snap || key === "valve" || key === "head") return p;
    return (key.startsWith("wall") ? snapCorner(this.pipeline.photo, p) : snapEdge(this.pipeline.photo, p)).point;
  }

  attachPointer() {
    const svg = this.els.svg;
    let drag = null;
    const down = (ev) => {
      if (!this.S.ready || !this.S.marks) return;
      ev.preventDefault();
      svg.setPointerCapture?.(ev.pointerId);
      const p = this.eventPoint(ev);
      if (this.S.tapQueue) {
        const key = this.S.tapQueue.shift();
        if (key === "wallBL") for (const k of ["leftRim", "rightRim", "leftTop", "rightTop"]) delete this.S.marks[k];
        this.S.marks[key] = this.snapped(key, p);
        this.tapHint();
        this.drawMarks();
        if (!this.S.tapQueue.length) {
          this.S.tapQueue = null;
          this.full();
          if (this.S.pointsDefault) { this.placeDefaultPoints(); this.full(); }
          this.S.messages.mark = [{ kind: "ok", text: "Corners set. Drag any dot to fine-tune; the dashed outline shows where the new base sits." }];
        }
        this.emit();
        return;
      }
      if (this.S.tool === "marks") {
        const rect = this.els.before.getBoundingClientRect();
        const reach = Math.max(this.els.before.width * 0.06, (this.S.simpleMarks ? 44 : 32) * (this.els.before.width / rect.width));
        let best = null, bd = Infinity;
        for (const [key] of this.handles()) {
          const q = this.getPt(key); const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (d < bd) { bd = d; best = key; }
        }
        if (bd < reach) {
          drag = { key: best, off: [this.getPt(best)[0] - p[0], this.getPt(best)[1] - p[1]] };
          if (this.S.simpleMarks) {
            this.S.markHistory = this.S.markHistory || [];
            this.S.markHistory.push(structuredClone(this.S.marks));
            this.S.activeMark = best;
            for (const k of ["leftRim", "rightRim", "leftTop", "rightTop"]) delete this.S.marks[k];
          }
          this.showLoupe(ev, this.getPt(best));
        }
      } else if (this.S.tool === "tapRemove") {
        const region = regionFromTap(this.pipeline.photo, p[0], p[1], { maxRadius: Math.max(this.els.before.width, this.els.before.height) * 0.2 });
        this.pushMaskHistory();
        let n = 0;
        for (let i = 0; i < region.length; i++) if (region[i] && !this.S.keepMask[i]) { this.S.removeMask[i] = 1; n++; }
        this.S.maskVersion++;
        this.drawBrushOverlay();
        this.later(() => this.compose(), 0);
        this.S.messages.mark = [{ kind: n ? "ok" : "info", text: n ? "Selected to remove. Tap Undo if it took too much." : "Nothing to remove there." }];
        this.emit();
      } else {
        this.pushMaskHistory();
        drag = { brush: true };
        this.brushAt(ev);
      }
    };
    const move = (ev) => {
      if (!drag) return;
      if (drag.key) {
        const p = this.eventPoint(ev);
        const q = [p[0] + drag.off[0], p[1] + drag.off[1]];
        this.setPt(drag.key, q);
        this.showLoupe(ev, q);
        this.drawMarks();
      } else this.brushAt(ev);
    };
    const up = () => {
      if (!drag) return;
      if (drag.key) {
        this.setPt(drag.key, this.snapped(drag.key, this.getPt(drag.key)));
        // the corners moved: re-check which way the photo faces
        if (this.S.simpleMarks) this.chooseOrientation(this.S.walls || { left: this.S.design.measure.leftWall, right: this.S.design.measure.rightWall });
        this.hideLoupe();
        this.drawMarks();
        this.later(() => this.full(), 0);
      } else if (drag.brush) { this.S.maskVersion++; this.later(() => this.compose(), 0); }
      drag = null;
      this.emit();
    };
    const cancel = () => { this.hideLoupe(); drag = null; };
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", cancel);
    this.detachPointer = () => {
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", cancel);
    };
  }

  undoMarks() {
    const h = this.S.markHistory?.pop();
    if (!h) return;
    this.S.marks = h;
    this.chooseOrientation(this.S.walls || {});
    this.full();
    this.emit();
  }
  resetMarks() {
    if (!this.S.suggestedMarks) return;
    this.S.markHistory = this.S.markHistory || [];
    this.S.markHistory.push(structuredClone(this.S.marks));
    this.S.marks = structuredClone(this.S.suggestedMarks);
    this.chooseOrientation(this.S.walls || {});
    this.full();
    this.emit();
  }

  pushMaskHistory() {
    this.S.maskHistory.push({ remove: this.S.removeMask.slice(), keep: this.S.keepMask.slice() });
    if (this.S.maskHistory.length > 12) this.S.maskHistory.shift();
  }
  undoMask() {
    const h = this.S.maskHistory.pop();
    if (!h) return;
    this.S.removeMask = h.remove; this.S.keepMask = h.keep; this.S.maskVersion++;
    this.drawBrushOverlay(); this.compose(); this.emit();
  }
  clearMasks() {
    this.pushMaskHistory();
    this.S.removeMask.fill(0); this.S.keepMask.fill(0); this.S.maskVersion++;
    this.drawBrushOverlay(); this.compose(); this.emit();
  }
  brushSize = 28;
  brushAt(ev) {
    const [x, y] = this.eventPoint(ev);
    const r = (this.brushSize * this.els.before.width) / 1000;
    const w = this.els.before.width, h = this.els.before.height;
    const paint = (mask, v) => {
      for (let yy = Math.max(0, Math.floor(y - r)); yy < Math.min(h, y + r); yy++)
        for (let xx = Math.max(0, Math.floor(x - r)); xx < Math.min(w, x + r); xx++)
          if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) mask[yy * w + xx] = v;
    };
    if (this.S.tool === "remove") paint(this.S.removeMask, 1);
    if (this.S.tool === "keep") paint(this.S.keepMask, 1);
    if (this.S.tool === "erase") { paint(this.S.removeMask, 0); paint(this.S.keepMask, 0); }
    this.drawBrushOverlay();
  }
  drawBrushOverlay() {
    const c = this.els.before, g = c.getContext("2d");
    g.putImageData(this.pipeline.photo, 0, 0);
    if (this.S.tool === "marks") return;
    const w = c.width, h = c.height;
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
      if (this.S.removeMask[i]) { img.data[i * 4] = img.data[i * 4] * 0.5 + 120; img.data[i * 4 + 1] *= 0.5; img.data[i * 4 + 2] *= 0.5; }
      else if (this.S.keepMask[i]) { img.data[i * 4] *= 0.5; img.data[i * 4 + 1] = img.data[i * 4 + 1] * 0.5 + 110; img.data[i * 4 + 2] *= 0.6; }
    }
    g.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------------ design changes
  /** Keep the design valid; returns human-readable changes. */
  fix() {
    if (!this.catalog) return [];
    const { design, changes } = autoFix(this.S.design, this.catalog);
    this.S.design = design;
    return changes;
  }

  /** Change the design (mutator gets the design), re-validate, re-render. Returns the changes autoFix made. */
  applyChange(mutate, { finishOnly = false, defer = false, drag = false } = {}) {
    this.S.dragFrame = drag;
    mutate(this.S.design);
    const before = { ...this.S.design };
    // only report automatic changes that replace something that was actually chosen
    const had = { Base: before.baseId, "Wall finish": before.finishId, Fixture: before.fixtureId };
    const changes = this.fix().filter((c) => !Object.entries(had).some(([label, v]) => !v && c.startsWith(label)));
    if (this.S.ready && !defer) {
      if (finishOnly && !changes.length) this.changeFinish();
      else this.full();
    }
    if (!defer) this.emit();
    return changes;
  }

  /** Brightness match of the new work to the photo (no geometry change). */
  setExposure(v) {
    this.S.design.measure.exposure = Math.min(1.3, Math.max(0.7, Number(v) || 1));
    this.pipeline.renderer.setExposure(this.S.design.measure.exposure);
    if (this.pipeline.sel) this.compose(performance.now(), "brightness");
    this.emit();
  }

  setMeasure(patch) {
    const changes = this.applyChange((d) => Object.assign(d.measure, patch), { defer: Boolean(this.S.model) });
    if (this.S.model) {
      const m = this.S.design.measure;
      const key = JSON.stringify([m.facingWidth, m.sideLength, m.rimHeight, m.leftWall, m.rightWall]);
      if (key !== this.S.model.measureKey && !checkMeasurements(m).length) this.drawRoom(m);
      this.full();
      this.emit();
    }
    return changes;
  }

  defaultWall() {
    const m = this.S.design.measure;
    if (alcoveFootprint(m).side === "front") return "facing";
    return m.leftWall ? "left" : "right";
  }

  /** A different room (another photo, another reading of it): accessories go back to their default spots. */
  replaceAccessories() {
    for (const a of this.S.design.accessories) {
      const p = this.accProduct(a);
      if (!p) continue;
      delete a.wall; delete a.corner; delete a.u;
      Object.assign(a, this.defaultPlacement(p));
    }
    this.S.moveHistory = [];
  }

  /** Where a new accessory goes first: grab bars at the recommended height, seats away from the faucet, shelves in a corner. */
  defaultPlacement(prod) {
    const m = this.S.design.measure, fl = this.floorTop();
    const wall = this.defaultWall();
    const wl = wallLength(wall, m);
    const pw = this.plumbingWorld();
    const out = {};
    if (prod.type === "grabBar") Object.assign(out, { wall, orientation: "horizontal", u: wl / 2, y: fl + 34.5 });
    if (prod.type === "seat") {
      // on the end wall opposite the faucet when there is one, else the far end of the back wall
      const other = pw?.wall === "left" ? "right" : pw?.wall === "right" ? "left" : null;
      if (other && wallExists(other, m)) Object.assign(out, { wall: other, u: wallLength(other, m) / 2, y: fl + 18 });
      else Object.assign(out, { wall, u: Math.max(prod.width / 2 + 2, wl - prod.width / 2 - 6), y: fl + 18 });
    }
    if (prod.type === "shelf") {
      const away = pw?.wall === "left" && m.rightWall ? "right" : pw?.wall === "right" && m.leftWall ? "left" : m.leftWall ? "left" : "right";
      Object.assign(out, { corner: away, y: (this.cur().base?.dims.height || 3) + 46 });
    }
    return out;
  }

  addAccessory(type) {
    const prod = (this.catalog.accessories || []).find((a) => a.type === type);
    if (!prod) return [];
    const a = { key: `a${this.accSeq++}`, productId: prod.id, ...this.defaultPlacement(prod) };
    return this.applyChange((d) => { d.accessories.push(a); });
  }

  // ------------------------------------------------------------------ moving accessories (drag on the picture, nudge, reset, undo)
  accProduct(a) { return byId(this.catalog.accessories, a?.productId); }

  /** Allowed centre positions for an accessory on a wall (inches), from its size and the wall panels. */
  accessoryLimits(a, p, wall = a.wall) {
    const m = this.S.design.measure, { base, finish } = this.cur();
    const H = base?.dims.height ?? 3;
    const kit = (finish?.kits || []).find((k) => k.for === base?.kind);
    const top = H + (kit?.height ?? 60);
    if (p.type === "shelf") return { yMin: H + 8, yMax: top - 4 };
    const wl = wallLength(wall, m);
    const half = (p.type === "grabBar" && a.orientation !== "vertical" ? p.length : p.type === "seat" ? p.width : p.flange ?? 3) / 2;
    const vhalf = p.type === "grabBar" && a.orientation === "vertical" ? p.length / 2 : p.type === "seat" ? 6 : (p.flange ?? 3) / 2;
    return { wall, uMin: half + 1.5, uMax: wl - half - 1.5, yMin: H + 1.5 + vhalf, yMax: top - vhalf - 0.5, half, vhalf };
  }

  /** Would this position collide with the faucet or another accessory? */
  accessoryBlocked(key, cand, p) {
    if (p.type === "shelf") return null;
    const L = this.accessoryLimits(cand, p, cand.wall);
    const box = { u0: cand.u - L.half, u1: cand.u + L.half, y0: cand.y - L.vhalf, y1: cand.y + L.vhalf };
    const pw = this.plumbingWorld() || (this.pipeline.valveWall ? { wall: this.pipeline.valveWall.wall, valve: [this.pipeline.valveWall.u, this.pipeline.valveWall.y], head: [this.pipeline.headWall?.u, this.pipeline.headWall?.y] } : null);
    if (pw && pw.wall === cand.wall) {
      const r = (this.cur().fixture?.geometry?.plateR ?? 3.5) + 1.5;
      const [vu, vy] = pw.valve;
      const nu = Math.max(box.u0, Math.min(vu, box.u1)), ny = Math.max(box.y0, Math.min(vy, box.y1));
      if (Math.hypot(nu - vu, ny - vy) < r) return "the faucet";
    }
    for (const o of this.S.design.accessories) {
      if (o.key === key || o.wall !== cand.wall) continue;
      const op = this.accProduct(o); if (!op || op.type === "shelf") continue;
      const OL = this.accessoryLimits(o, op, o.wall);
      if (box.u0 < o.u + OL.half && o.u - OL.half < box.u1 && box.y0 < o.y + OL.vhalf && o.y - OL.vhalf < box.y1) return op.family?.label || op.label || op.name;
    }
    return null;
  }

  /** Clamp + snap a wanted position; returns { place, blocked } (blocked: what it would hit). */
  constrainAccessory(a, p, want) {
    if (p.type === "shelf") {
      const L = this.accessoryLimits(a, p);
      let y = Math.min(L.yMax, Math.max(L.yMin, want.y));
      y = Math.round(y * 2) / 2;
      return { place: { corner: want.corner || a.corner, y }, blocked: null };
    }
    const wall = want.wall || a.wall;
    const L = this.accessoryLimits(a, p, wall);
    let u = Math.min(L.uMax, Math.max(L.uMin, want.u));
    let y = Math.min(L.yMax, Math.max(L.yMin, want.y));
    const fl = this.floorTop();
    const wl = wallLength(wall, this.S.design.measure);
    if (Math.abs(u - wl / 2) < 1.5) u = wl / 2; // snap to the middle of the wall
    if (p.type === "grabBar" && a.orientation !== "vertical" && Math.abs(y - fl - 34.5) < 1.6) y = fl + 34.5; // the recommended height band
    if (p.type === "seat" && Math.abs(y - fl - 18) < 1.6) y = fl + 18;
    u = Math.round(u * 4) / 4; y = Math.round(y * 4) / 4;
    const cand = { ...a, wall, u, y };
    return { place: { wall, u, y }, blocked: this.accessoryBlocked(a.key, cand, p) };
  }

  pushMove(key) {
    const a = this.S.design.accessories.find((x) => x.key === key);
    if (!a) return;
    this.S.moveHistory = this.S.moveHistory || [];
    this.S.moveHistory.push({ key, place: { wall: a.wall, corner: a.corner, u: a.u, y: a.y } });
    if (this.S.moveHistory.length > 40) this.S.moveHistory.shift();
  }
  undoMove() {
    const h = this.S.moveHistory?.pop();
    if (!h) return [];
    return this.applyChange((d) => { const a = d.accessories.find((x) => x.key === h.key); if (a) Object.assign(a, h.place); });
  }
  get canUndoMove() { return Boolean(this.S.moveHistory?.length); }

  /** Move an accessory to a position (inches), keeping it valid. record=false while a drag is in progress. */
  placeAccessory(key, want, { record = true } = {}) {
    const a = this.S.design.accessories.find((x) => x.key === key), p = a && this.accProduct(a);
    if (!a || !p) return { changes: [], blocked: null };
    const { place, blocked } = this.constrainAccessory(a, p, want);
    if (blocked) { this.S.lastBlocked = blocked; return { changes: [], blocked }; }
    this.S.lastBlocked = null;
    if (record) this.pushMove(key);
    const changes = this.applyChange((d) => { const t = d.accessories.find((x) => x.key === key); if (t) Object.assign(t, place); }, { drag: !record });
    return { changes, blocked: null };
  }
  nudgeAccessory(key, du, dy) {
    const a = this.S.design.accessories.find((x) => x.key === key);
    if (!a) return [];
    // u runs from the facing wall on side walls; on screen "right" depends on the wall
    const sign = a.wall === "left" ? -1 : 1;
    return this.placeAccessory(key, { wall: a.wall, corner: a.corner, u: (a.u ?? 0) + du * sign, y: a.y + dy }).changes;
  }
  resetAccessory(key) {
    const a = this.S.design.accessories.find((x) => x.key === key), p = a && this.accProduct(a);
    if (!a || !p) return [];
    this.pushMove(key);
    const place = this.defaultPlacement(p);
    return this.applyChange((d) => { const t = d.accessories.find((x) => x.key === key); if (t) { delete t.corner; delete t.wall; Object.assign(t, place); } });
  }

  /** Accessory centre in world inches (for hit-testing and the selection ring). */
  accessoryCentre(a, p) {
    const m = this.S.design.measure;
    if (p.type === "shelf") { const k = (p.leg ?? 9) / 3; return a.corner === "right" ? [m.facingWidth - k, a.y, k] : [k, a.y, k]; }
    if (p.type === "seat") return this.wallPoint(a.wall, a.u, a.y - 1, (p.depth ?? 15) / 2);
    return this.wallPoint(a.wall, a.u, a.y, (p.clearance ?? 1.5) + (p.diameter ?? 1.25) / 2);
  }

  /** Accessories as seen in the picture: [{ key, x, y, r }] in image pixels. */
  accessoryHandles() {
    const cam = this.pipeline.cam;
    if (!cam) return [];
    const out = [];
    const bad = new Set((this.S.check?.errors || []).map((e) => e.field));
    for (const a of this.S.design.accessories) {
      const p = this.accProduct(a); if (!p || bad.has(`accessory:${a.key}`)) continue;
      const c = this.accessoryCentre(a, p);
      const q = project(cam, c);
      if (q[2] <= 1) continue;
      const size = p.type === "grabBar" ? (p.length ?? 24) * 0.6 : p.type === "seat" ? (p.width ?? 16) * 0.6 : (p.leg ?? 9) * 0.9;
      out.push({ key: a.key, x: q[0], y: q[1], r: Math.max(26, (cam.f * size) / q[2] / 2), type: p.type });
    }
    return out;
  }
  /** The new wall panels as polygons in image pixels (where accessories can go). */
  panelPolygons() {
    const cam = this.pipeline.cam;
    if (!cam || !this.cur().base) return [];
    const m = this.S.design.measure, ms = this.measureFull();
    const H = ms.panHeight, top = H + ms.wallHeight, W = m.facingWidth, L = m.sideLength;
    const P = (pts) => pts.map((q) => project(cam, q)).map((q) => [q[0], q[1]]);
    const out = [{ wall: "facing", pts: P([[0, H, 0], [W, H, 0], [W, top, 0], [0, top, 0]]) }];
    if (m.leftWall) out.push({ wall: "left", pts: P([[0, H, L], [0, H, 0], [0, top, 0], [0, top, L]]) });
    if (m.rightWall) out.push({ wall: "right", pts: P([[W, H, 0], [W, H, L], [W, top, L], [W, top, 0]]) });
    return out;
  }

  accessoryAt(px, py) {
    let best = null, bd = Infinity;
    for (const h of this.accessoryHandles()) { const dd = Math.hypot(h.x - px, h.y - py); if (dd < h.r && dd < bd) { bd = dd; best = h.key; } }
    return best;
  }

  /** Drag: the point under the finger (image pixels) -> the accessory's new position (on any wall it can go on). */
  dragAccessory(key, px, py, { grab = [0, 0] } = {}) {
    const a = this.S.design.accessories.find((x) => x.key === key), p = a && this.accProduct(a);
    const cam = this.pipeline.cam;
    if (!a || !p || !cam) return { blocked: null };
    const m = this.S.design.measure;
    const hit = imageToWall(cam, px - grab[0], py - grab[1], { facingWidth: m.facingWidth, sideLength: m.sideLength, leftWall: m.leftWall, rightWall: m.rightWall });
    if (p.type === "shelf") {
      const corner = hit.wall === "left" || (hit.wall === "facing" && hit.u < m.facingWidth / 2) ? "left" : "right";
      const ok = corner === "left" ? m.leftWall : m.rightWall;
      return this.placeAccessory(key, { corner: ok ? corner : a.corner, y: hit.y }, { record: false });
    }
    const wall = wallExists(hit.wall, m) ? hit.wall : a.wall;
    return this.placeAccessory(key, { wall, u: hit.u, y: hit.y }, { record: false });
  }
  beginDrag(key) { this.pushMove(key); this.S.dragging = key; }
  endDrag() {
    this.S.dragging = null;
    // drop the history entry if nothing moved
    const h = this.S.moveHistory?.at(-1), a = h && this.S.design.accessories.find((x) => x.key === h.key);
    if (h && a && h.place.u === a.u && h.place.y === a.y && h.place.wall === a.wall && h.place.corner === a.corner) this.S.moveHistory.pop();
    this.compose(performance.now(), "detail", "full");
    this.emit();
  }
  updateAccessory(key, patch) {
    return this.applyChange((d) => {
      const t = d.accessories.find((x) => x.key === key);
      if (!t) return;
      if (patch.heightAboveFloor !== undefined) { t.y = this.floorTop() + Number(patch.heightAboveFloor); delete patch.heightAboveFloor; }
      if (patch.wall && patch.wall !== t.wall) t.u = Math.min(t.u ?? 0, wallLength(patch.wall, d.measure) / 2);
      Object.assign(t, patch);
    });
  }
  removeAccessory(key) {
    return this.applyChange((d) => { d.accessories = d.accessories.filter((x) => x.key !== key); });
  }

  // ------------------------------------------------------------------ rendering
  measureFull() {
    const { base, finish } = this.cur();
    const kit = (finish?.kits || []).find((k) => !base || k.for === base.kind);
    return { ...this.S.design.measure, panHeight: base?.dims.height ?? 2.75, wallHeight: kit?.height ?? 60 };
  }

  selection() {
    const { base, finish, fixture, enclosure } = this.cur();
    const bad = new Set((this.S.check?.errors || []).map((e) => e.field));
    return {
      base, finish, fixture, enclosure,
      drain: base.drains.find((d) => d.id === this.S.design.drainId) || base.drains[0],
      curtain: this.S.design.curtain,
      accessories: this.S.design.accessories
        .filter((a) => !bad.has(`accessory:${a.key}`))
        .map((a) => ({ product: byId(this.catalog.accessories, a.productId), place: { wall: a.wall, corner: a.corner, u: a.u, y: a.y, orientation: a.orientation } }))
        .filter((a) => a.product),
      valvePx: this.S.points.valve,
      headPx: this.S.points.head,
      plumbing: this.plumbingWorld(),
    };
  }

  runChecks() {
    const r = check({ ...this.S.design, valveWall: this.pipeline.valveWall || null }, this.catalog);
    this.S.check = { ...r, measureOk: !r.errors.some((e) => ["facingWidth", "sideLength", "rimHeight", "markHeight", "leftWall"].includes(e.field)) };
    this.S.messages.design = [
      ...r.errors.filter((e) => !String(e.field).startsWith("accessory:")).map((e) => ({ kind: "err", text: e.message })),
      ...r.warnings.filter((e) => !String(e.field).startsWith("accessory:")).map((e) => ({ kind: "warn", text: e.message })),
      ...r.notes.map((n) => ({ kind: "info", text: n })),
    ];
    return r;
  }

  full() {
    const S = this.S;
    if (!S.ready || !S.marks || !S.points || this.disposed) { this.drawMarks(); return; }
    const t0 = performance.now();
    const mErr = checkMeasurements(S.design.measure);
    S.messages.measure = mErr.map((e) => ({ kind: "err", text: e.message, field: e.field }));
    if (mErr.length) {
      S.check = { measureOk: false, errors: mErr, warnings: [], notes: [] };
      S.busy = this.audience === "customer" ? "One of the measurements looks off. Please check it." : "Fix the measurements to update the picture.";
      this.drawMarks(); this.emit();
      return;
    }
    const { base, finish, fixture } = this.cur();
    if (!base || !finish || !fixture) {
      this.runChecks();
      S.busy = "Choose your products to see the new look.";
      this.drawMarks(); this.emit();
      return;
    }
    try {
      this.pipeline.prepare({ marks: S.marks, measure: this.measureFull(), camera: S.model?.cam || null, modelLight: S.model?.light || null });
    } catch {
      S.busy = this.audience === "customer" ? "We couldn't identify the shower area. Try adjusting the highlighted corners, or use an example bathroom." : "We couldn't line up the picture with these dots. Check that the 4 blue dots sit on the wall corners.";
      this.drawMarks(); this.emit();
      return;
    }
    this.runChecks();
    const block = S.check.errors.filter((e) => !String(e.field).startsWith("accessory:"));
    if (block.length) {
      S.busy = this.audience === "customer" ? customerMessage(block[0], S.design, this.catalog) : "This combination isn't possible: " + block[0].message;
      this.drawMarks(); this.emit();
      return;
    }
    try {
      this.pipeline.build(this.selection(), this.measureFull());
      this.syncPoints();
      this.runChecks();
      this.compose(t0, "design");
    } catch (e) {
      S.busy = "The preview could not be drawn on this device.";
      console.error(e);
    }
    this.drawMarks();
    this.emit();
  }

  /** Keep the saved valve/head dots where the plumbing is drawn (designs are re-opened from them). */
  syncPoints() {
    const pw = this.plumbingWorld();
    if (!pw || !this.pipeline.cam) return;
    const v = project(this.pipeline.cam, this.wallPoint(pw.wall, pw.valve[0], pw.valve[1]));
    const h = project(this.pipeline.cam, this.wallPoint(pw.wall, pw.head[0], pw.head[1]));
    this.S.points = { valve: [v[0], v[1]], head: [h[0], h[1]] };
  }

  changeFinish() {
    if (!this.S.ready || !this.pipeline.cam || !this.pipeline.sel) { this.full(); return; }
    const t0 = performance.now();
    if (this.measureFull().wallHeight !== this.pipeline.lastWallHeight || this.S.check?.errors?.length) { this.full(); return; }
    this.pipeline.setFinish(this.cur().finish);
    this.compose(t0, "finish");
    this.emit();
  }

  compose(t0 = performance.now(), reason = "redraw", quality = "fast") {
    if (!this.pipeline.sel || this.disposed) return;
    clearTimeout(this.qualityTimer);
    const ms = this.measureFull();
    this.pipeline.lastWallHeight = ms.wallHeight;
    const anyRemove = this.S.removeMask.some((v) => v), anyKeep = this.S.keepMask.some((v) => v);
    this.pipeline.compose(this.els.after, {
      reuseLeftover: Boolean(this.S.dragFrame),
      removeMask: anyRemove ? this.S.removeMask : null, keepMask: anyKeep ? this.S.keepMask : null,
      autoRemove: this.S.autoRemove, measure: this.S.model ? null : ms, maskVersion: this.S.maskVersion, quality,
    });
    this.S.busy = null;
    this.S.last = { reason, ms: performance.now() - t0, fill: this.pipeline.fillQuality, at: Date.now(), timings: { ...this.pipeline.timings } };
    // the texture-continuing fill is slower: run it when the person pauses
    if (this.pipeline.fillQuality === "fast") this.qualityTimer = this.later(() => { this.compose(performance.now(), "detail", "full"); this.emit(); }, 450);
    if (this.S.tool !== "marks") this.drawBrushOverlay();
  }

  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.disposed) fn(); }, ms);
    this.timers.add(t);
    return t;
  }

  /** The current preview as a JPEG blob (for saving with the design). */
  previewBlob(maxSide = 1280, quality = 0.85) {
    const a = this.els.after;
    if (!a.width) return Promise.resolve(null);
    const k = Math.min(1, maxSide / Math.max(a.width, a.height));
    const c = document.createElement("canvas");
    c.width = Math.round(a.width * k); c.height = Math.round(a.height * k);
    c.getContext("2d").drawImage(a, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, "image/jpeg", quality));
  }

  /** Draw the before/after pair into compare canvases. */
  drawCompare(beforeCvs, afterCvs) {
    if (!this.pipeline.photo) return;
    for (const [c, src] of [[beforeCvs, this.pipeline.photo], [afterCvs, null]]) {
      if (!c) continue;
      c.width = this.els.before.width; c.height = this.els.before.height;
      const g = c.getContext("2d");
      if (src) g.putImageData(src, 0, 0); else g.drawImage(this.els.after, 0, 0);
    }
  }

  wallExists(w) { return wallExists(w, this.S.design.measure); }
  wallLength(w) { return wallLength(w, this.S.design.measure); }

  destroy() {
    this.disposed = true;
    for (const t of this.timers) clearTimeout(t);
    clearTimeout(this.qualityTimer);
    this.detachPointer?.();
    try { this.pipeline.renderer.renderer.dispose(); this.pipeline.renderer.renderer.forceContextLoss(); } catch { /* already gone */ }
  }
}
