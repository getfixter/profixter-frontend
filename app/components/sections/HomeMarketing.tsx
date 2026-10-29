"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import Reveal from "@/app/components/ui/Reveal";
import GoogleRatingCompact from "@/app/components/home/GoogleRatingCompact";
import MembershipMap from "@/app/components/home/MembershipMap";
import WorkStrip from "@/app/components/home/WorkStrip";
import GiftCallout from "@/app/components/gift/GiftCallout";
import { BOOKING_LINKS } from "@/lib/site-architecture";

/**
 * THE HOMEPAGE FOR A MEMBER (Website 3.0).
 *
 * A member is not a prospect: the offer, the plan pitch and the free visit are
 * noise to them. What they come to the homepage for is a way back into the
 * thing they pay for, so the first screen is a short greeting and the four
 * places they actually go. Below it, quietly: the gift (the one product a
 * member is the best person to buy), real work, where members are, and the
 * rating.
 */
const SHORTCUTS = [
  { label: "Book a visit", body: "Your next 90-minute visit.", href: "/book?visit=membership", event: "home_book_visit" },
  { label: "Full Day", body: "One Fixter, your whole list.", href: BOOKING_LINKS.fullDay.href, event: "home_full_day" },
  { label: "Projects", body: "Larger work and estimates.", href: "/projects", event: "home_projects" },
  { label: "Account", body: "Visits, plan and billing.", href: "/account", event: "home_account" },
];

export default function HomeMarketing() {
  const { user } = useAuth();
  const first = user?.name?.trim().split(/\s+/)[0];

  return (
    <main className="hm">
      <section className="hm-welcome" aria-labelledby="hm-welcome">
        <div className="ui-container">
          <p className="ui-eyebrow ui-rise">Your membership</p>
          <h1 id="hm-welcome" className="ui-display hm-welcome__title ui-rise" style={{ animationDelay: "60ms" }}>
            {first ? `Welcome back, ${first}.` : "Welcome back."}
          </h1>
          <p className="ui-lede ui-rise" style={{ animationDelay: "120ms" }}>
            Book your next visit whenever something comes up.
          </p>

          <ul className="hm-shortcuts ui-rise" style={{ animationDelay: "180ms" }}>
            {SHORTCUTS.map((s, i) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className={`hm-shortcut ${i === 0 ? "hm-shortcut--lead" : ""}`}
                  onClick={() => trackEvent(s.event)}
                >
                  <span className="hm-shortcut__label">{s.label}</span>
                  <span className="hm-shortcut__body">{s.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ui-section ui-section--tight" aria-label="Give a membership">
        <div className="ui-container">
          <Reveal>
            <GiftCallout variant="card" audience="member" />
          </Reveal>
        </div>
      </section>

      <section className="ui-section ui-section--tight" aria-labelledby="hm-work">
        <div className="ui-container">
          <Reveal className="ui-head ui-head--row">
            <div>
              <p className="ui-eyebrow">Real work</p>
              <h2 id="hm-work" className="ui-h2">
                This is the everyday kind.
              </h2>
            </div>
            <Link href="/recent-work" className="ui-link">
              See more work
            </Link>
          </Reveal>
        </div>
        <div className="ui-container hm-work-wrap">
          <WorkStrip />
        </div>
      </section>

      {/*
        Self-contained, and deliberately silent about numbers: each pin is a
        home, there is no total anywhere in it, and it renders nothing at all
        when there is nothing to show.
      */}
      <MembershipMap />

      <section className="ui-section ui-section--soft" aria-labelledby="hm-trust">
        <div className="ui-container hm-trust">
          <Reveal>
            <p className="ui-eyebrow">Who comes to your home</p>
            <h2 id="hm-trust" className="ui-h2">
              A local company, not a marketplace.
            </h2>
            <p className="ui-lede">The same team each time, so nobody has to learn your house twice.</p>
          </Reveal>
          <Reveal delay={80}>
            <GoogleRatingCompact className="hm-rating" />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
