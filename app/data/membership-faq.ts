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
  /*
   * THE QUESTION CUSTOMERS ACTUALLY ASK.
   *
   * This used to be "What does 'active appointment' mean?" — a question that
   * only existed because we had invented the term, and which answered it by
   * teaching the customer our vocabulary. What a homeowner wants to know is how
   * many visits they get, and the honest answer is that the question does not
   * apply: membership is a pace, not an allowance. Say that first.
   */
  {
    q: "How many visits do I get each month?",
    a: "Membership isn't a set number of visits per month. Book as often as you need — Basic lets you have one visit booked at a time, while Plus, Premium and Elite let you have up to two. Once a visit is done, you can book the next one. Scheduling is subject to availability.",
  },
  {
    q: "Are materials included?",
    a: "Basic includes labor only. Plus and above include basic materials for small tasks. Larger materials, special-order items, fixtures, appliances, and project materials are quoted or approved separately.",
  },
  {
    q: "How does cancellation work?",
    a: "Plans are month-to-month with no long-term contract. If you cancel, your membership stays active through the end of the current billing period and you will not be charged again.",
  },
  {
    q: "What if my job is bigger than a regular visit?",
    a: "Larger projects like roofing, siding, bathroom remodeling, kitchen work, full-room painting, major electrical, major plumbing, or longer repairs are handled as separate project estimates. You still stay with Profixter; the work just moves into the right path.",
  },
  {
    q: "Can I still book only one visit?",
    a: "Yes. If Membership is not the right fit today, you can book a one-time handyman visit. Membership is usually better for homeowners who expect to need help more than once.",
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
