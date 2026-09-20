"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";
import { trackEvent } from "@/lib/analytics";
import Reveal from "@/app/components/ui/Reveal";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";
import GoogleRatingCompact from "@/app/components/home/GoogleRatingCompact";
import MembershipMap from "@/app/components/home/MembershipMap";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/** The homeowner's own voice, not a service directory. */
const THE_LIST = [
  "A door that doesn't close right",
  "The TV still waiting to go up",
  "Caulk around the tub gone grey",
  "A cabinet handle working loose",
  "The shelf still in its box",
  "A drywall ding you stopped seeing",
  "Trim cracked since the spring",
  "A light fixture you meant to swap",
  "A closet door off its track",
  "A faucet you can hear at night",
];

const STEPS = [
  { n: "01", title: "Book it" },
  { n: "02", title: "We come" },
  { n: "03", title: "It's done" },
];

const FACTS: Array<[string, string]> = [
  ["Licensed", "NY HIC HI-71484"],
  ["Insured", "For in-home work"],
  ["Serving", "Nassau & Suffolk"],
];

/**
 * One drifting row of the list.
 *
 * The content is rendered twice and the animation travels exactly -50%, which
 * is what makes the loop seamless: the second copy is under the cursor at the
 * moment the first one runs out. The clone is aria-hidden and marked for the
 * reduced-motion rule to remove, so a screen reader hears the ten phrases once
 * and somebody who has asked for stillness reads them once.
 */
