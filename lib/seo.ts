import {
  CORE_PRODUCTS,
  HOME_SUPPORT_AI,
  MAIN_NAV_LINKS,
} from "@/lib/site-architecture";
import { plans } from "@/app/data/content";
import {
  getSeoEngineSitemapRoutes,
  renovationServices,
} from "@/lib/seo-content";
import {
  BRAND_ALTERNATE_NAMES,
  BUSINESS_LOCATION,
  FULL_DAY_FALLBACK,
  LEGAL_NAME,
  OFFICIAL_PROFILES,
  ONE_TIME_FALLBACK,
  OPENING_HOURS,
  SHORT_DESCRIPTION,
} from "@/lib/business";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/contact";
import { getGuideSitemapRoutes } from "@/lib/guides";

export const SITE_URL = "https://www.profixter.com";

/**
 * Annual membership is billed as ten months and runs for twelve. Restated here
 * for the structured data; PlansSection holds the same constant for the UI.
 */
const ANNUAL_MONTHS_CHARGED = 10;

export const SITE_NAME = "Profixter";
/**
 * ProFixter Customer Care. Membership, billing, scheduling problems, Priority
 * Visits and escalations. This is NOT the number for questions about the work
 * itself - that is the customer's Fixter, see lib/fixter.ts.
 */
export const BUSINESS_PHONE_DISPLAY = "631-599-1363";
export const BUSINESS_PHONE_E164 = "+1-631-599-1363";
/**
 * The ProFixter brand mark: PRO in brand blue over FIXTER in white, on black,
 * with Long Island beneath it.
 *
 * The same artwork as app/favicon.ico, the manifest icons and the Apple touch
 * icon, all generated from public/images/LogoSquare.png. Square, because
 * that is what both Google's favicon guidance and the manifest want, and
 * because every surface that shows a site icon crops to a square anyway.
 */
export const PROFIXTER_LOGO = {
  url: "/icon.png",
  width: 512,
  height: 512,
  alt: "ProFixter Long Island",
};

export const DEFAULT_OG_IMAGE = {
  /* A real 1200x630 JPEG (about 1/10 the weight of the 5760px hero it is cut from). */
  url: "/images/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "Profixter home support for Long Island homeowners",
};

/*
 * The two counties, and nothing finer. Listing individual towns added nothing
 * the counties do not already cover, and implied a footprint town by town that
 * the visit data does not support everywhere. Town pages describe themselves.
 */
export const LOCAL_SERVICE_AREAS = ["Long Island", "Nassau County", "Suffolk County"] as const;

/**
 * The date this release's content changes went live. Pages edited in a release
 * carry it as their sitemap lastmod; bump it when you edit those pages again.
 */
export const CONTENT_RELEASE_DATE = "2026-10-08";

type SitemapRoute = {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
  /**
   * When the page's content last really changed (YYYY-MM-DD).
   *
   * The sitemap used to stamp every URL with the time of the request, so every
   * page claimed to have changed every time it was fetched. Search engines learn
   * to ignore a lastmod that is always "now", which throws away the one signal
   * that tells them a page is worth recrawling. These dates come from the git
   * history of each page and move only when the page does.
   */
  updated: string;
};

