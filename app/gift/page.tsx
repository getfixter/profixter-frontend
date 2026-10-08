import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import GiftPurchaseClient from "./GiftPurchaseClient";
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
      <Header />
      <main className="min-h-[70vh] bg-white">
        {/*
          The page's one H1, in the served HTML. The purchase flow renders its
          own visible heading for each step only after it has asked the API
          whether gifts are available, so those are H2s under this.
        */}
        <h1 className="sr-only">Gift a Profixter handyman membership</h1>
        <GiftPurchaseClient />

        <section aria-labelledby="about-gift" className="border-t border-[#EEF1F8] bg-[#FAFBFE]">
          <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
            <h2 id="about-gift" className="text-[22px] font-semibold leading-tight text-[#313234] sm:text-[26px]">
              How a gift membership works
            </h2>
            <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-[#4A4D52] sm:text-base">
              <li>
                <strong className="font-semibold text-[#313234]">You choose a plan and a length</strong>
                {durations ? ` (${durations.join(", ")} months)` : ""}, and pay once. Nothing renews and nobody is
                billed later.
              </li>
              <li>
                <strong className="font-semibold text-[#313234]">They claim it</strong> with the link you send, add
                their home, and book {STANDARD_VISIT_MINUTES}-minute visits like any member: repairs, installations and
                everyday jobs, with the same local team.
              </li>
              <li>
                <strong className="font-semibold text-[#313234]">For a Long Island home.</strong> Profixter works in
                Nassau and Suffolk Counties, so the recipient&apos;s home needs to be there.
              </li>
              <li>
                <strong className="font-semibold text-[#313234]">Twelve months is priced like an annual membership</strong>
                {" "}— 12 months for the price of 10. Shorter gifts are the monthly price times the months. Tax is added
                at checkout.
              </li>
            </ul>

            {plans.length ? (
              <div className="relative mt-8 overflow-x-auto rounded-[12px] border border-[#E0E6F5] bg-white">
                <table className="w-full border-collapse text-left text-[15px]">
                  <caption className="sr-only">Gift membership prices by plan and length</caption>
                  <thead>
                    <tr className="border-b border-[#E0E6F5] bg-[#F8FAFF] text-[13px] text-[#6A6D71]">
                      <th scope="col" className="px-4 py-3 font-semibold">Plan</th>
                      {(durations || []).map((months) => (
                        <th key={months} scope="col" className="px-4 py-3 text-right font-semibold">
                          {months} mo
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.plan} className="border-b border-[#EEF1F8] last:border-b-0">
                        <th scope="row" className="px-4 py-3 font-semibold text-[#313234]">{plan.label}</th>
                        {(durations || []).map((months) => {
                          const quote = plan.quotes.find((q) => q.durationMonths === months);
                          return (
                            <td key={months} className="px-4 py-3 text-right tabular-nums text-[#313234]">
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

            <h3 className="mt-10 text-[18px] font-semibold text-[#313234]">Who it suits</h3>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-[#4A4D52]">
              <li>
                New homeowners, whose first year usually brings a long list.{" "}
                <Link href="/guides/new-homeowner-first-year-long-island" className="font-semibold text-[#306EEC] underline underline-offset-2">
                  The first-year checklist
                </Link>
                .
              </li>
              <li>
                A parent or relative whose house needs regular small repairs.{" "}
                <Link href="/guides/helping-a-parent-with-home-repairs" className="font-semibold text-[#306EEC] underline underline-offset-2">
                  Helping a parent keep up their home
                </Link>
                .
              </li>
              <li>
                Anyone whose to-do list you keep hearing about.{" "}
                <Link href="/handyman-membership" className="font-semibold text-[#306EEC] underline underline-offset-2">
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
