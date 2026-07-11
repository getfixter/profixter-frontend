// app/terms/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Terms of Service | Profixter",
  },
  description:
    "Review Profixter's terms for Membership, booking visits, home services, communications, payments, and customer responsibilities.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | Profixter",
    description:
      "The terms that apply when using Profixter Membership, handyman visits, home services, and communications.",
    url: absoluteUrl("/terms"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | Profixter",
    description:
      "Review Profixter's terms for Membership, booking visits, communications, payments, and customer responsibilities.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-24 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-5xl mx-auto rounded-[24px] p-6 sm:p-10 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49,50,52,0.62) 0%, rgba(49,50,52,0.52) 55%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.92)",
          boxShadow: "0px 0px 90px 0px rgba(0,0,0,0.55)",
        }}
      >
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3 text-center tracking-tight">
          Terms of Service
        </h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-8 leading-relaxed">
          Effective Date: January 9, 2026 &middot; Company:{" "}
          <span className="font-semibold">Premium Island Homes Inc.</span>, doing business as{" "}
          <span className="font-semibold">&quot;Profixter&quot;</span> and/or{" "}
          <span className="font-semibold">&quot;Mr. Fixter&quot;</span> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
          <br />
          <span className="text-white/55">
            This is general website terms language—consider a NY attorney review for your exact operations and insurance coverage.
          </span>
        </p>

        <div className="space-y-10 text-sm sm:text-base text-white/85 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">1. Agreement to Terms</h2>
            <p>
              By creating an account, booking a visit, requesting service, purchasing a membership plan, or using any part of our
              website, software, SMS/email communications, or services (collectively, the{" "}
              <span className="font-semibold">“Service”</span>), you (“Client”, “Customer”, or “Subscriber”) agree to these Terms
              of Service (the <span className="font-semibold">“Terms”</span>). These Terms form a binding agreement between you and
              Premium Island Homes Inc. (d/b/a Profixter / Mr. Fixter).
            </p>
            <p className="mt-3">
              If you do not agree, do not use the Service. If you are using the Service on behalf of another person or entity,
              you represent you have authority to bind them to these Terms.
            </p>
            <p className="mt-3">
              We may update these Terms from time to time. The most current version posted on our website governs your use.
              Changes become effective when posted. Continued use after changes means you accept the updated Terms.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">2. Definitions (Important)</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">“Membership” / “Plan”</span> means a{" "}
                <span className="font-semibold">month-to-month</span> protection membership purchased for a specific service address.
              </li>
              <li>
                <span className="font-semibold">“Billing Period”</span> means the monthly period starting on the date of purchase
                (or renewal) and renewing each month unless canceled.
              </li>
              <li>
                <span className="font-semibold">“Visit”</span> means an on-site service appointment scheduled through our system.
              </li>
              <li>
                <span className="font-semibold">“Covered Tasks”</span> means typical handyman tasks that can reasonably be completed
                during a standard visit time window and that are not excluded by these Terms or your Plan.
              </li>
              <li>
                <span className="font-semibold">“Service Address”</span> means the property address registered to your account.
                Coverage is tied to a specific address and is not transferable without our written approval.
              </li>
              <li>
                <span className="font-semibold">“Normal Use / Fair Use”</span> means reasonable household use and not using the
                membership as a substitute for a full-time maintenance team, renovations, or commercial operations.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">3. Membership &amp; Billing (Month-to-Month)</h2>

            <div className="space-y-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">3.1 Month-to-Month Auto-Renewal</h3>
                <p>
                  Memberships renew <span className="font-semibold">automatically month-to-month</span> unless you cancel before your
                  next renewal date. Your renewal date is typically the same calendar day of each month as your original purchase
                  (or the nearest possible date if a month has fewer days).
                </p>
                <p className="mt-2 text-white/70">
                  We may send renewal reminders, but you are responsible for managing your membership and cancellation timing.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">3.2 Payment Authorization</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    You authorize us (and our payment processors) to charge your selected payment method for recurring monthly
                    membership fees, applicable taxes, and any approved additional charges (materials, add-ons, third-party work,
                    reschedule/no-access fees where permitted, etc.).
                  </li>
                  <li>
                    If your payment method fails, we may retry charges, suspend scheduling, and/or pause membership benefits until
                    payment is updated.
                  </li>
                  <li>
                    Prices may change for future billing periods with notice as required by law. Continued membership after the
                    change takes effect means you accept the new price.
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">3.3 Cancellation</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    You can cancel anytime before the next renewal. Your membership remains active through the end of the
                    already-paid billing period.
                  </li>
                  <li>
                    Cancellation stops future renewals; it does not automatically create refunds for the current billing period
                    unless required by law.
                  </li>
                  <li>
                    To cancel, use your account dashboard (if available) or contact us using the details in Section 19.
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">3.4 No Refunds for Partial Months (General Rule)</h3>
                <p>
                  To the maximum extent permitted by law, membership fees are charged in advance and are generally{" "}
                  <span className="font-semibold">non-refundable</span> once a billing period starts, including partial-month refunds.
                  This is because time and capacity are reserved for members.
                </p>
                <p className="mt-2 text-white/70">
                  If a refund is granted in our discretion (or required by law), it may be reduced by the value of visits already
                  used, processing fees, and costs already incurred.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">3.5 Promotions / Promo Codes</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    Promo codes (when offered) typically provide a fixed discount (e.g., $50 off) and may have limits or expiration.
                  </li>
                  <li>Promo codes cannot be combined unless we explicitly state otherwise in writing.</li>
                  <li>We may cancel or modify promotions if we detect misuse, fraud, chargebacks, or unauthorized distribution.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">4. What’s Covered vs. Not Covered (Scope Control)</h2>

            <div className="space-y-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">4.1 Standard Visit Time Window</h3>
                <p>
                  Unless your Plan states otherwise, a standard Visit is intended to be up to{" "}
                  <span className="font-semibold">90 minutes</span> of labor on typical handyman tasks.
                </p>
                <ul className="list-disc list-inside space-y-2 mt-3">
                  <li>We may complete a safe stopping point and schedule a follow-up Visit (subject to availability), and/or</li>
                  <li>Provide an estimate for additional time, parts, materials, or specialized labor.</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">4.2 Covered Tasks (General)</h3>
                <p>
                  Covered Tasks are generally small to medium home maintenance and repairs that do not require a licensed trade
                  where legally required, do not involve major structural work, and are safe/feasible under the conditions at your
                  Service Address.
                </p>
                <p className="mt-2 text-white/70">
                  Exact coverage depends on the Plan description and our reasonable judgment based on safety, code requirements,
                  and the nature of the work.
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">4.3 Exclusions (Not Covered / Separate Quote)</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    Work requiring licensed professionals where legally required (including certain electrical, plumbing, HVAC, gas
                    lines, major roofing, structural changes).
                  </li>
                  <li>Major construction, remodeling, demolition, load-bearing repairs, or code-violation remediation.</li>
                  <li>Mold remediation, asbestos, lead paint abatement, hazardous materials, pest/rodent treatment.</li>
                  <li>Emergency/after-hours service or guaranteed response times unless explicitly purchased.</li>
                  <li>Work in unsafe conditions, extreme heights, unstable structures, or unreasonable risk environments.</li>
                  <li>Commercial properties, multi-unit buildings, or investment/turnover maintenance unless agreed in writing.</li>
                  <li>
                    Internal appliance repairs, diagnostics, warranty service, or standalone appliance service.
                  </li>
                </ul>
                <p className="mt-3">
                  We decide in our reasonable discretion whether a request is in-scope under your membership, requires a separate
                  quote, or must be performed by a licensed specialist.
                </p>
              </div>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. Scheduling, Availability, Access, Cancellations</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">Availability:</span> Visits are scheduled based on technician availability, route
                density, weather, supply constraints, and operational capacity. We do not guarantee same-day or next-day service.
              </li>
              <li>
                <span className="font-semibold">Concurrent active bookings:</span> To keep scheduling fair, we limit how many
                future bookings you can hold at the same time (Pending/Confirmed). Basic plans allow 1 active booking; Plus,
                Premium, and Elite plans allow up to 2 active bookings.
              </li>
              <li>
                <span className="font-semibold">Access:</span> You must provide safe, reasonable access to the work area at the
                scheduled time (parking, entry instructions, utility access when needed).
              </li>
              <li>
                <span className="font-semibold">Pets / safety:</span> You must secure pets and ensure safe conditions. If conditions
                are unsafe/unsanitary/hostile, we may refuse service and treat the Visit as used.
              </li>
              <li>
                <span className="font-semibold">24-hour notice:</span> Please cancel/reschedule at least 24 hours in advance. Repeated
                last-minute cancellations/no-shows/no-access may result in reduced availability, fees where permitted, or account
                review.
              </li>
              <li>
                <span className="font-semibold">No-access:</span> If we arrive and cannot gain access, we may treat the Visit as used
                to protect reserved capacity.
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">6. Fair Use Policy (Abuse Protection)</h2>
            <p>
              Membership is designed for normal, reasonable household use. To protect fairness and service speed for all customers,
              we may review and limit usage that appears abusive, fraudulent, or inconsistent with normal residential needs.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Excessive or back-to-back bookings beyond typical household needs.</li>
              <li>Repeated no-access visits or serial last-minute cancellations.</li>
              <li>Using the membership to complete renovations through many “small” bookings.</li>
              <li>Using membership primarily for commercial or investment properties.</li>
              <li>Unsafe, unsanitary, or hostile service conditions.</li>
            </ul>
            <p className="mt-3">
              We typically provide a written warning and suggested adjustments. If misuse continues, we may suspend or terminate
              membership for that account/address. Refunds (if any) will be only as required by law and may be reduced by used-visit
              value and incurred costs.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">7. Materials, Parts, Store Runs, Customer Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">Materials:</span> You may supply materials/parts, or we may purchase them with your
                approval. If we purchase, you agree to pay our cost plus any agreed handling/delivery/store-run fees.
              </li>
              <li>
                <span className="font-semibold">Compatibility:</span> If you supply parts, you are responsible for correct selection
                and compatibility. We are not responsible for delays or issues caused by incorrect parts.
              </li>
              <li>
                <span className="font-semibold">Prep:</span> You agree to prepare the work area (clear access, remove valuables). Time
                spent on cleanup/prep beyond reasonable expectations may reduce time available for Covered Tasks.
              </li>
              <li>
                <span className="font-semibold">Hidden conditions:</span> Some issues are not visible until work begins (water damage,
                rot, old wiring). If hidden conditions appear, we may stop and propose a revised plan/estimate for safety.
              </li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">8. Third-Party Contractors, Referrals, Licensed Work</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                If a request requires licensed trade work or falls outside membership coverage, we may provide a separate estimate
                or refer you to independent contractors.
              </li>
              <li>
                Unless we explicitly agree otherwise in writing, third parties are independent and may have their own contracts,
                warranties, insurance, and limitations.
              </li>
              <li>We are not responsible for third-party performance, delays, pricing, or warranties unless required by law.</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">9. Workmanship, Disclaimers, No Guaranteed Outcomes</h2>
            <p>
              We aim to do high-quality work. However, repairs can involve hidden conditions and unpredictable factors. To the maximum
              extent permitted by law, the Service is provided <span className="font-semibold">“as is”</span> and{" "}
              <span className="font-semibold">“as available”</span>.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>We do not guarantee any specific outcome, timing, or that every issue can be fixed in one Visit.</li>
              <li>We disclaim implied warranties to the extent permitted (merchantability, fitness, non-infringement).</li>
            </ul>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">10. Damage Claims, Risk Allocation, Indemnification</h2>
            <p>
              You agree to notify us promptly of any concern about damage or workmanship, ideally within 48 hours of the Visit, so we
              can investigate while conditions are recent.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">Customer-supplied parts:</span> We are not responsible for failure/defects or resulting
                damage from parts/materials you provide.
              </li>
              <li>
                <span className="font-semibold">Pre-existing conditions:</span> We are not responsible for rot, mold, corrosion, code
                violations, or prior improper work that existed before we arrived.
              </li>
              <li>
                <span className="font-semibold">Indemnification:</span> You agree to defend and indemnify us (and our employees,
                contractors, and agents) from claims arising from misuse of the Service, unsafe conditions, false information, or
                violation of these Terms, except to the extent caused by our gross negligence or willful misconduct.
              </li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">11. Limitation of Liability</h2>
            <p className="uppercase font-semibold text-white">
              To the maximum extent permitted by law, our total liability for any claim arising out of or related to the Service will
              not exceed the amount you paid to us for your membership during the one (1) month prior to the event giving rise to the
              claim, or $500, whichever is greater.
            </p>
            <p className="mt-3 uppercase">
              We are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of
              profits, revenue, goodwill, or data, even if advised of the possibility. Some jurisdictions do not allow certain
              limitations; in such cases we apply the maximum limitation permitted by law.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">12. Disputes, Class Action Waiver, Venue</h2>
            <p>
              These Terms are governed by New York law. Before filing a claim, you agree to contact us and allow 30 days for good-faith
              resolution. Unless required otherwise by law, disputes will be resolved in courts located in Suffolk County, New York (or
              small claims where eligible).
            </p>
            <p className="mt-3">
              <span className="font-semibold">Class action waiver:</span> To the extent permitted by law, you agree to bring claims only
              in your individual capacity and not as part of any class, collective, or representative action.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">13. Electronic Communications (Email, SMS, Phone)</h2>
            <p>
  By providing your phone number and opting in, you consent to receive
  service-related SMS communications, including scheduling updates,
  appointment reminders, customer support messages, and account notices.
  Message frequency may vary. Msg &amp; data rates may apply. We are not
  responsible for carrier delays, spam filtering, or inaccurate contact info.
