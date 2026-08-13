import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "SMS & Communication Consent | Profixter",
  },
  description:
    "Learn how Profixter may contact customers by phone, text, email, and automated systems for home service updates and account communication.",
  alternates: {
    canonical: "/communication-consent",
  },
  openGraph: {
    title: "SMS & Communication Consent | Profixter",
    description:
      "How Profixter contacts customers by phone, text, email, and automated systems for service communication.",
    url: absoluteUrl("/communication-consent"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "SMS & Communication Consent | Profixter",
    description:
      "How Profixter contacts customers by phone, text, email, and automated systems for service communication.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function CommunicationConsentPage() {
  return (
    <div className="min-h-screen px-4 py-9 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-5xl mx-auto rounded-[8px] p-6 sm:p-10 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49,50,52,0.62) 0%, rgba(49,50,52,0.52) 55%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.92)",
          boxShadow: "0px 0px 90px 0px rgba(0,0,0,0.55)",
        }}
      >
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3 text-center tracking-tight">
          Communication Consent &amp; SMS Terms
        </h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-8 leading-relaxed">
          Company: <span className="font-semibold">Premium Island Homes Inc.</span> (DBA{" "}
          <span className="font-semibold">&quot;Profixter&quot;</span> and/or{" "}
          <span className="font-semibold">&quot;Mr. Fixter&quot;</span>) (“we”, “us”, “our”).
          <br />
          Effective Date: <span className="font-semibold">January 9, 2026</span>
          <br />
          <span className="text-white/55">
            These terms explain how we contact you by phone, SMS, email, and automated systems. Please read carefully.
          </span>
        </p>

        <div className="space-y-10 text-sm sm:text-base text-white/85 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">1. Contact Information</h2>
            <p>If you have questions about privacy, consent, or communications, contact us:</p>

            <div className="mt-4 rounded-[8px] bg-white/5 border border-white/10 p-5">
              <p>
                Email:{" "}
                <a className="text-[#93c5fd] underline underline-offset-2" href={PUBLIC_CONTACT_MAILTO}>
                  {PUBLIC_CONTACT_EMAIL}
                </a>
                <br />
                Main Phone/Text Support: <span className="font-semibold">631-599-1363</span>
              </p>
              <p className="mt-3 text-white/70">
                <span className="font-semibold">Important:</span> We may contact you from{" "}
                <span className="font-semibold">different phone numbers</span> (including local numbers, toll-free numbers, or
                carrier-registered messaging numbers) for routing, reliability, staffing, and deliverability. Our{" "}
                <span className="font-semibold">primary number is 631-599-1363</span>.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">2. Your Consent to Contact You</h2>
            <p>
              By providing your phone number and/or email address, creating an account, booking a service, requesting a quote, or
              checking an “SMS consent” box (or taking any equivalent affirmative action), you consent to receive communications from
              Premium Island Homes Inc. (DBA Profixter / Mr. Fixter) as described here.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">Consent is not a condition of purchase</span> for marketing messages.
              </li>
              <li>
                You may still receive <span className="font-semibold">non-marketing</span> /{" "}
                <span className="font-semibold">transactional</span> messages (for example, service updates) where permitted by law,
                even if you opt out of marketing.
              </li>
              <li>
                You agree that your consent applies even if your number is on a state or federal Do Not Call list, to the extent
                permitted for Service-related communications you requested.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">3. How We May Contact You (Channels &amp; Technology)</h2>
            <p>We may contact you using one or more of the following methods:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">SMS / MMS text messages</span>
              </li>
              <li>
                <span className="font-semibold">Phone calls</span> (including live calls)
              </li>
              <li>
                <span className="font-semibold">Pre-recorded messages</span> where permitted
              </li>
              <li>
                <span className="font-semibold">Autodialing / automated systems</span> where permitted (for reminders, confirmations,
                security alerts, etc.)
              </li>
              <li>
                <span className="font-semibold">Email</span> (account notices, receipts, updates, marketing if you opt in)
              </li>
            </ul>

            <p className="mt-3 text-white/70">
              Message frequency varies based on your activity (bookings, reminders, support requests, promotions you opted into) and
              operational needs. We do not guarantee delivery timing due to carrier, device, filtering, and network variability.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">4. Message Categories (What You Might Receive)</h2>

            <div className="space-y-4">
              <div className="rounded-[8px] bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">4.1 Customer Care / Transactional</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Appointment scheduling, confirmations, rescheduling, and arrival updates</li>
                  <li>Service status updates, follow-ups, and support conversations</li>
                  <li>Account authentication/security alerts (for example, verification codes)</li>
                  <li>Billing notices, receipts, and important account notices</li>
                  <li>Requests for photos/info to prepare for a visit</li>
                </ul>
              </div>

              <div className="rounded-[8px] bg-white/5 border border-white/10 p-5">
                <h3 className="text-lg font-semibold mb-2">4.2 Marketing (Only If You Opt In)</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Promotions, discounts, seasonal offers, referral rewards, and special announcements</li>
                  <li>Limited-time campaigns (example: new service area, early-bird discounts)</li>
                </ul>
                <p className="mt-3 text-white/70">
                  Marketing consent is optional and is not required to purchase services. If you opt out of marketing, you may still
                  receive necessary transactional messages.
                </p>
              </div>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. Opt-Out, HELP, and Preferences</h2>
            <p>You control your messaging preferences. You can opt out anytime:</p>

            <div className="mt-4 rounded-[8px] bg-white/5 border border-white/10 p-5">
              <ul className="list-disc list-inside space-y-2">
                <li>
                  Reply <span className="font-semibold">STOP</span> to opt out of SMS messages (or{" "}
                  <span className="font-semibold">CANCEL</span>).
                </li>
                <li>
                  Reply <span className="font-semibold">HELP</span> for assistance.
                </li>
                <li>
                  You can also contact us at <span className="font-semibold">631-599-1363</span> or{" "}
                  <a className="text-[#93c5fd] underline underline-offset-2" href={PUBLIC_CONTACT_MAILTO}>
                    {PUBLIC_CONTACT_EMAIL}
                  </a>
                  .
                </li>
              </ul>
              <p className="mt-3 text-white/70">
                After you text STOP, you may receive a final confirmation message. If you opt out, we will stop sending marketing
                texts and (where required) stop other SMS categories; however, in some cases we may still send essential
                service-related messages by other methods (email/phone) or as otherwise permitted by law.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">6. Message &amp; Data Rates, Carrier Notes, Delivery</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Message and data rates may apply depending on your mobile plan and carrier.
              </li>
              <li>
                Carriers are not liable for delayed or undelivered messages.
              </li>
              <li>
                Delivery can be affected by device settings, spam filtering, network outages, app permissions, and carrier policies.
              </li>
              <li>
                If you change phone numbers or email, you must update your account information to continue receiving important notices.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">7. How We Collect Opt-In (Consent Records)</h2>
            <p>
              Customers typically opt in through our website or forms by providing a phone number and checking an SMS consent box (or
              taking equivalent affirmative action), and/or by initiating a conversation with us via text.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>We maintain consent records where required (timestamp, source, and consent language version).</li>
              <li>
                If you are providing a number that is not yours, you represent you have authorization from the account holder.
              </li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">8. Permitted Use of Your Contact Information</h2>
            <p>
              We use your contact information to operate the Service, provide customer support, schedule visits, prevent fraud,
              provide receipts/updates, and-only if you opt in-send marketing.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">9. Data Sharing, Transfer Restrictions (SMS Specific)</h2>
            <div className="rounded-[8px] bg-white/5 border border-white/10 p-5">
              <p className="font-semibold">
                Mobile opt-in data and consent information is not sold, rented, or shared with third parties for marketing purposes.
              </p>
              <p className="mt-3">
                We may share limited data with service providers who help us send messages (messaging platforms, carriers, delivery
                partners, cloud providers) solely to operate communications and under appropriate confidentiality obligations.
              </p>
              <p className="mt-3 text-white/70">
                If you want the absolute strict version (like your old line “not transferred under any circumstances”), it can
                conflict with how SMS delivery actually works (carriers + messaging vendors must process the message). The language
                above is safer and more realistic.
              </p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">10. Data Protection Measures</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We use reasonable administrative, technical, and organizational safeguards to protect personal information.</li>
              <li>No system is 100% secure; we cannot guarantee absolute security of transmitted or stored data.</li>
              <li>We restrict access to systems and logs to authorized personnel and vendors supporting operations.</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">11. Acceptable Use / No Abuse</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You agree not to use our messaging channels for harassment, threats, spam, or illegal activity.</li>
              <li>We may block numbers that abuse support channels or send malicious content.</li>
              <li>We may require identity verification for account changes or sensitive support requests.</li>
            </ul>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">12. Changes to These SMS Terms</h2>
            <p>
              We may update these terms from time to time. The latest version posted on this page applies going forward. If changes
              are material, we may provide additional notice as required by law.
            </p>
          </section>

          <p className="text-xs sm:text-sm text-white/55 mt-7 text-center">
            Last Updated: January 9, 2026
          </p>

          <div className="mt-7 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-[8px] border border-white/15 bg-white/5 px-5 py-3 text-sm sm:text-base text-[#93c5fd] hover:bg-white/10 transition"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
