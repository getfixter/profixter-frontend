import type { Guide } from "@/lib/guides/types";

export const guide: Guide = {
  slug: "long-island-home-maintenance-calendar",
  title: "A Long Island home maintenance calendar, season by season",
  metaTitle: "Long Island Home Maintenance Checklist by Season (Printable) | Profixter",
  metaDescription:
    "What to do to a Long Island house each season: shutting off outdoor faucets before the first freeze (around November 1 in Suffolk), storm prep for nor'easter and hurricane season, gutters, and the small repairs that show up each time of year.",
  dek: "Timed to Long Island's actual weather: first freeze, nor'easters, hurricane season, and the small repairs each season tends to bring.",
  summary: "Season-by-season upkeep timed to Long Island's freeze dates and storm seasons, with a printable checklist.",
  category: "maintenance",
  published: "2026-10-08",
  updated: "2026-10-08",
  body: [
    {
      t: "answer",
      text: "The dates that matter most on Long Island are the **first freeze**, which typically arrives around **November 1** in Suffolk and northern Nassau and around **November 11** in southern Nassau, and **storm season**: nor'easters are most frequent from September to April, and the Atlantic hurricane season runs June to November, peaking around September 10. Shut off and drain outdoor faucets before the first freeze, clear gutters after the leaves fall, and do storm checks in late summer.",
    },
    { t: "h2", text: "Fall (September–November): the most important season" },
    {
      t: "ul",
      items: [
        "**Before the first freeze:** shut off and drain outdoor faucets and irrigation, and disconnect hoses. The Suffolk County Water Authority says outdoor faucets and sprinkler systems are the most common source of winter pipe breaks.",
        "**After the leaves drop:** clear gutters and check downspouts discharge away from the house.",
        "**Seal the gaps:** weatherstripping on exterior doors, caulk around windows, door sweeps.",
        "**Safety:** test smoke and carbon monoxide detectors and replace batteries or expired units.",
        "**Storm check:** loose fence boards, gates and anything in the yard that could become a projectile in a nor'easter.",
      ],
    },
    { t: "h2", text: "Winter (December–February)" },
    {
      t: "ul",
      items: [
        "Watch for ice dams and drips at ceilings after snow.",
        "Keep pipes in unheated areas (garages, crawl spaces, exterior walls) from freezing.",
        "**Indoor list season:** with more time inside, this is when the inside list gets noticed: sticking doors, trim, touch-ups.",
        "Check door and window drafts you noticed in the cold and add them to the spring list.",
      ],
    },
    { t: "h2", text: "Spring (March–May)" },
    {
      t: "ul",
      items: [
        "After the last freeze (roughly early April), turn outdoor water back on slowly and look for leaks at the faucet and inside the wall behind it.",
        "Walk the outside: fence, deck boards, railings, gate latches, siding and trim after winter storms.",
        "Clean or replace HVAC filters and get cooling serviced before the first hot week.",
        "Re-caulk tubs, showers and sinks; spring is when mildewed caulk gets dealt with.",
      ],
    },
    { t: "h2", text: "Summer (June–August)" },
    {
      t: "ul",
      items: [
        "**Hurricane prep before the peak:** secure loose exterior items, check that gutters and drains are clear, know where your water and electrical shut-offs are.",
        "Decks, fences, gates and outdoor furniture.",
        "Check window screens and door closers.",
        "Look at caulk and grout around tubs and showers before it fails.",
      ],
    },
    {
      t: "callout",
      text: "Some upkeep belongs to a specialist: furnace and boiler service, and cesspool or septic pumping, which many Suffolk homes need because much of the county is unsewered. Book those with the right professional.",
    },
    {
      t: "checklist",
      title: "Long Island seasonal checklist",
      intro: "Freeze dates are typical, not guaranteed: watch the forecast in late October.",
      groups: [
        {
          name: "Fall",
          items: [
            "Shut off and drain outdoor faucets and irrigation",
            "Disconnect and store hoses",
            "Clean gutters after leaves drop",
            "Weatherstrip doors, caulk windows",
            "Test smoke and CO detectors",
            "Secure fences, gates and yard items",
          ],
        },
        {
          name: "Winter",
          items: [
            "Watch ceilings for drips after snow",
            "Protect pipes in unheated spaces",
            "Note drafts for spring",
            "Work through the indoor repair list",
          ],
        },
        {
          name: "Spring",
          items: [
            "Turn outdoor water back on, check for leaks",
            "Inspect fence, deck, railings and trim",
            "Replace HVAC filters, service cooling",
            "Re-caulk tubs and showers",
          ],
        },
        {
          name: "Summer",
          items: [
            "Hurricane prep before September",
            "Repair decks, fences and gates",
            "Check screens and door closers",
            "Check grout and caulk",
          ],
        },
      ],
      blankLines: 3,
    },
    { t: "h2", text: "Small repairs, all year" },
    {
      t: "p",
      text: "Seasonal tasks are predictable; the small repairs in between are not. If those show up a few times a year, book [a single visit](/book?visit=additional) when you need one. If your list refills every few weeks, that's what a [recurring handyman membership](/handyman-membership) is for.",
    },
    { t: "component", name: "offers" },
  ],
  sources: [
    { label: "National Weather Service New York: Frost/Freeze program and median freeze dates", url: "https://www.weather.gov/media/okx/FrostFreeze/OKX_Frost_Freeze_22_handout.pdf" },
    { label: "National Weather Service: Nor'easters", url: "https://www.weather.gov/safety/winter-noreaster" },
    { label: "NOAA: Peak of hurricane season", url: "https://www.noaa.gov/stories/peak-of-hurricane-season-why-now" },
    { label: "Suffolk County Water Authority: Protect your pipes", url: "https://www.scwa.com/protect-your-pipes/" },
    { label: "Suffolk County: wastewater and septic (Reclaim Our Water)", url: "https://suffolkcountyny.gov/Departments/Planning/Special-Projects/RFEI-Innovative-Alternative-Septic-Systems" },
  ],
  related: ["new-homeowner-first-year-long-island", "honey-do-list", "helping-a-parent-with-home-repairs", "handyman-for-small-jobs"],
};
