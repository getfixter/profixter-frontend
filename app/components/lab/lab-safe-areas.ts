/**
 * Where the page is busy, and where it is not.
 *
 * The character does not belong to the document any more — he lives in the
 * visible screen, and the screen is different every time somebody scrolls. So
 * the document's job is no longer to say "stand here"; it is to say "not here",
 * and it says that about whatever happens to be on screen at the time.
 *
 * That split is the whole architecture. Positioning is viewport-space and works
 * on any page. Avoidance is DOM-aware and needs no cooperation from the page
 * beyond ordinary markup — which is what makes this a site-level system rather
 * than something wired into one homepage.
 *
 * Rects are stored in PAGE space and converted on demand by subtracting the
 * scroll, because a page rect only changes when the page reflows. Scrolling is
 * then a subtraction rather than a re-measurement, which is what keeps this off
 * the critical path of a scroll.
 */

export type PageRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Pinned to the viewport rather than to the document.
   *
   * A sticky header does not scroll away, so storing it in page space and
   * subtracting the scroll would have the character carefully avoiding a strip
   * of empty page a thousand pixels below where the header actually is. These
   * are stored in viewport coordinates and used as-is.
   */
  fixed: boolean;
};

/**
 * What counts as content worth not standing on.
 *
 * Not a tag list. A tag list misses the thing that matters most, which is any
 * card, panel or widget assembled out of divs and spans — the booking form on
 * this very page was invisible to an earlier version of this, and he walked
 * straight through it.
 *
 * The general rule is simpler and works on markup nobody wrote for us: an
 * element is content if it directly holds text, or if it IS something you look
 * at or operate. Containers are excluded by size, because a section wrapper is
 * not content, it is the room the content is in.
 */
const ALWAYS_CONTENT = new Set([
  "IMG", "SVG", "VIDEO", "CANVAS", "PICTURE",
  "INPUT", "TEXTAREA", "SELECT", "BUTTON",
]);

/** Anything smaller than this is decoration and not worth avoiding. */
const MIN_AREA = 700;

/** Anything bigger than this share of the screen is a container, not content. */
const MAX_VIEWPORT_SHARE = 0.34;

/** Does this element directly hold words, rather than merely contain things? */
function holdsText(element: Element): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

/** Does this element, or anything close above it, stay put when you scroll? */
function isPinned(element: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  for (let i = 0; i < 5 && node; i++) {
    const position = getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return true;
    node = node.parentElement;
  }
  return false;
}

let rects: PageRect[] = [];
let root: HTMLElement | null = null;

export function setSafeAreaRoot(element: HTMLElement | null) {
  root = element;
}

/** Re-read the page. Cheap enough for a reflow, far too expensive per frame. */
export function measureSafeAreas(): number {
  if (typeof window === "undefined") return 0;
  const scope: ParentNode = root ?? document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const viewportArea = window.innerWidth * window.innerHeight;
  const next: PageRect[] = [];

  for (const node of scope.querySelectorAll("*")) {
    const element = node as HTMLElement;
    /* The canvas is the one thing exempt: it is the character, not the page. */
    if (element.hasAttribute("data-fx-layer")) continue;

    const interesting =
      ALWAYS_CONTENT.has(element.tagName) ||
      element.hasAttribute("data-fx-avoid") ||
      holdsText(element);
    if (!interesting) continue;

    const r = element.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < MIN_AREA) continue;
    if (area > viewportArea * MAX_VIEWPORT_SHARE) continue;

    const pinned = isPinned(element);
    next.push({
      x: pinned ? r.left : r.left + scrollX,
      y: pinned ? r.top : r.top + scrollY,
      w: r.width,
      h: r.height,
      fixed: pinned,
    });
  }

  rects = next;
  return rects.length;
}

export function safeAreaCount() {
  return rects.length;
}

/* ------------------------------------------------------------ free space */

export type Spot = {
  /** Viewport pixels, top-left origin. */
  x: number;
  y: number;
  /** How much clear room this spot has, 0..1. Bigger is calmer. */
  clearance: number;
};

const COLS = 17;
const ROWS = 12;

/**
 * Somewhere on the current screen he can stand.
 *
 * Works on a coarse grid rather than exact geometry because the answer does not
 * need to be optimal, it needs to be plausible and different from last time. A
 * grid also gives a natural measure of how much elbow room a spot has, which is
 * what stops him picking a technically-free sliver between two paragraphs.
 *
 * `need` is his own footprint plus whatever he is carrying, in viewport pixels.
 */