</p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">14. SMS Program Terms</h2>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
              <p className="font-semibold">
  Program Name: Premium Island Homes INC (Profixter) SMS Alerts &amp; Updates
</p>
              <p>
  Program Description: By opting in, you may receive appointment confirmations,
  scheduling updates, service reminders, customer support messages, account
  updates, and, if you separately opt in, occasional marketing messages from
  Premium Island Homes INC (Profixter).
</p>

              <ul className="list-disc list-inside space-y-2">
                <li>
                  You can cancel the SMS service at any time. Simply text <span className="font-semibold">&quot;STOP&quot;</span> to the number
                  that texted you. Upon sending &quot;STOP,&quot; we will confirm your unsubscribe status via SMS. Following this confirmation,
                  you will no longer receive SMS messages from us. To rejoin, start again as you did initially, and we will resume sending
                  SMS messages to you.
                </li>
                <li>
                  If you experience issues with the messaging program, reply with the keyword{" "}
                  <span className="font-semibold">HELP</span> for more assistance, or reach out directly to{" "}
                  <span className="font-semibold">631-599-1363</span> or{" "}
                  <a href={PUBLIC_CONTACT_MAILTO} className="text-[#93c5fd] underline underline-offset-2">
                    {PUBLIC_CONTACT_EMAIL}
                  </a>
                  .
                </li>
                <li>Carriers are not liable for delayed or undelivered messages.</li>
                <li>
                  Message and data rates may apply for messages sent to you from us and to us from you. Message frequency varies. For
                  questions about your text plan or data plan, contact your wireless provider.
                </li>
                <li>
                  For privacy-related inquiries, please refer to our Privacy Policy:{" "}
                  <Link href="/privacy" className="text-[#93c5fd] underline underline-offset-2">
                    https://www.profixter.com/privacy
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">15. Photos/Video + Marketing Use</h2>
            <p>
              We may take reasonable before/after photos or short clips of work areas for documentation, training, and marketing. We try
              to avoid faces/identifying information and may blur/crop. If you want to opt out of marketing use, email{" "}
              <a href={PUBLIC_CONTACT_MAILTO} className="text-[#93c5fd] underline underline-offset-2">
                {PUBLIC_CONTACT_EMAIL}
              </a>{" "}
              and we will honor it going forward.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">16. Prohibited Use, Fraud, Termination</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Do not provide false info, impersonate others, or misuse promotions.</li>
              <li>Do not request illegal work or create unsafe/hostile conditions.</li>
              <li>We may suspend/terminate membership for fraud, abuse, safety concerns, or repeated violations.</li>
              <li>Outstanding balances remain due even after termination.</li>
            </ul>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">17. Force Majeure</h2>
            <p>
              We are not liable for delays or inability to perform due to events outside our reasonable control (weather, disasters, supply
              shortages, outages, government actions, emergencies). We will reschedule as soon as practical.
            </p>
          </section>

          {/* 18 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">18. Miscellaneous</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">Severability:</span> If any part is unenforceable, the rest remains effective.
              </li>
              <li>
                <span className="font-semibold">No waiver:</span> Not enforcing a term is not a waiver.
              </li>
              <li>
                <span className="font-semibold">Assignment:</span> We may assign these Terms in a merger, acquisition, or asset sale.
              </li>
              <li>
                <span className="font-semibold">Entire agreement:</span> These Terms + your Plan description are the entire agreement.
              </li>
            </ul>
          </section>

          {/* 19 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">19. Contact</h2>
            <p className="mt-1">
              Phone: <span className="font-semibold">631-599-1363</span>
              <br />
              Email:{" "}
              <a href={PUBLIC_CONTACT_MAILTO} className="text-[#93c5fd] underline underline-offset-2">
                {PUBLIC_CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <div className="pt-2">
            <p className="text-xs sm:text-sm text-white/55 mt-6 text-center">Last Updated: January 9, 2026</p>

            <div className="mt-7 text-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm sm:text-base text-[#93c5fd] hover:bg-white/10 transition"
              >
                Back to Add Property
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