export const PUBLIC_SITEMAP_ROUTES: readonly SitemapRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1, updated: CONTENT_RELEASE_DATE },
  /* The prices, with their own canonical since this release. */
  { path: "/membership/plans", changeFrequency: "weekly", priority: 0.98, updated: CONTENT_RELEASE_DATE },
  /* The category explainer and the canonical "how Profixter membership works". */
  { path: "/handyman-membership", changeFrequency: "monthly", priority: 0.96, updated: CONTENT_RELEASE_DATE },
  { path: "/membership", changeFrequency: "weekly", priority: 0.9, updated: "2026-09-20" },
  { path: "/book", changeFrequency: "weekly", priority: 0.94, updated: CONTENT_RELEASE_DATE },
  /*
   * The free first visit has its own booker and its own canonical, and was
   * missing from the sitemap entirely.
   */
  { path: "/book/free", changeFrequency: "monthly", priority: 0.9, updated: "2026-10-06" },
  { path: "/projects", changeFrequency: "weekly", priority: 0.9, updated: "2026-10-06" },
  /* Proof of work, and the page most likely to answer "are these people any good". */
  { path: "/recent-work", changeFrequency: "weekly", priority: 0.88, updated: CONTENT_RELEASE_DATE },
  { path: "/kitchen-bathroom", changeFrequency: "monthly", priority: 0.86, updated: "2026-10-06" },
  /* Homeowner guides: the problem-first entry points. */
  ...getGuideSitemapRoutes(),
  { path: "/home-support", changeFrequency: "monthly", priority: 0.7, updated: "2026-08-13" },
  { path: "/about", changeFrequency: "monthly", priority: 0.8, updated: CONTENT_RELEASE_DATE },
  { path: "/communities", changeFrequency: "monthly", priority: 0.7, updated: "2026-10-06" },
  /*
   * A real product with its own funnel. It now has server-rendered content and
   * its own canonical; until this release it was an empty shell pointing at /.
   */
  { path: "/gift", changeFrequency: "monthly", priority: 0.72, updated: CONTENT_RELEASE_DATE },
  { path: "/membership/loyalty", changeFrequency: "monthly", priority: 0.66, updated: "2026-09-14" },
  /*
   * /july4 is gone from here. It was an expired $0 summer promotion linked from
   * nowhere; it stays reachable for anyone holding the link, marked noindex.
   */
  ...getSeoEngineSitemapRoutes().map((route) => ({ ...route, updated: CONTENT_RELEASE_DATE })),
  { path: "/careers", changeFrequency: "yearly", priority: 0.35, updated: "2026-08-13" },
  { path: "/partnerships", changeFrequency: "monthly", priority: 0.45, updated: "2026-08-13" },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.25, updated: "2026-09-13" },
  { path: "/terms", changeFrequency: "yearly", priority: 0.25, updated: "2026-09-14" },
  { path: "/communication-consent", changeFrequency: "yearly", priority: 0.2, updated: "2026-09-14" },
  /*
   * In the sitemap so a carrier reviewer's crawler can find it without being
   * handed the URL. Low priority because no customer is searching for it; it
   * exists to be verifiable, not to rank.
   */
  { path: "/sms-consent-example", changeFrequency: "yearly", priority: 0.2, updated: "2026-09-14" },
  /*
   * The sign-up form is the page A2P vetting has to be able to fetch: it is
   * where SMS consent is collected. It used to be disallowed in robots.txt,
   * which told a reviewer's crawler not to request it at all.
   */
  { path: "/signup", changeFrequency: "monthly", priority: 0.3, updated: "2026-09-14" },
];

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path === "/" ? "" : path}`;
}

const schemaServiceAreas = LOCAL_SERVICE_AREAS.map((name) => ({
  "@type": "Place",
  name: name.includes("County") || name === "Long Island" ? `${name}, NY` : `${name}, Long Island, NY`,
}));

export const PROFIXTER_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
      "@id": `${SITE_URL}/#business`,
      name: SITE_NAME,
      /*
       * Identity, from lib/business.ts. legalName and alternateName let a search
       * engine reconcile "Profixter", the Google profile's "ProFixter Handyman"
       * and the registered company as one business.
       */
      legalName: LEGAL_NAME,
      alternateName: [...BRAND_ALTERNATE_NAMES],
      description: SHORT_DESCRIPTION,
      url: SITE_URL,
      telephone: BUSINESS_PHONE_E164,
      email: PUBLIC_CONTACT_EMAIL,
      /*
       * Town and ZIP, never the street: true whether the Google profile keeps
       * its street address visible or becomes a service-area listing.
       */
      address: {
        "@type": "PostalAddress",
        addressLocality: BUSINESS_LOCATION.locality,
        addressRegion: BUSINESS_LOCATION.region,
        postalCode: BUSINESS_LOCATION.postalCode,
        addressCountry: BUSINESS_LOCATION.country,
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: OPENING_HOURS.days.map((day) => `https://schema.org/${day}`),
          opens: OPENING_HOURS.opens,
          closes: OPENING_HOURS.closes,
        },
      ],
      sameAs: [...OFFICIAL_PROFILES],
      /*
       * Stated on the site itself (About page and team section: "I founded
       * Profixter..."). Connects the person assistants already associate with
       * the business to the entity, without adding any new claim.
       */
      founder: { "@type": "Person", name: "Taras Bandura", jobTitle: "General Manager" },
      /*
       * No hasCredential. HI-71484 is a Suffolk County license held by the
       * founder personally, not by Premium Island Homes Inc., so attaching it
       * to the business entity in markup would overstate it. The visible site
       * names the license; the markup stays silent until the owner confirms
       * how it should be represented.
       */
      /*
       * The brand mark, not the hero photograph.
       *
       * `image` is a picture of the work and is what Google may show beside a
       * result; `logo` is the identity, and is what it reads for the knowledge
       * panel. Without one, the only logo signal the site published was the
       * favicon - which for a long time was the retired Mr. Fixter mascot.
       * /icon.png is the 512px square lockup, the same artwork as the manifest
       * icons and the favicon.
       */
      logo: `${SITE_URL}${PROFIXTER_LOGO.url}`,
      image: `${SITE_URL}${DEFAULT_OG_IMAGE.url}`,
      priceRange: "$$",
      areaServed: schemaServiceAreas,
      knowsAbout: [
        "Handyman membership",
        "Recurring handyman service",
        "Small home repairs",
        "Home maintenance",
        "Handyman visits",
        "Home Support AI",
        "Roofing",
        "Siding",
        "Kitchen remodeling",
        "Bathroom remodeling",
        "Home renovation",
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Profixter home services",
        itemListElement: [
          {
            "@type": "Offer",
            name: CORE_PRODUCTS[0].title,
            url: `${SITE_URL}${CORE_PRODUCTS[0].href}`,
          },
          {
            "@type": "Offer",
            name: CORE_PRODUCTS[1].title,
            description: `One handyman visit of up to ${ONE_TIME_FALLBACK.minutes} minutes, no membership needed.`,
            url: `${SITE_URL}/book?visit=additional`,
            price: ONE_TIME_FALLBACK.priceDollars.toFixed(2),
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: "Full Day handyman visit",
            description: `About ${FULL_DAY_FALLBACK.hours} hours of handyman work in one day.`,
            url: `${SITE_URL}/book?visit=full-day`,
            price: FULL_DAY_FALLBACK.priceDollars.toFixed(2),
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: "Free first visit",
            description: "A free 90-minute first visit for new Nassau and Suffolk customers, one per home.",
            url: `${SITE_URL}/book/free`,
            price: "0.00",
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: CORE_PRODUCTS[2].title,
            url: `${SITE_URL}${CORE_PRODUCTS[2].href}`,
          },
          {
            "@type": "Offer",
            name: HOME_SUPPORT_AI.title,
            url: `${SITE_URL}${HOME_SUPPORT_AI.href}`,
          },
        ],
      },
    },
    /*
     * The membership, as a service with published prices.
     *
     * The graph already named Membership in the offer catalogue, but with no
     * price and no explanation, so the one thing that distinguishes Profixter
     * from an ordinary handyman company was the one thing a machine could not
     * read. The four tiers are the live monthly prices from app/data/content.ts,
     * the same numbers the plan cards and Stripe checkout use, and each carries
     * the annual alternative underneath it.
     *
     * `plans` is imported rather than restated so a price can never drift
     * between what a homeowner is charged and what the markup claims.
     */
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#membership`,
      name: "Handyman membership",
      alternateName: "Home maintenance membership",
      serviceType: "Handyman and home maintenance membership",
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: schemaServiceAreas,
      url: `${SITE_URL}/handyman-membership`,
      description:
        "A monthly membership giving Long Island homeowners ongoing access to a handyman team for small and medium repairs, installations and maintenance, instead of hiring a new contractor for each task. Standard visits are up to 90 minutes. Membership is not a fixed number of visits per month: members book as often as they need, and each plan sets how many visits can be booked at the same time.",
      offers: plans.map((plan) => ({
        "@type": "Offer",
        name: `${plan.name} membership`,
        description: plan.description,
        url: `${SITE_URL}/membership/plans`,
        price: plan.price.toFixed(2),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        priceSpecification: [
          {
            "@type": "UnitPriceSpecification",
            price: plan.price.toFixed(2),
            priceCurrency: "USD",
            /* Schema.org's own duration code for "per month". */
            unitCode: "MON",
            billingIncrement: 1,
          },
          {
            "@type": "UnitPriceSpecification",
            name: "Annual billing",
            price: (plan.price * ANNUAL_MONTHS_CHARGED).toFixed(2),
            priceCurrency: "USD",
            unitCode: "ANN",
            billingIncrement: 1,
          },
        ],
      })),
    },
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#handyman-service`,
      name: "Handyman service",
      serviceType: "Handyman and home maintenance",
      provider: {
        "@id": `${SITE_URL}/#business`,
      },
      areaServed: schemaServiceAreas,
      url: `${SITE_URL}/book`,
      offers: {
        "@type": "Offer",
        name: "One-Time Handyman Visit",
        description: `One handyman visit of up to ${ONE_TIME_FALLBACK.minutes} minutes, no membership needed.`,
        url: `${SITE_URL}/book?visit=additional`,
        price: ONE_TIME_FALLBACK.priceDollars.toFixed(2),
        priceCurrency: "USD",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: {
        "@id": `${SITE_URL}/#business`,
      },
    },
    {
      "@type": "SiteNavigationElement",
      "@id": `${SITE_URL}/#site-navigation`,
      name: MAIN_NAV_LINKS.map((link) => link.label),
      url: MAIN_NAV_LINKS.map((link) => `${SITE_URL}${link.href}`),
    },
    {
      "@type": "ItemList",
      "@id": `${SITE_URL}/#primary-services`,
      name: "Profixter primary home service paths",
      itemListElement: CORE_PRODUCTS.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.title,
        description: product.summary,
        url: `${SITE_URL}${product.href}`,
      })),
    },
    {
      "@type": "ItemList",
      "@id": `${SITE_URL}/#renovation-services`,
      name: "Profixter renovation and construction services",
      itemListElement: renovationServices.map((service, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: service.title,
        url: `${SITE_URL}/renovations/${service.slug}`,
      })),
    },
  ],
};
