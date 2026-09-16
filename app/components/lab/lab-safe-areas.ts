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
  /** A control somebody might be reaching for, rather than words. */
  interactive: boolean;
  /**
   * Pinned to the viewport rather than to the document.
   *
   * A sticky header does not scroll away, so storing it in page space and
   * subtracting the scroll would have the character carefully avoiding a strip
   * of empty page a thousand pixels below where the header actually is. These
   * are stored in viewport coordinates and used as-is.
   */
  fixed: boolean;
  /**
   * How much it costs to stand on this, 1 to 3.
   *
   * Not everything on a page is equally unwelcome to cover. A line of body copy
   * is a shame; a headline is the thing the page is for, and a button is what
   * somebody is reaching for, so those two share the top of the scale. He was standing on "There is always something"
   * because one heading row inside his block scored the same as one line of a
   * paragraph and came in under the limit.
   */
  weight: number;
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

const INTERACTIVE = new Set([
  "INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "LABEL",
]);

/** Anything smaller than this is decoration and not worth avoiding. */
const MIN_AREA = 240;

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
/**
 * The pinned ones, kept with their elements.
 *
 * A sticky header is not where it will be. Before it sticks it sits in the flow
 * — a long way down the page, in this Lab, underneath the build banner — and
 * caching that position had him treating the top of the screen as free and
 * standing on the Log In button for a third of the loop. There are only ever a
 * handful of these, so they are simply re-read whenever the answer matters.
 */
let pinned: { element: HTMLElement; rect: PageRect }[] = [];
let root: HTMLElement | null = null;

export function setSafeAreaRoot(element: HTMLElement | null) {
  root = element;
}

/**
 * Re-read the page. Cheap enough for a reflow, far too expensive per frame.
 *
 * Text is measured by its line boxes, not by the element that holds it. Nearly
 * every paragraph on a website is a full-width block containing half a width of
 * words, and taking the element's rectangle throws away the empty half — which
 * on a tablet was most of the free space on the screen, and was why he ended up
 * standing on a checklist row that had a hand's width of daylight beside it.
 */
export function measureSafeAreas(): number {
  if (typeof window === "undefined") return 0;
  const scope: ParentNode = root ?? document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const viewportArea = window.innerWidth * window.innerHeight;
  const next: PageRect[] = [];
  const range = document.createRange();

  const nextPinned: { element: HTMLElement; rect: PageRect }[] = [];
  const nextBands: { y: number; fixed: boolean }[] = [];
  const seenBand = new Set<number>();

  /**
   * A wide, opaque block of colour is a band; its top and bottom are seams.
   *
   * Width is what separates a section from a card: both have a background, but
   * only one of them reaches across the page, and only one of them draws a line
   * the eye reads as the floor.
   */
  const noteBand = (element: HTMLElement, r: DOMRect, isFixed: boolean) => {
    if (r.width < window.innerWidth * 0.75 || r.height < 60) return;
    const bg = getComputedStyle(element).backgroundColor;
    const m = /^rgba?\(([^)]+)\)/.exec(bg);
    if (!m) return;
    const parts = m[1].split(",").map((v) => parseFloat(v));
    if (parts.length > 3 && parts[3] < 0.85) return;
    for (const edge of [r.top, r.bottom]) {
      const y = isFixed ? edge : edge + scrollY;
      const key = Math.round(y / 8);
      if (seenBand.has(key)) continue;
      seenBand.add(key);
      nextBands.push({ y, fixed: isFixed });
    }
  };

  const push = (
    r: DOMRect,
    isFixed: boolean,
    interactive: boolean,
    element: HTMLElement,
    weight = 1
  ) => {
    const area = r.width * r.height;
    if (area < MIN_AREA) return;
    if (area > viewportArea * MAX_VIEWPORT_SHARE) return;
    const rect: PageRect = {
      x: isFixed ? r.left : r.left + scrollX,
      y: isFixed ? r.top : r.top + scrollY,
      w: r.width,
      h: r.height,
      fixed: isFixed,
      interactive,
      weight: interactive ? 3 : weight,
    };
    next.push(rect);
    if (isFixed) nextPinned.push({ element, rect });
  };

  for (const node of scope.querySelectorAll("*")) {
    const element = node as HTMLElement;
    /* The canvas is the one thing exempt: it is the character, not the page. */
    if (element.hasAttribute("data-fx-layer")) continue;

    noteBand(element, element.getBoundingClientRect(), isPinned(element));

    /*
     * A card with a button in it is one thing, not several.
     *
     * Scanning for text and controls finds a pricing card as a scatter of
     * short lines with generous space between them, and that space scores as
     * free — so he stands in the middle of the Basic plan looking like part of
     * the offer. Anything that wraps a control is treated as a single object
     * the reader is about to use, and gets the same berth a button does.
     */
    if (!element.hasAttribute("data-fx-layer")) {
      const card = element.getBoundingClientRect();
      const area = card.width * card.height;
      /*
       * One control, not three.
       *
       * Counting any container with a button in it made the whole pricing grid
       * a single off-limits slab — a third of the viewport he could never stand
       * in, and the cards inside it were never marked at all. A card has one
       * call to action; a grid of cards has one per card. Counting them is the
       * cheapest thing that tells the two apart.
       */
      if (
        area > 8000 &&
        area < viewportArea * MAX_VIEWPORT_SHARE &&
        element.querySelectorAll("button, a, input, select, textarea").length === 1
      ) {
        push(card, isPinned(element), true, element);
      }
    }

    const always =
      ALWAYS_CONTENT.has(element.tagName) ||
      element.hasAttribute("data-fx-avoid");
    const text = holdsText(element);
    if (!always && !text) continue;

    const isFixedEl = isPinned(element);
    const interactive = INTERACTIVE.has(element.tagName);
    /* A heading, or anything set noticeably larger than body copy. */
    const big =
      /^H[1-4]$/.test(element.tagName) ||
      parseFloat(getComputedStyle(element).fontSize || "0") >= 22;
    /* A headline is not worth less than a button here. Standing on either is
       the difference between a character on a page and a thing in the way. */
    const weight = big ? 3 : 1;

    if (text && !always) {
      /* The lines themselves, so the empty half of a column stays empty. */
      range.selectNodeContents(element);
      const lines = range.getClientRects();
      if (lines.length) {
        for (const line of lines) push(line as DOMRect, isFixedEl, interactive, element, weight);
        continue;
      }
    }

    push(element.getBoundingClientRect(), isFixedEl, interactive, element, weight);
  }

  rects = next;
  pinned = nextPinned;
  bands = nextBands;
  return rects.length;
}

