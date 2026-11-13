/**
 * The admin's "field into view" rule (audit E.3, item 2).
 *
 * - Measure what is really visible: the visual viewport (the keyboard on
 *   iPhone only shrinks that), minus any sticky sheet footer or fixed bar
 *   touching its bottom ([data-adm-footer], [data-fixed-bottom]).
 * - If the focused field is visible (its bottom above the visible bottom
 *   minus 16px and its top below the header), do nothing. Never scrolling a
 *   visible field is what stops the page jumping under the thumb.
 * - Otherwise move the nearest scroll container (a sheet body), then the
 *   window, just enough that the field's bottom sits 24px above the keyboard,
 *   but never so far that its label (one line of context) leaves the top.
 * - Called on focus and when the keyboard opens; never on blur.
 */

const COVER_MARGIN = 16;
const TARGET_GAP = 24;

function visibleBand() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  let top = vv ? vv.offsetTop : 0;
  let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  // Fixed or sticky bars at the bottom of what is visible (a sheet footer rides on the keyboard).
  for (const bar of document.querySelectorAll<HTMLElement>("[data-adm-footer], [data-fixed-bottom]")) {
    const rect = bar.getBoundingClientRect();
    if (!rect.height) continue;
    const style = getComputedStyle(bar);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (rect.top < bottom && rect.bottom >= bottom - 4) bottom = Math.min(bottom, rect.top);
  }
  // The sticky admin header at the top.
  const header = document.querySelector<HTMLElement>("[data-adm-header]");
  if (header) {
    const rect = header.getBoundingClientRect();
    if (rect.bottom > top && rect.top <= top + 1) top = rect.bottom;
  }
  return { top, bottom };
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

/** The field's label (or its [data-field] wrapper), the line of context kept on screen above it. */
function contextTop(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const id = el.id;
  const label =
    (id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(id)}"]`) : null) ||
    el.closest<HTMLElement>("label") ||
    el.closest<HTMLElement>("[data-field]");
  if (!label) return rect.top;
  return Math.min(rect.top, label.getBoundingClientRect().top);
}

export function isCovered(el: HTMLElement): boolean {
  const band = visibleBand();
  const rect = el.getBoundingClientRect();
  return rect.bottom > band.bottom - COVER_MARGIN || rect.top < band.top;
}

export function keepFieldUncovered(el: HTMLElement): void {
  if (typeof window === "undefined" || !el?.isConnected) return;
  if (!isCovered(el)) return;
  const band = visibleBand();
  const rect = el.getBoundingClientRect();
  const ctxTop = contextTop(el);

  // How far up the field must move (positive) or down (negative, field above the top).
  let delta: number;
  if (rect.top < band.top) {
    delta = ctxTop - (band.top + 8);
  } else {
    delta = rect.bottom - (band.bottom - TARGET_GAP);
    // Keep the label on screen: never move the context line above the visible top.
    const maxUp = ctxTop - (band.top + 8);
    if (delta > maxUp) delta = Math.max(maxUp, 0);
  }
  if (Math.abs(delta) < 1) return;

  const container = scrollParent(el);
  if (container) {
    const before = container.scrollTop;
    container.scrollTop = before + delta;
    delta -= container.scrollTop - before;
  }
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: "auto" });
}
