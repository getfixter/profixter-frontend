/**
 * The event display's brain, free of React.
 *
 * PhotoPool decides what is loaded. It walks a shuffled deck of displayable photos
 * and keeps only a small buffer of them preloaded and measured, so a library of
 * thousands costs the tablet a dozen images at a time, never all of them.
 *
 * planScene decides what is shown next, from that buffer only: a photo is never
 * put on screen before its bytes have arrived and its shape is known, which is
 * what lets each frame be composed for the photos actually in it.
 */

import type { DisplayPhoto } from "@/lib/event-display-service";

export type Measured = DisplayPhoto & { w: number; h: number; aspect: number };
export type Fit = "cover" | "ambient";
export type Motion = { s0: number; x0: number; y0: number; s1: number; x1: number; y1: number };

/** `from`: set on a swiped scene, the side it slides in from (1 = right, -1 = left). */
type Base = { key: number; duration: number; fade: number; from?: 1 | -1 };
export type Scene =
  | (Base & { kind: "hero"; photo: Measured; fit: Fit; motion: Motion })
  | (Base & { kind: "pair"; photos: [Measured, Measured] })
  | (Base & { kind: "trio"; photos: [Measured, Measured, Measured]; mirror: boolean })
  | (Base & { kind: "wall"; photos: Measured[]; delays: number[]; focus: number; cols: number; rows: number })
  | (Base & { kind: "brand"; line: string; note?: "empty" | "offline" });

/* ---------------- timing ---------------- */

export const FADE_MS = 1600;
export const MANUAL_FADE_MS = 650;
export const RESUME_AFTER_MS = 12000;
const HERO_MS = 8600;
const AMBIENT_MS = 9400;
const PAIR_MS = 10000;
const TRIO_MS = 10800;
const WALL_MS = 8200;
export const WALL_EXPAND_LEAD_MS = 2300; // the focus tile starts growing this long before the wall ends
const BRAND_MS = 5600;
const BRAND_EVERY = 9;
const WALL_EVERY = 11;

const WALL_PHOTOS = 12;
const MIN_PHOTOS_FOR_WALL = 24;

/* ---------------- quality gates on the device ---------------- */

/** Anything smaller on its short side would look like a mistake at booth size. */
const MIN_SHORT_SIDE = 360;
/** Long screenshots and panoramas: no frame on this screen can hold them. */
const MAX_ASPECT = 3.2;
/** A photo that failed may be fine later (wifi at an event); try again after this. */
const RETRY_FAILED_AFTER_MS = 15 * 60 * 1000;
const LOAD_TIMEOUT_MS = 20000;

/** The brand moment's line, under the big mark. */
export const BRAND_LINES = [
  "Monthly handyman for your home.",
  "Real homes. Real things to fix.",
  "Everything handled, every month.",
  "Long Island's handyman membership.",
];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function shuffled<T>(list: T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Loads one image, waits for it to be decodable, and lets go of it.
 * Nothing keeps the Image object afterwards; the bytes stay in the HTTP cache
 * for the <img> that will show it.
 */
export function measureImage(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (error: Error | null, dims?: { w: number; h: number }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (error) {
        img.src = "";
        reject(error);
      } else {
        resolve(dims!);
      }
    };
    const timer = window.setTimeout(() => finish(new Error("timeout")), LOAD_TIMEOUT_MS);
    img.onload = () => {
      const dims = { w: img.naturalWidth, h: img.naturalHeight };
      const decoded = typeof img.decode === "function" ? img.decode() : Promise.resolve();
      decoded.then(
        () => finish(null, dims),
        () => finish(null, dims)
      );
    };
    img.onerror = () => finish(new Error("load"));
    img.decoding = "async";
    img.src = url;
  });
}

export class PhotoPool {
  private byId = new Map<string, DisplayPhoto>();
  private deck: string[] = [];
  private cursor = 0;
  private dims = new Map<string, { w: number; h: number }>();
  private failedUntil = new Map<string, number>();
  private loading = new Set<string>();
  private ready: Measured[] = [];
  private readonly concurrency = 3;
  private readonly target = WALL_PHOTOS + 3;
  private consecutiveFailures = 0;