/**
 * Re-read the pinned rectangles.
 *
 * Cheap — a handful of elements — and called whenever the answer matters, which
 * is the only way to be right about something that moves as you scroll but is
 * not in the document flow.
 */
export function refreshPinned() {
  for (const entry of pinned) {
    const r = entry.element.getBoundingClientRect();
    entry.rect.x = r.left;
    entry.rect.y = r.top;
    entry.rect.w = r.width;
    entry.rect.h = r.height;
  }
}

export function safeAreaCount() {
  return rects.length;
}

/**
 * The horizontal seams of the page.
 *
 * Every website is built out of bands — a dark hero, a white section, a tinted
 * strip — and the line where one meets the next is the strongest edge on the
 * screen. A character standing across it gets cut in half by it: body on navy,
 * boots on white. It looks like a compositing mistake even though nothing is
 * wrong, and no amount of "is this area empty" can see it, because the emptiest
 * part of a page is very often exactly the bottom of a band.
 *
 * So they are measured separately from content: not somewhere he must not go,
 * just a line he should not straddle.
 */
let bands: { y: number; fixed: boolean }[] = [];

/**
 * The last few places he stood.
 *
 * Scoring alone always picks the same winner, because the page does not change
 * between jobs: the most open rectangle on the screen is the most open
 * rectangle every time, and he lands on the same square of empty hero for job
 * after job. Remembering where he has just been is what turns one good spot
 * into a tour of them.
 */
const recent: { x: number; y: number }[] = [];

/**
 * Forget where he has been.
 *
 * Called when a search comes back with nowhere to go. On a roomy page the
 * memory adds variety; on a phone, where there may only be two or three places
 * he can legitimately stand, it can rule out all of them at once and leave him
 * off the page for a minute at a time. A repeated spot is a much smaller sin
 * than an absent character.
 */
export function forgetSpots() {
  recent.length = 0;
}

export function rememberSpot(x: number, y: number) {
  recent.push({ x, y });
  if (recent.length > 3) recent.shift();
}

export function bandCount() {
  return bands.length;
}

/* ------------------------------------------------------------ free space */

export type Spot = {
  /**
   * How much of him would be standing on something, 0 to 1.
   *
   * The caller decides what to do about it. Some pages — a phone showing a
   * single narrow column of body copy — genuinely have nowhere for a character
   * to be, and the honest answer there is not to find the least-bad paragraph
   * to stand on but to not be there at all.
   */
  crowding: number;
  /** Viewport pixels, top-left origin. */
  x: number;
  y: number;
  /** How much clear room this spot has, 0..1. Bigger is calmer. */
  clearance: number;
};

