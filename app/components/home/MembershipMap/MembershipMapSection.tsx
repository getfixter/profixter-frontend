"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMembershipMap,
  type MembershipMapData,
  type MembershipPlan,
} from "@/lib/public-membership-map";
import { ISLAND_PATH, MAP_VIEWBOX } from "./island-geometry";
import { LegendMarker, Marker, MarkerDefs, PLAN_LABEL, PLAN_ORDER } from "./markers";

/**
 * Where ProFixter members are, drawn rather than counted.
 *
 * A PICTURE, NOT A MAP CONTROL.
 *
 * There is no map SDK here and that is the design, not a saving. A locked
 * visualisation needs a shape and some dots; loading a tile engine to draw them
 * would cost a couple of hundred kilobytes on the homepage and then spend the
 * rest of its life having its features turned off one by one. An inline SVG
 * cannot be zoomed, panned, rotated, re-typed or opened in Google Maps because
 * none of those things exist in it - the absence is structural, not a setting
 * somebody could flip back.
 *
 * WHAT IS NEVER SHOWN, AND NEVER COMPUTED
 *
 * No number. Not a total, not a per-plan total, not a per-town total, not a
 * cluster badge. Visitors read the density off the picture and draw their own
 * conclusion, which is the honest way to make this point. Nothing in this file
 * counts anything for display.
 *
 * The payload behind it carries a position and a plan word per membership and
 * nothing else - no name, address, ZIP, coordinate or id - so what a curious
 * visitor finds in devtools is what they already see on screen.
 */

/** Stagger between markers appearing, and the cap on the whole entrance. */
const STAGGER_MS = 22;
const MAX_ENTRANCE_MS = 1100;

/**
 * Marker scale for the rendered width.
 *
 * The viewBox is fixed, so without this a pin would shrink with the viewport
 * until a phone showed a field of specks. The curve holds a Basic marker at
 * roughly twelve to fourteen screen pixels from 390px to 1440px.
 */
function markerScaleFor(width: number): number {
  if (!width) return 1;
  return Math.max(1, 900 / width);
}

type LoadState = "idle" | "ready" | "empty";

