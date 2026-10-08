import type { Guide } from "@/lib/guides/types";

export const guide: Guide = {
  slug: "new-homeowner-first-year-long-island",
  title: "Just bought a house on Long Island? Your first-year checklist",
  metaTitle: "New Homeowner Checklist for Long Island: The First Year | Profixter",
  metaDescription:
    "What to do in your first week, first month and first year in a Long Island home: locks and shut-offs, the inspection report punch list, older-house quirks, seasonal timing, and finding reliable help for the small jobs.",
  dek: "The first week, the first month and the first year in an older Long Island house, and how to get the inspection punch list done.",
  summary: "First week, first month, first year: shut-offs, the inspection punch list, and finding reliable help.",
  category: "homeownership",
  published: "2026-10-08",
  updated: "2026-10-08",
  body: [
    {
      t: "answer",
      text: "In the **first week**, change or re-key the locks, find the water and electrical shut-offs, and test the smoke and CO detectors. In the **first month**, turn the home inspection report into a punch list and clear the small items while they're small. In the **first year**, learn the house through a full cycle of seasons. Long Island homes are older than the national average (the median home was built in 1956 in Nassau and 1970 in Suffolk, against 1981 nationally), so expect small repairs and line up reliable help early.",
    },
    { t: "h2", text: "The first week" },
    {
      t: "ol",
      items: [
        "**Change or re-key the exterior locks.** You don't know how many keys are out there.",
        "**Find the shut-offs:** main water valve, the electrical panel, and gas if you have it. Label the panel if it isn't.",
        "**Test smoke and carbon monoxide detectors**, and note their age; replace expired units.",
        "**Know your sewer or septic situation.** Much of Suffolk County is unsewered; if you have a cesspool or septic system, find out where it is and when it was last pumped.",
        "**Save the inspection report and the seller's disclosures** somewhere you will find them again.",
      ],
    },
    { t: "h2", text: "The first month: work through the inspection report" },
    {
      t: "p",
      text: "Most inspection reports list a handful of major items and a long tail of small ones: a GFCI outlet that doesn't trip, a loose railing, a door that doesn't latch, missing caulk, a running toilet. The small items are easy to ignore because no single one is urgent. Together they are the punch list that will follow you for years if you let it.",
    },
    {
      t: "ol",
      items: [
        "Split the report into **safety items**, **licensed-trade items** (electrical, plumbing, heating, roof) and **small repairs**.",
        "Book safety and licensed-trade items first, with the right professionals.",
        "Group the small repairs by room and book them together. Our [honey-do list guide](/guides/honey-do-list) has a printable template.",
        "Put anything cosmetic on a later list. Live in the house a few months before deciding what to change.",
      ],
    },
    { t: "h2", text: "Older-house quirks to expect" },
    {
      t: "ul",
      items: [
        "**Plaster walls** in older homes: mounting shelves and TVs takes different anchors and more time.",
        "**Doors and windows that stick** as the house moves with the seasons.",
        "**Old shut-off valves** that seize when you finally need them.",
        "**Previous owners' DIY**: work that was never quite finished, or not done to code. Have anything electrical checked by an electrician.",
      ],
    },
    { t: "h2", text: "The first year: learn the seasons" },
    {
      t: "p",
      text: "A house shows you different problems in each season: drafts in winter, drainage in spring storms, the deck in summer. Before your first freeze, typically around November 1 in Suffolk and northern Nassau, shut off and drain the outdoor faucets. The [Long Island maintenance calendar](/guides/long-island-home-maintenance-calendar) goes season by season.",
    },
    { t: "h2", text: "Line up help before you need it" },
    {
      t: "p",
      text: "The worst time to find a handyman is when something just broke. In the first months, find one you trust, ideally through a small job, so that when the list grows you have someone to call. If your first year turns up a long list, an ongoing arrangement such as a [handyman membership](/handyman-membership) can handle it as a series of visits rather than a new search each time. If your list is short, pay per visit.",
    },
    {
      t: "callout",
      tone: "profixter",
      title: "For new Long Island homeowners",
      text: "New customers in Nassau and Suffolk can start with a **free first 90-minute visit**, one per home, to take a first bite out of the punch list. Real estate agents and family can also [give a membership as a gift](/gift): a set number of months, paid once, nothing renews.",
    },
    { t: "component", name: "offers" },
  ],
  sources: [
    { label: "U.S. Census Bureau, ACS 2024 1-year, table B25035: median year structure built (via Census Reporter)", url: "https://censusreporter.org/tables/B25035/" },
    { label: "Suffolk County: wastewater and septic (Reclaim Our Water)", url: "https://suffolkcountyny.gov/Departments/Planning/Special-Projects/RFEI-Innovative-Alternative-Septic-Systems" },
    { label: "National Weather Service New York: median freeze dates", url: "https://www.weather.gov/media/okx/FrostFreeze/OKX_Frost_Freeze_22_handout.pdf" },
  ],
  related: ["honey-do-list", "long-island-home-maintenance-calendar", "handyman-membership-vs-hiring-per-job", "handyman-for-small-jobs"],
};