/**
 * Grid resolution, chosen from the screen rather than fixed.
 *
 * A fixed grid was coarse enough on a phone that a cell was taller than a line
 * of text: he needed three rows, three rows was most of the screen, and the
 * search fell through to "anywhere at all" on nearly every job. Sizing the
 * cells in pixels instead keeps the resolution honest at any viewport.
 */
const CELL_TARGET = 28;
const MIN_COLS = 8;
const MAX_COLS = 22;
const MIN_ROWS = 8;
const MAX_ROWS = 30;

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
  /**
   * His footprint around the repair point, in viewport pixels.
   *
   * Asymmetric on purpose. The spot being chosen is where the REPAIR is, and he
   * hangs below it — a man reaching up to a ceiling fixture is almost entirely
   * underneath the thing he is fixing. Searching for a block centred on the
   * point checked the wrong rectangle and put his head in the site header.
   */
  need: { w: number; above: number; below: number };
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
  /*
   * Measure now, not whenever the last timer happened to fire.
   *
   * The map of the page goes stale on any layout change that is not a resize —
   * a banner dismissed, an accordion opened, an image finally arriving, or in
   * the Lab's case the controls being hidden, which shifts every section up by
   * seventy pixels. Placing him against yesterday's map put him neatly clear of
   * where the seam used to be and straight across where it is.
   *
   * This runs once per job, roughly every ten seconds, and never during travel
   * or work. That is a cheap price for never being wrong about the page.
   */
  measureSafeAreas();

  const left = inset.left;
  const top = inset.top;
  const usableW = viewport.w - inset.left - inset.right;
  const usableH = viewport.h - inset.top - inset.bottom;
  if (usableW <= 0 || usableH <= 0) return null;

  const COLS = Math.max(
    MIN_COLS,
    Math.min(MAX_COLS, Math.round(usableW / CELL_TARGET))
  );
  const ROWS = Math.max(
    MIN_ROWS,
    Math.min(MAX_ROWS, Math.round(usableH / CELL_TARGET))
  );
  const cellW = usableW / COLS;
  const cellH = usableH / ROWS;

  /* Occupancy, in grid cells, from whatever content is on screen right now. */
  const busy = new Uint8Array(COLS * ROWS);
  for (const r of rects) {
    const vy = r.fixed ? r.y : r.y - scrollY;
    if (vy + r.h < top || vy > top + usableH) continue;
    /*
     * Controls get a wider berth than prose.
     *
     * Standing next to a paragraph is fine; standing next to a button is the
     * difference between charming and in the way, because the button is the
     * thing somebody is reaching for.
     */
    const grow = r.interactive ? 12 : 2;
    const weight = r.weight;
    const c0 = Math.max(0, Math.floor((r.x - grow - left) / cellW));
    const c1 = Math.min(COLS - 1, Math.floor((r.x + r.w + grow - left) / cellW));
    const r0 = Math.max(0, Math.floor((vy - grow - top) / cellH));
    const r1 = Math.min(ROWS - 1, Math.floor((vy + r.h + grow - top) / cellH));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const at = row * COLS + col;
        if (busy[at] < weight) busy[at] = weight;
      }
    }
  }

  const baseC = Math.max(1, Math.min(COLS, Math.ceil(need.w / cellW)));
  /*
   * Round the block once, not twice.
   *
   * Rounding the space above him and the space below him up to whole cells
   * separately threw away most of two cells — about seventy pixels — every
   * time, and on a phone that was the difference between fitting inside the
   * hero and being placed across the seam at the bottom of it. The free strip
   * there was six pixels short of what he was asking for, and he was only
   * asking for it because of the arithmetic.
   */
  const baseR = Math.max(
    1,
    Math.min(ROWS, Math.ceil((need.above + need.below) / cellH))
  );
  const rowsAbove = Math.max(
    0,
    Math.min(
      baseR - 1,
      Math.round((need.above / Math.max(need.above + need.below, 1)) * baseR)
    )
  );

  /**
   * Try progressively harder.
   *
   * A dense page at some scroll positions genuinely has nowhere with a clear
   * block that size, and a character who freezes because the perfect spot does
   * not exist is far worse than one who stands somewhere merely good. So: ask
   * for room to spare, then for exactly enough, then for the emptiest place
   * there is. The last pass always answers.
   */
  const attempts: { c: number; r: number; allowBusy: number; allowSeam: boolean }[] = [
    { c: Math.min(COLS, baseC + 1), r: Math.min(ROWS, baseR + 1), allowBusy: 0, allowSeam: false },
    { c: baseC, r: baseR, allowBusy: 0, allowSeam: false },
    { c: baseC, r: Math.max(1, baseR - 1), allowBusy: 0, allowSeam: false },
    { c: baseC, r: Math.max(1, baseR - 1), allowBusy: Infinity, allowSeam: true },
  ];

  for (const attempt of attempts) {
    const needC = attempt.c;
    const needR = attempt.r;
    let bestScore = -Infinity;
    const shortlist: {
      x: number; y: number; clearance: number; score: number; busyWeight: number;
    }[] = [];

    for (let row = 0; row + needR <= ROWS; row++) {
      for (let col = 0; col + needC <= COLS; col++) {
        /*
         * Not all overlaps are equal.
         *
         * When the page is dense enough that he has to stand on something —
         * which on a phone is most of the time — standing on a line of body
         * copy is a shame and standing on a button is a bug. Counting cells
         * and weighting them separately lets the last-resort pass choose the
         * least harmful place instead of merely the first one it finds.
         */
        let busyCells = 0;
        let busyWeight = 0;
        for (let r = row; r < row + needR; r++) {
          for (let c = col; c < col + needC; c++) {
            const at = busy[r * COLS + c];
            if (at) {
              busyCells++;
              busyWeight += at;
            }
          }
        }
        if (busyCells > attempt.allowBusy) continue;

        /*
         * How much room he has, measured twice.
         *
         * `clearance` is the cells immediately around him: is he touching
         * anything. `openness` looks three cells further out: is this a
         * generous piece of screen or a slot. They disagree exactly where it
         * matters — the 180px gutter between a booking card and the window edge
         * is perfectly clear and a terrible place to stand, and only the wider
         * ring can say so.
         *
         * Off-grid counts as occupied in both, because the edge of the viewport
         * is a wall. Skipping those cells was why he kept ending up pressed
         * into the margin: hugging the edge cost him nothing.
         */
        const ring = (pad: number) => {
          let clear = 0;
          let total = 0;
          for (let r = row - pad; r < row + needR + pad; r++) {
            for (let c = col - pad; c < col + needC + pad; c++) {
              total++;
              if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
              if (!busy[r * COLS + c]) clear++;
            }
          }
          return total ? clear / total : 1;
        };
        const clearance = ring(1);
        const openness = ring(3);

        const x = left + (col + needC / 2) * cellW;
        /* The anchor sits where his hand will be, not in the middle of him. */
        const anchorRow = row + Math.min(rowsAbove, needR - 1);
        const y = top + anchorRow * cellH + cellH * 0.5;

        /*
         * Composition first, travel second.
         *
         * Wander used to be able to outscore everything else combined, which is
         * how a character with a whole empty hero to stand in ended up in the
         * gutter: the gutter was further away. Distance is a tiebreaker between
         * good places, not a reason to accept a bad one.
         */
        let score = openness * 2.4 + clearance * 1.3 - busyWeight * 0.6;
        if (options.awayFrom) {
          const dx = (x - options.awayFrom.x) / Math.max(usableW, 1);
          const dy = (y - options.awayFrom.y) / Math.max(usableH, 1);
          /* Reward distance, and the diagonal specifically: a leg that changes
             both axes is the one that reads as travel on a flat screen. */
          const distance = Math.hypot(dx, dy);
          score +=
            wander * (distance * 0.75 + Math.min(Math.abs(dx), Math.abs(dy)) * 0.6);

          /*
           * And penalise anywhere he can only reach by walking through
           * something.
           *
           * A clear spot directly behind a booking card is technically free and
           * practically useless: every route to it crosses the card. Counting
           * the crossings on the straight line is a crude proxy for the real
           * route, and crude is enough — it reliably steers him to the side of
           * an obstacle he is already on.
           */
          let crossings = 0;
          for (let s = 1; s < 7; s++) {
            const f = s / 7;
            const sx = options.awayFrom.x + (x - options.awayFrom.x) * f;
            const sy = options.awayFrom.y + (y - options.awayFrom.y) * f;
            const cc = Math.floor((sx - left) / cellW);
            const cr = Math.floor((sy - top) / cellH);
            if (cc >= 0 && cr >= 0 && cc < COLS && cr < ROWS && busy[cr * COLS + cc]) {
              crossings++;
            }
          }
          score -= crossings * 0.45;
        }

        /*
         * Do not stand on a seam.
         *
         * Measured against his whole body, not the anchor: the anchor can sit
         * comfortably inside the hero while his boots land on the white section
         * below it, and it is the boots that give it away.
         */
        const blockTop = top + row * cellH;
        const blockBottom = top + (row + needR) * cellH;
        const blockH = Math.max(1, blockBottom - blockTop);
        let cutInHalf = false;
        for (const band of bands) {
          const by = band.fixed ? band.y : band.y - scrollY;
          const f = (by - blockTop) / blockH;
          if (f <= 0.02 || f >= 1.02) continue;
          if (f > 0.86) {
            /*
             * A seam at his feet is not a problem, it is a floor.
             *
             * Standing on the line where a dark hero meets a white section
             * reads as standing ON the section — deliberate, and one of the
             * better compositions available on a phone, where the bands are
             * short and there is often nowhere else to be. So it is worth a
             * small bonus rather than a penalty.
             */
            score += 0.35;
          } else {
            /* Through the body, though, cuts him in half. */
            score -= 2.4 * Math.min(1, (0.86 - f) / 0.4);
            cutInHalf = true;
          }
          break;
        }
        /*
         * A constraint, not a preference.
         *
         * As a score this lost arguments it should have won: a spot with a
         * seam through his waist but open space all around it outscored a
         * genuinely clean spot in a narrower gap, and no amount of retuning the
         * weights against each other is going to be reliably right on a page
         * nobody has seen yet. So the first three passes simply refuse, and
         * only the last-resort pass — the one that must always answer — is
         * allowed to put him across a seam.
         */
        if (cutInHalf && !attempt.allowSeam) continue;

        /* And not where he has just been. */
        for (let i = 0; i < recent.length; i++) {
          const near =
            Math.hypot(
              (x - recent[i].x) / Math.max(usableW, 1),
              (y - recent[i].y) / Math.max(usableH, 1)
            );
          /* The most recent memory is the strongest. */
          const weight = 0.5 + 0.35 * i;
          if (near < 0.3) score -= weight * (1 - near / 0.3);
        }

        /* Every candidate, so the pool below is filtered on the final best
           score rather than on whatever the best happened to be at the time. */
        if (score > bestScore) bestScore = score;
        shortlist.push({ x, y, clearance, score, busyWeight });
      }
    }

    /*
     * Choose from the good spots, not the best one.
     *
     * Argmax on a page that does not move is a constant function, and a
     * character who reappears on the same square every time reads as broken
     * even when every individual placement is defensible. Anything within a
     * short distance of the best score is, by construction, also a good place
     * to stand — so take one of those at random and let the page feel inhabited
     * rather than solved.
     */
    if (shortlist.length) {
      const pool = shortlist.filter((c) => c.score >= bestScore - 0.45);
      const pick = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
      return {
        x: pick.x,
        y: pick.y,
        clearance: pick.clearance,
        /* 1.0 means every cell of him is on body copy; 3 means on controls. */
        crowding: Math.min(1, pick.busyWeight / Math.max(1, needC * needR)),
      };
    }
  }

  return null;
}

