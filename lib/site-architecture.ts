export const CORE_PRODUCTS = [
  {
    id: "membership",
    label: "Membership",
    href: "/membership",
    intent: "I want someone every month.",
    title: "Monthly Home Maintenance Membership",
    shortTitle: "Membership",
    summary:
      "Ongoing handyman help, home maintenance, and better long-term value for Long Island homeowners.",
    cta: "Become a Member",
  },
  {
    id: "one-time",
    label: "Book Handyman",
    href: "/book",
    intent: "I need something fixed.",
    title: "One-Time Handyman Services",
    shortTitle: "Book a visit",
    summary:
      "$99 One-Time Visit for one predefined small handyman task, up to 90 minutes.",
    cta: "Book a visit",
  },
  {
    id: "renovation",
    label: "Renovation",
    href: "/projects",
    intent: "I want to renovate.",
    title: "Renovation and Construction",
    shortTitle: "Projects",
    summary:
      "Bathrooms, kitchens, roofing, siding, additions, full-home renovations, and new construction.",
    cta: "Request Renovation Estimate",
  },
] as const;

export const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Community Partnerships", href: "/communities" },
  { label: "Careers", href: "/careers" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  /*
   * Reachable, not merely published.
   *
   * This page carries the SMS consent, opt-out and message-frequency
   * disclosures. It was in the sitemap but linked from nowhere, which makes it
   * a page a customer cannot find and an A2P reviewer has to be handed. A legal
   * disclosure nobody can navigate to is not much of a disclosure.
   */
  { label: "Communication Consent", href: "/communication-consent" },
  /*
   * The A2P reviewer's entry point, and deliberately a public footer link.
   *
   * A carrier reviewer verifying how ProFixter collects SMS consent should not
   * have to be handed a URL out of band, and should not have to invent a Long
   * Island address to see the sign-up form's consent panel. This page shows the
   * real flow with real screenshots and collects nothing.
   *
   * It is EVIDENCE, never an opt-in method: no form, no checkbox, no control
   * that could be read as a second place consent is gathered. See the page
   * itself for why that distinction is load-bearing.
   */
  { label: "SMS Consent", href: "/sms-consent-example" },
  /*
   * The booth kiosk, linked so it can be opened on an event iPad without
   * typing a URL. Deliberately last and plain: it is a convenience, not a
   * destination we promote. Left out of the compact footer.
   */
  { label: "Event Page", href: "/event" },
] as const;

/*
 * The ways to book, named the way a visitor would say them, each pointing at
 * the page that actually takes the booking. One-Time and Full Day are tabs of
 * /book selected by ?visit= (see VisitTypeNav.resolveVisitType); they are not
 * routes of their own.
 */
export const BOOKING_LINKS = {
  memberships: { label: "Memberships", href: "/membership/plans" },
  freeVisit: { label: "Free Visit", href: "/book/free" },
  oneTime: { label: "One-Time Visit", href: "/book?visit=additional" },
  fullDay: { label: "Full Day", href: "/book?visit=full-day" },
  gift: { label: "Gift", href: "/gift" },
} as const;

/** The About & Information page: everything a visitor rarely needs, in one place. */
export const INFO_PAGE = { label: "About & Information", href: "/info" } as const;

/**
 * Public navigation (signed out), Website 3.0.
 *
 * Membership leads because it is the business. The free first visit is not a
 * link here because it is the header's one button ("Book free visit"), and
 * two entries for the same action is one decision too many. One-Time and Full
 * Day go straight to their own tab of /book. Gift is back in the primary nav:
 * it is a real product and visitors could not find it in the footer.
 *
 * Projects, About, guides and the rest moved to the About & Information page
 * (/info), which the menu and the footer both link to.
 */
export const MAIN_NAV_LINKS = [
  BOOKING_LINKS.memberships,
  { label: "One-Time", href: BOOKING_LINKS.oneTime.href },
  { label: "Full Day", href: BOOKING_LINKS.fullDay.href },
  { label: "Gift", href: "/gift" },
] as const;

/*
 * The footer, in four short groups rather than a sitemap. Everything that left
 * it is one click away on /info.
 */
export const FOOTER_PRODUCT_LINKS = [
  BOOKING_LINKS.memberships,
  /*
   * The explainer, linked from every page. Membership is the part of the
   * business that needs defining before it can be chosen.
   */
  { label: "How membership works", href: "/handyman-membership" },
  { label: "Free first visit", href: BOOKING_LINKS.freeVisit.href },
  BOOKING_LINKS.oneTime,
  BOOKING_LINKS.fullDay,
  { label: "Gift a Membership", href: "/gift" },
] as const;

/*
 * The three search hubs and the guides. Every landing page under them is still
 * in the sitemap and linked from its hub, so nothing is dropped from the site.
 */
export const FOOTER_SEO_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Locations", href: "/locations" },
  { label: "Homeowner guides", href: "/guides" },
  { label: "What we do", href: "/recent-work" },
  { label: "Renovations", href: "/renovations" },
] as const;

export const FOOTER_COMPANY_LINKS = [
  { label: "About us", href: "/about" },
  INFO_PAGE,
  { label: "Careers", href: "/careers" },
] as const;

/*
 * Legal. Communication Consent and SMS Consent are disclosures a customer and
 * an A2P carrier reviewer must reach in one click from any page; see the notes
 * on COMPANY_LINKS above. They stay in every footer, compact or not.
 */
export const FOOTER_LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Communication Consent", href: "/communication-consent" },
  { label: "SMS Consent", href: "/sms-consent-example" },
] as const;

export const PROJECT_SERVICE_LINKS = [
  { label: "Bathroom Remodeling", href: "/renovations/bathroom-remodeling" },
  { label: "Kitchen Remodeling", href: "/renovations/kitchen-remodeling" },
  { label: "Roofing", href: "/renovations/roofing" },
  { label: "Siding", href: "/renovations/siding" },
  { label: "Full Home Renovation", href: "/renovations/full-home-renovation" },
  { label: "New Home Construction", href: "/renovations/new-home-construction" },
] as const;