export default function MembershipMapSection({ className = "" }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<MembershipMapData | null>(null);
  const [scale, setScale] = useState(1);
  const [entered, setEntered] = useState(false);

  /*
   * No observer here, on purpose.
   *
   * This component is code-split behind a sentinel and is only mounted once the
   * wrapper has seen it approach, so by the time this runs the answer is
   * already yes. A second observer would re-ask a question that has been
   * answered and schedule a render to agree with itself.
   */

  /* ------------------------------------------------------------ the feed */
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    /*
     * Guarded by a ref rather than by reading `state`.
     *
     * With `state` in the dependency array this effect re-runs the moment it
     * sets "loading", and the cleanup from the first run aborts the request it
     * had just started - leaving the section mounted, empty, forever. The ref
     * is not reactive, so the fetch happens exactly once per mount.
     */
    requested.current = true;
    const controller = new AbortController();
    /*
     * No "loading" transition. It renders identically to "idle" - an empty
     * frame - so setting it would buy a wasted render and a lint error for a
     * state nobody can see.
     */
    fetchMembershipMap(controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData(payload);
        setState(payload.points.length ? "ready" : "empty");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        /*
         * A failed decoration renders nothing. There is no error state on a
         * marketing page and no "0 memberships" - an unavailable feed and a
         * genuinely empty map both simply take the section away.
         */
        setState("empty");
      });

    return () => controller.abort();
  }, []);

  /* ------------------------------------------------- responsive pin sizing */
  const measure = useCallback(() => {
    const width = frameRef.current?.clientWidth || 0;
    setScale(markerScaleFor(width));
  }, []);

  useEffect(() => {
    if (state !== "ready") return;
    /*
     * ResizeObserver delivers the current size as soon as it starts observing,
     * so it supplies the first measurement too - calling measure() here as well
     * would set state synchronously inside the effect to compute a number the
     * observer is about to deliver anyway.
     */
    if (typeof ResizeObserver === "undefined") {
      const frame = requestAnimationFrame(measure);
      window.addEventListener("resize", measure);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", measure);
      };
    }
    const observer = new ResizeObserver(measure);
    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [state, measure]);

  /* Markers settle in once, then the map is calm. No perpetual pulsing. */
  useEffect(() => {
    if (state !== "ready") return;
    const timer = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "empty" || (state === "ready" && !data?.points.length)) return null;

  const viewBox = data?.viewBox || MAP_VIEWBOX;
  const points = data?.points || [];

  return (
    <section
      className={`bg-[#0B1628] px-5 py-14 sm:px-6 sm:py-18 ${className}`}
      aria-labelledby="membership-map-heading"
    >
      <style>{`
        @keyframes pfm-pin-in {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        .pfm-pin {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
        }
        .pfm-entered .pfm-pin {
          animation: pfm-pin-in 460ms cubic-bezier(0.34, 1.36, 0.64, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .pfm-entered .pfm-pin { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 text-center sm:mb-8">
          <h2
            id="membership-map-heading"
            className="text-[26px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[34px]"
          >
            Homes with a Fixter
          </h2>
          <p className="mx-auto mt-2.5 max-w-[520px] text-[14px] font-semibold leading-relaxed text-white/58 sm:text-[15px]">
            Long Island homeowners keeping a Fixter on their side &mdash; from the South
            Shore to the forks.
          </p>
        </div>

        {/*
          * One shared <defs> for the map and the legend.
          *
          * Gradient ids have to be unique in a document, so they are declared
          * once here and referenced by every marker on the page rather than
          * redeclared inside each little legend swatch.
          */}
        <svg width="0" height="0" aria-hidden="true" className="absolute">
          <MarkerDefs />
        </svg>

        <div
          ref={frameRef}
          className={`relative overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#081120] ${
            entered ? "pfm-entered" : ""
          }`}
        >
          <svg
            viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Approximate areas across Long Island where Profixter currently serves active membership customers. Marker styles represent Basic, Plus, Premium and Elite membership levels."
          >
            {/*
              * The service area itself, drawn from the ZIP areas ProFixter
              * covers rather than from a generic outline of Long Island.
              */}
            <path
              d={ISLAND_PATH}
              fill="#16304F"
              stroke="#16304F"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
            <path
              d={ISLAND_PATH}
              fill="none"
              stroke="#2E5C8F"
              strokeOpacity="0.5"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />

            {points.map((point, index) => (
              <g
                key={`${point.plan}-${point.x}-${point.y}-${index}`}
                className="pfm-pin"
                style={{
                  animationDelay: `${Math.min(index * STAGGER_MS, MAX_ENTRANCE_MS)}ms`,
                }}
              >
                <Marker plan={point.plan} x={point.x} y={point.y} scale={scale} />
              </g>
            ))}
          </svg>
        </div>

        {/* ------------------------------- legend ------------------------------- */}
        <div className="mt-5 flex flex-col items-center gap-3 sm:mt-6">
          {/*
            * Two-by-two on a phone, one row from small tablets up.
            *
            * Left to wrap, four items break three-and-one and the odd tier out
            * reads as an afterthought. A grid keeps the tiers balanced and the
            * progression legible at any width.
            */}
          <ul className="grid grid-cols-2 justify-items-start gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-7 sm:gap-y-2.5">
            {PLAN_ORDER.map((plan: MembershipPlan) => (
              <li key={plan} className="flex items-center gap-2">
                <LegendMarker plan={plan} />
                <span className="text-[13px] font-bold text-white/78 sm:text-sm">
                  {PLAN_LABEL[plan]}
                </span>
              </li>
            ))}
          </ul>
          {/*
            * Says the pins are areas, once, quietly. Enough that nobody reads
            * a dot as a doorstep, short enough not to become a disclaimer.
            */}
          <p className="text-[11.5px] font-semibold text-white/38">
            Approximate areas shown &middot; membership levels
          </p>
        </div>
      </div>
    </section>
  );
}
