import type { Metadata } from "next";
import type { ReactNode } from "react";
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
 * sign-up has no SMS boxes; service texts are one optional unticked box at the
 * booking step ("Text me about my visits") and in account settings; marketing
 * texts only in account settings. The wording quoted below is the wording in
 * BackEnd utils/consent/consentText.js ("terms.continue.v1",
 * "sms_service.booking.v1", "sms_service.settings.v1",
 * "sms_marketing.settings.v1").
 *
 * The two phone numbers are stated apart on purpose. 631-888-6340 is the
 * carrier-registered number the texts come from; 631-599-1363 is the office
 * line a person answers.
 */

const TITLE = "How ProFixter collects SMS consent";
const DESCRIPTION =
  "Evidence for carrier and A2P review: how ProFixter collects SMS consent, with annotated screenshots. Sign-up asks for no SMS consent; service texts are an optional unticked box at booking and in account settings; marketing texts are optional and offered only in account settings.";

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
      <div className="mx-auto max-w-[420px] overflow-hidden rounded-[8px] border border-white/10 bg-[#0B1628]">
        <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" unoptimized />
      </div>
    </figure>
  );
}

/** One quoted piece of on-screen wording. */
function Wording({ label, quote, children }: { label: string; quote: string; children: ReactNode }) {
  return (
    <div className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className="mt-1 font-semibold">&ldquo;{quote}&rdquo;</p>
      <p className="mt-1 text-white/70">{children}</p>
    </div>
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
          Suffolk County home improvement licence{" "}
          <span className="font-semibold">HI-71484</span> &middot; Nassau and Suffolk Counties, New York
        </p>

        <div className="rounded-[8px] border border-[#93c5fd]/25 bg-[#93c5fd]/[0.06] p-5 text-sm sm:text-base leading-relaxed text-white/80">
          This page is published as <span className="font-semibold">evidence</span> of how ProFixter collects consent
          to send text messages. It explains and illustrates the real screens: the sign-up screen at{" "}
          <Link href="/signup" className="text-[#93c5fd] underline underline-offset-2">
            profixter.com/signup
          </Link>
          , the booking step, and account settings.{" "}
          <span className="font-semibold">It is not itself a way to sign up for text messages.</span> Nothing on this
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
              Text messages are optional at every point. There are exactly two places where SMS consent is collected,
              and neither is the sign-up screen:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>
                <span className="font-semibold">The booking step</span> &mdash; one optional, unchecked box,{" "}
                &ldquo;Text me about my visits&rdquo;, just above the booking button, for service texts only.
              </li>
              <li>
                <span className="font-semibold">Account settings</span> &mdash; two separate, unchecked boxes, one for
                service texts and one for marketing texts. This is the only place marketing texts are offered.
              </li>
            </ul>
            <p className="mt-3">
              <span className="font-semibold">Sign-up collects no SMS consent.</span> The sign-up screen has no
              text-message checkboxes. A person who signs up with a phone number receives a one-time verification code
              that they request themselves, sent through Twilio Verify and not under this messaging campaign.
            </p>
            <p className="mt-3">
              We do not use keyword sign-up. We do not accept verbal opt-ins. We do not accept paper opt-ins. We never
              buy, rent, or accept a shared or transferred list of phone numbers. Consent is collected by ProFixter, for
              ProFixter, and is never shared with third parties or affiliates for marketing or promotional purposes.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">3. The exact wording on each screen</h2>
            <p>
              Verbatim, followed by what each choice covers. Every &ldquo;Details&rdquo; or document link opens the{" "}
              <a href="/communication-consent" className="underline underline-offset-4">
                SMS Terms
              </a>{" "}
              in a new tab and never ticks a box.
            </p>

            <div className="mt-4 rounded-[8px] bg-white/5 border border-white/10 p-5 space-y-4">
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
                quote="Text me about my visits"
              >
                Shown beside a single checkbox just above the booking button, with a &ldquo;Details&rdquo; link to the
                service-texts section of the SMS Terms and this line beneath it: &ldquo;Booking confirmations,
                appointment reminders and arrival updates. Message frequency varies. Message and data rates may apply.
                Reply STOP to opt out or HELP for help.&rdquo; It covers service texts only, never marketing. It is
                never pre-ticked, it is not required to book, and the booking goes ahead whether or not it is ticked.
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
                rates may apply. Reply STOP to opt out or HELP for help.&rdquo; This is the only place marketing texts
                are offered: never at sign-up, never at booking, and never combined with anything required.
              </Wording>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">4. What is, and is not, consent</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold">Service SMS is optional.</span> It is never required to create an
                account, to book a visit, or to buy anything.
              </li>
              <li>
                <span className="font-semibold">Marketing SMS is separately optional</span>, offered only in account
                settings, with its own box and its own record.
              </li>
              <li>
                Every SMS box is unchecked by default and never pre-ticked: the customer performs the tick themselves.
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
              as agreement.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. What the screens actually look like</h2>
            <p>
              Annotated screenshots of the real screens at phone width. The annotations (outlines and numbered notes)
              are added for this page and are not part of the screens themselves.
            </p>

            <Evidence
              label="A - The phone sign-up screen: no checkboxes"
              src="/compliance/a2p-v2-signup.png"
              alt="The ProFixter phone sign-up screen at phone width: a heading, the mobile number field, the Text me a code button and one line of terms text beneath it, with no checkboxes."
              width={390}
              height={844}
              caption="Sign-up asks for no SMS consent. The screen is a heading, the mobile number field, the “Text me a code” button and one line: “By continuing, you agree to the Terms and Privacy Policy and to receive a one-time verification text. Msg & data rates may apply.” The verification code is sent through Twilio Verify, only on request."
            />

            <Evidence
              label="B - The booking step: one optional, unticked box"
              src="/compliance/a2p-v2-booking.png"
              alt="The ProFixter booking step at phone width, with the unticked checkbox Text me about my visits directly above the booking button."
              width={390}
              height={844}
              caption="“Text me about my visits” sits just above the booking button, unticked. It covers service texts only, links to the SMS Terms, and states frequency, rates, STOP and HELP. The booking goes ahead whether or not it is ticked."
            />

            <Evidence
              label="C - Account settings: two separate, unticked boxes"
              src="/compliance/a2p-v2-settings.png"
              alt="ProFixter account settings at phone width, showing two separate unchecked text message boxes: Text me about my ProFixter visits, and Text me occasional ProFixter offers."
              width={390}
              height={844}
              caption="Account settings. Service texts and marketing texts are two independent, unticked boxes; turning one on never turns the other on, and either can be switched off at any time. This is the only place marketing texts are offered."
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
              <li>Message frequency varies. Message and data rates may apply.</li>
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
                the place it came from &mdash; the booking step, or the customer&apos;s own account settings &mdash; and
                the exact wording shown there.
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
            <p className="mt-3 text-white/70">
              One-time sign-in verification codes are neither: they are sent through Twilio Verify, only when requested,
              and not under this campaign.
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
                &mdash; the sign-up screen (no SMS consent is collected there)
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
