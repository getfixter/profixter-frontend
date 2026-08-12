import type { Metadata } from "next";
import Link from "next/link";
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

export default function PartnershipsPage() {
  return (
    <div className="min-h-screen px-4 py-9 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-5xl mx-auto rounded-[16px] p-6 sm:p-10 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49,50,52,0.62) 0%, rgba(49,50,52,0.52) 55%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.92)",
          boxShadow: "0px 0px 90px 0px rgba(0,0,0,0.55)",
        }}
      >
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3 text-center tracking-tight">
          Partnerships
        </h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-7 leading-relaxed">
          We’re building a network with{" "}
          <span className="font-semibold">influencers, bloggers, marketing companies</span>,{" "}
          and local pros who want to offer something truly helpful to homeowners.
          <br className="hidden sm:block" />
          Profixter is a{" "}
          <span className="font-semibold">unique home protection and handyman Membership</span>{" "}
          that makes home repairs simple - and that’s why partnerships work so well.
        </p>

        <div className="space-y-10 text-sm sm:text-base text-white/85 leading-relaxed">
          {/* WHY PARTNER */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Why Partner With Profixter
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">A service everyone needs</p>
                <p className="text-white/75 mt-1">
                  Homeowners always have a list - small repairs, installs, maintenance, “can you fix this?”
                  We make it easy to handle without stress.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">Very unique offer</p>
                <p className="text-white/75 mt-1">
                  We’re not a random handyman listing. We’re a structured membership that delivers
                  peace of mind + predictable help.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">High trust = high conversions</p>
                <p className="text-white/75 mt-1">
                  A trusted local recommendation (from you) turns into real long-term value for your audience/clients.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">We offer strong partnership deals</p>
                <p className="text-white/75 mt-1">
                  We have multiple partnership programs and we make it worth it - fair, simple, and designed to grow together.
                </p>
              </div>
            </div>

            <p className="text-white/70 mt-4">
              If you have an audience, clients, or properties - this is a partnership that actually helps people,
              not just “another promo”.
            </p>
          </section>

          {/* INFLUENCERS / MARKETING */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Influencers, Bloggers & Marketing Companies
            </h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/85">
                If you create content for homeowners (or local Long Island lifestyle), we can build campaigns that feel
                real and deliver results. Your audience gets a service that removes stress. You get a partnership
                that is valuable and easy to promote.
              </p>

              <ul className="list-disc list-inside space-y-2 mt-4 text-white/75">
                <li>Simple story to explain (peace of mind, ongoing home help)</li>
                <li>Clear benefits people understand immediately</li>
                <li>Great for reels, before/after, “homeowner tips”, and local community content</li>
                <li>Strong partnership deals (we have multiple options)</li>
              </ul>
            </div>
          </section>

          {/* REALTORS */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Realtors: The Perfect Closing Gift for New Homeowners
            </h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/85">
                Want to stand out from every other realtor? Instead of a bottle of wine or a gift basket,
                give something that new homeowners actually need:{" "}
                <span className="font-semibold">a Profixter Membership.</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-2xl bg-black/20 border border-white/10 p-5">
                  <p className="font-semibold">Benefits for your client</p>
                  <ul className="list-disc list-inside space-y-2 mt-2 text-white/75">
                    <li>Help right away after move-in (mounting, fixes, adjustments)</li>
                    <li>Less stress during the first months of ownership</li>
                    <li>A trusted local handyman membership from day one</li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-black/20 border border-white/10 p-5">
                  <p className="font-semibold">Benefits for you</p>
                  <ul className="list-disc list-inside space-y-2 mt-2 text-white/75">
                    <li>Be remembered (it’s a unique and practical gift)</li>
                    <li>Boost referrals and reviews</li>
                    <li>Stronger relationship after closing</li>
                  </ul>
                </div>
              </div>

              <p className="text-white/70 mt-4">
                We can create special realtor partnership packages, including bulk options and branded “gift style” onboarding.
              </p>
            </div>
          </section>

          {/* AIRBNB */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Airbnb & Short-Term Rentals: Protect Your Property and Your Reviews
            </h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/85">
                Your rental is a business. When something breaks, it’s not just annoying -
                it can cost bookings and reviews. Profixter helps keep your property running smoothly.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-2xl bg-black/20 border border-white/10 p-5">
                  <p className="font-semibold">Why we’re great for hosts</p>
                  <ul className="list-disc list-inside space-y-2 mt-2 text-white/75">
                    <li>Fast help for the “small stuff” that ruins guest experience</li>
                    <li>Ongoing maintenance to prevent bigger issues</li>
                    <li>Predictable support without hunting for last-minute contractors</li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-black/20 border border-white/10 p-5">
                  <p className="font-semibold">What you protect</p>
                  <ul className="list-disc list-inside space-y-2 mt-2 text-white/75">
                    <li>Your guest reviews</li>
                    <li>Your uptime (avoid cancellations)</li>
                    <li>Your property value and long-term condition</li>
                  </ul>
                </div>
              </div>

              <p className="text-white/70 mt-4">
                We also offer partnership programs for hosts with multiple properties.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">Let’s Build Something Together</h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/85">
                We have many partnership programs and we’ll match you with the best option based on your audience,
                clients, or properties.
              </p>

              <p className="mt-4 text-white/85">
                Email us:{" "}
                <a
                  href={PUBLIC_CONTACT_MAILTO}
                  className="text-[#93c5fd] underline underline-offset-2 hover:text-white transition"
                >
                  {PUBLIC_CONTACT_EMAIL}
                </a>
              </p>

              <p className="text-white/60 text-sm mt-2">
                Include: who you are, what type of partnership you want, and your location/audience (if applicable).
              </p>
            </div>
          </section>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm sm:text-base text-[#93c5fd] hover:bg-white/10 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
