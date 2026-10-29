"use client";

import Link from "next/link";
import {
  FOOTER_COMPANY_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_PRODUCT_LINKS,
  FOOTER_SEO_LINKS,
} from "@/lib/site-architecture";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import Wordmark from "@/app/components/ui/Wordmark";

type FooterLink = { readonly label: string; readonly href: string };

function Group({ title, links }: { title: string; links: readonly FooterLink[] }) {
  return (
    <nav className="ft__group" aria-label={`Footer ${title.toLowerCase()}`}>
      <p className="ft__title">{title}</p>
      <ul>
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The footer, Website 3.0: four short groups, not a sitemap.
 *
 * What must always be here, compact or not: Privacy, Terms, Communication
 * Consent and SMS Consent (the A2P reviewer's one-click path), the licence
 * line, the phone number, and the About & Information page, which carries
 * every link that left this footer.
 *
 * `compact` drops the Explore group for focused flows; nothing legal goes.
 */
export default function Footer({ compact = false }: { compact?: boolean }) {
  return (
    <footer id="contact-us" className="ft">
      <div className="ui-container">
        <div className={`ft__grid ${compact ? "ft__grid--compact" : ""}`}>
          <div className="ft__brand">
            <Link href="/" aria-label="Profixter home" className="inline-flex">
              <Wordmark tone="light" className="ft__mark" title="Profixter" />
            </Link>
            <p className="ft__line">A handyman membership for Long Island homes.</p>
            <p className="ft__contact">
              <a href="tel:+16315991363" className="ui-num">631-599-1363</a>
              <a href={PUBLIC_CONTACT_MAILTO}>{PUBLIC_CONTACT_EMAIL}</a>
            </p>
          </div>

          <Group title="Services" links={FOOTER_PRODUCT_LINKS} />
          {!compact ? <Group title="Explore" links={FOOTER_SEO_LINKS} /> : null}
          <Group title="Company" links={FOOTER_COMPANY_LINKS} />
          <Group title="Legal" links={FOOTER_LEGAL_LINKS} />
        </div>

        <div className="ft__base">
          {/*
            * THE LEGAL ENTITY, SAID ONCE, WHERE EVERY PAGE CARRIES IT.
            *
            * ProFixter is a trading name. The company is Premium Island Homes
            * Inc., and that is the name on the EIN, on the Twilio A2P brand and
            * on all three legal pages. One line here means a visitor or a
            * carrier reviewer checking whether profixter.com belongs to the
            * registered brand finds it on every page.
            */}
          <p>
            &copy; 2026 Premium Island Homes Inc., d/b/a ProFixter. All rights reserved. &middot; Suffolk County Licensed HI-71484
          </p>
          <p>Licensed &amp; insured &middot; Serving Nassau &amp; Suffolk</p>
        </div>
      </div>
    </footer>
  );
}
