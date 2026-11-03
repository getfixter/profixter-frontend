import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
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
    <div className="min-h-screen bg-white text-[color:var(--ui-ink)]">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <div
        className="ui-container ui-container--narrow pb-16 pt-8 sm:pb-20 sm:pt-12"
      >
        <h1 className="ui-display mb-3 text-center">
          Communication Consent &amp; SMS Terms
        </h1>

        <p className="text-[15px] sm:text-base text-[color:var(--ui-text-2)] text-center mb-8 leading-relaxed">
          Company: <span className="font-semibold">Premium Island Homes Inc.</span> (DBA{" "}
          <span className="font-semibold">&quot;Profixter&quot;</span> and/or{" "}
          <span className="font-semibold">&quot;Mr. Fixter&quot;</span>) (“we”, “us”, “our”).
          <br />
          Effective Date: <span className="font-semibold">January 9, 2026</span>
          <br />
          <span className="text-[color:var(--ui-text-3)]">
            These terms explain how we contact you by phone, SMS, email, and automated systems. Please read carefully.
          </span>
        </p>

        <div className="space-y-10 text-[15px] sm:text-base text-[color:var(--ui-text-2)] leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">1. Contact Information</h2>
            <p>If you have questions about privacy, consent, or communications, contact us:</p>

            <div className="mt-4 rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5">
              <p>
                Email:{" "}
                <a className="text-[color:var(--ui-accent-ink)] underline underline-offset-2" href={PUBLIC_CONTACT_MAILTO}>
                  {PUBLIC_CONTACT_EMAIL}
                </a>
                <br />
                Text messages are sent from: <span className="font-semibold">631-888-6340</span>
                <br />
                Customer service and HELP by phone: <span className="font-semibold">631-599-1363</span>
              </p>
              <p className="mt-3 text-[color:var(--ui-text-2)]">
                <span className="font-semibold">These two numbers are different on purpose.</span>{" "}
                <span className="font-semibold">631-888-6340</span> is our carrier-registered messaging number and is the number
                our text messages come from. <span className="font-semibold">631-599-1363</span> is our customer-service line,
                where a person answers. Replying <span className="font-semibold">HELP</span> to a text reaches our automated help
                reply; calling 631-599-1363 reaches our office.
              </p>
              <p className="mt-3 text-[color:var(--ui-text-2)]">
                We may also contact you from{" "}
                <span className="font-semibold">other phone numbers</span> (including local numbers, toll-free numbers, or
                additional carrier-registered messaging numbers) for routing, reliability, staffing, and deliverability.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">2. Your Consent to Contact You</h2>
            <p>
              We treat service communications and marketing communications as two separate things, we ask for them separately,
              and both are optional. Creating an account asks for no text-message consent at all.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">Signing up asks for no SMS consent.</span> The sign-up screen has no text-message
                checkboxes. If you sign up or sign in with your phone, we send a{" "}
                <span className="font-semibold">one-time verification code</span> that you request, through Twilio Verify. That
                single code is the only text it sends; it does not subscribe you to anything. Continuing on that screen means you
                agree to the{" "}
                <Link href="/terms" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  Privacy Policy
                </Link>{" "}
                and to receive that verification text. Msg &amp; data rates may apply.
              </li>
              <li>
                <span className="font-semibold">Service texts are optional.</span> Booking confirmations, appointment reminders and
                arrival updates are sent by SMS only if you agree in one of these ways: you tick the box{" "}
                <span className="font-semibold">&ldquo;Text me about my ProFixter visits&rdquo;</span> when you book a visit; you
                switch on <span className="font-semibold">&ldquo;Text me about my ProFixter visits.&rdquo;</span> in your account
                settings; or you tell our staff on a phone call that you agree to texts about your visits, and they record it. A box
                is never pre-ticked &mdash; you tick it yourself &mdash; and agreeing is never a condition of booking. Providing a
                phone number is not by itself consent to text you. You can turn service texts off at any time in your account
                settings.
              </li>
              <li>
                <span className="font-semibold">Requesting a Free Visit without an account.</span> The line under the{" "}
                <span className="font-semibold">&ldquo;Request my Free Visit&rdquo;</span> button reads: &ldquo;By requesting a
                visit, you agree that ProFixter may call or text you about this visit. Message frequency varies. Msg &amp; data rates
                may apply. Reply STOP to opt out or HELP for help.&rdquo; There is no checkbox: pressing the button is the agreement.
                It covers calls and texts about that requested visit only &mdash; that we received the request, its confirmation,
                reminders, a reschedule or cancellation, and who is coming &mdash; and never marketing or any other visit.
              </li>
              <li>
                <span className="font-semibold">On a phone call with our staff.</span> If you call us, our staff must ask whether
                you agree to texts about your visits and record your answer, Yes or No, with their name and the time. Your answer
                does not change your booking. A yes given on a call covers texts about your visits only and is never used to send
                you marketing texts.
              </li>
              <li>
                <span className="font-semibold">Marketing texts require a second, separate opt-in.</span> Promotional texts are sent
                only if you switch on <span className="font-semibold">&ldquo;Text me occasional ProFixter offers.&rdquo;</span> in
                your account settings, which is the only place you can turn marketing texts on today. It is unchecked by default, it
                is not the same box as the service one, and ticking either never ticks the other. Marketing texts are never offered
                at sign-up, at booking or with a Free Visit request, and telling our staff on a call that you want offers by text
                does not start them: you confirm it yourself.{" "}
                <span className="font-semibold">
                  Providing a phone number is never by itself treated as consent to marketing.
                </span>
              </li>
              <li>
                <span className="font-semibold">Marketing consent is never a condition of purchase</span> or of using the
                Service, and declining it changes nothing about your account, your bookings or your pricing.
              </li>
              <li>
                <span className="font-semibold">Declining texts changes nothing else.</span> By creating an account or booking a
                service you consent to be contacted about that service by <span className="font-semibold">email</span> and at the{" "}
                <span className="font-semibold">phone number you give us</span> — confirmations, receipts, scheduling and support
                replies — and those reach you normally whether or not you accept text messages.
              </li>
              <li>
                You may change either text-message choice at any time in your account settings, independently of the other.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">3. How We May Contact You (Channels &amp; Technology)</h2>
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

            <p className="mt-3 text-[color:var(--ui-text-2)]">
              Message frequency varies based on your activity (bookings, reminders, support requests, promotions you opted into) and
              operational needs. We do not guarantee delivery timing due to carrier, device, filtering, and network variability.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">4. Message Categories (What You Might Receive)</h2>

            <div className="space-y-4">
              <div id="service-texts" className="scroll-mt-24 rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5">
                <h3 className="text-[16px] font-semibold text-[color:var(--ui-ink)] mb-2">4.1 Customer Care / Transactional</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Appointment scheduling, confirmations, rescheduling, and arrival updates</li>
                  <li>Service status updates, follow-ups, and support conversations</li>
                  <li>Account security alerts</li>
                  <li>Billing notices, receipts, and important account notices</li>
                  <li>Requests for photos/info to prepare for a visit</li>
                </ul>
                <p className="mt-3 text-[color:var(--ui-text-2)]">
                  Optional. Offered as the unchecked box &ldquo;Text me about my ProFixter visits&rdquo; when you book, and in your
                  account settings; given for one visit by pressing &ldquo;Request my Free Visit&rdquo; under the line that says
                  so; or recorded by our staff when you agree on a phone call. Message frequency varies. Message and data rates
                  may apply. Reply STOP to opt out or HELP for help.
                  One-time sign-in verification codes are separate: they are sent only when you request one, through Twilio
                  Verify, and are not part of this category.
                </p>
              </div>

              <div id="marketing" className="scroll-mt-24 rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5">
                <h3 className="text-[16px] font-semibold text-[color:var(--ui-ink)] mb-2">4.2 Marketing (Only If You Opt In)</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Promotions, discounts, seasonal offers, referral rewards, and special announcements</li>
                  <li>Limited-time campaigns (example: new service area, early-bird discounts)</li>
                </ul>
                <p className="mt-3 text-[color:var(--ui-text-2)]">
                  Offered in your account settings, as the unchecked box &ldquo;Text me occasional ProFixter offers.&rdquo; Once
                  this method is registered with the carriers, a customer who asks our staff for offers by text may instead be
                  emailed a link to profixter.com/texts/confirm and press &ldquo;Yes, text me occasional ProFixter offers&rdquo;
                  there. Marketing consent is optional and is not required to purchase services. If you opt out of marketing, you
                  may still receive necessary transactional messages.
                </p>
              </div>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">5. Opt-Out, HELP, and Preferences</h2>
            <p>You control your messaging preferences. You can opt out anytime:</p>

            <div className="mt-4 rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5">
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
                  <a className="text-[color:var(--ui-accent-ink)] underline underline-offset-2" href={PUBLIC_CONTACT_MAILTO}>
                    {PUBLIC_CONTACT_EMAIL}
                  </a>
                  .
                </li>
              </ul>
              <p className="mt-3 text-[color:var(--ui-text-2)]">
                After you text STOP, you may receive a final confirmation message. STOP blocks every category of text message to
                that handset — service and marketing alike — and we will not text you again unless you opt back in. We may still
                send essential service-related messages by other methods (email/phone), which are not affected by your SMS
                choices.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">6. Message &amp; Data Rates, Carrier Notes, Delivery</h2>
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
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">7. How We Collect Opt-In (Consent Records)</h2>
            <p>
              Account sign-up collects no SMS consent: it has no text-message checkboxes, and continuing accepts the Terms of
              Service and Privacy Policy and a one-time verification text the person requests, sent through Twilio Verify. Neither
              service texts nor marketing texts are required to book or to use ProFixter.
            </p>
            <p className="mt-3">We collect SMS consent in these five places and nowhere else:</p>
            <ol className="list-decimal list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">The booking step</span> (signed in): one optional, unchecked box, &ldquo;Text me
                about my ProFixter visits&rdquo;, just above the final booking button, for service texts.
              </li>
              <li>
                <span className="font-semibold">The Free Visit request form</span> (no account): no checkbox; the line under the
                &ldquo;Request my Free Visit&rdquo; button, with links to these SMS Terms and the Privacy Policy. Pressing the
                button agrees to calls and texts about that one requested visit, and nothing else.
              </li>
              <li>
                <span className="font-semibold">Account settings</span>: two separate, unchecked boxes, one for service texts and
                one for marketing texts.
              </li>
              <li>
                <span className="font-semibold">A phone call with our staff</span>, for texts about your visits only: staff must
                ask and record Yes or No; neither answer is pre-selected. It is never used for marketing texts.
              </li>
              <li>
                <span className="font-semibold">profixter.com/texts/confirm</span>, for marketing texts, used only once this method
                is registered with the carriers: a page linked from an email we send after you ask our staff for offers by text,
                where you press &ldquo;Yes, text me occasional ProFixter offers&rdquo; yourself.
              </li>
            </ol>
            <p className="mt-3">
              Marketing texts are offered to customers only in account settings until the confirmation page is registered. We
              never send marketing texts on a yes given on a phone call. Written permission you send us yourself (your own email
              or text message, or a signed form) is recorded by our staff with a description of it, and no marketing text is sent
              on it until that method is registered with the carriers. Texting us does not by itself subscribe you to any
              category of message: if you text 631-888-6340, you get at most one automated reply a day saying the number is not
              monitored. We do not use a keyword sign-up, and we never buy, rent or accept a shared list of phone numbers.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                For each choice on an account we keep the consent status, the date and time it was recorded, the place it came from
                — the booking step, your account settings, a phone call recorded by our staff, or the confirmation page — the
                wording that applied, and, where staff recorded it, the staff member&apos;s name. Service texts and marketing texts
                are recorded separately. For a Free Visit requested without an account, we keep the exact line shown under the
                button and the time it was pressed.
              </li>
              <li>
                Replying <span className="font-semibold">START</span> or <span className="font-semibold">UNSTOP</span> lifts a
                previous STOP block on your handset, so this number is able to reach you again. It does not grant service SMS
                consent and it does not grant marketing SMS consent. If you have an account, you must switch the category you want
                back on yourself in your account settings (or agree again on a call, for texts about your visits), so that our
                record always reflects a choice you actually made. For a visit requested without an account, texts about that one
                visit can resume once the block is lifted.
              </li>
              <li>
                If you are providing a number that is not yours, you represent you have authorization from the account holder.
              </li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">8. Permitted Use of Your Contact Information</h2>
            <p>
              We use your contact information to operate the Service, provide customer support, schedule visits, prevent fraud,
              provide receipts/updates, and-only if you opt in-send marketing.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">9. Data Sharing, Transfer Restrictions (SMS Specific)</h2>
            <div className="rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5">
              <p className="font-semibold">
                Mobile information and SMS consent will not be shared with third parties or affiliates for marketing or
                promotional purposes.
              </p>
              <p className="mt-3">
                We may use service providers, such as messaging platforms and telecommunications carriers, solely as necessary
                to deliver messages and operate the messaging service. They may not use this information for their own
                marketing or promotional purposes. We never sell, rent or trade mobile information or SMS consent records.
              </p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">10. Data Protection Measures</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We use reasonable administrative, technical, and organizational safeguards to protect personal information.</li>
              <li>No system is 100% secure; we cannot guarantee absolute security of transmitted or stored data.</li>
              <li>We restrict access to systems and logs to authorized personnel and vendors supporting operations.</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">11. Acceptable Use / No Abuse</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You agree not to use our messaging channels for harassment, threats, spam, or illegal activity.</li>
              <li>We may block numbers that abuse support channels or send malicious content.</li>
              <li>We may require identity verification for account changes or sensitive support requests.</li>
            </ul>
          </section>

          {/* 12 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">12. Changes to These SMS Terms</h2>
            <p>
              We may update these terms from time to time. The latest version posted on this page applies going forward. If changes
              are material, we may provide additional notice as required by law.
            </p>
          </section>

          <p className="text-[13px] sm:text-sm text-[color:var(--ui-text-3)] mt-7 text-center">
            Last Updated: November 3, 2026
          </p>

          {/* See the note on the privacy policy: neighbouring documents, not a CTA. */}
          <nav aria-label="Related legal documents" className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] sm:text-sm text-[color:var(--ui-text-3)]">
            <Link href="/privacy" className="underline underline-offset-4 transition hover:text-[color:var(--ui-ink)]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline underline-offset-4 transition hover:text-[color:var(--ui-ink)]">
              Terms of Service
            </Link>
            <Link href="/sms-consent-example" className="underline underline-offset-4 transition hover:text-[color:var(--ui-ink)]">
              How we collect SMS consent
            </Link>
          </nav>
        </div>
      </div>
      <Footer />
    </div>
  );
}
