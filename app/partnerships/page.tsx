import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import Reveal from "@/app/components/ui/Reveal";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Partner with Profixter | Long Island Home Services",
  },
  description:
    "For realtors, creators, property managers, and local businesses: partner with Profixter to give homeowners practical Membership and home help.",
  alternates: {
    canonical: "/partnerships",
  },
  openGraph: {
    title: "Partner with Profixter | Long Island Home Services",
    description:
      "Build a useful partnership around Profixter Membership, home maintenance, handyman visits, and Long Island homeowner trust.",
    url: absoluteUrl("/partnerships"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Partner with Profixter | Long Island Home Services",
    description:
      "Partner with Profixter to give Long Island homeowners practical Membership and home help.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

const WHY = [
  ["A service everyone needs", "Homeowners always have a list - small repairs, installs, maintenance, “can you fix this?” We make it easy to handle without stress."],
  ["Very unique offer", "We’re not a random handyman listing. We’re a structured membership that delivers peace of mind + predictable help."],
  ["High trust = high conversions", "A trusted local recommendation (from you) turns into real long-term value for your audience/clients."],
  ["We offer strong partnership deals", "We have multiple partnership programs and we make it worth it - fair, simple, and designed to grow together."],
];

function Pair({ items }: { items: [string, string[]][] }) {
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {items.map(([title, list]) => (
        <div key={title}>
          <p className="font-semibold text-[color:var(--ui-ink)]">{title}</p>
          <ul className="mt-1.5">
            {list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function PartnershipsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main>
        <section className="ui-section ui-section--tight">
          <div className="ui-container pg-intro ui-rise">
            <p className="ui-eyebrow ui-eyebrow--accent">Partnerships</p>
            <h1 className="ui-display">Partnerships</h1>
            <p className="ui-lede">
              We’re building a network with influencers, bloggers, marketing companies, and local pros who want to
              offer something truly helpful to homeowners. Profixter is a unique home protection and handyman
              Membership that makes home repairs simple - and that’s why partnerships work so well.
            </p>
            <div className="pg-actions">
              <a href={PUBLIC_CONTACT_MAILTO} className="ui-btn ui-btn--primary">
                Email us
              </a>
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--soft ui-section--tight">
          <div className="ui-container">
            <h2 className="ui-h2">Why Partner With Profixter</h2>
            <div className="pg-cards pg-cards--4 mt-5">
              {WHY.map(([title, body], index) => (
                <Reveal key={title} delay={index * 50} className="ui-card">
                  <h3 className="pg-card__title !text-[16px]">{title}</h3>
                  <p className="pg-card__meta">{body}</p>
                </Reveal>
              ))}
            </div>
            <p className="ui-small mt-4 max-w-[70ch]">
              If you have an audience, clients, or properties - this is a partnership that actually helps people,
              not just “another promo”.
            </p>
          </div>
        </section>

        <section className="ui-section ui-section--tight">
          <div className="ui-container ui-container--narrow">
            <div className="pg-folds">
              <details className="pg-fold">
                <summary>
                  <h2 className="pg-fold__title">Influencers, Bloggers &amp; Marketing Companies</h2>
                </summary>
                <div className="pg-fold__body pg-prose">
                  <p>
                    If you create content for homeowners (or local Long Island lifestyle), we can build campaigns that feel
                    real and deliver results. Your audience gets a service that removes stress. You get a partnership
                    that is valuable and easy to promote.
                  </p>
                  <ul>
                    <li>Simple story to explain (peace of mind, ongoing home help)</li>
                    <li>Clear benefits people understand immediately</li>
                    <li>Great for reels, before/after, “homeowner tips”, and local community content</li>
                    <li>Strong partnership deals (we have multiple options)</li>
                  </ul>
                </div>
              </details>

              <details className="pg-fold">
                <summary>
                  <h2 className="pg-fold__title">Realtors: The Perfect Closing Gift for New Homeowners</h2>
                </summary>
                <div className="pg-fold__body pg-prose">
                  <p>
                    Want to stand out from every other realtor? Instead of a bottle of wine or a gift basket,
                    give something that new homeowners actually need: <strong>a Profixter Membership.</strong>
                  </p>
                  <Pair
                    items={[
                      ["Benefits for your client", ["Help right away after move-in (mounting, fixes, adjustments)", "Less stress during the first months of ownership", "A trusted local handyman membership from day one"]],
                      ["Benefits for you", ["Be remembered (it’s a unique and practical gift)", "Boost referrals and reviews", "Stronger relationship after closing"]],
                    ]}
                  />
                  <p>
                    We can create special realtor partnership packages, including bulk options and branded “gift style” onboarding.
                  </p>
                </div>
              </details>

              <details className="pg-fold">
                <summary>
                  <h2 className="pg-fold__title">Airbnb &amp; Short-Term Rentals: Protect Your Property and Your Reviews</h2>
                </summary>
                <div className="pg-fold__body pg-prose">
                  <p>
                    Your rental is a business. When something breaks, it’s not just annoying -
                    it can cost bookings and reviews. Profixter helps keep your property running smoothly.
                  </p>
                  <Pair
                    items={[
                      ["Why we’re great for hosts", ["Fast help for the “small stuff” that ruins guest experience", "Ongoing maintenance to prevent bigger issues", "Predictable support without hunting for last-minute contractors"]],
                      ["What you protect", ["Your guest reviews", "Your uptime (avoid cancellations)", "Your property value and long-term condition"]],
                    ]}
                  />
                  <p>We also offer partnership programs for hosts with multiple properties.</p>
                </div>
              </details>
            </div>

            <div className="ui-card ui-card--soft mt-10 !p-6 sm:!p-8">
              <h2 className="ui-h3">Let’s Build Something Together</h2>
              <p className="ui-body mt-2">
                We have many partnership programs and we’ll match you with the best option based on your audience,
                clients, or properties.
              </p>
              <p className="ui-body mt-3">
                Email us:{" "}
                <a href={PUBLIC_CONTACT_MAILTO} className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  {PUBLIC_CONTACT_EMAIL}
                </a>
              </p>
              <p className="ui-small mt-2">
                Include: who you are, what type of partnership you want, and your location/audience (if applicable).
              </p>
              <Link href="/" className="ui-link mt-4">
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
