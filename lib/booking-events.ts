"use client";

import { useSyncExternalStore } from "react";

/**
 * "A booking just succeeded on this page" - said by a booker only after the
 * server confirmed it, heard by the page around it (the homepage hides its
 * other ways to book, so the success is the only thing on screen).
 */

export type BookedVisitType = "free_visit" | "handyman" | "full_day";
const EVENT = "pf:booking-succeeded";
const RECENT_KEY = "pf_booked_recently";
const RECENT_MS = 30 * 60 * 1000;

/* A success announced on this page load (not one remembered from before a refresh). */
let announcedThisLoad: BookedVisitType | null = null;

export function announceBookingSucceeded(type: BookedVisitType) {
  announcedThisLoad = type;
  try {
    window.sessionStorage.setItem(RECENT_KEY, JSON.stringify({ type, at: Date.now() }));
  } catch {
    /* private mode: the event below still reaches this page */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { type } }));
  } catch {
    /* never throws */
  }
}

/* A booking succeeded in this tab within the last half hour (a refresh of the success). */
export function bookedRecently(): BookedVisitType | null {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(RECENT_KEY) || "null");
    return v && Date.now() - Number(v.at) < RECENT_MS ? (v.type as BookedVisitType) : null;
  } catch {
    return null;
  }
}

export function onBookingSucceeded(listener: (type: BookedVisitType) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<{ type: BookedVisitType }>).detail?.type);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/*
 * For a page around the bookers: { now, recent } where `now` is a success
 * announced on this page load and `recent` one in this tab in the last half
 * hour (a refresh of it). Server render: neither.
 */
export function useBookingSucceeded(): { now: BookedVisitType | null; recent: BookedVisitType | null } {
  const snap = useSyncExternalStore(
    (onChange) => onBookingSucceeded(onChange),
    () => `${announcedThisLoad || ""}|${bookedRecently() || ""}`,
    () => "|"
  );
  const [now, recent] = snap.split("|");
  return { now: (now || null) as BookedVisitType | null, recent: (recent || null) as BookedVisitType | null };
}
