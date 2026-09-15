/**
 * Where the webpage's own elements are.
 *
 * The point of the homepage experiment is that a repair job belongs to a piece
 * of the page — this headline, that list row — rather than to a coordinate
 * somebody typed. So the page publishes the elements that can host a job, and
 * the 3D layer reads their geometry.
 *
 * Boxes are stored in PAGE space (viewport rect plus scroll), not viewport
 * space. That one decision is what makes scrolling work: a page-space rect does
 * not change when the document scrolls, so anchors are measured on layout
 * changes only, and the scene compensates for scroll with a single group
 * offset. Measuring per frame would be both slower and wrong — it would let
 * rounding during a scroll jitter the character against the text he is
 * standing next to.
 *
 * Deliberately outside React, like the other Lab stores: this is read inside a
 * render loop, and a context would re-render the tree on every reflow.
 */

export type AnchorBox = {
  /** Centre of the element, in page CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
};

const nodes = new Map<string, HTMLElement>();
let boxes: Record<string, AnchorBox> = {};
let version = 0;
const listeners = new Set<() => void>();

/** Ref callback: `ref={(el) => registerAnchor("cabinet", el)}`. */
export function registerAnchor(id: string, element: HTMLElement | null) {
  if (element) nodes.set(id, element);
  else nodes.delete(id);
}

/**
 * Re-read every registered element.
 *
 * Returns whether anything actually moved, so a resize that changes nothing —
 * a scrollbar appearing, a repaint — does not invalidate the tour and restart
 * the character's walk.
 */
export function measureAnchors(): boolean {
  if (typeof window === "undefined") return false;

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const next: Record<string, AnchorBox> = {};

  for (const [id, element] of nodes) {
    const rect = element.getBoundingClientRect();
    /* A hidden element has no honest position; leave its job unplaced. */
    if (rect.width === 0 && rect.height === 0) continue;
    next[id] = {
      x: rect.left + scrollX + rect.width / 2,
      y: rect.top + scrollY + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  }

  const ids = Object.keys(next);
  const same =
    ids.length === Object.keys(boxes).length &&
    ids.every((id) => {
      const a = next[id];
      const b = boxes[id];
      return (
        b !== undefined &&
        Math.abs(a.x - b.x) < 0.5 &&
        Math.abs(a.y - b.y) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
      );
    });

  if (same) return false;

  boxes = next;
  version += 1;
  for (const listener of listeners) listener();
  return true;
}

export function getAnchorBox(id: string): AnchorBox | undefined {
  return boxes[id];
}

export function getAnchorVersion() {
  return version;
}

export function subscribeAnchors(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called when the homepage experiment unmounts, so nothing stale survives. */
export function clearAnchors() {
  nodes.clear();
  boxes = {};
  version += 1;
  for (const listener of listeners) listener();
}
