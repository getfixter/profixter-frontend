import type { Guide } from "@/lib/guides/types";

export const guide: Guide = {
  slug: "handyman-membership-vs-hiring-per-job",
  title: "Handyman membership or hiring per job: which costs less?",
  metaTitle: "Handyman Membership vs Hiring Per Job: Calculator & Honest Comparison | Profixter",
  metaDescription:
    "A handyman membership only saves money if small jobs keep coming. Use the calculator to compare a monthly membership with paying per visit, and see when hiring per job is clearly the better deal.",
  dek: "The honest arithmetic, a calculator for your own numbers, and the cases where a membership is the wrong choice.",
  summary: "A calculator and an honest comparison, including when paying per visit is clearly better.",
  category: "membership",
  published: "2026-10-08",
  updated: "2026-10-08",
  body: [
    {
      t: "answer",
      text: "It depends almost entirely on **how often you need someone to come out**. Per visit is cheaper if you need help a few times a year. A membership becomes cheaper once visits are frequent: on Profixter's published prices, a Basic membership paid annually ($1,490) costs less than $99 One-Time Visits from about **16 visits a year**, and less than $150 visits from about **10 a year**. Below those numbers, paying per visit is the better deal, and we would say so.",
    },
    { t: "component", name: "membership-calculator" },
    { t: "h2", text: "What you are actually comparing" },
    {
      t: "table",
      caption: "Hiring per job vs a handyman membership",
      head: ["", "Hiring per job", "Handyman membership"],
      rows: [
        ["How you pay", "Per visit: hourly with a minimum, a quote, or a fixed visit price", "A monthly or annual fee"],
        ["Finding someone", "Every time, unless you have a regular", "Once"],
        ["Who comes", "Whoever is available", "The same team, who learn the house"],
        ["Small jobs", "Often wait until there are enough to justify a minimum", "Booked as they come up"],
        ["Cost predictability", "Varies job to job", "Fixed monthly line"],
        ["If you need nothing for months", "You pay nothing", "You still pay the fee"],
        ["Best for", "Occasional, one-off needs", "A steady stream of small jobs"],
      ],
    },
    { t: "h2", text: "When hiring per job is the better choice" },
    {
      t: "ul",
      items: [
        "You need help a few times a year, not a few times a month.",
        "You have one specific job, and it's done when it's done.",
        "The work is a single large project (a roof, a kitchen, a re-pipe): that's a contractor with a written estimate, not handyman visits.",
        "You already have a reliable handyman you're happy with.",
        "You're selling soon and only need a pre-closing punch list cleared.",
      ],
    },
    { t: "h2", text: "When a membership makes more sense" },
    {
      t: "ul",
      items: [
        "Small jobs arrive faster than you get around to booking them.",
        "You spend more time finding, vetting and chasing someone than the repair takes.",
        "You want the same people back, who already know the house.",
        "You'd rather budget a fixed monthly amount than absorb unpredictable call-outs.",
        "The house is older, or new to you, and the list is long. Census data puts the median Nassau home at built in 1956 and the median Suffolk home in 1970.",
      ],
    },
    { t: "h2", text: "What the calculator can't price" },
    {
      t: "p",
      text: "Cost per visit is only part of it. A per-visit handyman's minimum often covers more time than one small job uses; a membership visit lets you use the whole visit for whatever is on the list. Waiting costs something too: a dripping faucet or a sticking door you live with for two months while you save up jobs. And the search itself, finding someone who answers, shows up and does good work, is a real cost that only disappears once you have someone reliable.",
    },
    {
      t: "p",
      text: "Equally, a membership has costs the calculator does understate: you pay in quiet months, and regular visits are booked ahead rather than same-day. If you value flexibility to pay nothing, that matters.",
    },
    { t: "h2", text: "How Profixter's membership works" },
    {
      t: "ul",
      items: [
        "**90-minute visits** for everyday home tasks, with the same local team.",
        "**No monthly visit allowance.** Book as often as you need; your plan sets how many visits you can have booked at the same time (one on Basic, two on Plus and above).",
        "**Booked ahead.** Regular member visits are scheduled at least a week out; Premium and Elite include Priority Visits for things that can't wait.",
        "**Month to month.** No long-term contract; annual billing is 12 months for the price of 10.",
        "**Not covered:** appliance repair, whole-room painting, large electrical or plumbing work, renovations. Those are separate.",
      ],
    },
    { t: "component", name: "plan-table" },
    {
      t: "p",
      text: "Not sure yet? New Nassau and Suffolk customers can start with a [free first visit](/book/free), or book a single [One-Time Visit](/book?visit=additional) and decide later. [How the membership works, in full](/handyman-membership).",
    },
  ],
  sources: [
    { label: "U.S. Census Bureau, ACS 2024 1-year, table B25035: median year structure built (via Census Reporter)", url: "https://censusreporter.org/tables/B25035/" },
    { label: "HomeGuide: Handyman prices (typical minimum charges)", url: "https://homeguide.com/costs/handyman-prices" },
  ],
  related: ["home-maintenance-plans-compared", "handyman-cost-long-island", "handyman-for-small-jobs", "handyman-minimum-charges"],
};
