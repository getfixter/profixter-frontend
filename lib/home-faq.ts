/**
 * The homepage FAQ: the questions and answers HomeLanding renders.
 */

/*
 * Every answer here is wording the site already uses elsewhere; nothing new is promised.
 *
 * Its own module, without "use client", because two places read it: the
 * homepage FAQ (HomeLanding, a client component) and the FAQPage markup the
 * server-rendered app/page.tsx emits. One list means the markup can never
 * describe questions the page does not show.
 */
export const HOME_FAQ: Array<{ q: string; a: string; link?: { href: string; label: string } }> = [
  {
    q: "What's included in the free visit?",
    a: "Up to 90 minutes of handyman labor at your home. One per home, no card needed. If special parts are needed, you only cover the material cost.",
  },
  {
    q: "What can a Fixter help with?",
    a: "Everyday home jobs: mounting, assembly, small repairs, fixtures, patching and more. Big remodels, structural work, large electrical or plumbing projects and appliance repairs aren't included - for those, see Projects.",
    link: { href: "/projects", label: "Larger projects" },
  },
  {
    q: "What if the job takes longer than 90 minutes?",
    a: "We can split the work into more than one visit, based on availability.",
  },
  /*
   * The bridge from the ordinary problem to the membership, on the page Google
   * sends "handyman" searches to. Answer first: lists are normal; start with
   * the free visit; only if small jobs keep coming does membership make sense.
   * The figure is from the visit records (about half of requests ask for two
   * or more kinds of work).
   */
  {
    q: "I have a list of small jobs. Where do I start?",
    a: "Lists are normal: about half of the visit requests we get ask for two or more kinds of work. Start with your free first visit. If small jobs keep coming, a membership lets you book 90-minute visits as often as you need, and your plan sets how many you can have booked at the same time.",
    link: { href: "/guides/handyman-for-small-jobs", label: "Small jobs: your options" },
  },
  {
    q: "Where do you work?",
    a: "Nassau and Suffolk counties on Long Island.",
  },
  {
    q: "How does membership work?",
    a: "There's no monthly visit allowance. Book as often as you need - your plan simply determines how many visits you can have booked at the same time. Plans start at $149 a month.",
    link: { href: "/membership/plans", label: "See plans" },
  },
  {
    q: "Can I reschedule?",
    a: "Yes. Please reschedule early so we can offer the slot to another customer.",
  },
];