function MarqueeRow({ items, variant }: { items: string[]; variant: "a" | "b" }) {
  return (
    <div className={`home-marquee__row home-marquee__row--${variant}`}>
      {items.map((t) => (
        <span key={t} className="home-chip">
          {t}
        </span>
      ))}
      {items.map((t) => (
        <span key={`clone-${t}`} className="home-chip" data-clone="1" aria-hidden="true">
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * THE HOMEPAGE, AFTER THE START SCREEN.
 *
 * The start screen already said what ProFixter is and offered the one action.
 * By the time somebody arrives here they have chosen to scroll instead, which
 * means they are not asking "what is this" - they are asking "is this for me,
 * and are you any good". This page answers those two, and then gets out of the
 * way.
 *
 * It is deliberately almost unreadable in the sense that there is almost
 * nothing to read: a strip of the ten things wrong with everybody's house,
 * photographs of real finished work, three words for the process, a map of
 * where members actually are, one rating that is not us talking, and a way in.
 *
 * WHAT WAS HERE BEFORE: twelve sections, 772 words, eleven mobile screens - as
 * long as the About page. A membership pitch with plan cards, a mock booking
 * interface, a lead-capture form competing with the primary action, a second
 * business line, and the free-visit offer stated three times in one scroll. All
 * of it is still on the site; none of it is on this page. Membership detail
 * lives on /membership, the company story and the trust detail on /about, and
 * larger work on /projects.
 */
export default function HomeMarketing() {
  const { user } = useAuth();
  const isMember = hasActiveMembership(user);

  return (
    <div className="relative z-20 bg-white">
      {/* ==================== THERE'S ALWAYS SOMETHING ==================== */}
      {/*
        The first thing after the start screen, and the one that has to earn the
        scroll. Not a headline about home maintenance - the actual sentence
        somebody would use about their own hallway.
      */}
      <section className="mk-beat" aria-labelledby="home-recognition">
        <div className="mk-wrap">
          <Reveal>
            <p className="mk-eyebrow">The list</p>
            <h2 id="home-recognition" className="mk-h2">
              There&rsquo;s always something.
            </h2>
          </Reveal>
        </div>

        <div className="home-marquee mt-8 sm:mt-10" aria-label="Jobs a membership covers">
          <MarqueeRow items={THE_LIST} variant="a" />
          <MarqueeRow items={[...THE_LIST].reverse()} variant="b" />
        </div>
      </section>

      {/* ========================== REAL WORK ============================ */}
      {/*
        The strongest asset on the site and the cheapest to read: real finished
        jobs in real houses. One line above it, because the pictures are the
        argument and a paragraph would only be describing them.
      */}
      <section className="mk-beat pt-0" aria-labelledby="home-work">
        <div className="mk-wrap">
          <Reveal>
            <p className="mk-eyebrow">Real work</p>
            <h2 id="home-work" className="mk-h2">
              This is the everyday kind.
            </h2>
          </Reveal>
        </div>
        <div className="mt-8 sm:mt-10">
          <RecentWorkSection variant="preview" showHeading={false} />
        </div>
      </section>

      {/* ========================= HOW IT WORKS ========================== */}
      <section id="how-it-works" className="mk-beat scroll-mt-2 bg-[#F6F8FC]" aria-labelledby="home-how">
        <div className="mk-wrap">
          <Reveal>
            <p className="mk-eyebrow">How it works</p>
            <h2 id="home-how" className="mk-h2">
              Book it. We come. It&rsquo;s done.
            </h2>
          </Reveal>

          {/*
            Three words each, and no paragraph under them.

            This used to be three steps with a sentence apiece and a full mock
            booking interface underneath - a picture of a calendar, a time
            picker and a photo upload, on a page whose job is not to demonstrate
            the booking screen. /book does that, for real.
          */}
          <Reveal delay={60}>
            <ol className="home-steps">
              {STEPS.map((s) => (
                <li key={s.n} className="home-step">
                  <span className="home-step__n">{s.n}</span>
                  <h3 className="home-step__t">{s.title}</h3>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={90}>
            <p className="home-price">
              <span>
                <b>From $149 a month.</b> Your first visit is free.
              </span>
              <Link href="/membership" onClick={() => trackEvent("home_membership_link")}>
                See what&rsquo;s included
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ======================= WHERE MEMBERS ARE ======================= */}
      {/*
        Self-contained, and deliberately silent about numbers: each pin is a
        home, there is no total anywhere in it, and it renders nothing at all
        when there is nothing to show. Moved, not changed.
      */}
      <MembershipMap />

      {/* ============================ PROOF ============================= */}
      <section className="mk-beat" aria-labelledby="home-proof">
        <div className="mk-wrap">
          <div className="home-proof">
            <div>
              <Reveal>
                <p className="mk-eyebrow">Who comes to your home</p>
                <h2 id="home-proof" className="mk-h2">
                  A local company, not a marketplace.
                </h2>
                <p className="mk-lede">
                  The same team each time, so nobody has to learn your house twice.
                </p>
              </Reveal>

              <Reveal delay={60}>
                <dl className="home-facts mt-7">
                  {FACTS.map(([k, v]) => (
                    <div key={k} className="home-fact">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>

            {/*
              The one thing on this page that is not us talking. It fetches its
              own reviews and renders nothing at all if Google returns none,
              because a rating with nothing behind it is a fabricated claim on
              the one beat whose whole job is credibility.
            */}
            <Reveal delay={90}>
              <GoogleRatingCompact />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================ CLOSE ============================= */}
      <section className="home-close" aria-labelledby="home-close">
        <div className="mk-wrap">
          <Reveal>
            <h2 id="home-close" className="mk-h2">
              Start with whatever&rsquo;s been waiting longest.
            </h2>
            <p className="mk-lede">
              {isMember
                ? "Book your next visit whenever something comes up."
                : "Your first 90-minute visit is free. No card required."}
            </p>

            <Link
              href={isMember ? "/book?visit=membership" : "/signup?source=home"}
              className="home-cta"
              onClick={() => trackEvent(isMember ? "home_book_visit" : "home_get_started")}
            >
              {isMember ? "Book a visit" : "Get Started"}
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

            <p className="home-quiet">
              <Link href="/membership">Membership</Link>
              <Link href="/about">About us</Link>
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
