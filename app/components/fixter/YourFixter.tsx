import Image from "next/image";
import { CUSTOMER_CARE, getPrimaryFixter, type Fixter } from "@/lib/fixter";

/**
 * The member's Fixter.
 *
 * The point of this block is a relationship, not a contact card. A member
 * should look at it once and know there is a specific person looking after
 * their home.
 *
 * His number is shown but is deliberately not an action. There used to be Call
 * and Text buttons here, which made getting him on the phone the easiest thing
 * on the page and invited a call for every small question. A member who really
 * needs him can read the number and dial it; the small extra effort is the
 * point. It is also why the number is plain text rather than a tel: or sms:
 * link, and why there is no phone icon, which would read as a button.
 *
 * The copy draws a line that matters operationally: Roman answers questions
 * about the work and the home; anything to do with the booking itself stays
 * inside ProFixter. So it never invites the customer to schedule with him -
 * appointments must not drift out of the system one phone call at a time.
 *
 * It also never promises Roman will do the work. He can be away, ill or already
 * booked. "Your primary Fixter" is a true statement; "Roman will be there" is
 * not one we can keep.
 *
 * Every value comes from getPrimaryFixter, so his number lives in exactly one
 * place and none of these components knows what it is.
 */

function FixterPortrait({ fixter, size }: { fixter: Fixter; size: "sm" | "md" | "lg" }) {
  const dimension =
    size === "lg"
      ? "h-20 w-20 sm:h-24 sm:w-24"
      : size === "sm"
        ? "h-12 w-12 sm:h-14 sm:w-14"
        : "h-16 w-16 sm:h-[68px] sm:w-[68px]";
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

/**
 * His number, present but passive.
 *
 * Not a link. Selectable, so it can be copied, and labelled so a screen reader
 * announces whose number it is rather than reading seven digits into the void.
 */
function FixterPhone({ fixter, className = "" }: { fixter: Fixter; className?: string }) {
  return (
    <p className={`text-[13px] leading-5 text-[#6E6E73] ${className}`}>
      <span className="sr-only">{fixter.firstName}&rsquo;s number: </span>
      <span className="select-all font-semibold tracking-[0.01em] text-[#3C4453]">
        {fixter.phoneDisplay}
      </span>
    </p>
  );
}

/**
 * Customer Care, deliberately quieter.
 *
 * It has to be findable without competing with the Fixter, or members keep
 * routing work questions to the office - which is the problem this whole block
 * exists to solve. This one stays a real link: the office is who you are
 * supposed to call about billing and scheduling.
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
      className={`rounded-[14px] border border-[#E6ECF5] bg-white p-5 sm:p-6 ${className}`}
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
              welcome ? "text-[19px] sm:text-[21px]" : "text-[17px] sm:text-[18px]"
            }`}
          >
            {fixter.firstName}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6E6E73]">Your primary Fixter</p>
          <FixterPhone fixter={fixter} className="mt-1" />
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-6 text-[#3C4453]">
        {welcome
          ? `Questions about the work or something around your home? ${fixter.firstName} is your go-to. Whenever possible, he is the Fixter taking care of your home.`
          : `Questions about the work, your home, or an upcoming visit? ${fixter.firstName} is your go-to.`}
      </p>

      <CustomerCareNote />
    </section>
  );
}

/**
 * The Fixter as a contact row, for pages whose real job is something else.
 *
 * Written for the top of the booking page, where the customer has already
 * tapped through to book and the calendar is the thing they came for. So this
 * is deliberately a row and not a card: it says who is looking after the home,
 * then gets out of the way. Anything taller would push the calendar down the
 * screen to say something the member already knows.
 *
 * The layout changes shape rather than scale. On a phone it stacks into a
 * profile row; from small screens up it becomes a single bar with the identity
 * at one end and the explanation at the other, so a wide screen is filled by
 * composition instead of by a stretched phone card.
 */
export function YourFixterRow({ className = "" }: { className?: string }) {
  const fixter = getPrimaryFixter();

  return (
    <section
      aria-labelledby="your-fixter-row-heading"
      className={`rounded-[16px] border border-[#E6ECF5] bg-white p-3.5 sm:p-4 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 items-center gap-3 sm:shrink-0">
          <FixterPortrait fixter={fixter} size="sm" />
          <div className="min-w-0">
            <p
              id="your-fixter-row-heading"
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A94A6]"
            >
              Your Fixter
            </p>
            <p className="text-[17px] font-semibold leading-tight tracking-[-0.02em] text-[#111111] sm:text-[19px]">
              {fixter.firstName}
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#6E6E73]">Your primary Fixter</p>
            <FixterPhone fixter={fixter} className="mt-0.5 text-[12.5px]" />
          </div>
        </div>

        {/*
         * One paragraph, two behaviours. Stacked on a phone it sits under the
         * name; from sm it becomes the second column and fills the space a wide
         * screen would otherwise leave empty.
         */}
        <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-[#6E6E73] lg:text-[13px]">
          Questions about the work or your home? {fixter.firstName} is your go-to.
          Booking stays on this page.
        </p>
      </div>
    </section>
  );
}

/**
 * A single quiet line for places that already have their own job, such as
 * Account or a booking confirmation. It offers the Fixter for questions about
 * the work without implying the appointment can be changed by ringing him.
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
        <FixterPhone fixter={fixter} className="mt-0.5 text-[12.5px]" />
      </div>
    </div>
  );
}
