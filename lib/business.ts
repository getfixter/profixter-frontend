/**
 * Who Profixter is, in one place.
 *
 * WHY THIS FILE EXISTS
 * The October 2026 discovery audit found the business described five different
 * ways across the web: Profixter, ProFixter Handyman, Pro.Fixter, Mr. Fixter and
 * Premium Island Homes Inc., with a second phone number in old posts and
 * "unlimited visits" in the old bios. Search engines and AI assistants build
 * their picture of a local business by matching those descriptions against each
 * other, so every inconsistency is a reason to trust the listing less.
 *
 * This is the canonical record. The site-wide structured data, the facts boxes
 * on the membership and guide pages, and the external listing package all read
 * from here, so a change is made once and cannot drift between them.
 *
 * Prices are NOT restated here. Membership prices live in app/data/content.ts
 * (the same numbers checkout uses); the One-Time and Full Day prices are
 * administered on the server and read live by lib/offers.ts, with the fallbacks
 * below used only when the API cannot be reached.
 */

/** The brand, as written in prose. The logo sets it as PRO / FIXTER. */
export const BRAND_NAME = "Profixter";

/**
 * Other names the same business is legitimately known by.
 *
 * "ProFixter Handyman" is the Google Business Profile name and "ProFixter" the
 * logo's styling. The retired "Mr. Fixter" and "Pro.Fixter" names are left out
 * on purpose: they are what the cleanup is moving away from, and publishing them
 * as current names would tie the old "unlimited visits" posts to the business
 * more firmly than they already are.
 */
export const BRAND_ALTERNATE_NAMES = ["ProFixter", "ProFixter Handyman"] as const;

export const LEGAL_NAME = "Premium Island Homes Inc.";

/** Home improvement contractor license number, as printed on the About page. */
export const HIC_LICENSE = "HI-71484";

/**
 * How the license is described in new copy.
 *
 * Verified on Suffolk County Consumer Affairs' public lookup (2026-10-08):
 * HI-71484 is a SUFFOLK COUNTY home improvement license. New York State does
 * not issue one. Older copy across the site said "NY State Licensed" and
 * "verifiable through the NYS Department of State", which was not accurate and
 * has been corrected. No Nassau County license was found on Nassau's lookup, so
 * nothing on the site may say the business is licensed in Nassau.
 */
export const LICENSE_PHRASE = `Suffolk County home improvement license ${HIC_LICENSE}`;

/**
 * Where the business is, to the precision it is published.
 *
 * Town and ZIP only, never the street. The Google profile currently shows a
 * street address; whether it should stay visible or become a service-area
 * listing is an owner decision (see the external package). Locality-level data
 * is true under either choice, so the website cannot contradict the profile
 * whichever way that decision goes.
 */
export const BUSINESS_LOCATION = {
  locality: "Lindenhurst",
  region: "NY",
  postalCode: "11757",
  country: "US",
  town: "Town of Babylon",
  county: "Suffolk County",
} as const;

/** The counties served. Every town page sits inside one of these. */
export const SERVICE_COUNTIES = ["Suffolk County", "Nassau County"] as const;

/** Matches the Google Business Profile: 8 AM to 6 PM, every day. */
export const OPENING_HOURS = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  opens: "08:00",
  closes: "18:00",
  display: "8 AM – 6 PM, seven days a week",
} as const;

/**
 * Official profiles, for schema.org sameAs.
 *
 * Only profiles the business controls AND that describe it accurately. The
 * Google Maps link is the profile's own CID URL.
 *
 * Instagram (@mrfixter.ny) is deliberately NOT listed yet: it still carries the
 * retired Mr.Fixter name and an "Unlimited visits" bio, and sameAs tells
 * search engines to treat that profile as this business. Add
 * "https://www.instagram.com/mrfixter.ny/" (or its new handle) once the bio and
 * name are corrected - a change coordinated with the marketing agency.
 * facebook.com/profixter and tiktok.com/@profixter belong to other people and
 * must never be listed.
 */
export const OFFICIAL_PROFILES = ["https://maps.google.com/?cid=17232690381782599634"] as const;

/** Fallbacks for the live offer settings. See lib/offers.ts. */
export const ONE_TIME_FALLBACK = { priceDollars: 99, minutes: 90 } as const;
export const FULL_DAY_FALLBACK = { priceDollars: 499, hours: 8 } as const;

/** Every standard visit, member or one-time, is up to this long. */
export const STANDARD_VISIT_MINUTES = 90;

/**
 * The one-sentence description, reused wherever a short definition is needed.
 * Deliberately says both products, and never "unlimited".
 */
export const SHORT_DESCRIPTION =
  "Profixter is a Long Island handyman and home-maintenance company based in Lindenhurst, serving Nassau and Suffolk Counties, that offers both one-time handyman visits and a recurring handyman membership.";

/**
 * What is outside a handyman visit, member or not. Mirrors the server's
 * excluded list and the membership FAQ.
 */
export const NOT_HANDYMAN_WORK = [
  "Appliance repair",
  "Painting entire rooms",
  "Large electrical work, such as panels and rewiring",
  "Plumbing remodels and re-piping",
  "Roofing, siding and renovations",
  "Structural work and multi-day projects",
] as const;
