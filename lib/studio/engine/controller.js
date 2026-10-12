// The Shower Studio engine controller: one object that owns the canvases, the
// dot overlay, masks and the rendering pipeline, and keeps a design valid
// against the catalog. Framework-free: the public Studio and the employee
// Sales Studio both drive it and render their own panels from onChange().
//
// Ported from the Milestone 1b prototype (main.js) without changing the
// geometry, rendering or compositing.
import { Pipeline } from "./pipeline.js";
import { project } from "./geometry.js";
import { suggestMarks, snapCorner, snapEdge } from "./detect.js";
import { regionFromTap } from "./composite.js";
import { check, options, autoFix, checkMeasurements, alcoveFootprint, wallExists, wallLength } from "./compat.js";
import { encodeMask, decodeMask } from "./design.js";

const COL = { wall: "#2f7bff", rim: "#13a39a", top: "#8a4dff", fix: "#ff8a1f" };
const byId = (list, id) => (list || []).find((x) => x.id === id) || null;

export const DEFAULT_DESIGN = () => ({
  measure: { facingWidth: 30, sideLength: 60, rimHeight: 15, markHeight: NaN, leftWall: true, rightWall: false, aboveMode: "paint", exposure: 1 },
  baseId: "", drainId: "", finishId: "", fixtureId: "", enclosureId: "none", curtain: false, accessories: [],
});

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
    });
  }

  // ------------------------------------------------------------------ photo
  /** Load the (already server-sanitized) photo. Uses a blob URL so the canvas is never tainted. */
  async loadPhoto(url, { state = null } = {}) {
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
      const m = this.S.design.measure;
      if (s.walls.left) m.leftWall = true;
      if (s.walls.right) m.rightWall = true;
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

  drawMarks() {
    const svg = this.els.svg, m = this.S.marks;
    if (!m || !this.S.points) { svg.innerHTML = ""; return; }
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
        const reach = Math.max(this.els.before.width * 0.06, 32 * (this.els.before.width / rect.width));
        let best = null, bd = Infinity;
        for (const [key] of this.handles()) {
          const q = this.getPt(key); const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (d < bd) { bd = d; best = key; }
        }
        if (bd < reach) { drag = { key: best, off: [this.getPt(best)[0] - p[0], this.getPt(best)[1] - p[1]] }; this.showLoupe(ev, this.getPt(best)); }
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
  applyChange(mutate, { finishOnly = false } = {}) {
    mutate(this.S.design);
    const before = { ...this.S.design };
    // only report automatic changes that replace something that was actually chosen
    const had = { Base: before.baseId, "Wall finish": before.finishId, Fixture: before.fixtureId };
    const changes = this.fix().filter((c) => !Object.entries(had).some(([label, v]) => !v && c.startsWith(label)));
    if (this.S.ready) {
      if (finishOnly && !changes.length) this.changeFinish();
      else this.full();
    }
    this.emit();
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
    return this.applyChange((d) => Object.assign(d.measure, patch));
  }

  defaultWall() {
    const m = this.S.design.measure;
    if (alcoveFootprint(m).side === "front") return "facing";
    return m.leftWall ? "left" : "right";
  }

  addAccessory(type) {
    const prod = (this.catalog.accessories || []).find((a) => a.type === type);
    if (!prod) return [];
    const m = this.S.design.measure, fl = this.floorTop();
    const wall = this.defaultWall();
    const wl = wallLength(wall, m);
    const a = { key: `a${this.accSeq++}`, productId: prod.id };
    if (type === "grabBar") Object.assign(a, { wall, orientation: "horizontal", u: wl / 2, y: fl + 34.5 });
    if (type === "seat") Object.assign(a, { wall, u: Math.max(prod.width / 2 + 2, wl - prod.width / 2 - 6), y: fl + 18 });
    if (type === "shelf") Object.assign(a, { corner: m.leftWall ? "left" : "right", y: (this.cur().base?.dims.height || 3) + 46 });
    return this.applyChange((d) => { d.accessories.push(a); });
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
      S.busy = "Fix the measurements to update the picture.";
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
      this.pipeline.prepare({ marks: S.marks, measure: this.measureFull() });
    } catch {
      S.busy = "We couldn't line up the picture with these dots. Check that the 4 blue dots sit on the wall corners.";
      this.drawMarks(); this.emit();
      return;
    }
    this.runChecks();
    const block = S.check.errors.filter((e) => !String(e.field).startsWith("accessory:"));
    if (block.length) {
      S.busy = "This combination isn't possible: " + block[0].message;
      this.drawMarks(); this.emit();
      return;
    }
    try {
      this.pipeline.build(this.selection(), this.measureFull());
      this.runChecks();
      this.compose(t0, "design");
    } catch (e) {
      S.busy = "The preview could not be drawn on this device.";
      console.error(e);
    }
    this.drawMarks();
    this.emit();
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
      removeMask: anyRemove ? this.S.removeMask : null, keepMask: anyKeep ? this.S.keepMask : null,
      autoRemove: this.S.autoRemove, measure: ms, maskVersion: this.S.maskVersion, quality,
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
