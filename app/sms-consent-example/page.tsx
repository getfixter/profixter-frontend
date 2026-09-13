import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

/**
 * How ProFixter collects SMS consent - the reviewer's evidence page.
 *
 * THIS PAGE IS EVIDENCE. IT IS NOT AN OPT-IN METHOD, AND THAT DISTINCTION IS
 * THE WHOLE DESIGN CONSTRAINT.
 *
 * A carrier reviewing an A2P 10DLC campaign has to satisfy themselves that
 * consent is real: that the checkboxes are optional, that they start unticked,
 * that refusing them still leaves a usable account, and that nothing about the
 * required Terms acceptance smuggles SMS consent in with it. On ProFixter that
 * all happens at /signup - which is a form behind four steps of address, name,
 * contact and password. A reviewer should not have to invent a Long Island
 * street address to check our compliance, and until this page existed, they did.
 *
 * So this page shows them, with screenshots taken from production, and collects
 * nothing at all. There is deliberately NO form element, NO input, NO checkbox
 * and NO button that changes any state on this page. If a future edit adds one,
 * this page stops being evidence of the opt-in flow and becomes a second,
 * undeclared opt-in flow - which is precisely the finding (Twilio error 30896,
 * "more than one opt-in method, not all listed") that it exists to prevent.
 * scripts/test_a2p_public_evidence.js in the backend repo pins that.
 *
 * The two phone numbers are stated apart on purpose. 631-888-6340 is the
 * carrier-registered number the texts come from; 631-599-1363 is the office
 * line a person answers. Both are correct, they are not interchangeable, and a
 * reviewer comparing this page against the campaign should be told which is
 * which rather than left to assume one of them is a typo.
 */

const TITLE = "How ProFixter collects SMS consent";
const DESCRIPTION =
  "Evidence for carrier and A2P review: how ProFixter collects SMS consent at sign-up, with screenshots. Service texts and marketing texts are two separate, optional, unchecked choices, and neither is required to register, book or buy.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | ProFixter` },
  description: DESCRIPTION,
  alternates: { canonical: "/sms-consent-example" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${TITLE} | ProFixter`,
    description: DESCRIPTION,
    url: absoluteUrl("/sms-consent-example"),
    siteName: "ProFixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | ProFixter`,
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
};

/** One screenshot with its caption. Plain figure; nothing interactive. */
function Evidence({
  label,
  src,
  alt,
  caption,
  width,
  height,
}: {
  label: string;
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}) {
  return (
    <figure className="mt-6 rounded-[10px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <figcaption className="mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#93c5fd]">{label}</span>
        <p className="mt-1.5 text-sm sm:text-base text-white/75 leading-relaxed">{caption}</p>
      </figcaption>
      {/*
        `unoptimized` on purpose: these are compliance screenshots and should
        reach a reviewer as captured, not re-encoded into a smaller, softer
        version by the image pipeline. Whether a checkbox reads as ticked is the
        entire value of the picture.
      */}
      <div className="overflow-hidden rounded-[8px] border border-white/10 bg-[#0B1628]">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full"
          unoptimized
        />
      </div>
    </figure>
  );
}

