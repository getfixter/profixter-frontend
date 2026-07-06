import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Careers at Profixter | Build the Future of Home Services",
  },
  description:
    "Join a fast-growing Long Island home platform building modern Membership, handyman, AI, and renovation experiences for homeowners.",
  alternates: {
    canonical: "/careers",
  },
  openGraph: {
    title: "Careers at Profixter | Build the Future of Home Services",
    description:
      "Explore careers with Profixter, a Long Island home platform changing how homeowners get maintenance, handyman, AI, and renovation help.",
    url: absoluteUrl("/careers"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Careers at Profixter | Build the Future of Home Services",
    description:
      "Join a fast-growing Long Island home platform building modern home service experiences.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function CareersPage() {
  return (
    <div className="min-h-screen px-4 py-24 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-5xl mx-auto rounded-[24px] p-6 sm:p-10 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49,50,52,0.62) 0%, rgba(49,50,52,0.52) 55%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.92)",
          boxShadow: "0px 0px 90px 0px rgba(0,0,0,0.55)",
        }}
      >
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3 text-center tracking-tight">
          Careers at Profixter
        </h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-10 leading-relaxed">
          Join <span className="font-semibold">Profixter</span> — a fast-growing home service company
          changing how homeowners handle repairs, maintenance, and peace of mind.
        </p>

        <div className="space-y-10 text-sm sm:text-base text-white/85 leading-relaxed">
          {/* WHY WORK WITH US */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Why Work With Us
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">We’re building something real</p>
                <p className="text-white/75 mt-1">
                  This isn’t a boring corporate job — we’re building a modern service brand with ambition, speed, and impact.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">Room to grow fast</p>
                <p className="text-white/75 mt-1">
                  If you’re motivated, you can grow into leadership, management, and high-earning roles.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">We reward performance</p>
                <p className="text-white/75 mt-1">
                  Strong performance is noticed — bonuses, raises, commissions, and real career progress.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="font-semibold">Modern, creative, and flexible</p>
                <p className="text-white/75 mt-1">
                  We value initiative, creativity, independence, and problem-solving — not bureaucracy.
                </p>
              </div>
            </div>
          </section>

          {/* OFFICE ROLES */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Office & Business Roles
            </h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/85">
                We are hiring and partnering with talented people in areas like:
              </p>

              <ul className="list-disc list-inside space-y-2 mt-3 text-white/75">
                <li>Sales & Customer Support</li>
                <li>Marketing & Social Media</li>
                <li>Operations & Scheduling</li>
                <li>Administrative & Office Support</li>
                <li>Business Development & Partnerships</li>
                <li>Creative, Content & Brand Roles</li>
              </ul>

              <p className="text-white/70 mt-4">
                If you’re driven, organized, creative, or great with people — we want to hear from you.
              </p>
            </div>
          </section>

          {/* COMPANY CULTURE */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              Our Culture
            </h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <ul className="list-disc list-inside space-y-2 text-white/75">
                <li>Fast-moving & ambitious</li>
                <li>Respectful, honest, and direct</li>
                <li>Focused on results — not excuses</li>
                <li>Supportive, but performance-driven</li>
                <li>We grow together</li>
              </ul>
            </div>
          </section>

          {/* HOW TO APPLY */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              How to Apply
            </h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-white/85">
                Send us an email with your{" "}
                <span className="font-semibold">resume</span>, a short introduction,
                and what role you’re interested in.
              </p>

              <p className="mt-4 text-white/85">
                Email:{" "}
                <a
                  href="mailto:my@profixter.com?subject=Career%20Application%20-%20Profixter"
                  className="text-[#93c5fd] underline underline-offset-2 hover:text-white transition"
                >
                  my@profixter.com
                </a>
              </p>

              <p className="text-white/60 text-sm mt-2">
                Tip: Tell us why you want to work with Profixter — we love motivated people.
              </p>
            </div>
          </section>

          {/* CTA */}
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
