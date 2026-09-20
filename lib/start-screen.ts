"use client";

import { useSyncExternalStore } from "react";

/**
 * Is the logged-out start screen currently covering the viewport?
 *
 * The signal lives on `<html data-pf-start>` rather than in React state, and
 * that is deliberate. It is written twice: once by a synchronous inline script
 * inside the start screen's own markup, which runs while the browser is still
 * parsing the document, and after that by the start screen's scroll observer.
 *
 * Writing it to the DOM first is what makes it usable before the first paint.
 * Two things on this page have to decide what to do *immediately* or they are
 * visibly wrong: the fixed bottom tab bar, which would otherwise flash across
 * the hero for a frame, and the 3D marketing world, which must not start
 * downloading three.js and a five megabyte character while the hero is still
 * loading. CSS can read an attribute during layout; it cannot read useState.
 *
 * Values:
 *   "covering" - the start screen is on screen and is the whole experience
 *   "passed"   - the visitor has scrolled down into the real homepage
 *   "off"      - there is a session, so the start screen never renders at all
 *   (absent)   - not on the homepage
 */
export type StartScreenState = "covering" | "passed" | "off";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setStartScreenState(state: StartScreenState | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const current = root.dataset.pfStart;
  const next = state ?? undefined;
  if (current === next) return;
  if (next === undefined) delete root.dataset.pfStart;
  else root.dataset.pfStart = next;
  notify();
}

export function getStartScreenState(): StartScreenState | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.pfStart;
  return value === "covering" || value === "passed" || value === "off" ? value : null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/*
 * A boolean rather than the raw state, so useSyncExternalStore compares by
 * value and never re-renders on a change that does not matter to the caller.
 */
function getSnapshot() {
  return getStartScreenState() === "covering";
}

function getServerSnapshot() {
  return false;
}

export function useStartScreenCovering() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
