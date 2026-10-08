/**
 * What Profixter's own visit records show, as of a stated date.
 *
 * Every number here comes from a read-only aggregate of completed bookings in
 * production on 2026-10-08 (test accounts removed, cancellations excluded). Only
 * aggregates are kept: no names, no addresses, no notes. The analysis and its
 * method are described in the October 2026 search implementation report.
 *
 * PUBLISHING RULES - keep them when this file is refreshed:
 *  - A town gets figures only when its visits come from at least three
 *    different customers. Below that, a town figure describes one home.
 *  - "Customers" means distinct customer accounts - that is what the data
 *    counts. It is not called "households", which the data cannot verify.
 *  - Task shares are keyword classifications of the customer's own request
 *    text, accurate to roughly five points; they are always shown rounded and
 *    described as "requests mentioning".
 *  - Numbers are stated with their date. They are a snapshot, not a live count.
 */

export const DATA_AS_OF = "October 2026";
export const DATA_AS_OF_ISO = "2026-10-08";
export const DATA_SINCE = "August 2025";

/** Completed visits and households, rounded down so the copy never overstates. */
export const COMPLETED_VISITS_ROUNDED = 800; // 847 exact
export const CUSTOMERS_ROUNDED = 100; // 102 distinct customer accounts
/*
 * 60 town strings in the data, but one is "(unknown)" and one is a ZIP code
 * typed as a town, and spellings were cleaned by hand - so the published claim
 * is the conservative "more than 50 communities", not an exact count.
 */
export const COMMUNITIES_PHRASE = "more than 50 Long Island communities";
export const TOWNS_WITH_FIVE_PLUS_VISITS = 41;
/*
 * The county field is inconsistent for a few towns (Laurel Hollow and Woodbury
 * are tagged Suffolk), so the split is published only as "about two thirds /
 * one third", which holds either way (571/276 as tagged; ~564/283 by geography).
 */
export const COUNTY_SPLIT_PHRASE = "about two thirds in Suffolk and one third in Nassau";

/*
 * In about half of visit requests (48.6%), the customer's own description
 * mentions two or more different kinds of work; about one in five (19.6%)
 * mentions three or more. This is what the customer ASKED for before the visit,
 * read by keyword - so it is always worded as requests, never as work done.
 */
export const MULTI_TASK_REQUEST_PHRASE = "about half of visit requests ask for two or more different kinds of work";

/**
 * Share of visit requests mentioning each kind of work (one visit can mention
 * several). Rounded to whole percent from the keyword classification.
 */
export const TASK_MIX: { label: string; percent: number }[] = [
  { label: "Light fixtures, fans and small electrical fixtures", percent: 23 },
  { label: "Paint touch-ups", percent: 22 },
  { label: "Carpentry, trim and flooring repairs", percent: 21 },
  { label: "Shelves, curtains, mirrors and hanging", percent: 20 },
  { label: "Outdoor: fences, decks, sheds and gates", percent: 15 },
  { label: "Drywall patching", percent: 15 },
  { label: "Doors and locks", percent: 15 },
  { label: "Faucets, toilets and plumbing fixtures", percent: 14 },
  { label: "Furniture assembly", percent: 8 },
  { label: "TV mounting", percent: 6 },
  { label: "Caulking", percent: 6 },
];

/**
 * Towns with figures, under the three-customer rule. Visit counts are floored
 * to the nearest five.
 */
export const TOWN_RECORDS: Record<string, { visits: number; customers: number }> = {
  lindenhurst: { visits: 75, customers: 9 }, // 75 exact
  "west-babylon": { visits: 75, customers: 3 }, // 75
  syosset: { visits: 65, customers: 3 }, // 65
  massapequa: { visits: 35, customers: 4 }, // 37
  seaford: { visits: 35, customers: 3 }, // 36
  "north-babylon": { visits: 30, customers: 4 }, // 30
  "east-northport": { visits: 20, customers: 4 }, // 23
  huntington: { visits: 20, customers: 3 }, // 22
  farmingdale: { visits: 20, customers: 3 }, // 20
  babylon: { visits: 15, customers: 4 }, // 17
  "bay-shore": { visits: 15, customers: 4 }, // 17
};

/** Towns with at least five completed visits, grouped by county, for the locations hub. */
export const TOWNS_WITH_COMPLETED_WORK: Record<"Suffolk County" | "Nassau County", string[]> = {
  "Suffolk County": [
    "Amity Harbor",
    "Amityville",
    "Babylon",
    "Bay Shore",
    "Brookhaven",
    "Commack",
    "Deer Park",
    "Dix Hills",
    "East Northport",
    "East Patchogue",
    "Farmingville",
    "Holbrook",
    "Huntington",
    "Lindenhurst",
    "Miller Place",
    "Nesconset",
    "North Babylon",
    "Patchogue",
    "Port Jefferson",
    "Port Jefferson Station",
    "Ridge",
    "Ronkonkoma",
    "Sayville",
    "Shirley",
    "Smithtown",
    "West Babylon",
    "West Islip",
  ],
  "Nassau County": [
    "Baldwin",
    "Bellmore",
    "Farmingdale",
    "Glen Head",
    "Laurel Hollow",
    "Levittown",
    "Massapequa",
    "Merrick",
    "Old Bethpage",
    "Seaford",
    "South Farmingdale",
    "Syosset",
    "Wantagh",
    "Westbury",
  ],
};
