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

export const HOME_SUPPORT_AI = {
  id: "home-support-ai",
  label: "Profixter AI",
  href: "/home-support",
  intent: "I am not sure where to start.",
  title: "Profixter Home Support AI",
  shortTitle: "Profixter AI",
  summary:
    "Free homeowner guidance for repairs, maintenance, quotes, materials, safety, and DIY-or-hire decisions.",
  cta: "Ask Profixter AI",
} as const;

export const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Community Partnerships", href: "/communities" },
  { label: "Careers", href: "/careers" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
] as const;

/**
 * Public navigation. Membership leads because it is the business; the one-time
 * visit is a fallback, not a peer product. Home Support AI is intentionally not
 * a top-level item - it competes with the primary conversion journey and is
 * reachable from the footer.
 *
 * Book sits in the middle because it is a service destination rather than a
 * marketing page. It was missing here for a long time, from back when /book was
 * treated as somewhere you arrived from a call to action rather than somewhere
 * you navigate to. The phone has had a Book tab in the bottom bar throughout,
 * so a visitor on a desktop was the only customer on the site with no ordinary
 * way to reach it.
 *
 * Bare /book on purpose. The page resolves its own default from customer state,
 * so pinning a ?visit= here would override a decision that belongs to Book.
 */
export const MAIN_NAV_LINKS = [
  { label: "Membership", href: "/membership" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Book", href: "/book" },
  { label: "Projects", href: "/projects" },
  { label: "About Us", href: "/about" },
] as const;

export const FOOTER_PRODUCT_LINKS = [
  ...CORE_PRODUCTS.map((product) => ({
    label: product.shortTitle,
    href: product.href,
  })),
  /*
   * The explainer, linked from every page. Membership is the part of the
   * business that needs defining before it can be chosen, and a footer link is
   * how somebody who is still working out what the product is reaches the page
   * that says so.
   */
  { label: "What is a handyman membership?", href: "/handyman-membership" },
  { label: HOME_SUPPORT_AI.shortTitle, href: HOME_SUPPORT_AI.href },
] as const;

export const PROJECT_SERVICE_LINKS = [
  { label: "Bathroom Remodeling", href: "/renovations/bathroom-remodeling" },
  { label: "Kitchen Remodeling", href: "/renovations/kitchen-remodeling" },
  { label: "Roofing", href: "/renovations/roofing" },
  { label: "Siding", href: "/renovations/siding" },
  { label: "Full Home Renovation", href: "/renovations/full-home-renovation" },
  { label: "New Home Construction", href: "/renovations/new-home-construction" },
] as const;

/*
 * The three hubs, not a sample of their children.
 *
 * This column used to mix hub pages with an arbitrary handful of individual
 * landing pages (TV Mounting, Drywall Repair, Bathroom Remodeling, Roofing),
 * which read as product navigation but was really search plumbing, and which
 * put Roofing two rows below Projects as though they were different things.
 * Every one of those pages still exists, is still in the sitemap, and is still
 * linked from the hub above it, so nothing has been dropped from the site.
 */
export const FOOTER_SEO_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Renovations", href: "/renovations" },
  { label: "Locations", href: "/locations" },
] as const;
