import Image from "next/image";
import {
  CUSTOMER_CARE,
  fixterCallHref,
  fixterTextHref,
  getPrimaryFixter,
  type Fixter,
} from "@/lib/fixter";

/**
 * The member's Fixter.
 *
 * The point of this block is a relationship, not a contact card. A member
 * should look at it once and know there is a specific person looking after
 * their home, and that reaching him is one tap.
 *
 * The copy draws a line that matters operationally: Roman answers questions
 * about the work and the home; anything to do with the booking itself stays
 * inside ProFixter. So it never invites the customer to schedule with him -
 * appointments must not drift out of the system one phone call at a time.
 *
 * It also never promises Roman will do the work. He can be away, ill or already
 * booked. "Your primary Fixter" is a true statement; "Roman will be there" is
 * not one we can keep.
 */

function CallIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 3.5h2.2l1.4 3.6-1.8 1.3a12.4 12.4 0 0 0 5.2 5.2l1.3-1.8 3.6 1.4v2.2a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16v10.2H9.4L5 19.2v-3.5H4V5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FixterPortrait({ fixter, size }: { fixter: Fixter; size: "md" | "lg" }) {
  const dimension = size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-[68px] sm:w-[68px]";
  return (
    <div className={`relative ${dimension} shrink-0 overflow-hidden rounded-full bg-[#EEF2F8]`}>
      <Image
        src={fixter.photoSrc}
        alt={`${fixter.firstName}, your primary Fixter`}
        fill
        sizes="96px"
        className="object-cover"
        style={{ objectPosition: fixter.photoPosition }}
      />
    </div>
  );
}

function ContactActions({ fixter }: { fixter: Fixter }) {
  return (
    <div className="mt-4 flex gap-2">
      <a
        href={fixterCallHref(fixter)}
        aria-label={`Call ${fixter.firstName} at ${fixter.phoneDisplay}`}
        className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[13px] bg-[#0B1628] px-4 text-[14px] font-semibold text-white transition hover:bg-[#172033] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
      >
        <CallIcon />
        Call {fixter.firstName}
      </a>
      <a
        href={fixterTextHref(fixter)}
        aria-label={`Text ${fixter.firstName} at ${fixter.phoneDisplay}`}
        className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-[13px] border border-[#D7DEE9] bg-white px-4 text-[14px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
      >
        <TextIcon />
        Text {fixter.firstName}
      </a>
    </div>
  );
}

/**
 * Customer Care, deliberately quieter.
 *
 * It has to be findable without competing with the Fixter, or members keep
 * routing work questions to the office - which is the problem this whole block
 * exists to solve.
 */
function CustomerCareNote() {
  return (
    <div className="mt-5 border-t border-[#EDF1F7] pt-4">
      <p className="text-[13px] font-semibold text-[#0B1628]">Need help with your account?</p>
      <p className="mt-1 text-[13px] leading-5 text-[#6E6E73]">
        For membership, billing, or scheduling, contact ProFixter Customer Care at{" "}
        <a
          href={CUSTOMER_CARE.callHref}
          className="font-semibold text-[#306EEC] underline underline-offset-2"
        >
          {CUSTOMER_CARE.phoneDisplay}
        </a>
        .
      </p>
    </div>
  );
}

export default function YourFixter({
  variant = "card",
  className = "",
}: {
  /** "card" sits in the dashboard. "welcome" introduces him after joining. */
  variant?: "card" | "welcome";
  className?: string;
}) {
  const fixter = getPrimaryFixter();
  const welcome = variant === "welcome";

  return (
    <section
      aria-labelledby="your-fixter-heading"
      className={`rounded-[20px] border border-[#E6ECF5] bg-white p-5 sm:p-6 ${className}`}
    >
      <p
        id="your-fixter-heading"
        className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A94A6]"
      >
        {welcome ? "Meet your Fixter" : "Your Fixter"}
      </p>

      <div className="mt-3 flex items-center gap-4">
        <FixterPortrait fixter={fixter} size={welcome ? "lg" : "md"} />
        <div className="min-w-0">
          <p
            className={`font-semibold tracking-[-0.02em] text-[#111111] ${
              welcome ? "text-[24px] sm:text-[28px]" : "text-[20px] sm:text-[22px]"
            }`}
          >
            {fixter.firstName}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6E6E73]">Your primary Fixter</p>
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-6 text-[#3C4453]">
        {welcome
          ? `Questions about the work or something around your home? ${fixter.firstName} is your go-to. Whenever possible, he is the Fixter taking care of your home.`
          : `Questions about the work, your home, or an upcoming visit? ${fixter.firstName} is your go-to.`}
      </p>

      <ContactActions fixter={fixter} />
      <CustomerCareNote />
    </section>
  );
}

/**
 * A single quiet line for places that already have their own job, such as a
 * booking confirmation. It offers the Fixter for questions about the work
 * without implying the appointment can be changed by texting him.
 */
export function AskYourFixterLine({ className = "" }: { className?: string }) {
  const fixter = getPrimaryFixter();
  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] border border-[#E6ECF5] bg-white p-3 ${className}`}
    >
      <FixterPortrait fixter={fixter} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#111111]">
          Question about the work? Ask {fixter.firstName}.
        </p>
        <p className="mt-0.5 text-[12px] text-[#6E6E73]">Your primary Fixter</p>
      </div>
      <a
        href={fixterTextHref(fixter)}
        aria-label={`Text ${fixter.firstName} at ${fixter.phoneDisplay}`}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[12px] border border-[#D7DEE9] bg-white px-3.5 text-[13px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF]"
      >
        <TextIcon />
        Text
      </a>
    </div>
  );
}
