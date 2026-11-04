import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
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
 * that refusing them still leaves a usable account, and that nothing required
 * smuggles SMS consent in with it. Since Registration 2.0 the opt-in lives at
 * the booking step and in account settings, both behind a sign-in, so a
 * reviewer cannot reach it without an account. This page shows them, with
 * annotated screenshots of the real screens, and collects nothing at all.
 *
 * There is deliberately NO form element, NO input, NO checkbox and NO button
 * that changes any state on this page. If a future edit adds one, this page
 * stops being evidence of the opt-in flow and becomes a second, undeclared
 * opt-in flow - which is precisely the finding (Twilio error 30896, "more than
 * one opt-in method, not all listed") that it exists to prevent.
 * scripts/test_a2p_public_evidence.js in the backend repo pins that.
 *
 * REGISTRATION 2.0. The registered campaign makes text consent optional and
 * asks for none at sign-up. Sign-in codes are sent through Twilio Verify,
 * outside the campaign, and a code the person requests needs no checkbox. So
 * sign-up has no SMS boxes.
 *
 * 2026-11-03: this page used to say consent was collected in exactly two
 * places and that there was no verbal opt-in. Neither was true any more, so it
 * now lists every place consent is collected, as the code does it:
 *   1. the booking-step box, "Text me about my ProFixter visits"
 *      ("sms_service.booking.v2");
 *   2. the line under the guest Free Visit request button (no account, no
 *      checkbox; FrontEnd booking4/FreeVisitForm.tsx, BackEnd
 *      routes/freeVisitRequests.js), for texts about that one visit only
 *      (BackEnd utils/sms/smsEligibility.js GUEST_VISIT_TYPES);
 *   3. account settings ("sms_service.settings.v1", "sms_marketing.settings.v1");
 *   4. staff recording a caller's yes or no in Admin, for texts about their
 *      visits ("sms_service.admin_phone.v1", or the guest visit's own record) -
 *      never marketing (BackEnd utils/consent/marketingSmsBasis.js);
 *   5. profixter.com/texts/confirm, for marketing, held until
 *      SMS_ADMIN_ASSISTED_OPTIN_REGISTERED=true;
 *   6. (2026-11-03) the mobile-number screen (FrontEnd
 *      auth/ContactCompletion.tsx): one optional, unticked offers box
 *      ("sms_marketing.phone_verify.v1"), and when a number is changed a
 *      second one for visit texts ("sms_service.phone_change.v1"), both
 *      recorded only after the code verifies the number.
 * The wording quoted below is the wording in BackEnd
 * utils/consent/consentText.js and on those screens, word for word.
 *
 * The two phone numbers are stated apart on purpose. 631-888-6340 is the
 * carrier-registered number the texts come from; 631-599-1363 is the office
 * line a person answers.
 */

const TITLE = "How ProFixter collects SMS consent";
const DESCRIPTION =
  "Evidence for carrier and A2P review: how ProFixter collects SMS consent, with annotated screenshots. The phone sign-up screen asks for no SMS consent. Texts about visits are optional: a box at booking, the line at the Free Visit request button, account settings, or a yes recorded by staff on a call. Customers switch on marketing texts themselves, in account settings or with an optional box on the mobile-number screen.";

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
    <figure className="mt-6 rounded-[10px] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-soft)] p-4 sm:p-5">
      <figcaption className="mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ui-accent-ink)]">{label}</span>
        <p className="mt-1.5 text-[15px] sm:text-base text-[color:var(--ui-text-2)] leading-relaxed">{caption}</p>
      </figcaption>
      {/*
        `unoptimized` on purpose: these are compliance screenshots and should
        reach a reviewer as captured, not re-encoded into a smaller, softer
        version by the image pipeline. Whether a checkbox reads as ticked is the
        entire value of the picture.
      */}
      <div className="mx-auto max-w-[420px] overflow-hidden rounded-[8px] border border-[color:var(--ui-line)] bg-[#0B1628]">
        <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" unoptimized />
      </div>
    </figure>
  );
}

