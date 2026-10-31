"use client";

/**
 * The homepage for anyone who is not already a member (Website 3.0).
 *
 * Customer Experience 4.0 (2026-10-30): the first screen on a phone shows the
 * brand, one line about what Profixter is, and the two ways to start - Free
 * Visit (we come and go over your to-do list; no labor) and Book a Handyman
 * (get the work done). Both are reachable without scrolling. Then: What's
 * Included (before/after, moved up in Customer Experience 4.2), what each path
 * is, membership, trust, questions.
 *
 * Short text only. Details live behind links and a closed FAQ. There is no
 * booking form on this page: each path has its own focused page
 * (/book/free, /book/handyman), so nothing here competes with them.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { HomeExtras, MemberPromo } from "./HomePersonal";
import GoogleRatingCompact from "@/app/components/home/GoogleRatingCompact";
import WhatWeDo from "@/app/components/whatwedo/WhatWeDo";
import Reveal from "@/app/components/ui/Reveal";
import { trackEvent } from "@/lib/analytics";
import { HOME_FAQ as FAQ } from "@/lib/home-faq";
import { BOOKING_LINKS } from "@/lib/site-architecture";

const FREE_VISIT_POINTS = [
  "We come to your home and go over your to-do list",
  "We explain what we handle and which service fits",
  "Free, no account needed. Repairs aren't part of this visit",
];
const HANDYMAN_STEPS = [
  { title: "Describe the job", body: "A few words, a photo if you have one." },
  { title: "Pick a time", body: "Real open times on our calendar." },
  { title: "Choose how to book", body: "A One-Time Visit or a membership." },
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

export default function HomeLanding({ signedIn = false }: { signedIn?: boolean }) {
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
            <p className="ui-eyebrow ui-rise">Handyman services &middot; Long Island</p>
            <h1 id="hm-title" className="ui-display hm-hero__title ui-rise" style={{ animationDelay: "60ms" }}>
              Your home. Your handyman.
            </h1>
            <p className="ui-lede hm-hero__lede ui-rise" style={{ animationDelay: "120ms" }}>
              Local Fixters for the small jobs around your house. Nassau &amp; Suffolk.
            </p>
            <div className="hm-choices ui-rise" style={{ animationDelay: "180ms" }} data-hero-choices>
              <Link
                href="/book/free"
                className="hm-choice"
                data-hero-cta="free-visit"
                onClick={() => trackEvent("free_visit_cta_clicked", { placement: "home_hero" })}
              >
                <span className="hm-choice__name">Free Visit</span>
                <span className="hm-choice__desc">We&rsquo;ll look at your to-do list</span>
                <span className="hm-choice__go" aria-hidden="true"><Arrow /></span>
              </Link>
              <Link
                href="/book/handyman"
                className="hm-choice hm-choice--primary"
                data-hero-cta="book-handyman"
                onClick={() => trackEvent("book_handyman_clicked", { placement: "home_hero" })}
              >
                <span className="hm-choice__name">Book a Handyman</span>
                <span className="hm-choice__desc">Get the work done</span>
                <span className="hm-choice__go" aria-hidden="true"><Arrow /></span>
              </Link>
            </div>
            <p className="hm-hero__offer ui-rise" style={{ animationDelay: "240ms" }}>
              <span>
                Memberships from $149/month.{" "}
                <Link href={BOOKING_LINKS.memberships.href} className="hm-inline-link" onClick={plansClick("home_hero")}>
                  Explore plans
                </Link>
              </span>
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
              <Link href="/book/free" className="hm-way">
                <span className="hm-way__name">Free Visit</span>
                <span className="hm-way__price">Free</span>
                <span className="hm-way__desc">We go over your to-do list.</span>
                <span className="hm-way__go" aria-hidden="true"><Arrow /></span>
              </Link>
            </li>
            <li>
              <Link href="/book/handyman" className="hm-way">
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

      {/* =========================== WHAT'S INCLUDED ========================== */}
      {/* Customer Experience 4.2: the before/after work, right before the choice it informs. */}
      <WhatWeDo variant="home" cta={false} />

      {/* ============================ TWO WAYS IN ============================ */}
      {/* id="book": older links to /#book land here, on the two ways to start. */}
      <section id="book" className="ui-section ui-section--soft hm-paths" aria-labelledby="hm-paths">
        <div className="ui-container">
          <Reveal className="ui-head">
            <p className="ui-eyebrow ui-eyebrow--accent">Two ways to start</p>
            <h2 id="hm-paths" className="ui-h2">
              Not sure yet, or ready to go?
            </h2>
          </Reveal>
          <div className="hm-paths__grid">
            <Reveal className="hm-path">
              <h3 className="ui-h3">Free Visit</h3>
              <p className="ui-body">Let&rsquo;s take a look at your to-do list together.</p>
              <ul className="ui-checks">
                {FREE_VISIT_POINTS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href="/book/free" className="ui-btn ui-btn--secondary" onClick={() => trackEvent("free_visit_cta_clicked", { placement: "home_paths" })}>
                Book a Free Visit
              </Link>
            </Reveal>
            <Reveal className="hm-path hm-path--primary" delay={70}>
              <h3 className="ui-h3">Book a Handyman</h3>
              <p className="ui-body">Ready to get it done? Book a Fixter in about a minute.</p>
              <ol className="hm-steps">
                {HANDYMAN_STEPS.map((step, i) => (
                  <li key={step.title}>
                    <span className="hm-steps__n ui-num">{i + 1}</span>
                    <span>
                      <b>{step.title}</b>
                      <span>{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Link href="/book/handyman" className="ui-btn ui-btn--primary" onClick={() => trackEvent("book_handyman_clicked", { placement: "home_paths" })}>
                Book a Handyman
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Signed in without a membership: one compact invitation, then the other services. */}
      {signedIn ? <MemberPromo /> : null}
      {signedIn ? <HomeExtras /> : null}

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
              <span className="ui-num">Plans from $149 a month.</span> Not sure yet? Start with a Free Visit.
            </p>
            <Link href={BOOKING_LINKS.memberships.href} className="ui-btn ui-btn--primary" onClick={plansClick("home_membership")}>
              Explore memberships
            </Link>
          </Reveal>
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
