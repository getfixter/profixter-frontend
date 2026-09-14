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
 * consent is real: that the boxes start unticked and are ticked by the person,
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
  "Evidence for carrier and A2P review: how ProFixter collects SMS consent at sign-up, with screenshots. Service texts are required to create an account; marketing texts are a separate, optional choice. Neither box is pre-ticked.";

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
            <p>
              This is the wording shown beside each checkbox, verbatim, followed by what each choice covers. The two
              SMS labels are deliberately short: each one is a link to the{" "}
              <a href="/communication-consent" className="underline underline-offset-4">SMS Terms</a>, which carry the
              sending number, the frequency and rate disclosures and the STOP and HELP instructions in full.
              Following the link opens a new tab and does not tick the box.
            </p>

            <div className="mt-4 rounded-[8px] bg-white/5 border border-white/10 p-5 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Group label (HTML &lt;legend&gt;)
                </p>
                <p className="mt-1 font-semibold">Mobile number and text message preferences</p>
                <p className="mt-1 text-white/70">
                  The mobile number field and both SMS checkboxes are inside this one group &mdash; a single HTML
                  &lt;fieldset&gt; within the sign-up &lt;form&gt; &mdash; so it is unambiguous which number a
                  customer is giving permission for. There is only one phone field on the page, and it is the number
                  saved to the account. The group is presented without a visible frame or heading, so the legend is
                  addressed to assistive technology and to anything parsing the form.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Mobile phone number (required for the account, not an SMS opt-in)
                </p>
                <p className="mt-1 font-semibold">Mobile Phone Number</p>
                <p className="mt-1 text-white/70">
                  Required for your account, so we can call you and so your Fixter can reach you at the door.
                  Entering it does not by itself switch on any text message: the two checkboxes below it are what
                  record a choice, and both start empty.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Sub-heading
                </p>
                <p className="mt-1 font-semibold">Where the two boxes appear</p>
                <p className="mt-1 text-white/70">
                  On the final step of the sign-up form, immediately before the account is created, together with the
                  mobile number they apply to. No text-message question is asked on any earlier step. The form shows
                  the two names above and nothing else &mdash; no status word is printed beside either box. Service
                  texts are a condition of creating an account and are enforced when the customer presses Finish, by
                  the form and again by the server; offers and promotions are optional and can never stop an account
                  being created. Both are separate from the Terms of Service and from each other.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Checkbox 1 &mdash; service texts (required, unchecked by default)
                </p>
                <p className="mt-1 font-semibold">Service text messages</p>
                <p className="mt-1 text-white/70">
                  Booking confirmations, appointment reminders and service updates about the customer&rsquo;s own
                  visits, sent from (631) 888-6340. Message frequency varies. Message and data rates may apply. Reply
                  STOP to opt out or HELP for help. The label links to the SMS Terms, where all of this is set out in
                  full. Required to create an account, and never pre-ticked: the customer performs the tick.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Checkbox 2 &mdash; marketing texts (optional, unchecked by default, separate)
                </p>
                <p className="mt-1 font-semibold">Offers &amp; promotions</p>
                <p className="mt-1 text-white/70">
                  Optional, and separate from the service texts above. Not required to create an account, book or buy
                  anything, and declining it can never stop an account being created. Message frequency varies.
                  Message and data rates may apply. Reply STOP to opt out or HELP for help. The label links to the
                  marketing section of the SMS Terms.
                </p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                  Checkbox 3 &mdash; Terms acceptance (required, outside the SMS group, contains no SMS consent)
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
              <li>
                Service SMS is required to create a ProFixter account, and is still an affirmative act:
                the box is never pre-ticked and the customer has to tick it themselves.
              </li>
              <li>Marketing SMS is separately optional. It has its own box and its own record.</li>
              <li>Both boxes are unchecked by default. Neither is pre-selected at any point.</li>
              <li>
                Marketing SMS is not required to register an account, to book a visit, or to purchase a membership or
                any service, and declining it changes nothing about price, availability or service.
              </li>
              <li>
                Service SMS is a condition of holding an account and nothing further. It is not a condition of any
                individual booking, membership or purchase, and it never implies marketing consent.
              </li>
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
              These screenshots are taken from the live site. Sign-up is a four-step form, and the two text-message
              choices are asked once, on the final step, immediately before the account is created &mdash; together
              with the mobile number they apply to. The three earlier steps collect the property address, the
              customer&rsquo;s name and their email address, and none of them mentions text messages or shows a
              consent control of any kind.
            </p>
            <p className="mt-3">
              On that final step the mobile number field and both checkboxes sit inside a single HTML
              <code>&lt;fieldset&gt;</code> within the sign-up <code>&lt;form&gt;</code>. There is exactly one phone
              input on the page, so the number being consented is necessarily the number saved to the account &mdash;
              the two cannot differ. The required Terms of Service checkbox is in the same form but deliberately
              outside that group, because it carries no SMS consent.
            </p>
            <p className="mt-3">
              Each checkbox label is a link to the SMS Terms. Clicking the box toggles it; clicking the label opens
              the terms in a new tab and leaves the box exactly as it was, so nobody can record a consent while
              trying to read what it means.
            </p>

            <Evidence
              label="A &mdash; Desktop, the final sign-up step"
              src="/compliance/a2p-signup-desktop.png"
              alt="The final step of the ProFixter sign-up form on a desktop browser, showing the mobile phone number field with two unchecked SMS checkboxes directly beneath it."
              width={1440}
              height={930}
              caption="The final step of the sign-up form on a desktop browser, reached after the address, name and email steps. The mobile phone number field and both SMS checkboxes sit together in one group; both boxes are unchecked, and each label links to the SMS Terms."
            />

            <Evidence
              label="B &mdash; Mobile, the final sign-up step"
              src="/compliance/a2p-signup-mobile.png"
              alt="The same final sign-up step at phone width, showing the mobile number field and two unchecked SMS checkboxes in one group."
              width={390}
              height={918}
              caption="The same step at phone width. The mobile number field and both unchecked checkboxes are shown together on one screen, immediately above the button that creates the account."
            />

            <Evidence
              label="C &mdash; Service texts ticked, marketing deliberately left off"
              src="/compliance/a2p-signup-terms-separate.png"
              alt="The final sign-up step with the Terms checkbox and the service text checkbox ticked, and the offers and promotions checkbox left unticked."
              width={1440}
              height={930}
              caption="The same step, completed. The Terms of Service box and the service text box have each been ticked by the customer; the offers and promotions box has been left alone. The form submits in exactly this state and creates the account, and no marketing consent is recorded &mdash; which is what makes the two genuinely separate."
            />

            <Evidence
              label="D &mdash; A real account with both text categories switched off"
              src="/compliance/a2p-registered-no-sms.png"
              alt="A signed-in ProFixter account showing both SMS preferences switched off in account settings."
              width={1440}
              height={1100}
              caption="A signed-in account with both categories switched off from account settings. Service texts are a condition of creating an account, but they are not a condition of keeping one: a customer can switch them off here at any time afterwards, in one place, without contacting us. Confirmations, reminders and receipts continue to arrive by email."
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