  private onReady: () => void = () => {};

  /** Called whenever a load settles; the player sets it once it is mounted. */
  listen(onReady: () => void) {
    this.onReady = onReady;
  }

  get size() {
    return this.byId.size;
  }

  get readyCount() {
    return this.ready.length;
  }

  /** True when every recent load failed: the network, not the photos. */
  get looksOffline() {
    return this.consecutiveFailures >= 6 && this.ready.length === 0;
  }

  /** Replace the library. Photos that were hidden disappear from the buffer at once. */
  setPhotos(list: DisplayPhoto[]) {
    const next = new Map(list.map((p) => [p.id, p]));
    const added = list.filter((p) => !this.byId.has(p.id)).map((p) => p.id);
    this.byId = next;
    this.ready = this.ready.filter((p) => next.has(p.id));
    const remaining = this.deck.slice(this.cursor).filter((id) => next.has(id));
    this.deck = remaining.concat(shuffled(added));
    this.cursor = 0;
    this.fill();
  }

  /** New order from here on. The buffer is kept so the screen never waits. */
  reshuffle() {
    this.deck = shuffled([...this.byId.keys()]);
    this.cursor = 0;
  }

  markBroken(id: string) {
    this.failedUntil.set(id, Date.now() + RETRY_FAILED_AFTER_MS);
    this.ready = this.ready.filter((p) => p.id !== id);
    this.fill();
  }

  private nextId(): string | null {
    const total = this.byId.size;
    if (total === 0) return null;
    const now = Date.now();
    for (let tries = 0; tries < total + 1; tries += 1) {
      if (this.cursor >= this.deck.length) {
        this.deck = shuffled([...this.byId.keys()]);
        this.cursor = 0;
      }
      const id = this.deck[this.cursor];
      this.cursor += 1;
      if (!this.byId.has(id) || this.loading.has(id)) continue;
      if (this.ready.some((p) => p.id === id)) continue;
      const until = this.failedUntil.get(id);
      if (until && until > now) continue;
      return id;
    }
    return null;
  }

  fill() {
    // A small library cannot fill a large buffer without showing doubles side by side.
    const target = Math.min(this.target, Math.max(1, this.byId.size - 1), this.byId.size);
    while (this.loading.size < this.concurrency && this.ready.length + this.loading.size < target) {
      const id = this.nextId();
      if (!id) return;
      void this.load(id);
    }
  }

  private async load(id: string) {
    const photo = this.byId.get(id);
    if (!photo) return;
    this.loading.add(id);
    try {
      const known = this.dims.get(id);
      const dims = known ?? (await measureImage(photo.url));
      if (!known) this.dims.set(id, dims);
      this.consecutiveFailures = 0;
      const short = Math.min(dims.w, dims.h);
      const aspect = dims.w / Math.max(1, dims.h);
      if (short < MIN_SHORT_SIDE || aspect > MAX_ASPECT || aspect < 1 / MAX_ASPECT) {
        // Not a transient failure: never retry this one.
        this.failedUntil.set(id, Number.POSITIVE_INFINITY);
      } else if (this.byId.has(id)) {
        this.ready.push({ ...this.byId.get(id)!, ...dims, aspect });
      }
    } catch {
      this.consecutiveFailures += 1;
      this.failedUntil.set(id, Date.now() + RETRY_FAILED_AFTER_MS);
    } finally {
      this.loading.delete(id);
      if (this.consecutiveFailures >= 6) {
        // Back off instead of burning through the whole library while offline.
        window.setTimeout(() => this.fill(), 20000);
      } else {
        this.fill();
      }
      this.onReady();
    }
  }

  /** Take the first buffered photo matching `want`, or null. */
  take(want: (p: Measured) => boolean = () => true): Measured | null {
    const index = this.ready.findIndex(want);
    if (index < 0) return null;
    const [photo] = this.ready.splice(index, 1);
    this.fill();
    return photo;
  }

  takePairFromOneJob(want: (p: Measured) => boolean): [Measured, Measured] | null {
    for (let i = 0; i < this.ready.length; i += 1) {
      const a = this.ready[i];
      if (!want(a)) continue;
      const j = this.ready.findIndex((b, k) => k !== i && b.group === a.group && want(b));
      if (j >= 0) {
        const b = this.ready[j];
        this.ready = this.ready.filter((p) => p !== a && p !== b);
        this.fill();
        return [a, b];
      }
    }
    return null;
  }

