"use client";

import Link from "next/link";

/**
 * The three ways a member can get a Fixter to their home.
 *
 * A segmented control rather than three cards: this is navigation between
 * states of one task, not three separate offers to weigh up. It stays one row
 * at every width, so the relationship between the options is always visible.
 *
 * State lives in the URL, so back and forward behave, a tab can be linked to,
 * and refreshing keeps you where you were.
 */

/*
 * The URL values are deliberately left alone. "membership" is an internal
 * routing key, not a label, and rewriting it would break every link and
 * bookmark already pointing at /book?visit=membership for the sake of a word
 * nobody sees.
 */
export const VISIT_TYPES = [
  "membership",
  "full-day",
  "additional",
  "priority",
] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const DEFAULT_VISIT_TYPE: VisitType = "membership";

export function parseVisitType(value: string | null | undefined): VisitType {
  return VISIT_TYPES.includes(value as VisitType) ? (value as VisitType) : DEFAULT_VISIT_TYPE;
}

/**
 * Which tab a bare /book should open on.
 *
 * A member came for the visit their membership includes. Everybody else came
 * to book the visit they can actually buy today, and /book is a public
 * marketing destination that has always meant exactly that, so opening them on
 * the membership pitch would answer a question they did not ask and, less
 * obviously, would hide the visit history that lives under the one-time flow.
 *
 * An explicit ?visit= always wins. This only decides the default.
 */
export function resolveVisitType(
  value: string | null | undefined,
  isMember: boolean
): VisitType {
  if (VISIT_TYPES.includes(value as VisitType)) return value as VisitType;
  return isMember ? "membership" : "additional";
}

/*
 * "Book Fixter" rather than "Membership". The tab is a destination, and what
 * the member is doing there is getting their Fixter to the house; naming it
 * after the product they already bought described the entitlement rather than
 * the action. The membership product keeps its name everywhere else.
 *
 * The middle tab is the one label that cannot be shared. "Extra" only means
 * anything if you already have something for it to be extra to: to a member it
 * is precisely right, and to a stranger it is a word about a product they do
 * not own. Both point at the same flow and the same ?visit=additional key, so
 * this is one tab wearing the name that is true for whoever is reading it.
 */
function tabsFor(isMember: boolean): { type: VisitType; label: string }[] {
  return [
    { type: "membership", label: "Book Fixter" },
    // Second, not last. It sits next to the ordinary visit because that is the
    // comparison the customer is actually making: one job or the whole list.
    { type: "full-day", label: "Full Day" },
    // No price on the tab. It is a label, not an offer, and the price is
    // unmissable inside the section itself.
    { type: "additional", label: isMember ? "Extra" : "One-Time" },
    { type: "priority", label: "Priority" },
  ];
}

export default function VisitTypeNav({
  active,
  isMember = false,
}: {
  active: VisitType;
  isMember?: boolean;
}) {
  const TABS = tabsFor(isMember);

  return (
    <nav
      aria-label="Visit type"
      className="mx-auto w-full max-w-[1280px] px-4 pt-3 sm:px-6 sm:pt-5 lg:px-8"
    >
      {/*
        Four tabs in one row, down to 375px. Measured rather than assumed: at
        that width each tab gets about 80px and the longest label, "Book
        Fixter", sets about 68px at 11.5px, so the row holds without wrapping
        and without a scroller. A scroller would have hidden the fourth option
        behind a gesture, which is the opposite of what a segmented control is
        for.
      */}
      <div className="flex w-full gap-1 rounded-[8px] border border-[#E4E9F2] bg-[#F1F4F9] p-1 sm:max-w-[680px]">
        {TABS.map((tab) => {
          const selected = tab.type === active;
          return (
            <Link
              key={tab.type}
              href={`/book?visit=${tab.type}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={[
                "flex min-h-[42px] flex-1 items-center justify-center whitespace-nowrap rounded-[6px] px-1 text-center text-[11.5px] font-semibold leading-tight tracking-[-0.01em] transition sm:min-h-[44px] sm:px-2 sm:text-[14px]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]",
                selected
                  ? "bg-white text-[#0B1628] shadow-[0_1px_3px_rgba(11,22,40,0.12)]"
                  : "text-[#5C6672] hover:text-[#0B1628]",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
