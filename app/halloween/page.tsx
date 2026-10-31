"use client";

/**
 * Halloween 2026: 20% off the first payment on any membership plan.
 *
 * Where the campaign email and SMS land. This page starts nothing: it explains
 * the offer, remembers the campaign for the tab, and sends the customer to the
 * plans page, where - once they are signed in - the server opens their ten
 * minutes (lib/welcome-offer). So a link preview, or a message read days later,
 * never runs a timer down; the offer itself runs until the campaign's end date.
 *
 * Prices are the live plan prices (lib/stripe-links PLAN_DETAILS, which mirror
 * Stripe: annual is ten months' price). The server prices the checkout itself.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { PLAN_DETAILS } from "@/lib/stripe-links";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import { HALLOWEEN_CAMPAIGN, formatCents, rememberCampaign } from "@/lib/welcome-offer";
import { buttonClass } from "@/app/components/ui/Button";

// Through Monday, November 2, 2026, 11:59 PM New York time (the server enforces the same date).
const CAMPAIGN_ENDS = Date.parse("2026-11-03T04:59:59Z");
const PLANS_URL = "/membership/plans?offer=halloween";
const first = (cents: number) => Math.round(cents * 0.8);

export default function HalloweenPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const channel = new URLSearchParams(window.location.search).get("c") || "direct";
    const over = Date.now() > CAMPAIGN_ENDS;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read in the browser, after mount
    setEnded(over);
    if (!over) rememberCampaign(HALLOWEEN_CAMPAIGN);
    trackEvent("halloween_offer_viewed", { channel, ended: over });
  }, []);

  const claim = () => {
    rememberCampaign(HALLOWEEN_CAMPAIGN);
    trackEvent("halloween_offer_claim_clicked", { signed_in: isAuthenticated });
    router.push(PLANS_URL);
  };

  return (
    <div className="pg-flow min-h-screen overflow-x-clip bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main>
        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container ui-container--narrow" data-halloween>
            <p className="ui-eyebrow ui-eyebrow--accent">Happy Halloween 🎃</p>
            <h1 className="ui-display">20% off your first membership payment.</h1>
            {ended ? (
              <>
                <p className="ui-lede" data-campaign-ended>
                  This Halloween offer has ended. Our membership plans are still here whenever you&rsquo;re ready.
                </p>
                <div className="pg-actions mt-5">
                  <Link href="/membership/plans" className={buttonClass({ variant: "primary" })}>
                    See membership plans
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="ui-lede">
                  A little treat for your home: 20% off the first payment on any Profixter membership plan, monthly or annual.
                  Whether you&rsquo;re joining for the first time or coming back.
                </p>
                <div className="pg-actions mt-5">
                  <button type="button" onClick={claim} className={buttonClass({ variant: "primary" })} data-action="claim-halloween">
                    Claim my 20% off
                  </button>
                  {!isAuthenticated ? (
                    <Link href={`/signin?next=${encodeURIComponent(PLANS_URL)}`} onClick={() => rememberCampaign(HALLOWEEN_CAMPAIGN)} className={buttonClass({ variant: "secondary" })} data-action="signin-halloween">
                      I&rsquo;m already a customer
                    </Link>
                  ) : null}
                </div>
              </>
            )}

            <div className="mt-8 overflow-hidden rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white">
              <table className="w-full text-left text-[15px]" data-halloween-prices>
                <thead className="bg-[color:var(--ui-bg-soft)] text-[13px] text-[color:var(--ui-text-3)]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Plan</th>
                    <th className="px-4 py-2.5 font-semibold">First month</th>
                    <th className="px-4 py-2.5 font-semibold">First year (annual)</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_DETAILS.map((plan) => {
                    const monthly = plan.price * 100;
                    const annual = plan.price * 10 * 100;
                    return (
                      <tr key={plan.id} className="border-t border-[color:var(--ui-line)]">
                        <td className="px-4 py-3 font-semibold text-[color:var(--ui-ink)]">{plan.name}</td>
                        <td className="px-4 py-3">
                          <s className="mr-1.5 text-[color:var(--ui-text-3)]">{formatCents(monthly)}</s>
                          <b className="text-[color:var(--ui-ink)]">{formatCents(first(monthly))}</b>
                        </td>
                        <td className="px-4 py-3">
                          <s className="mr-1.5 text-[color:var(--ui-text-3)]">{formatCents(annual)}</s>
                          <b className="text-[color:var(--ui-ink)]">{formatCents(first(annual))}</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="ui-checks mt-6">
              <li>Labor included for covered tasks, with the same local team every visit.</li>
              <li>Month to month, or pay for 10 months and get 12 on annual.</li>
            </ul>

            <div className="mt-6 text-[13px] leading-6 text-[color:var(--ui-text-3)]" data-halloween-terms>
              <p>
                <b className="text-[color:var(--ui-text-2)]">How it works.</b> Sign in or create your account, then choose a plan. You&rsquo;ll have 10
                minutes to check out at 20% off. The timer starts when you open the offer, not when we sent it.
              </p>
              <p className="mt-2">
                20% off applies to the first payment only (the first month, or the first year on annual billing). Renewals are at the regular price, plus
                applicable taxes. One per customer and home. Not available with an active membership. Offer available through November 2, 2026.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