export default function SmsConsentExamplePage() {
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
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3 text-center tracking-tight">{TITLE}</h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-8 leading-relaxed">
          <span className="font-semibold">ProFixter</span> is operated by{" "}
          <span className="font-semibold">Premium Island Homes Inc.</span>
          <br />
          NY State Home Improvement Contractor licence{" "}
          <span className="font-semibold">HI-71484</span> &middot; Nassau and Suffolk Counties, New York
        </p>

        <div className="rounded-[8px] border border-[#93c5fd]/25 bg-[#93c5fd]/[0.06] p-5 text-sm sm:text-base leading-relaxed text-white/80">
          This page is published as <span className="font-semibold">evidence</span> of how ProFixter collects consent
          to send text messages. It explains and illustrates the real sign-up form at{" "}
          <Link href="/signup" className="text-[#93c5fd] underline underline-offset-2">
            profixter.com/signup
          </Link>
          . <span className="font-semibold">It is not itself a way to sign up for text messages.</span> Nothing on this
          page collects information, and there is no checkbox, form or button here that subscribes anyone to anything.
        </div>

        <div className="space-y-10 text-sm sm:text-base text-white/85 leading-relaxed mt-10">
          {/* 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">1. The two phone numbers, and why they differ</h2>
            <div className="rounded-[8px] bg-white/5 border border-white/10 p-5">
              <p>
                Text messages are sent from: <span className="font-semibold">631-888-6340</span>
                <br />
                Customer service and HELP by phone: <span className="font-semibold">631-599-1363</span>
              </p>
              <p className="mt-3 text-white/70">
                <span className="font-semibold">These are two different numbers on purpose.</span>{" "}
                631-888-6340 is our carrier-registered messaging number and is the number our text messages come from.
                631-599-1363 is our customer-service line, where a person answers. Replying{" "}
                <span className="font-semibold">HELP</span> to a text returns our automated help reply; calling
                631-599-1363 reaches our office during business hours.
              </p>
              <p className="mt-3 text-white/70">
                Email:{" "}
                <a className="text-[#93c5fd] underline underline-offset-2" href={PUBLIC_CONTACT_MAILTO}>
                  {PUBLIC_CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">2. Where consent is collected</h2>
            <p>
              There are exactly two places, and they present the same two choices:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                The public account sign-up form at{" "}
                <Link href="/signup" className="text-[#93c5fd] underline underline-offset-2">
                  profixter.com/signup
                </Link>
                .
              </li>
              <li>The SMS preferences in a signed-in customer&apos;s own account settings.</li>
            </ul>
            <p className="mt-3">
              We do not use keyword sign-up. We do not accept verbal opt-ins. We do not accept paper opt-ins. We never
              buy, rent, or accept a shared or transferred list of phone numbers. Consent is collected by ProFixter, for
              ProFixter, and is never shared with third parties or affiliates for marketing or promotional purposes.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">3. The exact consent language</h2>
            <p>This is the wording shown beside each checkbox, verbatim.</p>

            <div className="mt-4 rounded-[8px] bg-white/5 border border-white/10 p-5 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Panel heading
                </p>
                <p className="mt-1 font-semibold">Text messages &mdash; optional</p>
                <p className="mt-1 text-white/70">
                  You can create an account, book visits and use every ProFixter service without agreeing to receive
                  text messages. These choices are separate from the Terms of Service, and separate from each other.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Checkbox 1 &mdash; service texts (optional, unchecked by default)
                </p>
                <p className="mt-1 font-semibold">Text me about my ProFixter visits.</p>
                <p className="mt-1 text-white/70">
                  Optional. Receive booking confirmations, appointment reminders and service updates from ProFixter,
                  sent from (631) 888-6340. Message frequency varies. Message and data rates may apply. Reply STOP to
                  opt out or HELP for help.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Checkbox 2 &mdash; marketing texts (optional, unchecked by default, separate)
                </p>
                <p className="mt-1 font-semibold">Text me occasional ProFixter offers.</p>
                <p className="mt-1 text-white/70">
                  Optional, and separate from the service texts above. Not required to create an account, book or buy
                  anything. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP
                  for help.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Checkbox 3 &mdash; Terms acceptance (required, and contains no SMS consent)
                </p>
                <p className="mt-1 font-semibold">I agree to the Terms of Service and Privacy Policy.</p>
                <p className="mt-1 text-white/70">Required to create an account.</p>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">4. What is, and is not, consent</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Service SMS is optional. It is off unless the customer ticks the service box themselves.</li>
              <li>Marketing SMS is separately optional. It has its own box and its own record.</li>
              <li>Both boxes are unchecked by default. Neither is pre-selected at any point.</li>
              <li>Neither is required to register an account.</li>
              <li>Neither is required to book a visit.</li>
              <li>Neither is required to purchase a membership or any service.</li>
              <li>
                <span className="font-semibold">Entering a phone number is not consent.</span> A number is required to
                register so that we can telephone you and so your Fixter can reach you at the door. It never by itself
                switches on any text message.
              </li>
              <li>
                <span className="font-semibold">Accepting the Terms of Service is not SMS consent.</span> The Terms
                checkbox covers the Terms and the Privacy Policy and nothing else. No SMS consent of any kind is bundled
                into it.
              </li>
              <li>
                <span className="font-semibold">Texting ProFixter is not SMS consent.</span> Sending us a message does
                not subscribe you to any category of message.
              </li>
              <li>
                <span className="font-semibold">Replying START or UNSTOP is not SMS consent.</span> See section 6.
              </li>
              <li>
                There is no verbal opt-in, no paper opt-in, no keyword opt-in, and no purchased, rented or shared list.
              </li>
            </ul>
            <p className="mt-3">
              Where a customer has not ticked a box, we hold no consent, and we send no text. Silence is never treated
              as agreement, and an account created before these checkboxes existed is treated as having said nothing at
              all &mdash; because that customer was never asked.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. What the sign-up form actually looks like</h2>
            <p>
              These screenshots are taken from the live site. The panel headed &ldquo;Text messages &mdash;
              optional&rdquo; is visible from the first step, before anything has been typed, so the two SMS choices are
              on screen the moment the page opens.
            </p>

            <Evidence
              label="A &mdash; Desktop, /signup on load"
              src="/compliance/a2p-signup-desktop.png"
              alt="The ProFixter sign-up page on a desktop browser, showing the optional text-message panel with two unchecked checkboxes."
              width={1440}
              height={900}
              caption="The sign-up page as it first loads on a desktop browser. Both SMS checkboxes are present and unchecked, with links to the Terms of Service, Privacy Policy and SMS Terms."
            />

            <Evidence
              label="B &mdash; Mobile, /signup on load"
              src="/compliance/a2p-signup-mobile.png"
              alt="The ProFixter sign-up page on a phone-sized screen, showing the same optional text-message panel with two unchecked checkboxes."
              width={390}
              height={844}
              caption="The same page at phone width. The optional text-message panel and both unchecked checkboxes are shown without the reviewer entering any information."
            />

            <Evidence
              label="C &mdash; Terms accepted, both SMS choices left off"
              src="/compliance/a2p-signup-terms-separate.png"
              alt="The final sign-up step showing the required Terms checkbox ticked while both optional SMS checkboxes remain unticked."
              width={1440}
              height={1100}
              caption="The final step immediately before the account is created. The required Terms of Service checkbox is ticked; both optional SMS checkboxes are untouched. The form submits in this state."
            />

            <Evidence
              label="D &mdash; A real account registered with both SMS choices off"
              src="/compliance/a2p-registered-no-sms.png"
              alt="A signed-in ProFixter account showing both SMS preferences switched off after registration."
              width={1440}
              height={1100}
              caption="The resulting account, signed in. Registration completed normally and no SMS consent of any kind was recorded. Confirmations, reminders and receipts continue to arrive by email."
            />

            <Evidence
              label="E &mdash; The same two choices in account settings"
              src="/compliance/a2p-account-sms-switches.png"
              alt="Account settings showing two independent SMS switches, one for service texts and one for marketing texts, both off."
              width={1120}
              height={140}
              caption="Account settings. The two choices remain independent after registration: turning one on never turns the other on, and either can be switched off at any time."
            />
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">6. STOP, HELP, and what START really does</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">STOP</span> (also STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) stops every
                category of text to that handset, service and marketing alike. It also switches both stored preferences
                off, so the account no longer records a consent the customer has just withdrawn. A single confirmation
                message is returned.
              </li>
              <li>
                <span className="font-semibold">HELP</span> (also INFO) returns our automated help reply, identifying
                Premium Island Homes Inc., message frequency, that message and data rates may apply, how to opt out, and
                where to reach us.
              </li>
              <li>
                <span className="font-semibold">START or UNSTOP removes the block on the handset and nothing more.</span>{" "}
                It does not grant service SMS consent and it does not grant marketing SMS consent. After replying START,
                a customer still receives no text messages from us until they switch a category back on themselves in
                their account settings. This is deliberately more conservative than the carrier default, so that our
                record always reflects a choice the customer actually made.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">7. What we keep as a consent record</h2>
            <p>For each of the two choices, independently, we retain:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>the consent status &mdash; on, off, or never chosen;</li>
              <li>the date and time it was recorded;</li>
              <li>
                the place it came from &mdash; the sign-up form, or the customer&apos;s own account settings.
              </li>
            </ul>
            <p className="mt-3">
              Service texts and marketing texts are recorded separately, and neither is ever inferred from the other.
              &ldquo;Never chosen&rdquo; and &ldquo;switched off&rdquo; are stored as different states and stay
              distinguishable, because only one of them means the customer was ever asked.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">8. Message categories</h2>
            <p>
              <span className="font-semibold">Service texts</span> &mdash; booking confirmations, rescheduling and
              cancellation notices, appointment reminders, notice that a Fixter is on the way, membership and account
              notices, and payment problems.
            </p>
            <p className="mt-3">
              <span className="font-semibold">Marketing texts</span> &mdash; occasional offers about memberships,
              seasonal work and renovation services. Every marketing message carries &ldquo;Reply STOP to opt
              out.&rdquo;
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">9. The documents themselves</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <Link href="/signup" className="text-[#93c5fd] underline underline-offset-2">
                  https://www.profixter.com/signup
                </Link>{" "}
                &mdash; the sign-up form where consent is collected
              </li>
              <li>
                <Link href="/privacy" className="text-[#93c5fd] underline underline-offset-2">
                  https://www.profixter.com/privacy
                </Link>{" "}
                &mdash; Privacy Policy
              </li>
              <li>
                <Link href="/terms" className="text-[#93c5fd] underline underline-offset-2">
                  https://www.profixter.com/terms
                </Link>{" "}
                &mdash; Terms of Service
              </li>
              <li>
                <Link href="/communication-consent" className="text-[#93c5fd] underline underline-offset-2">
                  https://www.profixter.com/communication-consent
                </Link>{" "}
                &mdash; Communication Consent &amp; SMS Terms
              </li>
            </ul>
            <p className="mt-4 text-white/70">
              Mobile information and SMS consent will not be shared with third parties or affiliates for marketing or
              promotional purposes.
            </p>
          </section>
        </div>

        <nav
          aria-label="Related legal documents"
          className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs sm:text-sm text-white/55"
        >
          <Link href="/privacy" className="underline underline-offset-4 transition hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline underline-offset-4 transition hover:text-white">
            Terms of Service
          </Link>
          <Link href="/communication-consent" className="underline underline-offset-4 transition hover:text-white">
            Communication Consent &amp; SMS Terms
          </Link>
        </nav>
      </div>
    </div>
  );
}