export function findSpot(options: {
  viewport: { w: number; h: number };
  need: { w: number; h: number };
  /** Keep clear of the very edges, and of any fixed site chrome. */
  inset: { top: number; right: number; bottom: number; left: number };
  /** Prefer somewhere away from here — usually where he already is. */
  awayFrom?: { x: number; y: number } | null;
  /** How strongly to prefer moving. 0 takes the calmest spot wherever it is. */
  wander?: number;
}): Spot | null {
  const { viewport, need, inset } = options;
  const wander = options.wander ?? 1;
  const scrollY = typeof window === "undefined" ? 0 : window.scrollY;

  const left = inset.left;
  const top = inset.top;
  const usableW = viewport.w - inset.left - inset.right;
  const usableH = viewport.h - inset.top - inset.bottom;
  if (usableW <= 0 || usableH <= 0) return null;

  const cellW = usableW / COLS;
  const cellH = usableH / ROWS;

  /* Occupancy, in grid cells, from whatever content is on screen right now. */
  const busy = new Uint8Array(COLS * ROWS);
  for (const r of rects) {
    const vy = r.fixed ? r.y : r.y - scrollY;
    if (vy + r.h < top || vy > top + usableH) continue;
    const c0 = Math.max(0, Math.floor((r.x - left) / cellW));
    const c1 = Math.min(COLS - 1, Math.floor((r.x + r.w - left) / cellW));
    const r0 = Math.max(0, Math.floor((vy - top) / cellH));
    const r1 = Math.min(ROWS - 1, Math.floor((vy + r.h - top) / cellH));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) busy[row * COLS + col] = 1;
    }
  }

  const baseC = Math.max(1, Math.min(COLS, Math.ceil(need.w / cellW)));
  const baseR = Math.max(1, Math.min(ROWS, Math.ceil(need.h / cellH)));

  /**
   * Try progressively harder.
   *
   * A dense page at some scroll positions genuinely has nowhere with a clear
   * block that size, and a character who freezes because the perfect spot does
   * not exist is far worse than one who stands somewhere merely good. So: ask
   * for room to spare, then for exactly enough, then for the emptiest place
   * there is. The last pass always answers.
   */
  const attempts: { c: number; r: number; allowBusy: number }[] = [
    { c: Math.min(COLS, baseC + 1), r: Math.min(ROWS, baseR + 1), allowBusy: 0 },
    { c: baseC, r: baseR, allowBusy: 0 },
    { c: baseC, r: Math.max(1, baseR - 1), allowBusy: 0 },
    { c: baseC, r: Math.max(1, baseR - 1), allowBusy: Infinity },
  ];

  for (const attempt of attempts) {
    const needC = attempt.c;
    const needR = attempt.r;
    let best: Spot | null = null;
    let bestScore = -Infinity;

    for (let row = 0; row + needR <= ROWS; row++) {
      for (let col = 0; col + needC <= COLS; col++) {
        let busyCells = 0;
        for (let r = row; r < row + needR; r++) {
          for (let c = col; c < col + needC; c++) {
            if (busy[r * COLS + c]) busyCells++;
          }
        }
        if (busyCells > attempt.allowBusy) continue;

        /* Clear cells in a ring around the block, as a calmness measure. */
        let clear = 0;
        let total = 0;
        for (let r = row - 1; r <= row + needR; r++) {
          for (let c = col - 1; c <= col + needC; c++) {
            if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
            total++;
            if (!busy[r * COLS + c]) clear++;
          }
        }
        const clearance = total ? clear / total : 1;

        const x = left + (col + needC / 2) * cellW;
        const y = top + (row + needR / 2) * cellH;

        let score = clearance * 2 - busyCells * 0.6;
        if (options.awayFrom) {
          const dx = (x - options.awayFrom.x) / Math.max(usableW, 1);
          const dy = (y - options.awayFrom.y) / Math.max(usableH, 1);
          /* Reward distance, and the diagonal specifically: a leg that changes
             both axes is the one that reads as travel on a flat screen. */
          const distance = Math.hypot(dx, dy);
          score +=
            wander * (distance * 1.6 + Math.min(Math.abs(dx), Math.abs(dy)) * 1.4);
        }

        if (score > bestScore) {
          bestScore = score;
          best = { x, y, clearance };
        }
      }
    }

    if (best) return best;
  }

  return null;
}

/** Is this viewport point currently sitting on top of something? */
export function isBusy(x: number, y: number, pad = 0): boolean {
  const scrollY = typeof window === "undefined" ? 0 : window.scrollY;
  for (const r of rects) {
    const vy = r.fixed ? r.y : r.y - scrollY;
    if (
      x >= r.x - pad &&
      x <= r.x + r.w + pad &&
      y >= vy - pad &&
      y <= vy + r.h + pad
    ) {
      return true;
    }
  }
  return false;
}