/** One quoted piece of on-screen wording. */
function Wording({ label, quote, children }: { label: string; quote: string; children: ReactNode }) {
  return (
    <div className="border-t border-[color:var(--ui-line)] pt-4 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ui-text-3)]">{label}</p>
      <p className="mt-1 font-semibold">&ldquo;{quote}&rdquo;</p>
      <p className="mt-1 text-[color:var(--ui-text-2)]">{children}</p>
    </div>
  );
}

export default function SmsConsentExamplePage() {
  return (
    <div className="min-h-screen bg-white text-[color:var(--ui-ink)]">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <div
        className="ui-container ui-container--narrow pb-16 pt-8 sm:pb-20 sm:pt-12"
      >
        <h1 className="ui-display mb-3 text-center">{TITLE}</h1>

        <p className="text-[15px] sm:text-base text-[color:var(--ui-text-2)] text-center mb-8 leading-relaxed">
          <span className="font-semibold">ProFixter</span> is operated by{" "}
          <span className="font-semibold">Premium Island Homes Inc.</span>
          <br />
          Suffolk County home improvement licence{" "}
          <span className="font-semibold">HI-71484</span> &middot; Nassau and Suffolk Counties, New York
        </p>

        <div className="rounded-[8px] border border-[color:var(--ui-line)] bg-[color:var(--ui-accent-soft)] p-5 text-[15px] sm:text-base leading-relaxed text-[color:var(--ui-text-2)]">
          This page is published as <span className="font-semibold">evidence</span> of how ProFixter collects consent
          to send text messages. It explains and illustrates the real screens: the sign-up screen at{" "}
          <Link href="/signup" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
            profixter.com/signup
          </Link>
          , the booking step, the Free Visit request form at{" "}
          <Link href="/book/free" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
            profixter.com/book/free
          </Link>
          , account settings, the mobile-number screen, and what our staff record on a phone call.{" "}
          <span className="font-semibold">It is not itself a way to sign up for text messages.</span> Nothing on this
          page collects information, and there is no checkbox, form or button here that subscribes anyone to anything.
        </div>

        <div className="space-y-10 text-[15px] sm:text-base text-[color:var(--ui-text-2)] leading-relaxed mt-10">
          {/* 1 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">1. The two phone numbers, and why they differ</h2>
            <div className="rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5">
              <p>
                Text messages are sent from: <span className="font-semibold">631-888-6340</span>
                <br />
                Customer service and HELP by phone: <span className="font-semibold">631-599-1363</span>
              </p>
              <p className="mt-3 text-[color:var(--ui-text-2)]">
                <span className="font-semibold">These are two different numbers on purpose.</span>{" "}
                631-888-6340 is our carrier-registered messaging number and is the number our text messages come from.
                631-599-1363 is our customer-service line, where a person answers. Replying{" "}
                <span className="font-semibold">HELP</span> to a text returns our automated help reply; calling
                631-599-1363 reaches our office during business hours.
              </p>
              <p className="mt-3 text-[color:var(--ui-text-2)]">
                Email:{" "}
                <a className="text-[color:var(--ui-accent-ink)] underline underline-offset-2" href={PUBLIC_CONTACT_MAILTO}>
                  {PUBLIC_CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">2. Where consent is collected</h2>
            <p>
              Text messages are optional at every point, and the phone sign-up screen collects none. SMS consent is
              collected in these six places, and nowhere else:
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">The booking step</span> (signed-in customers) &mdash; one optional,
                unchecked box, &ldquo;Text me about my ProFixter visits&rdquo;, just above the final booking button, for
                service texts only.
              </li>
              <li>
                <span className="font-semibold">The Free Visit request form</span> (no account needed) &mdash; at
                profixter.com/book/free and on the homepage. There is no checkbox. The line directly under the
                &ldquo;Request my Free Visit&rdquo; button states what the person agrees to, with links to the SMS Terms
                and the Privacy Policy; pressing the button is the agreement. It covers calls and texts about that one
                requested visit and nothing else, never marketing.
              </li>
              <li>
                <span className="font-semibold">Account settings</span> &mdash; two separate, unchecked boxes, one for
                service texts and one for marketing texts.
              </li>
              <li>
                <span className="font-semibold">The mobile-number screen</span> (signed-in customers) &mdash; shown when
                a customer adds a mobile number to their account (including right after creating an account with email,
                Google or Apple) or changes it. Under the number field there is one optional, unchecked box,
                &ldquo;Text me ProFixter offers, too.&rdquo;, for marketing texts only. It is recorded only after the
                customer enters the code that verifies the number, and the account works the same whether or not it is
                ticked. When a customer changes their number, consent given for the old number does not move to the new
                one, so a second optional, unchecked box, &ldquo;Text me about my ProFixter visits&rdquo;, is also shown.
              </li>
              <li>
                <span className="font-semibold">A phone call with ProFixter staff</span> &mdash; for texts about the
                caller&apos;s own visits only. Staff must ask, and record the answer in our admin system: when they
                create a customer or a visit, they must choose Yes or No, and neither is pre-selected. The record names
                the staff member and the time. A yes given on a call is never used for marketing texts.
              </li>
              <li>
                <span className="font-semibold">The confirmation page profixter.com/texts/confirm</span> &mdash; for
                marketing texts, and only once this method is registered with the carriers. A customer who has asked
                our staff for offers by text is emailed a link to it, and presses &ldquo;Yes, text me occasional
                ProFixter offers&rdquo; themselves. Until it is registered, that email links to account settings
                instead, and no marketing text is sent on a confirmation recorded on that page.
              </li>
            </ol>
            <p className="mt-3">
              <span className="font-semibold">The phone sign-up screen collects no SMS consent.</span> It has no
              text-message checkboxes. A person who signs up with a phone number receives a one-time verification code
              that they request themselves, sent through Twilio Verify and not under this messaging campaign. Verifying
              a number is never consent; only a box the customer ticks is.
            </p>
            <p className="mt-3">
              <span className="font-semibold">Marketing texts are never sent on what staff record.</span> If a caller
              asks for offers by text, staff can note it, but nothing is sent until the customer switches offers on
              themselves in account settings. Written permission a customer sends us (their own email or text message,
              or a signed form), which staff record with a description of it, is held the same way as the confirmation
              page: no marketing text is sent on it until that method is registered with the carriers.
            </p>
            <p className="mt-3">
              We do not use keyword sign-up. We never buy, rent, or accept a shared or transferred list of phone numbers.
              Consent is collected by ProFixter, for ProFixter, and is never shared with third parties or affiliates for
              marketing or promotional purposes.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">3. The exact wording on each screen</h2>
            <p>
              Verbatim, followed by what each choice covers. The document links at the booking box, the Free Visit line
              , account settings and the mobile-number screen (the{" "}
              <a href="/communication-consent" className="underline underline-offset-4">
                SMS Terms
              </a>
              , the Privacy Policy and the Terms of Service) open in a new tab, and following one never ticks a box.
            </p>

            <div className="mt-4 rounded-[8px] bg-[color:var(--ui-bg-soft)] border border-[color:var(--ui-line)] p-5 space-y-4">
              <Wording
                label="Sign-up screen - one line under the “Text me a code” button (no checkbox)"
                quote="By continuing, you agree to the Terms and Privacy Policy and to receive a one-time verification text. Msg & data rates may apply."
              >
                &ldquo;Terms&rdquo; links to the Terms of Service, &ldquo;Privacy Policy&rdquo; to the Privacy Policy, and
                &ldquo;verification text&rdquo; to the SMS Terms. The screen shows a heading, the mobile number field,
                the button and this line, and nothing else. The verification code is a single text the person requests
                and is sent by Twilio Verify; it is not a subscription and records no SMS consent. No marketing consent
                of any kind is asked for on this screen.
              </Wording>

              <Wording
                label="Booking step - service texts (optional, unchecked by default)"
                quote="Text me about my ProFixter visits"
              >
                Shown beside a single checkbox just above the final booking button, with this line beneath it:
                &ldquo;Optional. Booking confirmations, appointment reminders and arrival updates. Message frequency
                varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.&rdquo; followed by the
                links &ldquo;SMS Terms&rdquo; (the service-texts section of the SMS Terms), &ldquo;Privacy&rdquo; and
                &ldquo;Terms&rdquo;. It is shown to a signed-in customer with a phone number on their account who has
                not already turned service texts on. It covers service texts only, never marketing. It is never
                pre-ticked, it is not required to book, and the booking goes ahead whether or not it is ticked; a tick
                is saved only after the booking has been accepted.
              </Wording>

              <Wording
                label="Free Visit request form - the line under the “Request my Free Visit” button (no account, no checkbox)"
                quote="By requesting a visit, you agree that ProFixter may call or text you about this visit. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help."
              >
                Followed by the links &ldquo;SMS Terms&rdquo; (the service-texts section of the SMS Terms) and
                &ldquo;Privacy&rdquo;. The person gives their name, mobile number, email, address and a preferred time,
                and presses the button directly above this line; that press is the agreement. The request stores the
                exact line shown and the time. It covers messages about that requested visit only: that the request was
                received, its confirmation, reminders, a reschedule or cancellation, and who is coming. It is never used
                for marketing or for any other visit, and a STOP ends it like any other text.
              </Wording>

              <Wording
                label="Account settings - service texts (optional, unchecked until switched on)"
                quote="Text me about my ProFixter visits."
              >
                &ldquo;Optional. Booking confirmations, appointment reminders and service updates. Message frequency
                varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.&rdquo;
              </Wording>

              <Wording
                label="Account settings - marketing texts (optional, unchecked, separate)"
                quote="Text me occasional ProFixter offers."
              >
                &ldquo;Optional, and separate from the service texts above. Message frequency varies. Message and data
                rates may apply. Reply STOP to opt out or HELP for help.&rdquo; Customers switch on marketing texts
                themselves only here or with the optional box on the mobile-number screen: never on the phone sign-up
                screen, never at booking, never at the Free Visit request, and never combined with anything required.
              </Wording>

              <Wording
                label="The mobile-number screen - marketing texts (optional, unchecked by default)"
                quote="Text me ProFixter offers, too."
              >
                Beside a single checkbox under the mobile number field and above the &ldquo;Text me a code&rdquo;
                button, with this line beneath it: &ldquo;Optional, not required to buy. Msg frequency varies. Msg &amp;
                data rates may apply. Reply STOP to opt out, HELP for help.&rdquo; followed by the links &ldquo;SMS
                Terms&rdquo; (the marketing section of the SMS Terms) and &ldquo;Privacy&rdquo;. It is not shown to a
                customer who already receives offer texts. A tick is recorded, with this wording, the phone number and
                the time, only after the customer enters the code that verifies the number; the number is saved and the
                customer continues whether or not it is ticked. A STOP from that phone still stops every text.
              </Wording>

              <Wording
                label="The mobile-number screen when changing a number - service texts (optional, unchecked)"
                quote="Text me about my ProFixter visits"
              >
                Shown only when a customer replaces the number on their account, because consent given for the old
                number does not move to the new one. The line beneath it reads: &ldquo;Booking confirmations, reminders
                and arrival updates. Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP
                for help.&rdquo; followed by the SMS Terms and Privacy links. Recorded only after the new number is
                verified with its code.
              </Wording>

              <Wording
                label="Account settings - the line under both boxes"
                quote="Texts come from ProFixter at (631) 888-6340."
              >
                Followed by the links &ldquo;SMS Terms&rdquo;, &ldquo;Privacy Policy&rdquo; and &ldquo;Terms of
                Service&rdquo;.
              </Wording>

              <Wording
                label="Our admin system, used by staff on a phone call - the question staff must answer (Yes or No, nothing pre-selected)"
                quote="Did they agree to texts about their visits?"
              >
                When creating a visit for a caller who has no account, the question reads &ldquo;Did they agree to texts
                about this visit?&rdquo;. The two answers are &ldquo;Yes, asked and agreed&rdquo; and &ldquo;No&rdquo;;
                a customer with a phone number cannot be created, and that visit cannot be booked, until staff choose
                one, and either answer lets them go ahead. For an existing customer, staff who have asked on a call
                switch service texts on in the customer&apos;s record. A yes for a customer account is recorded as: &ldquo;Agreed by phone with ProFixter staff, who
                recorded it in Admin: text messages about this customer&apos;s account and visits - account access,
                booking confirmations, reminders, arrival and service updates, billing notices. Message frequency
                varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.&rdquo; A yes for a visit
                without an account is recorded on that visit as: &ldquo;Agreed by phone to be contacted by call or text
                about this visit; recorded in Admin by&rdquo; followed by the staff member&apos;s name. Both are stored
                with the time. The customer can turn these texts off in their account, and STOP always wins.
              </Wording>

              <Wording
                label="profixter.com/texts/confirm - marketing texts (used only once registered with the carriers)"
                quote="Yes, text me occasional ProFixter offers"
              >
                The page opens from an email ProFixter sends a customer who asked our staff for offers by text. It
                shows the last four digits of their phone number and, under the button: &ldquo;Optional, and not
                required to buy anything. Message frequency varies. Message and data rates may apply. Reply STOP to opt
                out or HELP for help.&rdquo; followed by links to the SMS Terms, the Privacy Policy and the Terms of
                Service. Opening the page changes nothing; only pressing the button records consent.
              </Wording>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">4. What is, and is not, consent</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">Service SMS is optional.</span> It is never required to create an
                account, to book a visit, or to buy anything.
              </li>
              <li>
                <span className="font-semibold">Marketing SMS is separately optional</span>. Customers switch it on
                themselves, in account settings or with the optional box on the mobile-number screen, each with its own
                box and its own record. It is never switched on by verifying a number, by booking, by requesting a Free
                Visit, or by anything said on a phone call.
              </li>
              <li>
                Every SMS box is unchecked by default and never pre-ticked: the customer performs the tick themselves.
                The Free Visit request has no box: the agreement is pressing &ldquo;Request my Free Visit&rdquo;, with
                the full line directly under it. On a call, staff must choose Yes or No, and neither is pre-selected.
              </li>
              <li>
                Declining texts changes nothing about price, availability or service. Confirmations, reminders and
                receipts still arrive by email.
              </li>
              <li>
                <span className="font-semibold">Requesting a verification code is not SMS consent.</span> The one-time
                code is sent through Twilio Verify only because the person asked for it, and it subscribes them to
                nothing.
              </li>
              <li>
                <span className="font-semibold">Entering a phone number is not consent.</span> It never by itself
                switches on any text message.
              </li>
              <li>
                <span className="font-semibold">Accepting the Terms of Service is not SMS consent.</span> Continuing on
                the sign-up screen accepts the Terms and the Privacy Policy and the one requested verification text,
                and nothing else. No service or marketing consent is bundled into it.
              </li>
              <li>
                <span className="font-semibold">Texting ProFixter is not SMS consent.</span> Sending us a message does
                not subscribe you to any category of message. Someone who texts 631-888-6340 gets at most one automated
                reply a day, saying the number is not monitored and giving our customer-service number.
              </li>
              <li>
                <span className="font-semibold">Replying START or UNSTOP is not SMS consent.</span> See section 6.
              </li>
              <li>
                There is no keyword opt-in, and no purchased, rented or shared list. A yes given on a phone call covers
                only texts about that caller&apos;s visits, and is never used for marketing texts.
              </li>
            </ul>
            <p className="mt-3">
              Without one of the consents described on this page, we send no text, apart from that single reply to
              someone who texted us first. Silence is never treated as agreement.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">5. What the screens actually look like</h2>
            <p>
              Annotated screenshots of the real screens at phone width. The annotations (outlines and numbered notes)
              are added for this page and are not part of the screens themselves.
            </p>

            <Evidence
              label="A - The phone sign-up screen: no checkboxes"
              src="/compliance/a2p-v3-signup.png"
              alt="The ProFixter phone sign-up screen at phone width: a heading, the mobile number field, the Text me a code button and one line of terms text beneath it, with no checkboxes."
              width={390}
              height={844}
              caption="Sign-up asks for no SMS consent. The screen is a heading, the mobile number field, the “Text me a code” button and one line: “By continuing, you agree to the Terms and Privacy Policy and to receive a one-time verification text. Msg & data rates may apply.” The verification code is sent through Twilio Verify, only on request."
            />

            <Evidence
              label="B - The booking step: one optional, unticked box"
              src="/compliance/a2p-v3-booking.png"
              alt="The ProFixter booking step at phone width, with the unticked checkbox Text me about my ProFixter visits, its disclosure line and the SMS Terms, Privacy and Terms links, directly above the final booking button."
              width={390}
              height={844}
              caption="“Text me about my ProFixter visits” sits just above the final booking button, unticked. It covers service texts only, states frequency, rates, STOP and HELP, and links to the SMS Terms, Privacy Policy and Terms of Service. The booking goes ahead whether or not it is ticked."
            />

            <Evidence
              label="C - The Free Visit request form: no account, no checkbox"
              src="/compliance/a2p-v3-free-visit.png"
              alt="The ProFixter Free Visit request form at phone width: the Request my Free Visit button with the consent line directly under it and links to the SMS Terms and Privacy Policy. There is no checkbox."
              width={390}
              height={844}
              caption="The line directly under “Request my Free Visit” says ProFixter may call or text about this visit, with frequency, rates, STOP and HELP, and links to the SMS Terms and Privacy Policy. Pressing the button is the agreement. It covers that one requested visit only, never marketing."
            />

            <Evidence
              label="D - Account settings: two separate, unticked boxes"
              src="/compliance/a2p-v3-settings.png"
              alt="ProFixter account settings at phone width, showing two separate unchecked text message boxes, Text me about my ProFixter visits and Text me occasional ProFixter offers, and under them the sending number with links to the SMS Terms, Privacy Policy and Terms of Service."
              width={390}
              height={844}
              caption="Account settings. Service texts and marketing texts are two independent, unticked boxes; turning one on never turns the other on, and either can be switched off at any time. Under them: the number texts come from, and the SMS Terms, Privacy Policy and Terms of Service."
            />

            <Evidence
              label="E - The mobile-number screen: one optional, unticked offers box"
              src="/compliance/a2p-v3-phone.png"
              alt="The ProFixter Add your mobile number screen at phone width: the mobile number field, the unticked checkbox Text me ProFixter offers, too. with its disclosure line and SMS Terms and Privacy links, the Text me a code button and the terms line beneath it."
              width={390}
              height={844}
              caption="Shown when a customer adds or changes the mobile number on their account. &ldquo;Text me ProFixter offers, too.&rdquo; is unticked and optional, states frequency, rates, STOP and HELP, and links to the SMS Terms and Privacy Policy. It is recorded only after the code verifies the number; the customer continues either way."
            />

            <p className="mt-6">
              Our admin system is not public, so it is not pictured. On a call, staff see the question &ldquo;Did they
              agree to texts about their visits?&rdquo; with two buttons, &ldquo;Yes, asked and agreed&rdquo; and
              &ldquo;No&rdquo;, neither selected until staff choose one (section 3).
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">6. STOP, HELP, and what START really does</h2>
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
                It does not grant service SMS consent and it does not grant marketing SMS consent. STOP switched both
                account choices off, and START does not switch them back on: a customer with an account still receives
                no text messages from us until they switch a category back on themselves in their account settings, or
                agree again on a call for texts about their visits. The one difference is a visit requested without an
                account: once the block is lifted, texts about that one visit can resume on the agreement given when it
                was requested. This is deliberately more conservative than the carrier default, so that our record
                always reflects a choice the customer actually made.
              </li>
              <li>Message frequency varies. Message and data rates may apply.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">7. What we keep as a consent record</h2>
            <p>For each of the two choices on an account, service texts and marketing texts, independently, we retain:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>the consent status &mdash; on, off, or never chosen;</li>
              <li>the date and time it was recorded;</li>
              <li>
                the place it came from &mdash; the booking step, the customer&apos;s own account settings, a phone call
                recorded by staff, or the confirmation page &mdash; and the exact wording that applied;
              </li>
              <li>where staff recorded it, the name of the staff member.</li>
            </ul>
            <p className="mt-3">
              For a Free Visit requested without an account, the request and the visit keep the exact line shown under
              the button and the time the button was pressed. For a visit staff booked by phone for someone without an
              account, the visit keeps the staff member&apos;s note that the caller agreed, with their name and the time.
            </p>
            <p className="mt-3">
              Service texts and marketing texts are recorded separately, and neither is ever inferred from the other.
              &ldquo;Never chosen&rdquo; and &ldquo;switched off&rdquo; are stored as different states and stay
              distinguishable, because only one of them means the customer was ever asked.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">8. Message categories</h2>
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
            <p className="mt-3 text-[color:var(--ui-text-2)]">
              One-time sign-in verification codes are neither: they are sent through Twilio Verify, only when requested,
              and not under this campaign.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="ui-h3 mb-3 !text-[19px] sm:!text-[21px]">9. The documents themselves</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <Link href="/signup" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  https://www.profixter.com/signup
                </Link>{" "}
                &mdash; the sign-up screen (no SMS consent is collected there)
              </li>
              <li>
                <Link href="/book/free" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  https://www.profixter.com/book/free
                </Link>{" "}
                &mdash; the Free Visit request form (the consent line is under the request button)
              </li>
              <li>
                <Link href="/privacy" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  https://www.profixter.com/privacy
                </Link>{" "}
                &mdash; Privacy Policy
              </li>
              <li>
                <Link href="/terms" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  https://www.profixter.com/terms
                </Link>{" "}
                &mdash; Terms of Service
              </li>
              <li>
                <Link href="/communication-consent" className="text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  https://www.profixter.com/communication-consent
                </Link>{" "}
                &mdash; Communication Consent &amp; SMS Terms
              </li>
            </ul>
            <p className="mt-4 text-[color:var(--ui-text-2)]">
              Mobile information and SMS consent will not be shared with third parties or affiliates for marketing or
              promotional purposes.
            </p>
          </section>
        </div>

        <nav
          aria-label="Related legal documents"
          className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] sm:text-sm text-[color:var(--ui-text-3)]"
        >
          <Link href="/privacy" className="underline underline-offset-4 transition hover:text-[color:var(--ui-ink)]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline underline-offset-4 transition hover:text-[color:var(--ui-ink)]">
            Terms of Service
          </Link>
          <Link href="/communication-consent" className="underline underline-offset-4 transition hover:text-[color:var(--ui-ink)]">
            Communication Consent &amp; SMS Terms
          </Link>
        </nav>
      </div>
      <Footer />
    </div>
  );
}
