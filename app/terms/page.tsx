import Link from "next/link";

export default function CommunicationConsentPage() {
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
          Communication Consent &amp; SMS Terms
        </h1>

        <p className="text-xs sm:text-sm text-white/60 text-center mb-8">
          Company: <span className="font-semibold">Premium Island Homes INC</span>{" "}
          (DBA “Profixter”) (“we”, “us”, “our”).<br />
          Effective Date: Oct 4, 2025
        </p>

        <div className="space-y-6 text-sm sm:text-base text-white/80">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Contact Information</h2>
            <p>
              For questions about privacy or communications, contact:
            </p>
            <p className="mt-2">
              Email:{" "}
              <a className="text-[#93c5fd]" href="mailto:my@profixter.com">
                my@profixter.com
              </a>
              <br />
              Phone/Text Support:{" "}
              <span className="font-semibold">(516) 363-3823</span>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. SMS/Text Consent</h2>
            <p>
              By providing your phone number and opting in, you consent to receive text
              messages from <span className="font-semibold">Premium Island Homes INC (DBA Profixter)</span>.
              Consent is not a condition of purchase. Message frequency varies. Message &amp; data rates may apply.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Message Types</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Customer Care:</span> appointment scheduling, confirmations,
                rescheduling, service updates, and support conversations.
              </li>
              <li>
                <span className="font-semibold">Marketing:</span> promotions, discounts, and special offers (e.g., first-month discount).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Opt-Out / Help</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Reply <span className="font-semibold">STOP</span> or{" "}
                <span className="font-semibold">CANCEL</span> to unsubscribe at any time.
              </li>
              <li>
                Reply <span className="font-semibold">HELP</span> for assistance.
              </li>
              <li>
                You can also contact us at <span className="font-semibold">(516) 363-3823</span> or{" "}
                <a className="text-[#93c5fd]" href="mailto:my@profixter.com">
                  my@profixter.com
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. How We Collect Opt-In</h2>
            <p>
              Customers opt in via our website by submitting their phone number and checking an SMS consent box (or equivalent affirmative action).
              We maintain consent records where required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Data Sharing and Transfer Restrictions</h2>
            <p className="font-semibold">
              Customer data is not transferred to external organizations under any circumstances.
            </p>
            <p className="mt-2">
              Mobile opt-in and consent information is never shared with anyone for any purpose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data Protection Measures</h2>
            <p>
              We use reasonable administrative, technical, and organizational safeguards to protect personal information from unauthorized access, use, or disclosure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Updates</h2>
            <p>
              We may update these terms from time to time. The latest version posted on this page applies going forward.
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
