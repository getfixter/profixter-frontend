import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";
import { BOOKING_LINKS } from "@/lib/site-architecture";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";

/**
 * About & Information: every link a visitor rarely needs, in one place.
 *
 * Website 3.0 cut the header to the ways to book and the footer to four short
 * groups. Everything that left them is here, one click from the menu and the
 * footer on every page: the company pages, the search hubs (services,
 * locations, guides), the legal disclosures and the booth kiosk link.
 *
 * Plain links in plain groups, server-rendered, so it is also a clean crawl
 * path to the hubs.
 */
const TITLE = "About & Information | Profixter";
const DESCRIPTION =
  "Everything about Profixter in one place: memberships and visits, services and areas we cover, homeowner guides, the company, contact details and our policies.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/info" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/info"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

type Item = { label: string; href: string; note?: string };

const GROUPS: Array<{ id: string; title: string; items: Item[] }> = [
  {
    id: "book",
    title: "Memberships & visits",
    items: [
      { ...BOOKING_LINKS.memberships, note: "Plans from $149/month" },
      { label: "How membership works", href: "/handyman-membership" },
      { label: "Free Visit", href: BOOKING_LINKS.freeVisit.href, note: "We go over your to-do list" },
      { ...BOOKING_LINKS.oneTime, note: "$99, one small job" },
      { ...BOOKING_LINKS.fullDay, note: "One Fixter, your whole list" },
      { label: "Gift a membership", href: "/gift" },
    ],
  },
  {
    id: "services",
    title: "Services & areas",
    items: [
      { label: "Handyman services", href: "/services" },
      { label: "Locations we serve", href: "/locations", note: "Nassau & Suffolk" },
      { label: "What's included", href: "/recent-work", note: "Before-and-after examples" },
      { label: "Homeowner guides", href: "/guides" },
      { label: "Projects", href: "/projects", note: "Larger work and estimates" },
      { label: "Renovations", href: "/renovations" },
    ],
  },
  {
    id: "company",
    title: "Company",
    items: [
      { label: "About us", href: "/about" },
      { label: "Community partnerships", href: "/communities" },
      { label: "Careers", href: "/careers" },
      { label: "Sign in", href: "/signin" },
    ],
  },
  {
    id: "legal",
    title: "Policies",
    items: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Communication Consent", href: "/communication-consent" },
      { label: "SMS Consent", href: "/sms-consent-example" },
    ],
  },
];

export default function InfoPage() {
  return (
    <>
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="info">
        <section className="ui-section ui-section--tight">
          <div className="ui-container">
            <p className="ui-eyebrow">About &amp; Information</p>
            <h1 className="ui-display info__title">Everything else, in one place.</h1>
            <p className="ui-lede">
              Profixter is a handyman membership for Long Island homes, from a local, licensed and insured team.
            </p>
          </div>
        </section>

        <section className="ui-section ui-section--flush-top">
          <div className="ui-container info__grid">
            {GROUPS.map((group) => (
              <nav key={group.id} className="info__group" aria-labelledby={`info-${group.id}`}>
                <h2 id={`info-${group.id}`} className="ui-eyebrow">
                  {group.title}
                </h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="info__link">
                        <span>{item.label}</span>
                        {item.note ? <span className="info__note">{item.note}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <section className="info__group" aria-labelledby="info-contact">
              <h2 id="info-contact" className="ui-eyebrow">
                Contact
              </h2>
              <ul>
                <li>
                  <a href="tel:+16315991363" className="info__link">
                    <span className="ui-num">631-599-1363</span>
                    <span className="info__note">Call or text</span>
                  </a>
                </li>
                <li>
                  <a href={PUBLIC_CONTACT_MAILTO} className="info__link">
                    <span>{PUBLIC_CONTACT_EMAIL}</span>
                  </a>
                </li>
              </ul>
              <p className="ui-small info__legal">
                Premium Island Homes Inc., d/b/a ProFixter. Suffolk County Licensed HI-71484. Serving Nassau and Suffolk Counties.
              </p>
              {/* The booth kiosk, for opening on an event iPad; not a destination we promote. */}
              <p className="ui-small">
                <Link href="/event" className="info__quiet">
                  Event display
                </Link>
              </p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
