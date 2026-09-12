"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMembershipMap, type MembershipMapData } from "@/lib/public-membership-map";
import { ISLAND_PATH, MAP_VIEWBOX } from "./island-geometry";
import { Marker, MarkerDefs } from "./markers";
import { declutter } from "./declutter";

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
 * ONE MARKER, ONE CLAIM.
 *
 * V2 drew four tiers and a legend to explain them. Both are gone: the map exists
 * to say that real homeowners across Long Island keep a Fixter, and which plan
 * each of them pays for is not the public's business. With a single marker there
 * is nothing left to explain, so the legend went with it - which also took a
 * block of vertical space off the phone layout.
 *
 * WHAT IS NEVER SHOWN, AND NEVER COMPUTED
 *
 * No number. Not a total, not a per-town total, not a cluster badge. Visitors
 * read the density off the picture and draw their own conclusion, which is the
 * honest way to make this point. Nothing in this file counts anything.
 *
 * The payload behind it is a list of positions and nothing else - no name,
 * address, ZIP, coordinate, id, or membership tier - so what a curious visitor
 * finds in devtools is exactly what they already see on screen.
 */

/** Stagger between markers appearing, and the cap on the whole entrance. */
const STAGGER_MS = 22;
const MAX_ENTRANCE_MS = 1100;

/**
 * How often an open page re-reads the map.
 *
 * Three minutes is not about freshness - almost nobody sits on the homepage that
 * long - it is so a page left open does not go stale for hours. Paused entirely
 * while the tab is hidden, and resumed with one read when it comes back, so a
 * backgrounded tab costs nothing.
 *
 * The server answers from cache, so this is a conditional-ish read rather than a
 * query. Nothing about it is live-activity theatre: new points fade in where
 * they belong and departed ones fade out, with no message, no counter and no
 * announcement.
 */
const REFRESH_MS = 3 * 60 * 1000;

/**
 * Marker scale for the rendered width.
 *
 * The viewBox is fixed, so without this a pin would shrink with the viewport
 * until a phone showed a field of specks.
 *
 * The curve is tuned so a Basic dot lands near 8.4px on a phone or tablet and
 * about 11px on a desktop card, rather than V1's uniform thirteen to fifteen.
 * Small screens are where crowding hurts, so they keep the tighter figure; a
 * wide card has room for the markers to carry some presence.
 */
function markerScaleFor(width: number): number {
  if (!width) return 1;
  return Math.max(1, 903 / width);
}

type LoadState = "idle" | "ready" | "empty";

export default function MembershipMapSection({ className = "" }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<MembershipMapData | null>(null);
  const [scale, setScale] = useState(1);
  /* The card's drawn width, so pixels can be converted into viewBox units. */
  const [frameWidth, setFrameWidth] = useState(0);
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

  /* ------------------------------------------------------- quiet refresh */
  useEffect(() => {
    if (state !== "ready") return;

    let controller: AbortController | null = null;
    let timer: number | undefined;

    /*
     * A refresh that fails changes nothing.
     *
     * The section is already on screen with good data. An endpoint that blips
     * must not empty it, so a failed re-read is discarded and the next one tries
     * again - unlike the first load, where there is nothing to keep.
     */
    const reread = () => {
      controller?.abort();
      controller = new AbortController();
      fetchMembershipMap(controller.signal)
        .then((payload) => {
          if (controller?.signal.aborted) return;
          if (payload.points.length) setData(payload);
        })
        .catch(() => {});
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        reread();
        schedule();
      }, REFRESH_MS);
    };

    /*
     * Nothing runs while the tab is in the background. A page left open in a
     * tab nobody is looking at should cost the server and the battery nothing;
     * when it comes back, one read catches it up immediately rather than
     * waiting out the rest of the interval.
     */
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        controller?.abort();
      } else {
        reread();
        schedule();
      }
    };

    if (!document.hidden) schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state]);

  /* ------------------------------------------------- responsive pin sizing */
  const measure = useCallback(() => {
    const width = frameRef.current?.clientWidth || 0;
    setScale(markerScaleFor(width));
    setFrameWidth(width);
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

  /*
   * A few pixels of screen-space separation for markers that would otherwise
   * eclipse each other. Purely a rendering treatment - see declutter.ts - and
   * applied here rather than upstream so the published coordinates and the
   * geographic logic stay exactly as the server sent them.
   */
  const drawn = declutter(points, scale, frameWidth / viewBox.width);

  return (
    <section
      className={`bg-[#0B1628] px-5 py-10 sm:px-6 sm:py-14 ${className}`}
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
        /*
          A refresh keeps the markers already on screen and only animates what
          is genuinely new, because the key is the position itself. Nothing is
          torn down and rebuilt, so a quiet update looks like nothing happening.
        */
        @media (prefers-reduced-motion: reduce) {
          .pfm-entered .pfm-pin { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-[1180px]">
        <div className="mb-5 text-center sm:mb-7">
          <h2
            id="membership-map-heading"
            className="text-[26px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[34px]"
          >
            Homes with a Fixter
          </h2>
          {/*
            * Says only what the picture supports.
            *
            * V1 claimed "from the South Shore to the forks", which the real
            * distribution does not back up - there is nothing on the forks.
            */}
          <p className="mx-auto mt-2.5 max-w-[430px] text-[14px] font-semibold leading-relaxed text-white/58 sm:text-[15px]">
            See where homeowners across Long Island have a Fixter.
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

        {/*
          * Edge to edge on a phone.
          *
          * The section's own horizontal padding costs the island 40px of an
          * already narrow screen, and Long Island is a wide shape - every pixel
          * of width is width the map gets. The negative margin cancels the
          * padding below the small breakpoint and hands it back; from sm up the
          * card returns to its rounded, inset form where there is room for it.
          */}
        <div
          ref={frameRef}
          className={`relative -mx-5 overflow-hidden border-y border-white/[0.08] bg-[#081120] sm:mx-0 sm:rounded-[14px] sm:border ${
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

            {drawn.map((point, index) => (
              <g
                /*
                  Keyed by published position, not by array index and not by
                  anything that was removed with the tiers. A refresh therefore
                  reuses every marker that stayed put and only animates the ones
                  that are genuinely new - no flicker, no re-run of the entrance
                  every three minutes.
                */
                key={`${point.x}-${point.y}`}
                className="pfm-pin"
                style={{
                  animationDelay: `${Math.min(index * STAGGER_MS, MAX_ENTRANCE_MS)}ms`,
                }}
              >
                <Marker x={point.dx} y={point.dy} scale={scale} />
              </g>
            ))}
          </svg>
        </div>

        {/*
          * No legend any more, and nothing in its place.
          *
          * Four swatches existed to explain four marker styles. There is one
          * marker now, so a key would be explaining a distinction that no longer
          * exists - and removing it takes roughly ninety pixels off the phone
          * layout, which is most of why the section used to run long.
          *
          * The privacy note stays. It is the one thing the picture cannot say
          * for itself, and it is the reason nobody should read a dot as a
          * doorstep.
          */}
        <p className="mt-4 text-center text-[11.5px] font-semibold text-white/38 sm:mt-5">
          Approximate locations
        </p>
      </div>
    </section>
  );
}