  peekCount(want: (p: Measured) => boolean) {
    return this.ready.filter(want).length;
  }

  /** Put photos back at the front of the buffer when a composition fell through. */
  giveBack(photos: Measured[]) {
    this.ready = photos.concat(this.ready);
  }
}

/* ---------------- composition ---------------- */

/** How much of the photo a full-bleed crop would throw away, as a ratio of aspects. */
export function cropRatio(photoAspect: number, stageAspect: number) {
  return Math.max(photoAspect / stageAspect, stageAspect / photoAspect);
}

export function fitFor(photo: Measured, stageAspect: number): Fit {
  return cropRatio(photo.aspect, stageAspect) <= 1.45 ? "cover" : "ambient";
}

/**
 * A slow push or pull with a little drift. Drift never exceeds what the zoom
 * has in hand, so no edge of the photo can come into view.
 */
export function makeMotion(fit: Fit, calm = false): Motion {
  if (fit === "ambient" || calm) {
    return { s0: 1, x0: 0, y0: 0, s1: fit === "ambient" ? 1.045 : 1.07, x1: 0, y1: 0 };
  }
  const zoomIn = Math.random() < 0.72;
  const near = rand(1.0, 1.025);
  const far = rand(1.09, 1.13);
  const [s0, s1] = zoomIn ? [near, far] : [far, near];
  const room = (s: number) => Math.max(0, (s - 1) * 42);
  const drift = () => pick([-1, 1]) * rand(0.3, 1);
  const dx = drift();
  const dy = drift() * 0.6;
  return {
    s0,
    s1,
    x0: (-dx * room(s0)) / 2,
    y0: (-dy * room(s0)) / 2,
    x1: (dx * room(s1)) / 2,
    y1: (dy * room(s1)) / 2,
  };
}

export type PlannerState = {
  sinceBrand: number;
  sinceWall: number;
  lastKind: Scene["kind"] | null;
  brandIndex: number;
  forcedHero: Measured | null;
  key: number;
};

export function newPlannerState(): PlannerState {
  return {
    sinceBrand: 0,
    sinceWall: Math.floor(WALL_EVERY / 2),
    lastKind: null,
    brandIndex: Math.floor(Math.random() * BRAND_LINES.length),
    forcedHero: null,
    key: 0,
  };
}

export function brandScene(state: PlannerState, note?: "empty" | "offline"): Scene {
  state.key += 1;
  state.sinceBrand = 0;
  state.lastKind = "brand";
  const line = note ? BRAND_LINES[0] : BRAND_LINES[state.brandIndex++ % BRAND_LINES.length];
  return { kind: "brand", key: state.key, line, note, duration: BRAND_MS, fade: FADE_MS };
}

export function heroScene(
  state: PlannerState,
  photo: Measured,
  stageAspect: number,
  opts: { fade?: number; duration?: number; forceCover?: boolean; calm?: boolean; from?: 1 | -1 } = {}
): Scene {
  state.key += 1;
  state.lastKind = "hero";
  const fit = opts.forceCover ? "cover" : fitFor(photo, stageAspect);
  return {
    kind: "hero",
    key: state.key,
    photo,
    fit,
    motion: makeMotion(fit, opts.calm),
    duration: opts.duration ?? (fit === "ambient" ? AMBIENT_MS : HERO_MS),
    fade: opts.fade ?? FADE_MS,
    from: opts.from,
  };
}

/**
 * The rhythm: mostly one photo at a time; now and then two, three or a wall;
 * a brand moment roughly every minute and a half. A multi-photo frame is
 * always followed by a single photo, so the screen breathes.
 */
