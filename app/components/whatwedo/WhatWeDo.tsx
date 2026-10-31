"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BeforeAfter from "./BeforeAfter";
import { trackEvent } from "@/lib/analytics";
import { fetchRecentWork, WORK_GROUPS, type PublicWorkPhoto } from "@/lib/public-recent-work";
import "./whatwedo.css";

/**
 * What We Do: small fixes shown as before/after pairs.
 *
 * "home" is a swipeable carousel of up to 24 pairs. "page" (/recent-work) loads
 * every published pair: the same carousel on a phone, a grid from 768px, and it
 * owns the page's H1, so its heading is always rendered - including in the
 * server HTML before the pairs arrive.
 *
 * The pairs are the server's before/after feed only (kind=before_after), never
 * a customer's private booking photo. Many are illustrative examples rather
 * than photographs of specific jobs, and the section says so underneath
 * whenever one is on screen.
 *
 * On the homepage it renders nothing at all if the feed is empty or fails, so
 * there is never an empty or broken section.
 */

type Variant = "home" | "page";

const HOME_LIMIT = 24;
const PAGE_SIZE = 60;
const MAX_PAGES = 5;

const isPair = (photo: PublicWorkPhoto) =>
  photo.kind === "before_after" && Boolean(photo.beforeImageUrl || photo.beforeThumbUrl) && Boolean(photo.imageUrl || photo.thumbUrl);

async function loadPairs(variant: Variant, signal: AbortSignal): Promise<PublicWorkPhoto[]> {
  if (variant === "home") {
    const data = await fetchRecentWork({ kind: "before_after", limit: HOME_LIMIT, signal });
    return (data.photos || []).filter(isPair);
  }
  const all: PublicWorkPhoto[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchRecentWork({ kind: "before_after", limit: PAGE_SIZE, page, signal });
    all.push(...(data.photos || []));
    if (!data.hasMore) break;
  }
  return all.filter(isPair);
}

