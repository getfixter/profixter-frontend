"use client";

/**
 * The homepage for anyone who is not already a member (Website 3.0).
 *
 * The one thing a visitor must understand within five seconds: Profixter is a
 * handyman membership for your home. So the first screen says exactly that,
 * offers the membership first, and puts the free first visit one tap away.
 * Then, in order: the other ways in (One-Time, Full Day), the free-visit
 * booker itself, how membership works, real work, why us, questions.
 *
 * Short text only. Details live behind links and a closed FAQ.
 *
 * THE BOOKER IS UNCHANGED. FreeVisitBooker (same component, same props, same
 * API calls, validation, consent line and Meta/analytics events) only moved
 * down the page and wears the design system through .hm-booker in home.css.
 *
 * Every fact here is already published on the site: plans from $149/month,
 * the free first 90-minute visit for new Nassau and Suffolk customers (one per
 * customer, no card), the $99 One-Time Visit for one small job, Full Day.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import FreeVisitBooker from "@/app/components/booking/FreeVisitBooker";
import GoogleRatingCompact from "@/app/components/home/GoogleRatingCompact";
import WorkStrip from "@/app/components/home/WorkStrip";
import Reveal from "@/app/components/ui/Reveal";
import { trackEvent } from "@/lib/analytics";
import { HOME_FAQ as FAQ } from "@/lib/home-faq";
import { BOOKING_LINKS } from "@/lib/site-architecture";

const STEPS = [
  { title: "Pick a time", body: "Tell us what needs doing. About a minute." },
  { title: "Your Fixter arrives", body: "A local pro, with the tools." },
  { title: "It's done", body: "Up to 90 minutes of work on your list." },
];

const MEMBERSHIP_POINTS = [
  {
    title: "Book as often as you need",
    body: "No monthly visit allowance. Your plan sets how many visits you can have booked at the same time.",
  },
  {
    title: "90 minutes, every visit",
    body: "Mounting, assembly, fixtures, small repairs, patching - the everyday list.",
  },
  {
    title: "The same local team",
    body: "So nobody has to learn your house twice.",
  },
];

const FACTS: Array<[string, string]> = [
  ["Licensed", "Suffolk County HI-71484"],
  ["Insured", "Fully insured"],
  ["Local", "Nassau & Suffolk"],
];

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomeLanding() {
  useEffect(() => {
    trackEvent("landing_viewed", { variant: "membership_first" });
  }, []);

  const plansClick = (placement: string) => () => trackEvent("see_plans_clicked", { placement });

  return (
    <main className="hm">
      {/* ================================ HERO ================================ */}
      <section className="hm-hero" aria-labelledby="hm-title">
        <div className="ui-container hm-hero__grid">
          <div className="ui-media hm-hero__media ui-rise">
            <Image
              src="/images/home/fixter-at-home-tall.webp"
              alt="A Profixter handyman fixing an outlet in a Long Island living room"
              fill
              priority
              sizes="(min-width: 1024px) 520px, 100vw"
              className="hm-hero__img"
            />
          </div>

          <div className="hm-hero__copy">
            <p className="ui-eyebrow ui-rise">Handyman membership &middot; Long Island</p>
            <h1 id="hm-title" className="ui-display hm-hero__title ui-rise" style={{ animationDelay: "60ms" }}>
              Your home. Your handyman. One membership.
            </h1>
            <p className="ui-lede hm-hero__lede ui-rise" style={{ animationDelay: "120ms" }}>
              Reliable handyman visits through one simple monthly membership, from $149/month.
            </p>
            <div className="hm-hero__ctas ui-rise" style={{ animationDelay: "180ms" }}>
              <Link
                href={BOOKING_LINKS.memberships.href}
                className="ui-btn ui-btn--primary ui-btn--lg"
                onClick={plansClick("home_hero")}
              >
                Explore memberships
              </Link>
              <Link
                href="#book"
                className="ui-btn ui-btn--secondary ui-btn--lg"
                onClick={() => trackEvent("free_visit_cta_clicked", { placement: "home_hero" })}
              >
                Book a free visit
              </Link>
            </div>
            <p className="hm-hero__offer ui-rise" style={{ animationDelay: "240ms" }}>
              <span className="ui-tag ui-tag--accent">Free</span>
              <span>First 90-minute visit for new Nassau &amp; Suffolk customers. No card needed.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ============================ WAYS TO START =========================== */}
      <section className="ui-section ui-section--tight hm-ways" aria-labelledby="hm-ways">
        <div className="ui-container">
          <h2 id="hm-ways" className="sr-only">
            Ways to book
          </h2>
          <ul className="hm-ways__list">
            <li>
              <Link href={BOOKING_LINKS.memberships.href} className="hm-way hm-way--lead" onClick={plansClick("home_ways")}>
                <span className="hm-way__name">Membership</span>
                <span className="hm-way__price ui-num">From $149/mo</span>
                <span className="hm-way__desc">Book as often as you need.</span>
                <span className="hm-way__go" aria-hidden="true"><Arrow /></span>
              </Link>
            </li>
            <li>
              <Link href="#book" className="hm-way">
                <span className="hm-way__name">Free first visit</span>
                <span className="hm-way__price">Free</span>
                <span className="hm-way__desc">90 minutes, new customers.</span>
                <span className="hm-way__go" aria-hidden="true"><Arrow /></span>
              </Link>
            </li>
            <li>
              <Link href={BOOKING_LINKS.oneTime.href} className="hm-way">
                <span className="hm-way__name">One-Time Visit</span>
                <span className="hm-way__price ui-num">$99</span>
                <span className="hm-way__desc">One small job, up to 90 minutes.</span>
                <span className="hm-way__go" aria-hidden="true"><Arrow /></span>
              </Link>
            </li>
            <li>
              <Link href={BOOKING_LINKS.fullDay.href} className="hm-way">
                <span className="hm-way__name">Full Day</span>
                <span className="hm-way__price">All day</span>
                <span className="hm-way__desc">One Fixter, your whole list.</span>
                <span className="hm-way__go" aria-hidden="true"><Arrow /></span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* ======================== FREE VISIT + BOOKER ========================= */}
      <section className="ui-section ui-section--soft hm-try" aria-labelledby="hm-try">
        <div className="ui-container hm-try__grid">
          <Reveal className="hm-try__copy">
            <p className="ui-eyebrow ui-eyebrow--accent">First visit free</p>
            <h2 id="hm-try" className="ui-h2">
              Your first 90 minutes are on us.
            </h2>
            <p className="ui-lede">Choose how you&rsquo;d like to book.</p>
            <ol className="hm-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="hm-steps__n ui-num">{i + 1}</span>
                  <span>
                    <b>{s.title}</b>
                    <span>{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>

          <div className="hm-booker">
            <FreeVisitBooker id="book" variant="compact" guest />
          </div>
        </div>
      </section>

      {/* ============================== MEMBERSHIP ============================ */}
      <section className="ui-section hm-member" aria-labelledby="hm-plans">
        <div className="ui-container">
          <Reveal className="ui-head ui-head--row">
            <div>
              <p className="ui-eyebrow">Membership</p>
              <h2 id="hm-plans" className="ui-h2">
                One membership. Every small job.
              </h2>
            </div>
            <Link href="/handyman-membership" className="ui-link">
              How membership works
            </Link>
          </Reveal>

          <ul className="hm-points">
            {MEMBERSHIP_POINTS.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 70} className="hm-point">
                <span className="hm-point__n ui-num">0{i + 1}</span>
                <h3 className="ui-h3">{p.title}</h3>
                <p className="ui-body">{p.body}</p>
              </Reveal>
            ))}
          </ul>

          <Reveal className="hm-member__cta">
            <p className="hm-member__price">
              <span className="ui-num">Plans from $149 a month.</span> Your first visit is free.
            </p>
            <Link href={BOOKING_LINKS.memberships.href} className="ui-btn ui-btn--primary" onClick={plansClick("home_membership")}>
              Explore memberships
            </Link>
          </Reveal>
        </div>
      </section>

      {/* =============================== REAL WORK ============================ */}
      <section className="ui-section ui-section--flush-top hm-realwork" aria-labelledby="hm-work">
        <div className="ui-container">
          <Reveal className="ui-head ui-head--row">
            <div>
              <p className="ui-eyebrow">Real work</p>
              <h2 id="hm-work" className="ui-h2">
                Real homes. Real jobs.
              </h2>
            </div>
            <Link href="/recent-work" className="ui-link">
              See more work
            </Link>
          </Reveal>
        </div>
        <div className="ui-container">
          <WorkStrip />
        </div>
      </section>

      {/* ================================= TRUST ============================== */}
      <section className="ui-section ui-section--soft" aria-labelledby="hm-trust">
        <div className="ui-container hm-trust">
          <Reveal>
            <p className="ui-eyebrow">Who comes to your home</p>
            <h2 id="hm-trust" className="ui-h2">
              A local company, not a marketplace.
            </h2>
            <dl className="hm-facts">
              {FACTS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={80}>
            <GoogleRatingCompact className="hm-rating" />
          </Reveal>
        </div>
      </section>

      {/* ================================== FAQ =============================== */}
      <section className="ui-section" aria-labelledby="hm-faq">
        <div className="ui-container ui-container--narrow">
          <h2 id="hm-faq" className="ui-h2 hm-faq__title">
            Questions
          </h2>
          <div className="ui-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="lx-faq">
                <summary>{item.q}</summary>
                <div className="ui-faq__a">
                  {item.a}
                  {item.link ? (
                    <>
                      {" "}
                      <Link href={item.link.href} className="hm-inline-link">
                        {item.link.label}
                      </Link>
                    </>
                  ) : null}
                </div>
              </details>
            ))}
          </div>

          <div className="hm-after">
            <Link href="/gift" className="hm-after__gift">
              <span>
                <b>Buying for someone else?</b> Give a membership as a gift.
              </span>
              <Arrow />
            </Link>
            <p className="ui-small">
              Something else? Call or text{" "}
              <a href="tel:+16315991363" className="hm-inline-link ui-num">
                631-599-1363
              </a>
              , or read{" "}
              <Link href="/about" className="hm-inline-link">
                about us
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
