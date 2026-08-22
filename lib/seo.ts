import {
  CORE_PRODUCTS,
  HOME_SUPPORT_AI,
  MAIN_NAV_LINKS,
} from "@/lib/site-architecture";
import {
  getSeoEngineSitemapRoutes,
  renovationServices,
  serviceAreas,
} from "@/lib/seo-content";

export const SITE_URL = "https://www.profixter.com";
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
  url: "/images/hero-bg.webp",
  width: 1200,
  height: 630,
  alt: "Profixter home support for Long Island homeowners",
};

export const LOCAL_SERVICE_AREAS = [
  "Long Island",
  "Nassau County",
  "Suffolk County",
  ...serviceAreas.map((area) => area.name),
] as const;

export const PUBLIC_SITEMAP_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/membership", changeFrequency: "weekly", priority: 0.98 },
  { path: "/book", changeFrequency: "weekly", priority: 0.94 },
  { path: "/projects", changeFrequency: "weekly", priority: 0.94 },
  { path: "/kitchen-bathroom", changeFrequency: "monthly", priority: 0.9 },
  { path: "/home-support", changeFrequency: "weekly", priority: 0.82 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/communities", changeFrequency: "monthly", priority: 0.72 },
  { path: "/july4", changeFrequency: "monthly", priority: 0.62 },
  ...getSeoEngineSitemapRoutes(),
  { path: "/careers", changeFrequency: "yearly", priority: 0.35 },
  { path: "/partnerships", changeFrequency: "monthly", priority: 0.45 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.25 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.25 },
  { path: "/communication-consent", changeFrequency: "yearly", priority: 0.2 },
] as const;

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
      url: SITE_URL,
      telephone: BUSINESS_PHONE_E164,
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
        "Monthly home maintenance membership",
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
            url: `${SITE_URL}${CORE_PRODUCTS[1].href}`,
            price: "99.00",
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
        url: `${SITE_URL}/book`,
        price: "99.00",
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
