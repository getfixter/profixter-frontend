import type { Guide } from "@/lib/guides/types";

export const guide: Guide = {
  slug: "honey-do-list",
  title: "How to get a whole honey-do list done",
  metaTitle: "How to Get a Honey-Do List Done (Printable Template) | Profixter",
  metaDescription:
    "A practical way to clear a home repair list: write it so a handyman can price it, group jobs by trade and room, decide what waits, and choose between one long visit, several short ones or a recurring handyman. Printable checklist included.",
  dek: "Write it down the right way, group it, and pick the right kind of help. With a printable list for the fridge.",
  summary:
    "Turn a growing list of small repairs into one or two efficient visits, with a printable punch-list template.",
  category: "small-jobs",
  published: "2026-10-08",
  updated: "2026-10-08",
  body: [
    {
      t: "answer",
      text: "Write every job down with a photo and a location, group the list by trade (handyman work, electrician, plumber) and by room, pull out anything urgent or unsafe, and then book the handyman part as **one longer visit** if you have a lot at once, or as **regular short visits** if new jobs keep appearing. A clear list is the biggest single factor in how much gets done per hour, because the handyman spends the time working instead of discovering the job.",
    },
    { t: "h2", text: "Step 1: Write the list so someone else can price it" },
    {
      t: "p",
      text: "\"Fix the bathroom\" can't be estimated. \"Re-caulk the tub, the upstairs bathroom faucet drips, towel bar is loose\" can. For each item, note:",
    },
    {
      t: "ul",
      items: [
        "**Where** it is (room and floor).",
        "**What** is wrong or what you want, in one line.",
        "**A photo**, and a second one showing the surroundings (the wall, the ceiling height, the outlet nearby).",
        "**Parts and materials**: do you already have the fixture, the mount, the paint, the hardware? Note the brand or model if you know it.",
        "**How soon** it needs doing: now, this month, whenever.",
      ],
    },
    {
      t: "p",
      text: "That last column matters more than it looks. It is what lets you split the list into a visit now and a visit later instead of waiting until everything is ready.",
    },
    { t: "h2", text: "Step 2: Pull out what isn't handyman work" },
    {
      t: "p",
      text: "Most lists contain one or two items that belong to a licensed trade or a specialist, and booking them into a handyman visit wastes the visit. Typical examples:",
    },
    {
      t: "table",
      caption: "Who to ask first for common list items",
      head: ["On the list", "Ask first"],
      rows: [
        ["Patch drywall, touch up paint", "Handyman (a painter for whole rooms)"],
        ["Fix a sticking door, replace a lockset", "Handyman"],
        ["Shelves, curtain rods, mirrors, TV mount", "Handyman"],
        ["Swap a light fixture or fan; replace a faucet or toilet part", "Ask the company whether it is in scope; some fixture work requires a licensed electrician or plumber"],
        ["New outlet or circuit, panel work", "Licensed electrician"],
        ["Moving or adding plumbing lines, water heater", "Licensed plumber"],
        ["Appliance that won't run", "Appliance repair service"],
        ["Leaking roof, rotted siding, structural sag", "Contractor with a written estimate"],
      ],
      note: "On Long Island, electrical and plumbing work done for pay is governed by county and town rules, and they differ between Nassau and Suffolk. A good company tells you up front what it will and won't do, and when a licensed electrician or plumber is required.",
    },
    { t: "h2", text: "Step 3: Group by room and by what's needed" },
    {
      t: "p",
      text: "Order the remaining list so the work flows: everything needing a ladder together, everything needing the water off together, everything in the same room together. Put anything that needs a store run (a specific bulb, a matching hinge) at the top, so it can be bought before the visit rather than during it.",
    },
    { t: "h2", text: "Step 4: Decide how to book it" },
    {
      t: "table",
      caption: "Booking options for a honey-do list",
      head: ["Your list", "Book it as"],
      rows: [
        ["One or two quick items", "A single short visit"],
        ["Five to fifteen items, all available now", "One long visit, a half day or a full day"],
        ["A list that refills every month", "Regular short visits, or a recurring handyman membership"],
        ["A list with one big item and many small ones", "Split: the big item as a project, the rest as a handyman visit"],
      ],
    },
    {
      t: "p",
      text: "A long single visit is the most efficient use of a trip. Regular visits are better when the list never really empties, because you stop living with broken things while you wait for the list to be worth a call. That second situation is exactly what a [recurring handyman membership](/handyman-membership) is designed for.",
    },
    { t: "h2", text: "Printable honey-do list" },
    {
      t: "checklist",
      title: "Home repair punch list",
      intro: "Tick what applies, add your own, and note the room and a photo for each item before you book.",
      groups: [
        {
          name: "Walls and doors",
          items: [
            "Drywall dents, holes or nail pops",
            "Paint touch-ups",
            "Door that sticks, rubs or won't latch",
            "Loose doorknob or lock to replace",
            "Squeaky hinges",
          ],
        },
        {
          name: "Kitchen and bath",
          items: [
            "Dripping faucet",
            "Running or wobbly toilet",
            "Tub or shower caulk",
            "Loose towel bar or toilet paper holder",
            "Cabinet door or drawer out of line",
          ],
        },
        {
          name: "Hanging and mounting",
          items: ["TV to mount", "Shelves to put up", "Curtain rods or blinds", "Mirrors and artwork", "Hooks, racks and organizers"],
        },
        {
          name: "Lights and fixtures",
          items: [
            "Light fixture to swap",
            "Ceiling fan to install or balance",
            "Smoke or CO detector to replace",
            "Bulbs out of reach",
          ],
        },
        {
          name: "Outside",
          items: ["Loose fence board or gate latch", "Deck board or railing", "Gutter debris", "Weatherstripping on exterior doors"],
        },
        {
          name: "Assembly and odd jobs",
          items: ["Furniture to assemble", "Something to move or rehang", "Childproofing", "Smart doorbell or thermostat"],
        },
      ],
      blankLines: 5,
    },
    { t: "h2", text: "How Profixter handles lists" },
    {
      t: "p",
      text: "Profixter's visits are built around lists, not single jobs. In our records about half of all visits covered two or more different kinds of work. If you are in Nassau or Suffolk County you can send the list with photos when you book, and the visit is planned around it.",
    },
    { t: "component", name: "offers" },
  ],
  related: ["handyman-for-small-jobs", "what-fits-in-a-90-minute-handyman-visit", "handyman-minimum-charges", "new-homeowner-first-year-long-island"],
};
