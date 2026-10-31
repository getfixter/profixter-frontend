import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import GiftPurchaseClient from "./GiftPurchaseClient";
import "./gift.css";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";
import { STANDARD_VISIT_MINUTES } from "@/lib/business";

/**
 * /gift — give somebody a ProFixter membership.
 *
 * The page itself is public so somebody arriving from a link or a search sees
 * what it is; buying requires an account, and the client preserves the
 * destination through sign-in so they come back here rather than landing on a
 * generic page.
 *
 * Whether the feature is live at all is the SERVER's answer, not this file's:
 * the client asks the API and renders an unavailable state when gifts are off.
 * There is deliberately no public env var, which could drift out of step with
 * the backend and offer a purchase flow that cannot complete.
 *
 * SEARCH. Until October 2026 this route served a 32-character shell - the
 * client renders nothing until it has asked the API - with no heading, no
 * navigation, and a canonical inherited from the root layout that pointed at
 * the homepage. The purchase flow is unchanged; the page now has its own
 * canonical, the site header and footer, and a server-rendered explanation of
 * the product below the flow, with live plan prices.
 */

const TITLE = "Gift a Handyman Membership on Long Island | Profixter";
const DESCRIPTION =
  "Give someone a Profixter handyman membership for 1 to 12 months: 90-minute visits from a local Long Island team, paid once, nothing renews. A practical gift for new homeowners and parents in Nassau and Suffolk.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/gift" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/gift"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

/* Re-read hourly: the plan prices come from the same public endpoint the flow uses. */
export const revalidate = 3600;

type GiftOptionsPayload = {
  plans?: { plan: string; label: string; quotes: { durationMonths: number; totalCents: number; pricingBasis?: string }[] }[];
  durations?: number[];
};

async function getGiftOptions(): Promise<GiftOptionsPayload | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";
    const res = await fetch(`${base}/api/gifts/options`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as GiftOptionsPayload;
  } catch {
    return null;
  }
}

function dollars(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export default async function GiftPage() {
  const options = await getGiftOptions();
  const durations = options?.durations?.length ? options.durations : null;
  const plans = options?.plans || [];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main>
        {/*
          The page's one H1, in the served HTML. The purchase flow below only
          renders once it has asked the API whether gifts are available, so
          its section headings are H2s under this.
        */}
        <section className="ui-section ui-section--tight">
          <div className="ui-container">
            <header className="mb-8 max-w-[640px] sm:mb-10">
              <p className="ui-eyebrow ui-eyebrow--accent">Gift a membership</p>
              <h1 className="ui-display mt-3">Give someone a ProFixter membership.</h1>
              <p className="ui-lede mt-3">
                A professional handyman at their home. You pay once, they book the visits, and nothing renews.
              </p>
            </header>
            <GiftPurchaseClient />
          </div>
        </section>

        <section aria-labelledby="about-gift" className="ui-section ui-section--soft">
          <div className="ui-container ui-container--narrow">
            <h2 id="about-gift" className="ui-h2">
              How a gift membership works
            </h2>
            <ul className="ui-body mt-6 space-y-3 text-[color:var(--ui-text-2)]">
              <li>
                <strong className="font-semibold text-[color:var(--ui-ink)]">You choose a plan and a length</strong>
                {durations ? ` (${durations.join(", ")} months)` : ""}, and pay once. Nothing renews and nobody is
                billed later.
              </li>
              <li>
                <strong className="font-semibold text-[color:var(--ui-ink)]">They claim it</strong> with the link you
                send, add their home, and book {STANDARD_VISIT_MINUTES}-minute visits like any member: repairs,
                installations and everyday jobs, with the same local team.
              </li>
              <li>
                <strong className="font-semibold text-[color:var(--ui-ink)]">For a Long Island home.</strong> Profixter
                works in Nassau and Suffolk Counties, so the recipient&apos;s home needs to be there.
              </li>
              <li>
                <strong className="font-semibold text-[color:var(--ui-ink)]">
                  Twelve months is priced like an annual membership
                </strong>{" "}
                — 12 months for the price of 10. Shorter gifts are the monthly price times the months. Tax is added
                at checkout.
              </li>
            </ul>

            {plans.length ? (
              /*
                Six columns do not fit the narrowest phones. The plan column
                stays put while the prices scroll, and a soft edge on the right
                shows there is more to see (gift.css, .gf-prices). The region
                is labelled and focusable so the keyboard can scroll it too.
              */
              <div
                className="gf-prices ui-card relative mt-8 overflow-x-auto p-0"
                role="region"
                aria-label="Gift membership prices by plan and length"
                tabIndex={0}
              >
                <table className="w-full border-collapse whitespace-nowrap text-left text-[15px]">
                  <caption className="sr-only">Gift membership prices by plan and length</caption>
                  <thead>
                    <tr className="border-b border-[color:var(--ui-line)] text-[13px] text-[color:var(--ui-text-3)]">
                      <th scope="col" className="py-3 pl-4 pr-3 font-semibold sm:px-4">Plan</th>
                      {(durations || []).map((months) => (
                        <th key={months} scope="col" className="px-2.5 py-3 text-right font-semibold sm:px-4">
                          {months} mo
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.plan} className="border-b border-[color:var(--ui-line)] last:border-b-0">
                        <th scope="row" className="py-3 pl-4 pr-3 font-semibold text-[color:var(--ui-ink)] sm:px-4">{plan.label}</th>
                        {(durations || []).map((months) => {
                          const quote = plan.quotes.find((q) => q.durationMonths === months);
                          return (
                            <td key={months} className="ui-num px-2.5 py-3 text-right text-[color:var(--ui-ink)] sm:px-4">
                              {quote ? dollars(quote.totalCents) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <h3 className="ui-h3 mt-10">Who it suits</h3>
            <ul className="ui-body mt-3 space-y-2 text-[color:var(--ui-text-2)]">
              <li>
                New homeowners, whose first year usually brings a long list.{" "}
                <Link href="/guides/new-homeowner-first-year-long-island" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  The first-year checklist
                </Link>
                .
              </li>
              <li>
                A parent or relative whose house needs regular small repairs.{" "}
                <Link href="/guides/helping-a-parent-with-home-repairs" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  Helping a parent keep up their home
                </Link>
                .
              </li>
              <li>
                Anyone whose to-do list you keep hearing about.{" "}
                <Link href="/handyman-membership" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  What the membership includes
                </Link>
                .
              </li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
