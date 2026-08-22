/**
 * The membership questions and answers.
 *
 * Lifted out of FAQSection so there is one set of answers behind three
 * surfaces: the accordion on /membership/plans, the FAQPage structured data
 * that describes it, and the explainer at /handyman-membership. Google only
 * accepts FAQ markup that matches question and answer text visible on the
 * page, so sharing the source is not tidiness - it is what keeps the markup
 * honest as the copy changes.
 *
 * Every answer here describes how Membership actually behaves in production:
 * active-appointment limits per plan, the 90-minute visit, what materials each
 * tier covers, and where larger work goes instead.
 */
export type MembershipFaq = { q: string; a: string };

export const MEMBERSHIP_FAQS: MembershipFaq[] = [
  {
    q: "Why become a Member instead of calling a handyman when something breaks?",
    a: "Membership gives your home one ongoing team instead of a new search every time. You can book online, keep the small list moving, and work with a company that learns your home over time.",
  },
  {
    q: "What's included in the membership?",
    a: "Membership is built for small and medium home tasks that fit within your visit time: repairs, installations, maintenance, drywall patches, caulking, paint touch-ups, doors, locks, shelves, fixtures, and similar handyman work. Larger work moves into a project estimate.",
  },
  {
    q: "Are there limits per month?",
    a: "There is no hard monthly cap on standard visit requests. Your plan controls how many active appointments you can have at one time, plus benefits like basic materials, Priority Visits, and project time. Appointment availability still depends on the schedule.",
  },
  {
    q: 'What does "active appointment" mean?',
    a: "An active appointment is a visit that is pending, booked, or scheduled. Once that visit is completed, you can book the next one. Basic includes 1 active appointment at a time. Plus, Premium, and Elite include 2 active appointments at a time.",
  },
  {
    q: "How long is each visit?",
    a: "Each standard visit is up to 90 minutes. It is designed for small and medium tasks, punch lists, repairs, installations, and maintenance items that can usually be completed during that visit.",
  },
  {
    q: "Are materials included?",
    a: "Basic includes labor only. Plus and Premium include basic materials for small tasks. Larger materials, special-order items, fixtures, appliances, and project materials are quoted or approved separately.",
  },
  {
    q: "How does cancellation work?",
    a: "Plans are month-to-month with no long-term contract. If you cancel, your membership stays active through the end of the current billing period and you will not be charged again.",
  },
  {
    q: "What areas do you serve?",
    a: "Profixter is based near Babylon and serves homeowners across Nassau and Suffolk Counties.",
  },
  {
    q: "Do I need to be home during the visit?",
    a: "You can be home if you prefer, but it is not always required. Many members provide access instructions. We document the visit and keep notes so the same trusted team can continue learning your home.",
  },
  {
    q: "What if my job is bigger than a regular visit?",
    a: "Larger projects like roofing, siding, bathroom remodeling, kitchen work, full-room painting, major electrical, major plumbing, or longer repairs are handled as separate project estimates. You still stay with Profixter; the work just moves into the right path.",
  },
  {
    q: "Can I still book only one visit?",
    a: "Yes. If Membership is not the right fit today, you can book a one-time handyman visit. Membership is usually better for homeowners who expect to need help more than once.",
  },
  {
    q: "Are you licensed and insured?",
    a: "Yes. Profixter is licensed as a New York Home Improvement Contractor under license HI-71484 and is fully insured.",
  },
];

/**
 * The questions a given surface actually renders.
 *
 * /membership/plans hides the cancellation question, because the plan cards
 * beside it already carry the cancellation controls. The markup has to hide it
 * too: Google only accepts FAQ structured data whose questions and answers are
 * visible on the page, so a list built from the full set would have been
 * describing a question that surface does not show.
 */
export function visibleMembershipFaqs(hideCancellation = false): MembershipFaq[] {
  return hideCancellation
    ? MEMBERSHIP_FAQS.filter(({ q }) => !q.toLowerCase().includes("cancellation"))
    : MEMBERSHIP_FAQS;
}

/** FAQPage JSON-LD for a page that actually displays these questions. */
export function membershipFaqJsonLd(pageUrl: string, hideCancellation = false) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: visibleMembershipFaqs(hideCancellation).map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}
