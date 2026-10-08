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
 *    different households. Below that, a town figure describes one home.
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
export const HOUSEHOLDS_ROUNDED = 100; // 102 exact
export const TOWNS_SERVED = 60;
export const TOWNS_WITH_FIVE_PLUS_VISITS = 41;
export const COUNTY_SPLIT = { suffolkPercent: 67, nassauPercent: 33 } as const;

/** About half of visits covered two or more different kinds of job. */
export const MULTI_TASK_VISIT_PERCENT = 49; // 48.6%
export const THREE_PLUS_TASK_VISIT_PERCENT = 20; // 19.6%

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
 * Towns with figures, under the three-household rule. Visit counts are floored
 * to the nearest five.
 */
export const TOWN_RECORDS: Record<string, { visits: number; households: number }> = {
  lindenhurst: { visits: 75, households: 9 },
  "west-babylon": { visits: 75, households: 3 },
  syosset: { visits: 65, households: 3 },
  massapequa: { visits: 35, households: 4 },
  seaford: { visits: 35, households: 3 },
  "north-babylon": { visits: 30, households: 4 },
  "east-northport": { visits: 20, households: 4 },
  huntington: { visits: 20, households: 3 },
  farmingdale: { visits: 20, households: 3 },
  babylon: { visits: 15, households: 4 },
  "bay-shore": { visits: 15, households: 4 },
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