/**
 * What would he actually be standing on, if he stood here?
 *
 * The grid crowding figure is a good scoring signal and a poor guarantee: it
 * measures the block reserved for the search, which is deliberately larger and
 * differently shaped than the character, and it averages. Averaging is how a
 * headline ends up under his head and still comes in under the limit.
 *
 * This asks the direct question instead, about his real silhouette in real
 * pixels, and reports the worst thing it touches and how much of him is on
 * something. The caller can then refuse outright to cover a heading or a
 * control while tolerating a clipped corner of a paragraph.
 */
export function whatIsUnder(box: {
  x: number; y: number; w: number; h: number;
}): { worst: number; covered: number } {
  const scrollY = typeof window === "undefined" ? 0 : window.scrollY;
  const area = Math.max(1, box.w * box.h);
  let worst = 0;
  let covered = 0;
  for (const r of rects) {
    const ry = r.fixed ? r.y : r.y - scrollY;
    const ox = Math.min(box.x + box.w, r.x + r.w) - Math.max(box.x, r.x);
    const oy = Math.min(box.y + box.h, ry + r.h) - Math.max(box.y, ry);
    if (ox <= 0 || oy <= 0) continue;
    const share = (ox * oy) / area;
    /* A glancing corner of something is not "standing on" it. */
    if (share < 0.012) continue;
    if (r.weight > worst) worst = r.weight;
    covered += share;
  }
  return { worst, covered: Math.min(1, covered) };
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

/* ------------------------------------------------------------------ debug */

/**
 * Lab-only window hook.
 *
 * Reasoning about an occupancy grid from screenshots is guesswork; printing it
 * takes a second and answers outright. Removed with the rest of the diagnostic
 * scaffolding.
 */
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__fxSafe = {
    rects: () => rects,
    count: () => rects.length,
  };
}
