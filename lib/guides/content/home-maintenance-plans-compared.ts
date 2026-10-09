import type { Guide } from "@/lib/guides/types";

/**
 * Comparison of MODELS, not of named local competitors. The one national product
 * named (Lowe's HomeCare+) is described only from Lowe's own announcement, with
 * its date, and availability is left to Lowe's to state. Facts that change are
 * dated in the copy so the page can be maintained.
 */
export const guide: Guide = {
  slug: "home-maintenance-plans-compared",
  title: "Handyman membership, home warranty, or a maintenance subscription: what's the difference?",
  metaTitle: "Handyman Membership vs Home Warranty: What Each Covers | Profixter",
  metaDescription:
    "Four products that sound alike and do different jobs: a home warranty pays for failed systems and appliances, a maintenance subscription like Lowe's HomeCare+ does set upkeep tasks, apps match you with a different pro each time, and a handyman membership covers your running repair list.",
  dek: "Four products that sound similar and cover very different things, so you can buy the one that matches your problem.",
  summary: "Home warranties, maintenance subscriptions, apps and handyman memberships, and what each actually covers.",
  category: "membership",
  published: "2026-10-08",
  updated: "2026-10-08",
  body: [
    {
      t: "answer",
      text: "They solve different problems. A **home warranty** pays toward repairing or replacing major systems and appliances when they fail, and excludes general maintenance. A **maintenance subscription** (for example Lowe's HomeCare+) sends someone for a fixed set of upkeep tasks a couple of times a year. An **app or marketplace** connects you with an independent pro per job. A **handyman membership** gives you ongoing access to a handyman team for the everyday list: repairs, installs and fixes. Many homeowners need none of them; some need two.",
    },
    { t: "h2", text: "Side by side" },
    {
      t: "table",
      caption: "Comparison of home warranties, maintenance subscriptions, marketplaces and handyman memberships",
      head: ["", "Home warranty", "Maintenance subscription", "App or marketplace", "Handyman membership"],
      rows: [
        ["Pays for", "Repair or replacement of covered systems and appliances that fail", "A set list of upkeep tasks", "One job at a time", "Ongoing handyman visits"],
        ["Covers a loose railing, a drywall hole, a new shelf", "No (general maintenance excluded)", "Usually no", "Yes, booked per job", "Yes"],
        ["Covers a broken furnace or fridge", "Yes, if covered and not excluded", "No", "Sometimes, via a specialist", "No (appliance repair excluded)"],
        ["Who comes", "A contractor the warranty company assigns", "The provider's staff", "Whichever independent pro accepts", "Usually the same team"],
        ["Typical cost", "New York averages about $766–$1,029 a year, plus a service fee per claim (often $65–$125)", "Lowe's HomeCare+: $99 a year at launch", "Per job, plus platform fees on some apps", "Profixter: $149–$499 a month"],
      ],
      note: "Warranty figures from This Old House's New York cost guide (updated June 2026). Lowe's HomeCare+ from Lowe's March 17, 2026 announcement. Prices change; check the provider.",
    },
    { t: "h2", text: "Home warranties" },
    {
      t: "p",
      text: "A home warranty is a service contract for systems (heating, cooling, plumbing, water heater) and appliances (washer, dryer, dishwasher, refrigerator). When a covered item fails, you call the warranty company, pay a service fee, and they send a contractor to repair or replace it under the contract's terms. They commonly exclude **general maintenance**, cosmetic damage, pre-existing conditions and improper installation. A warranty won't patch a wall, fix a sticking door or hang a TV. It is protection against a big, unexpected repair bill, not help with the to-do list.",
    },
    { t: "h2", text: "Maintenance subscriptions" },
    {
      t: "p",
      text: "Some retailers and service companies now sell scheduled upkeep. Lowe's announced HomeCare+ on March 17, 2026: $99 a year for two in-home visits, each with up to seven set tasks (dryer vent cleaning, HVAC and refrigerator filter changes, an electric water heater flush, garage door lubrication, smoke and CO detector batteries, and light bulbs), done by store associates for MyLowe's Rewards members in select ZIP codes. It is a good fit for keeping routine items on schedule. It is not handyman work: no repairs, no installs, no to-do list. Check Lowe's site for availability at your address.",
    },
    { t: "h2", text: "Apps and marketplaces" },
    {
      t: "p",
      text: "Platforms such as TaskRabbit, Thumbtack and Angi connect you with independent pros per job. They are good for a one-off job and for comparing quotes. Their business models differ: some charge the customer service fees on top of the pro's rate, and some charge pros for leads. Either way, you are often hiring a different person each time.",
    },
    { t: "h2", text: "Handyman memberships" },
    {
      t: "p",
      text: "With a handyman membership, you pay monthly for ongoing access to a handyman team and book visits as jobs come up. It doesn't pay for a failed furnace and it isn't a checklist of set tasks: it covers the everyday list of small repairs and installations that every house produces. Plans vary widely between providers in how much time a visit includes, how far ahead you book, what is excluded and whether materials are included, so compare those, not just the monthly price.",
    },
    {
      t: "callout",
      tone: "profixter",
      title: "Profixter's membership",
      text: "Long Island homeowners get 90-minute visits for everyday home tasks with the same local team. There is no monthly visit allowance: book as often as you need, and your plan sets how many visits you can have booked at the same time. Plans run $149 to $499 a month, month to month. [How it works](/handyman-membership) · [Compare plans](/membership/plans).",
    },
    { t: "h2", text: "Which do you need?" },
    {
      t: "table",
      caption: "Matching the problem to the product",
      head: ["If your worry is…", "Look at"],
      rows: [
        ["An expensive failure of the furnace, water heater or appliances", "A home warranty"],
        ["Remembering filters, batteries and routine upkeep", "A maintenance subscription, or a calendar"],
        ["One job, done once, by whoever is available", "An app or a single handyman visit"],
        ["A list of small repairs that never empties", "A handyman membership"],
      ],
    },
    {
      t: "p",
      text: "Still deciding on cost? The [membership vs per-job calculator](/guides/handyman-membership-vs-hiring-per-job) shows when a membership is worth it, and when it isn't.",
    },
  ],
  sources: [
    { label: "Lowe's: HomeCare+ launch announcement, March 17, 2026 (PR Newswire)", url: "https://www.prnewswire.com/news-releases/lowes-launches-an-associate-powered-home-maintenance-subscription-called-homecare-nationwide-302715274.html" },
    { label: "This Old House: Home warranty costs in New York (updated June 2026)", url: "https://www.thisoldhouse.com/home-finances/home-warranty-new-york" },
    { label: "TaskRabbit Support: Service fee", url: "https://support.taskrabbit.com/hc/en-us/articles/204411610-What-s-the-Taskrabbit-Service-Fee-" },
    { label: "Angi: FAQs (how pros advertise)", url: "https://www.angi.com/faqs" },
  ],
  related: ["handyman-membership-vs-hiring-per-job", "handyman-cost-long-island", "handyman-for-small-jobs", "new-homeowner-first-year-long-island"],
};
