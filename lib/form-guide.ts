"use client";

import { useEffect } from "react";

/**
 * Bringing the customer to what needs them (Customer Experience 5, 2026-11-03).
 *
 * The owner, testing on an Android phone, kept losing his place: a form said
 * "please choose a time" somewhere he could not see, or the next step opened
 * below the fold. Every customer form now ends a failed submit the same way:
 *
 *   1. the first field that needs attention is found (the form's own errors,
 *      marked aria-invalid="true" or data-error="1" - never a second set of
 *      rules here);
 *   2. a closed <details> or [data-collapsible="closed"] around it is opened;
 *   3. it is scrolled to the middle of what the customer can actually see -
 *      clear of the tab bar, a fixed button and the keyboard - smoothly, or
 *      instantly for people who asked for reduced motion;
 *   4. its input is focused when that helps (a text field), without a second
 *      jump (preventScroll).
 *
 * Only on request: nothing here runs while somebody is typing, and nothing
 * moves a calendar or a slider out from under a finger.
 */

const FIELD_SELECTOR = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])";
const TEXT_ENTRY = "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=hidden]), textarea, [contenteditable='true']";
export const INVALID_SELECTOR = "[aria-invalid='true'], [data-error='1'], [data-invalid='true'], [data-error-for]";

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/** Run after React has committed and the browser has laid the change out - not after a guessed delay. */
export function afterLayout(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/* Open whatever is hiding it: native <details>, or a section that says it is collapsed. */
export function expandAncestors(el: Element) {
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
    if (node instanceof HTMLElement && node.dataset.collapsible === "closed") {
      node.querySelector<HTMLElement>("[data-collapsible-toggle]")?.click();
    }
    node = node.parentElement;
  }
}

/*
 * What an error is about. A field marked invalid is itself; a message marked
 * data-error-for="when" points at the section marked data-field="when"; a
 * block marked data-error="1" is the block around its own field; any other
 * message belongs to the field just before it.
 */
function resolveTarget(el: Element): { scrollTo: Element; field: HTMLElement | null } {
  const inside = (box: Element) => box.querySelector<HTMLElement>(TEXT_ENTRY) || box.querySelector<HTMLElement>(FIELD_SELECTOR);
  if (el.matches(FIELD_SELECTOR)) {
    return { scrollTo: el.closest("[data-field]") || el, field: el as HTMLElement };
  }
  const key = (el as HTMLElement).dataset?.errorFor;
  const named = key ? document.querySelector(`[data-field="${CSS.escape(key)}"]`) : null;
  if (named) return { scrollTo: named, field: inside(named) };
  const own = inside(el);
  if (own) return { scrollTo: el, field: own };
  const section = el.closest("[data-field]");
  if (section) return { scrollTo: section, field: inside(section) };
  let prev = el.previousElementSibling;
  while (prev) {
    const field = prev.matches(FIELD_SELECTOR) ? (prev as HTMLElement) : prev.querySelector<HTMLElement>(FIELD_SELECTOR);
    if (field) return { scrollTo: prev, field };
    prev = prev.previousElementSibling;
  }
  return { scrollTo: el, field: el.parentElement?.querySelector<HTMLElement>(FIELD_SELECTOR) || null };
}

/** Bottom of what the customer can see, in viewport pixels: above the keyboard and any fixed bar. */
function visibleBand() {
  const vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0;
  let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  for (const bar of document.querySelectorAll<HTMLElement>("[data-fixed-bottom], .csn, .sticky-cta.is-visible")) {
    const rect = bar.getBoundingClientRect();
    if (rect.height && rect.top < bottom && rect.bottom >= bottom - 2 && getComputedStyle(bar).visibility !== "hidden" && getComputedStyle(bar).display !== "none") {
      bottom = Math.min(bottom, rect.top);
    }
  }
  return { top: top + 8, bottom: bottom - 12 };
}

/**
 * Make sure `el` is inside the visible band, moving as little as needed.
 * Scrollable sheets are handled by the browser's own scrollIntoView (which
 * scrolls every container in between); the window is then nudged by what is
 * still hidden, which is what the keyboard on iPhone needs.
 */
export function keepInView(el: Element, { block = "nearest" as ScrollLogicalPosition, behavior }: { block?: ScrollLogicalPosition; behavior?: ScrollBehavior } = {}) {
  const how = behavior || scrollBehavior();
  const band = visibleBand();
  const rect = el.getBoundingClientRect();
  if (rect.top >= band.top && rect.bottom <= band.bottom && block === "nearest") return;
  el.scrollIntoView({ block, inline: "nearest", behavior: how });
  // What the browser's own scroll could not fix (a keyboard over the layout viewport): the window, by the difference.
  afterLayout(() => {
    const now = el.getBoundingClientRect();
    const fresh = visibleBand();
    const tall = now.height > fresh.bottom - fresh.top;
    if (now.bottom > fresh.bottom && !tall) window.scrollBy({ top: now.bottom - fresh.bottom, behavior: "auto" });
    else if (now.top < fresh.top) window.scrollBy({ top: now.top - fresh.top, behavior: "auto" });
  });
}

/**
 * Bring one field (or its section) into view, open, and optionally focused.
 * Returns false when there was nothing to show.
 */
export function revealField(target: Element | string | null | undefined, { focus = true }: { focus?: boolean } = {}): boolean {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return false;
  expandAncestors(el);
  afterLayout(() => {
    const { scrollTo, field } = resolveTarget(el);
    expandAncestors(scrollTo);
    keepInView(scrollTo, { block: "center" });
    if (!focus || !field) return;
    // A text field takes focus (and the keyboard). A calendar, a list of times or a
    // slider is only scrolled to: focus there would move it under the customer's finger.
    if (field.matches(TEXT_ENTRY) && document.activeElement !== field) field.focus({ preventScroll: true });
  });
  return true;
}

/** The first field the form has marked as needing attention, in page order. */
export function revealFirstError(root: ParentNode | null | undefined = typeof document === "undefined" ? null : document, options?: { focus?: boolean }): boolean {
  if (!root) return false;
  const first = root.querySelector(INVALID_SELECTOR);
  return revealField(first, options);
}

/**
 * Arriving at /book#your-visits: go to the visit list once it exists, and stay
 * on it while the content above it finishes loading - until the customer
 * scrolls, taps or types themselves, or a few seconds have passed.
 */
export function useHashAnchor(id: string, ready: boolean) {
  useEffect(() => {
    if (!ready || typeof window === "undefined" || window.location.hash !== `#${id}`) return;
    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    const align = () => {
      if (stopped) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: "start", behavior: "auto" });
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, stop, { passive: true, once: true }));
    afterLayout(align);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => align()) : null;
    observer?.observe(document.body);
    const end = window.setTimeout(() => {
      stopped = true;
      observer?.disconnect();
    }, 4000);
    return () => {
      stopped = true;
      observer?.disconnect();
      window.clearTimeout(end);
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, [id, ready]);
}