export function planScene(state: PlannerState, pool: PhotoPool, stageAspect: number): Scene | null {
  const portrait = stageAspect < 1;

  if (state.forcedHero) {
    const photo = state.forcedHero;
    state.forcedHero = null;
    state.sinceBrand += 1;
    state.sinceWall += 1;
    return heroScene(state, photo, stageAspect, { fade: 700, forceCover: true, calm: true });
  }

  if (state.sinceBrand >= BRAND_EVERY && state.lastKind !== "brand") {
    return brandScene(state);
  }

  if (pool.readyCount === 0) return null;

  const options: Array<{ kind: Scene["kind"]; weight: number }> = [{ kind: "hero", weight: 5 }];
  if (state.lastKind === "hero" || state.lastKind === "brand") {
    // Slots in a pair are wide on a portrait screen and tall on a landscape one.
    const pairShape = (p: Measured) => (portrait ? p.aspect >= 1.1 : p.aspect <= 0.95);
    if (pool.peekCount(pairShape) >= 2) options.push({ kind: "pair", weight: 2.2 });
    if (pool.readyCount >= 3) options.push({ kind: "trio", weight: 1.4 });
    if (
      state.sinceWall >= WALL_EVERY &&
      pool.readyCount >= WALL_PHOTOS &&
      pool.size >= MIN_PHOTOS_FOR_WALL
    ) {
      options.push({ kind: "wall", weight: 6 });
    }
  }

  let roll = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
  let kind: Scene["kind"] = "hero";
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      kind = option.kind;
      break;
    }
  }

  state.sinceBrand += 1;
  state.sinceWall += 1;

  if (kind === "pair") {
    const shape = (p: Measured) => (portrait ? p.aspect >= 1.1 : p.aspect <= 0.95);
    const photos =
      pool.takePairFromOneJob(shape) ??
      (() => {
        const a = pool.take(shape);
        const b = a ? pool.take(shape) : null;
        if (a && b) return [a, b] as [Measured, Measured];
        if (a) pool.giveBack([a]);
        return null;
      })();
    if (photos) {
      state.key += 1;
      state.lastKind = "pair";
      return { kind: "pair", key: state.key, photos, duration: PAIR_MS, fade: FADE_MS };
    }
  }

  if (kind === "trio") {
    // The large slot is landscape on a portrait screen and portrait on a landscape one.
    const big = pool.take((p) => (portrait ? p.aspect >= 1.05 : p.aspect <= 1)) ?? pool.take();
    const a = pool.take();
    const b = pool.take();
    if (big && a && b) {
      state.key += 1;
      state.lastKind = "trio";
      return {
        kind: "trio",
        key: state.key,
        photos: [big, a, b],
        mirror: Math.random() < 0.5,
        duration: TRIO_MS,
        fade: FADE_MS,
      };
    }
    pool.giveBack([big, a, b].filter(Boolean) as Measured[]);
  }

  if (kind === "wall") {
    const photos: Measured[] = [];
    for (let i = 0; i < WALL_PHOTOS; i += 1) {
      const p = pool.take();
      if (p) photos.push(p);
    }
    if (photos.length === WALL_PHOTOS) {
      const cols = portrait ? 3 : 4;
      const rows = WALL_PHOTOS / cols;
      // The tile that grows into the next frame must survive a full-bleed crop,
      // and is picked away from the edges so its journey is visible.
      const inner = photos
        .map((p, i) => ({ p, i }))
        .filter(({ i }) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          return c > 0 && c < cols - 1 && r > 0 && r < rows - 1;
        });
      const candidates = inner.filter(({ p }) => fitFor(p, stageAspect) === "cover");
      const focus = (candidates.length ? pick(candidates) : pick(inner.length ? inner : photos.map((p, i) => ({ p, i })))).i;
      state.key += 1;
      state.lastKind = "wall";
      state.sinceWall = 0;
      state.forcedHero = photos[focus];
      const delays = photos.map(() => Math.round(Math.random() * 1100));
      return { kind: "wall", key: state.key, photos, delays, focus, cols, rows, duration: WALL_MS, fade: FADE_MS };
    }
    pool.giveBack(photos);
  }

  const photo = pool.take();
  if (!photo) return null;
  return heroScene(state, photo, stageAspect);
}

export function photosIn(scene: Scene): Measured[] {
  switch (scene.kind) {
    case "hero":
      return [scene.photo];
    case "pair":
    case "trio":
    case "wall":
      return scene.photos;
    default:
      return [];
  }
}
