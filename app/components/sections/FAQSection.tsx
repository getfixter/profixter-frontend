"use client";

import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";
import { visibleMembershipFaqs } from "@/app/data/membership-faq";



type FAQSectionProps = {
  hideCancellationUi?: boolean;
};

export default function FAQSection({ hideCancellationUi = false }: FAQSectionProps = {}) {
  /*
   * The heading used to read "Questions before you become a Member" for
   * everybody, including people who became one months ago. Same answers,
   * but addressed to whoever is actually reading.
   */
  const { user } = useAuth();
  const isMember = hasActiveMembership(user);
  /* Same helper the FAQPage markup uses, so the two cannot disagree about
     which questions this surface shows. Closed <details>: the answers are in
     the HTML as real text, one tap away. */
  const faqs = visibleMembershipFaqs(hideCancellationUi);

  return (
    <section id="faq" className="ui-section ui-section--soft w-full">
      <div className="ui-container ui-container--narrow">
        <div className="ui-head">
          <p className="ui-eyebrow">Questions</p>
          <h2 className="ui-h2">
            {isMember ? "Questions about your membership" : "Questions before you join"}
          </h2>
        </div>

        <div className="ui-faq">
          {faqs.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p className="ui-faq__a">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
