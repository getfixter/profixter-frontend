import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Privacy Policy | Profixter",
  },
  description:
    "Read how Profixter handles customer information, communication consent, SMS data, and privacy for our home services platform.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Profixter",
    description:
      "How Profixter handles customer information, privacy, SMS consent, and communication data.",
    url: absoluteUrl("/privacy"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Profixter",
    description:
      "How Profixter handles customer information, privacy, SMS consent, and communication data.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-8 leading-relaxed">
          Effective Date: January 22, 2026 · Company:{" "}
          <span className="font-semibold">Premium Island Homes Inc.</span>, doing
          business as{" "}
          <span className="font-semibold">“Profixter”</span> and/or{" "}
          <span className="font-semibold">“Mr. Fixter”</span> (“we”, “us”, “our”).
        </p>

        {/* IMPORTANT SMS NOTICE */}
        <div className="mb-8 rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-sm sm:text-base text-white/85 leading-relaxed">
            <span className="font-semibold">
              IMPORTANT NOTICE REGARDING TEXT MESSAGING DATA:
            </span>{" "}
            We do <span className="font-semibold">not</span> share customer opt-in
            information (including phone numbers and consent records) with
            affiliates or third parties for marketing or promotional purposes.
            Text messaging originator opt-in data and consent are kept strictly
            confidential and are used only to provide our direct services.
          </p>
        </div>

        <div className="space-y-8 text-sm sm:text-base text-white/85 leading-relaxed">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              1. Information We Collect
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Contact information (name, email, phone number)</li>
              <li>Service address, booking details, service notes</li>
              <li>
                Payment-related data handled by payment processors (we do not
                store full card numbers)
              </li>
              <li>
                Communications with us (SMS, email, support messages) and your
                communication preferences
              </li>
              <li>
                Opt-in/opt-out records and timestamps (for SMS/email consents, if
                you provide them)
              </li>
              <li>
                Technical data (IP address, browser/device info, cookies for
                basic functionality/security, and usage analytics)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              2. How We Use Information
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Provide services, schedule visits, and manage your account</li>
              <li>Send appointment confirmations, reminders, and service updates</li>
              <li>Process payments and help prevent fraud</li>
              <li>Customer support and service improvement</li>
              <li>
                Send marketing messages{" "}
                <span className="font-semibold">only if you opt in</span>
              </li>
              <li>
                Maintain records of your communication preferences and consent
              </li>
            </ul>
          </section>

          {/* SMS COMPLIANCE SECTION */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              3. SMS Messaging &amp; Compliance
            </h2>
            <p>
              If you opt into our text messaging services, you may receive
              messages related to our services, including appointment reminders,
              account notifications, customer support, and important updates.
              Promotional/marketing texts are sent only with specific marketing
              consent.
            </p>

            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">Opt-In &amp; Consent:</span> You
                will only receive messages if you explicitly opt in. We may
                maintain timestamped records of opt-in/opt-out actions.
              </li>
              <li>
                <span className="font-semibold">Opt-Out:</span> Reply{" "}
                <span className="font-semibold">STOP</span> to cancel SMS at any
                time. You may receive a final confirmation message and no further
                messages will be sent unless you re-opt in.
              </li>
              <li>
                <span className="font-semibold">Help:</span> Reply{" "}
                <span className="font-semibold">HELP</span> for assistance or
                contact us at{" "}
                <a
                  href="mailto:my@profixter.com"
                  className="text-[#93c5fd] underline underline-offset-2"
                >
                  my@profixter.com
                </a>
                .
              </li>
              <li>
                <span className="font-semibold">Message &amp; Data Rates:</span>{" "}
                Standard message and data rates may apply. Message frequency
                varies based on your interactions.
              </li>
              <li>
                <span className="font-semibold">Carriers:</span> Carriers are not
                liable for delayed or undelivered messages.
              </li>
            </ul>

            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="font-semibold">
                No mobile information will be shared with third parties/affiliates
                for marketing/promotional purposes. Information sharing to
                subcontractors in support services, such as customer service is
                permitted. All other use case categories exclude text messaging
                originator opt-in data and consent; this information will not be
                shared with any third parties.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              4. Information Sharing
            </h2>
            <p>
              We do not sell, rent, or trade your personal information. We may
              share limited information with trusted service providers that help
              us operate (for example, payment processing, messaging delivery,
              hosting, analytics) under confidentiality and security obligations,
              and with contractors/specialists when you request or approve
              additional work.
            </p>

            <p className="mt-3">
  <span className="font-semibold">SMS data protection:</span> All
  categories above exclude text messaging originator opt-in data and
  consent. This information will not be shared with any third parties,
  except as needed to deliver messages you consented to receive (for
  example, SMS platform/aggregator providers).
</p>

<p className="mt-3">
  SMS opt-in consent and phone numbers collected for SMS purposes are not
  shared with third parties or affiliates for marketing purposes.
</p>
          </section>

          <section>
  <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. Cookies</h2>
  <p>
    We may use cookies and similar technologies for basic site
    functionality, security, and to understand site usage. You can
    control cookies through your browser settings. Disabling cookies may
    limit certain site features.
  </p>
  <p className="mt-3">
    We may use cookies, analytics tools, and similar tracking
    technologies to understand website usage, improve performance, and
    support website security.
  </p>
</section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              6. Data Security
            </h2>
            <p>
              We use reasonable safeguards to protect information (such as access
              controls and secure service providers). No system is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              7. Your Choices
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You can opt out of SMS by replying STOP.</li>
              <li>
                You can opt out of marketing by using unsubscribe links in emails
                or contacting us.
              </li>
              <li>
                You can request updates or deletion of certain information by
                contacting us (subject to legal/operational requirements).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              8. Third-Party Links
            </h2>
            <p>
              Our website may contain links to third-party websites. We are not
              responsible for their privacy practices. This policy applies only to
              information collected by us.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this policy periodically. The latest version will
              always be available on our website with the effective date. For
              significant changes, we may notify you by email or by a notice on
              the website.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">10. Contact</h2>
            <p>
              Phone: <span className="font-semibold">631-599-1363</span>
              <br />
              Email:{" "}
              <a
                href="mailto:my@profixter.com"
                className="text-[#93c5fd] underline underline-offset-2"
              >
                my@profixter.com
              </a>
            </p>
          </section>

          <p className="text-xs sm:text-sm text-white/55 mt-10 text-center">
            Last Updated: January 22, 2026
          </p>

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
  );
}