export default function WhatWeDo({ variant = "home" }: { variant?: Variant }) {
  const [pairs, setPairs] = useState<PublicWorkPhoto[] | null>(null);
  const [group, setGroup] = useState("All");
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const viewedRef = useRef(false);
  const comparedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    loadPairs(variant, controller.signal)
      .then(setPairs)
      .catch(() => {
        if (!controller.signal.aborted) setPairs([]);
      });
    return () => controller.abort();
  }, [variant]);

  /* Groups that actually have a pair, in the server's order; unknown ones last. */
  const groups = useMemo(() => {
    const present = new Set((pairs || []).map((p) => p.group || "Other"));
    const known = WORK_GROUPS.filter((g) => present.has(g));
    const extra = [...present].filter((g) => !(WORK_GROUPS as readonly string[]).includes(g)).sort();
    return [...known, ...extra];
  }, [pairs]);

  const shown = useMemo(
    () => (pairs || []).filter((p) => group === "All" || (p.group || "Other") === group),
    [pairs, group]
  );
  const anyIllustrative = shown.some((p) => p.illustrative);
  const hasPairs = Boolean(pairs && pairs.length);

  /* "what_we_do_viewed", once, when the section is actually on screen. */
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !hasPairs || viewedRef.current || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !viewedRef.current) {
          viewedRef.current = true;
          trackEvent("what_we_do_viewed", { variant, count: pairs?.length || 0 });
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasPairs, pairs, variant]);

  /* Which card is in view, and whether the arrows have anywhere to go. */
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    if (!cards.length) return;
    const left = track.scrollLeft;
    let nearest = 0;
    let best = Infinity;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - cards[0].offsetLeft - left);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    const max = track.scrollWidth - track.clientWidth;
    setAtStart(left <= 2);
    setAtEnd(left >= max - 2);
    setActive(left >= max - 2 && max > 0 ? cards.length - 1 : nearest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    track.scrollTo({ left: 0 });
    measure();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [measure, shown]);

  const step = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    /*
     * offsetWidth, not the bounding rect: scrolling works in layout pixels, and
     * under the site's CSS zoom the rect is the scaled size.
     */
    const layout = card ? card.offsetWidth + gap : track.clientWidth * 0.8;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * layout, behavior: reduce ? "auto" : "smooth" });
  };

  const onCompare = useCallback((id: string) => {
    if (comparedRef.current.has(id)) return;
    comparedRef.current.add(id);
    trackEvent("what_we_do_compare", { id });
  }, []);

  const choose = (next: string) => {
    if (next === group) return;
    setGroup(next);
    trackEvent("what_we_do_filter", { group: next });
  };

  const isPage = variant === "page";
  const headingId = `wwd-title-${variant}`;

  /* Home: no pairs, no section. The page keeps its heading (it owns the H1). */
  if (!isPage && pairs !== null && pairs.length === 0) return null;

  const Heading = isPage ? "h1" : "h2";
  const lede = pairs !== null && pairs.length === 0 ? "Small fixes, done right." : "Small fixes, done right. Drag to compare.";

  return (
    <section
      ref={sectionRef}
      className={`wwd wwd--${variant} ui-section${isPage ? "" : " ui-section--tight"}`}
      aria-labelledby={headingId}
      data-testid="what-we-do"
    >
      <div className="ui-container">
        <div className="wwd-head">
          <div>
            <p className="ui-eyebrow ui-eyebrow--accent">Before &amp; after</p>
            <Heading id={headingId} className={isPage ? "ui-display" : "ui-h2"}>
              What We Do
            </Heading>
            <p className="ui-lede wwd-lede">{lede}</p>
          </div>
          {!isPage && hasPairs ? (
            <Link href="/recent-work" className="ui-link wwd-all">
              See all
            </Link>
          ) : null}
        </div>

        {pairs === null ? (
          <Skeleton page={isPage} />
        ) : hasPairs ? (
          <>
            {groups.length > 1 ? (
              <div className="wwd-chips" role="group" aria-label="Filter by kind of job">
                {["All", ...groups].map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="wwd-chip"
                    aria-pressed={group === name}
                    onClick={() => choose(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="wwd-rail">
              <ul ref={trackRef} className="wwd-track" aria-label="Before and after examples" data-testid="wwd-track">
                {shown.map((pair, index) => (
                  <li key={pair.id} className="wwd-card" data-group={pair.group || "Other"}>
                    <BeforeAfter
                      id={pair.id}
                      title={pair.title || "Handyman fix"}
                      beforeThumb={pair.beforeThumbUrl || ""}
                      beforeImage={pair.beforeImageUrl || pair.beforeThumbUrl || ""}
                      afterThumb={pair.thumbUrl}
                      afterImage={pair.imageUrl || pair.thumbUrl}
                      width={pair.width}
                      height={pair.height}
                      eager={index === 0}
                      onFirstInteraction={onCompare}
                    />
                    <div className="wwd-card__body">
                      <h3 className="wwd-card__title">{pair.title || "Handyman fix"}</h3>
                      {pair.caption ? <p className="wwd-card__caption">{pair.caption}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>

              {shown.length > 1 ? (
                <div className="wwd-nav">
                  <button
                    type="button"
                    className="wwd-arrow"
                    aria-label="Previous example"
                    onClick={() => step(-1)}
                    disabled={atStart}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m15 6-6 6 6 6" />
                    </svg>
                  </button>
                  <span className="wwd-count ui-num" aria-live="polite" data-testid="wwd-count">
                    {Math.min(active + 1, shown.length)} / {shown.length}
                  </span>
                  <button
                    type="button"
                    className="wwd-arrow"
                    aria-label="Next example"
                    onClick={() => step(1)}
                    disabled={atEnd}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>

            {anyIllustrative ? (
              <p className="wwd-note" data-testid="wwd-note">
                Illustrative examples of the kinds of jobs we handle.
              </p>
            ) : null}

            {!isPage ? (
              <div className="wwd-cta">
                <Link href="/book/handyman" className="wwd-cta__link">
                  Book a Handyman
                </Link>
                <Link href="/book/free" className="wwd-cta__link wwd-cta__link--quiet">
                  Free Visit
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Skeleton({ page }: { page: boolean }) {
  return (
    <div className={`wwd-skeleton${page ? " wwd-skeleton--page" : ""}`} aria-hidden="true" data-testid="wwd-skeleton">
      <div className="wwd-chips">
        {[56, 84, 72, 96].map((width) => (
          <span key={width} className="wwd-skel wwd-skel--chip" style={{ width }} />
        ))}
      </div>
      <ul className="wwd-track">
        {Array.from({ length: 3 }).map((_, index) => (
          <li key={index} className="wwd-card">
            <div className="wwd-skel wwd-skel--media" />
            <div className="wwd-card__body">
              <span className="wwd-skel wwd-skel--line" />
              <span className="wwd-skel wwd-skel--line wwd-skel--short" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
