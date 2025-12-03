import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-24 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-4xl mx-auto rounded-[20px] p-6 sm:p-8 lg:p-10 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49,50,52,0.6) 0%, rgba(49,50,52,0.5) 50%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.9)",
          boxShadow: "0px 0px 80px 0px rgba(0,0,0,0.45)",
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-semibold mb-6 text-center">
          Terms &amp; Conditions / Privacy Notice
        </h1>

        <p className="text-xs sm:text-sm text-white/60 text-center mb-8">
          Effective Date: Oct 4, 2025 &middot; Company: Premium Island Homes Corp.,
          doing business as &quot;Profixter&quot; (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        </p>

        <div className="space-y-6 text-sm sm:text-base text-white/80">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Agreement to Terms</h2>
            <p>
              By creating an account, booking a visit, or subscribing to any plan, you
              (&quot;Client&quot;, &quot;Customer&quot;, or &quot;Subscriber&quot;) agree to
              these Terms &amp; Conditions and acknowledge our Privacy Notice. These Terms
              form a binding agreement between you and Premium Island Homes Corp.
              (collectively, &quot;Profixter&quot;, &quot;we&quot;, &quot;us&quot;).
            </p>
            <p className="mt-2">
              We may update these Terms and our Privacy Notice from time to time. The
              latest version posted on our website will apply to new and ongoing use of
              the service. If you continue using the service after changes are posted, you
              accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Subscription &amp; Billing</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Plans renew automatically month-to-month until you cancel.</li>
              <li>
                You can cancel any time before the next renewal period. Your plan remains
                active through the end of the already-paid period.
              </li>
              <li>
                Subscription fees are charged in advance. We generally do not issue
                refunds for partial months once a billing period has started.
              </li>
              <li>
                Any additional work or services beyond the covered plan items will be
                quoted and billed separately with your approval.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. What&apos;s Included / Excluded</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Visits and services are limited to the scope, property type, and frequency
                described on your selected plan or on our Services/Plans page.
              </li>
              <li>
                Excluded and separately billed work includes (without limitation): plumbing,
                electrical, HVAC, roofing, major construction, structural work, and any
                work requiring a licensed trade where legally required.
              </li>
              <li>
                We reserve the right to determine, in our reasonable discretion, whether a
                requested task is in-scope or requires a separate estimate or licensed
                contractor.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Scheduling, Access &amp; Cancellations</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Only one active booking at a time per account/address.</li>
              <li>
                You are responsible for providing safe and reasonable access to the
                property at the scheduled time.
              </li>
              <li>
                Please reschedule or cancel at least 24 hours in advance whenever
                possible. Repeated last-minute cancellations or no-access visits may result
                in limited future availability or account review.
              </li>
              <li>
                If our technician cannot gain access, we may treat the visit as used for
                that booking window to maintain fairness for all clients.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Fair Use &amp; Service Abuse</h2>
            <p>
              Our subscription service is designed for normal, reasonable household use.
              To protect service quality and speed for all customers, we may review and
              limit usage that appears abusive or inconsistent with normal residential
              needs, such as:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Excessive or back-to-back bookings beyond normal household needs.</li>
              <li>Serial same-day cancellations or repeated no-access visits.</li>
              <li>Using the plan primarily for commercial or investment properties.</li>
              <li>Unsafe, unsanitary, or hostile conditions at the service location.</li>
            </ul>
            <p className="mt-2">
              We will typically provide a written warning and suggested adjustments. If you
              continue to misuse the service after a warning, we may suspend or terminate
              service to that customer or address and issue a refund only where required by
              law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              6. Materials, Third-Party Contractors &amp; Estimates
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Materials may be supplied by you or by us with your approval. If we
                purchase materials, we may charge you our cost and any agreed handling or
                delivery fees.
              </li>
              <li>
                If a job requires licensed trade work or falls outside the plan, we will
                provide a separate estimate and obtain your approval before proceeding.
              </li>
              <li>
                We may coordinate or refer independent contractors. In those cases, they
                may have their own terms, warranties, and limitations of liability.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              7. Photos, Video &amp; Marketing Use of Project Content
            </h2>
            <p>
              To document our work quality, plan improvements, and promote our services,
              we may take reasonable before-and-after photos or short video clips of areas
              where we perform work.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                We will avoid capturing faces or clearly identifying personal information
                whenever reasonably possible, and we may blur or crop identifying details
                before external use.
              </li>
              <li>
                By using our services, you grant Premium Island Homes Corp. a
                non-exclusive, worldwide, royalty-free license to use such photos or
                videos for internal training, quality control, and external marketing,
                including on our website, social media, and advertising materials.
              </li>
              <li>
                If you do not want your property featured in our marketing, you may email
                us at{" "}
                <a href="mailto:my@profixter.com" className="text-[#93c5fd]">
                  my@profixter.com
                </a>{" "}
                and we will honor your request on a going-forward basis.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Privacy &amp; Data Use</h2>
            <p>
              We collect and store the information you provide (such as name, contact
              details, property address, service history, and communications) to operate
              our business, schedule visits, process payments, and communicate with you
              about your account and services.
            </p>
            <p className="mt-2">
              We do <span className="font-semibold">not</span> sell your personal
              information to third parties.
            </p>
            <p className="mt-2">
              We may share your information only as necessary to provide services (for
              example, with payment processors, scheduling tools, communication providers,
              cloud hosting, or licensed contractors you approve), under appropriate
              confidentiality and security obligations.
            </p>
            <p className="mt-2">
              For SMS purposes, we do not transfer consumer data to external organizations
              except as necessary to deliver messages through our messaging providers, and
              we do not share mobile opt-in data for marketing by third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Security &amp; Data Retention</h2>
            <p>
              We use reasonable technical and administrative measures to protect your
              information. However, no system is 100% secure, and we cannot guarantee
              absolute security of information transmitted or stored electronically.
            </p>
            <p className="mt-2">
              We keep your information as long as needed to provide the services, maintain
              legitimate business records, comply with our legal obligations, resolve
              disputes, and enforce our agreements. We may anonymize or aggregate data for
              analytics, which we may keep indefinitely.
            </p>
          </section>

          {/* ✅ This section is for Grasshopper/TCR SMS compliance */}
          <section>
            <h2 className="text-lg font-semibold mb-2">SMS Messaging Terms &amp; Consent</h2>

            <p>
              By providing your phone number and checking the SMS consent box, you consent
              to receive text messages from{" "}
              <span className="font-semibold">Premium Island Homes Corp.</span> (doing
              business as <span className="font-semibold">Profixter</span>) regarding
              customer care (including appointment and service updates) and
              promotional/marketing messages.
            </p>

            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Message frequency varies.</li>
              <li>Message and data rates may apply.</li>
              <li>
                Reply <span className="font-semibold">STOP</span> or{" "}
                <span className="font-semibold">CANCEL</span> to unsubscribe at any time.
              </li>
              <li>
                Reply <span className="font-semibold">HELP</span> for assistance.
              </li>
              <li>
                Consent is not a condition of purchase.
              </li>
              <li>
                You can also contact us at{" "}
                <span className="font-semibold">(516) 363-3823</span>,{" "}
                <span className="font-semibold">(516) 540-5855</span>, or{" "}
                <span className="font-semibold">(516) 908-8922</span>, or email{" "}
                <a href="mailto:my@profixter.com" className="text-[#93c5fd]">
                  my@profixter.com
                </a>
                .
              </li>
            </ul>

            <p className="mt-2">
              Mobile opt-in information is never shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIMS
              ARISING OUT OF OR RELATED TO THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID
              TO US FOR YOUR SUBSCRIPTION IN THE ONE (1) MONTH PRIOR TO THE EVENT GIVING
              RISE TO THE CLAIM.
            </p>
            <p className="mt-2">
              WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, OR DATA, EVEN IF WE HAVE
              BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. SOME JURISDICTIONS DO NOT
              ALLOW LIMITATIONS OF LIABILITY; IN SUCH CASES, WE WILL APPLY THE MAXIMUM
              LIMITATION PERMITTED BY APPLICABLE LAW.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Governing Law &amp; Disputes</h2>
            <p>
              These Terms are governed by the laws of the State of New York, without
              regard to its conflict-of-laws rules. Any disputes will be resolved in the
              courts or small claims courts located in Suffolk County, New York, unless
              another forum is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Contact</h2>
            <p>For questions about these Terms or our Privacy Notice, you can contact us:</p>
            <p className="mt-2">
              Phone:{" "}
              <span className="font-semibold">
                (516) 363-3823, (516) 540-5855, (516) 908-8922
              </span>
              <br />
              Email:{" "}
              <a href="mailto:my@profixter.com" className="text-[#93c5fd]">
                my@profixter.com
              </a>
            </p>
          </section>

          <p className="text-xs text-white/50 mt-8 text-center">
            Last Updated: September 4, 2025
          </p>

          <div className="mt-6 text-center">
            <Link
              href="/signup"
              className="text-sm sm:text-base text-[#93c5fd] underline underline-offset-2"
            >
              Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
