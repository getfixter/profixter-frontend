"use client";

/**
 * The homepage's booking panel (2026-11-03): the two real booking forms,
 * already open under the headline, behind a two-tab switch.
 *
 * Nothing here books anything. Each tab is the standalone page's own component
 * (booking4/FreeVisitForm, booking4/HandymanBooker) in its `embedded` mode, so
 * /book/free, /book/handyman and this panel can never drift apart: the same
 * calendar, the same draft storage, the same server calls.
 *
 * - Book a Handyman is on the left and open first (owner, 2026-11-20); Free
 *   Visit is on the right and mounts the first time it is chosen (so a
 *   homepage view is not counted as a Free Visit view). Both stay mounted after
 *   that: switching back and forth keeps what was typed. A Free Visit just
 *   requested (its 30-minute success) still opens on Free Visit.
 * - While the welcome entry covers the homepage (lib/welcome-entry), Book a
 *   Handyman is not mounted: it shares the welcome flow's draft and would
 *   otherwise hold a time behind it. It mounts the moment the homepage shows.
 * - A sideways swipe switches tabs. It never starts on a field, the confirmation
 *   sheet, or anything that scrolls sideways itself (the day strip, the job
 *   shortcuts), and it only counts when it is clearly sideways - so vertical
 *   scrolling, typing and picking a time behave exactly as before.
 * - "I Need a Handyman Instead" on the Free Visit sheet saves the draft as it
 *   always has, then opens this panel's other tab on it instead of a new page.
 */

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import FreeVisitForm from "@/app/components/booking4/FreeVisitForm";
import HandymanBooker from "@/app/components/booking4/HandymanBooker";
import { trackEvent } from "@/lib/analytics";
import { useBookingSucceeded } from "@/lib/booking-events";
import { welcomeShowing } from "@/lib/welcome-entry";

type Tab = "free" | "handyman";
const TABS: Array<{ key: Tab; name: string; hint: string }> = [
  { key: "handyman", name: "Book a Handyman", hint: "Get the work done" },
  { key: "free", name: "Free Visit", hint: "We look at your to-do list" },
];

/* Is the welcome entry covering the homepage? (the attribute chooseHomepage removes) */
const subscribeWelcome = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pf-welcome"] });
  return () => observer.disconnect();
};

/* A touch that starts here belongs to the control, not to the tab swipe. */
const NO_SWIPE = "input, textarea, select, [contenteditable='true'], [role='dialog'], .bk-sheet-backdrop, .pac-container";
function scrollsSideways(target: Element | null, stop: Element) {
  for (let el = target; el && el !== stop; el = el.parentElement) {
    const x = getComputedStyle(el).overflowX;
    if ((x === "auto" || x === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

export default function HomeBookingPanel() {
  const [tab, setTab] = useState<Tab>("handyman");
  const [freeOpened, setFreeOpened] = useState(false);
  // On the server (and before the pre-paint decision is read) assume covered: nothing mounts that the welcome flow should own.
  const covered = useSyncExternalStore(subscribeWelcome, welcomeShowing, () => true);
  /* Bumped when the Free Visit hands over its draft: the booker reloads it. */
  const [handover, setHandover] = useState(0);
  const [enter, setEnter] = useState<"left" | "right" | "">("");
  const rootRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  /*
   * A booking just succeeded here: its confirmation stays alone on screen - no
   * tab offering another way to book beside it. A refreshed Free Visit
   * success (FreeVisitForm keeps it for 30 minutes) counts too.
   */
  const success = useBookingSucceeded();
  const booked = Boolean(success.now || success.recent === "free_visit");
  /* A Free Visit requested in the last 30 minutes: its confirmation is on the Free Visit tab. */
  useEffect(() => {
    if (success.recent !== "free_visit") return;
    setFreeOpened(true);
    setTab("free");
  }, [success.recent]);

  const choose = (next: Tab, via: "tap" | "swipe" | "key" | "handover") => {
    if (next === tab) return;
    // Book a Handyman is on the left now: Free Visit comes in from the right.
    setEnter(next === "free" ? "right" : "left");
    if (next === "free") setFreeOpened(true);
    setTab(next);
    trackEvent("home_booking_tab_selected", { tab: next, via });
  };

  const onNeedHandyman = () => {
    setHandover((n) => n + 1);
    choose("handyman", "handover");
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as Element;
    if (e.touches.length !== 1 || target.closest(NO_SWIPE) || scrollsSideways(target, e.currentTarget)) {
      touch.current = null;
      return;
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || e.changedTouches.length !== 1 || booked) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - start.t > 900) return;
    choose(dx < 0 ? "free" : "handyman", "swipe");
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = e.key === "ArrowRight" ? "free" : "handyman";
    choose(next, "key");
    document.getElementById(`hb-tab-${next}`)?.focus();
  };

  return (
    <div className="hb" ref={rootRef} data-home-booking data-tab={tab} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => (touch.current = null)}>
      <div className="hb-tabs" role="tablist" aria-label="How would you like to start?" onKeyDown={onTabKey} hidden={booked}>
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`hb-tab-${t.key}`}
            type="button"
            role="tab"
            className="hb-tab"
            aria-selected={tab === t.key}
            aria-controls={`hb-pane-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            data-home-tab={t.key}
            onClick={() => choose(t.key, "tap")}
          >
            <span className="hb-tab__name">{t.name}</span>
            <span className="hb-tab__hint">{t.hint}</span>
          </button>
        ))}
      </div>

      <div id="hb-pane-handyman" role="tabpanel" aria-labelledby="hb-tab-handyman" className="hb-pane" data-active={tab === "handyman" ? "1" : "0"} data-enter={tab === "handyman" ? enter : ""}>
        {covered ? (
          <div style={{ minHeight: 320 }} />
        ) : (
          <Suspense fallback={<div style={{ minHeight: 320 }} />}>
            <HandymanBooker key={handover} embedded fromFreeVisit={handover > 0} />
          </Suspense>
        )}
      </div>
      <div id="hb-pane-free" role="tabpanel" aria-labelledby="hb-tab-free" className="hb-pane" data-active={tab === "free" ? "1" : "0"} data-enter={tab === "free" ? enter : ""}>
        {freeOpened ? <FreeVisitForm embedded onNeedHandyman={onNeedHandyman} /> : null}
      </div>
    </div>
  );
}
