"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { setStartScreenState } from "@/lib/start-screen";
import StartMenu from "./StartMenu";

/*
 * Runs while the browser is still parsing this element, before anything on the
 * page has painted.
 *
 * It answers one question — does this visitor already have a session? — and
 * writes the answer where CSS can act on it immediately. A member who presses
 * Home gets the site they pay for, with no acquisition screen flashing in front
 * of it for a frame, and the site's fixed bottom tab bar knows to stay out of
 * the way of a hero it would otherwise sit on top of.
 *
 * React cannot do this job. Any client-only branch in the render would either
 * mismatch the server HTML or resolve an effect too late, which is a visible
 * flash either way. Reading one localStorage key during parse is the whole
 * trick, and it fails closed: if storage throws, the visitor is treated as new.
 */
const PRE_PAINT_SESSION_CHECK = `(function(){try{document.documentElement.dataset.pfStart=localStorage.getItem('token')?'off':'covering'}catch(e){document.documentElement.dataset.pfStart='covering'}})();`;

/*
 * The photograph, at its three useful sizes.
 *
 * The source is public/Fixter Background/Back New.png — 1024x1536 and 2.4MB,
 * which is the right thing to keep and the wrong thing to serve. These are
 * derivatives of it; the original is untouched. AVIF first, WebP for Safari
 * versions that predate it, JPEG last for anything else. Nothing is wider than
 * the source's own 1024px, because upscaling in an encoder only ships bytes.
 */
const HERO_BASENAME = "/images/start/home-hero";
const HERO_SRCSET = (extension: string) =>
  [512, 768, 1024].map((width) => `${HERO_BASENAME}-${width}.${extension} ${width}w`).join(", ");

/*
 * Before the paint, not after it.
 *
 * RoleEntryGate unmounts this component to show its spinner while it resolves a
 * session, then mounts it again once it knows. Unmounting clears data-pf-start,
 * so on the way back there is a window where the attribute is missing, the
 * CSS rule that hides the start screen does not match, and a member sees the
 * acquisition screen for a frame or two before the effect re-hides it. Measured
 * at 372ms against a 212ms first paint - late enough to be real.
 *
 * A layout effect runs in the same commit as the DOM insert, so the attribute
 * is back before the browser paints anything. On the server it degrades to
 * useEffect, which never runs there and would otherwise warn; the server case
 * is covered by the inline script above regardless.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function StartScreen() {
  const sectionRef = useRef<HTMLElement>(null);

  useBeforePaint(() => {
    const section = sectionRef.current;
    if (!section) return;

    /*
     * Set again here, because the inline script above only runs on a real
     * document load. Arriving at / from another page is a client-side
     * navigation: React re-renders the script tag, the browser does not execute
     * it, and without this the front door would render with no state at all.
     */
    const hasSession = (() => {
      try {
        return Boolean(window.localStorage.getItem("token"));
      } catch {
        return false;
      }
    })();

    if (hasSession) {
      setStartScreenState("off");
      return () => setStartScreenState(null);
    }

    setStartScreenState("covering");
    trackEvent("start_screen_view", { page: "/" });

    /*
     * "Covering" stops being true the moment the homepage underneath is what
     * the visitor is actually looking at. That is what brings the bottom tab
     * bar and the 3D world back: they belong to the homepage, not to the front
     * door, and the front door is only ever the first screenful.
     */
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStartScreenState(entry.intersectionRatio > 0.5 ? "covering" : "passed");
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
      setStartScreenState(null);
    };
  }, []);

  const scrollToHomepage = () => {
    const section = sectionRef.current;
    if (!section) return;
    trackEvent("start_screen_scroll_explore", { page: "/" });
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: section.getBoundingClientRect().bottom + window.scrollY,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section ref={sectionRef} className="start-screen" aria-label="Profixter">
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SESSION_CHECK }} />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${HERO_BASENAME}-ambient.webp`}
        alt=""
        aria-hidden="true"
        className="start-screen__ambient"
        decoding="async"
      />
      <div className="start-screen__vignette" aria-hidden="true" />

      <div className="start-screen__frame">
        <picture>
          <source type="image/avif" srcSet={HERO_SRCSET("avif")} sizes="100vw" />
          <source type="image/webp" srcSet={HERO_SRCSET("webp")} sizes="100vw" />
          <img
            src={`${HERO_BASENAME}-1024.jpg`}
            alt="Two Profixter handymen at work in a family home, one replacing a ceiling light from a ladder and one fitting a wall outlet, with the family dog watching"
            className="start-screen__photo"
            width={1024}
            height={1536}
            fetchPriority="high"
            decoding="async"
          />
        </picture>

        {/* Inside the frame, so it fades out on the frame's own edge and leaves
            the blurred margins the colour of the room. */}
        <div className="start-screen__scrim" aria-hidden="true" />
      </div>

      <div className="start-screen__content">
        <div className="start-screen__bar">
          <Link href="/" aria-label="Profixter home" className="start-screen__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-footer.svg" alt="Profixter" width={113} height={24} />
          </Link>

          <StartMenu />
        </div>

        <div className="start-screen__middle">
          {/*
            The whole proposition, in four words. Nothing sits above it and
            nothing explains it underneath: a visitor who reads this knows what
            Profixter is, and the next thing they need is the button.
          */}
          <h1 className="start-screen__headline">
            Monthly handyman
            <span>for your home.</span>
          </h1>

          <Link
            href="/signup?source=start-screen"
            className="start-screen__cta"
            onClick={() => trackEvent("start_screen_get_started", { placement: "hero" })}
          >
            Get Started
            <svg width="19" height="14" viewBox="0 0 19 14" aria-hidden="true">
              <path
                d="M1 7h16m0 0l-5.6-5.6M17 7l-5.6 5.6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </Link>
        </div>

        {/*
          A button, not a link to another page. There is no other page: the
          homepage is already in this document, directly underneath, so this
          does exactly what swiping down does.
        */}
        <button type="button" onClick={scrollToHomepage} className="start-screen__scroll">
          <i>
            <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
              <path
                d="M1 1l7 7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </i>
          <span>Scroll to explore</span>
        </button>
      </div>
    </section>
  );
}
