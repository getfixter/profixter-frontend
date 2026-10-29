import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import Reveal from "@/app/components/ui/Reveal";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
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

const WHY = [
  ["We’re building something real", "This isn’t a boring corporate job - we’re building a modern service brand with ambition, speed, and impact."],
  ["Room to grow fast", "If you’re motivated, you can grow into leadership, management, and high-earning roles."],
  ["We reward performance", "Strong performance is noticed - bonuses, raises, commissions, and real career progress."],
  ["Modern, creative, and flexible", "We value initiative, creativity, independence, and problem-solving - not bureaucracy."],
];

const ROLES = [
  "Sales & Customer Support",
  "Marketing & Social Media",
  "Operations & Scheduling",
  "Administrative & Office Support",
  "Business Development & Partnerships",
  "Creative, Content & Brand Roles",
];

const CULTURE = [
  "Fast-moving & ambitious",
  "Respectful, honest, and direct",
  "Focused on results - not excuses",
  "Supportive, but performance-driven",
  "We grow together",
];

export default function CareersPage() {
  const applyHref = `${PUBLIC_CONTACT_MAILTO}?subject=Career%20Application%20-%20Profixter`;
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main>
        <section className="ui-section ui-section--tight">
          <div className="ui-container pg-intro ui-rise">
            <p className="ui-eyebrow ui-eyebrow--accent">Careers</p>
            <h1 className="ui-display">Careers at Profixter</h1>
            <p className="ui-lede">
              Join Profixter - a fast-growing home service company changing how homeowners handle repairs,
              maintenance, and peace of mind.
            </p>
            <div className="pg-actions">
              <a href={applyHref} className="ui-btn ui-btn--primary">
                Apply by email
              </a>
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--soft ui-section--tight">
          <div className="ui-container">
            <h2 className="ui-h2">Why Work With Us</h2>
            <div className="pg-cards pg-cards--4 mt-5">
              {WHY.map(([title, body], index) => (
                <Reveal key={title} delay={index * 50} className="ui-card">
                  <h3 className="pg-card__title !text-[16px]">{title}</h3>
                  <p className="pg-card__meta">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--tight">
          <div className="ui-container grid gap-8 md:grid-cols-2 md:gap-14">
            <Reveal>
              <h2 className="ui-h3">Office &amp; Business Roles</h2>
              <p className="ui-body mt-1.5">We are hiring and partnering with talented people in areas like:</p>
              <ul className="ui-checks mt-3">
                {ROLES.map((role) => (
                  <li key={role} className="!text-[15px]">{role}</li>
                ))}
              </ul>
              <p className="ui-small mt-3">
                If you’re driven, organized, creative, or great with people - we want to hear from you.
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="ui-h3">Our Culture</h2>
              <ul className="ui-checks mt-3">
                {CULTURE.map((item) => (
                  <li key={item} className="!text-[15px]">{item}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container ui-container--narrow">
            <div className="ui-card !p-6 sm:!p-8">
              <h2 className="ui-h3">How to Apply</h2>
              <p className="ui-body mt-2">
                Send us an email with your <strong className="font-semibold text-[color:var(--ui-ink)]">resume</strong>, a
                short introduction, and what role you’re interested in.
              </p>
              <p className="ui-body mt-3">
                Email:{" "}
                <a href={applyHref} className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  {PUBLIC_CONTACT_EMAIL}
                </a>
              </p>
              <p className="ui-small mt-2">Tip: Tell us why you want to work with Profixter - we love motivated people.</p>
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
