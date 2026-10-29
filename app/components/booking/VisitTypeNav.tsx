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
 * Which tab a bare /book should open on: Book Fixter, for everybody.
 *
 * Membership is the Profixter relationship; One-Time is the alternative a
 * customer chooses on purpose. Book Fixter is the member's calendar for a
 * member, and the plan picker for everybody else.
 *
 * This used to open non-members on One-Time, for a real reason: their visit
 * history (/book#your-visits, where Account and the one-time confirmation send
 * them) only rendered under that tab. The history now renders under Book
 * Fixter too, so the reason is gone rather than worked around.
 *
 * An explicit ?visit= always wins. This only decides the default.
 */
export function resolveVisitType(value: string | null | undefined): VisitType {
  if (VISIT_TYPES.includes(value as VisitType)) return value as VisitType;
  return "membership";
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
    <nav aria-label="Visit type" className="pf-tabs ui-container pt-3 sm:pt-5">
      {/*
        Four tabs in one row, down to 320px. A scroller would hide the fourth
        option behind a gesture, which is the opposite of what a segmented
        control is for.
      */}
      <div className="flex w-full gap-1 rounded-[var(--ui-r-sm)] bg-white p-1 shadow-[inset_0_0_0_1px_var(--ui-line)] sm:max-w-[560px]">
        {TABS.map((tab) => {
          const selected = tab.type === active;
          return (
            <Link
              key={tab.type}
              href={`/book?visit=${tab.type}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={[
                "pf-tab flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-[7px] px-1 text-center text-[13px] font-semibold leading-tight tracking-[-0.01em] transition-colors sm:text-[14px]",
                selected
                  ? "bg-[color:var(--ui-ink)] text-white"
                  : "text-[color:var(--ui-text-2)] hover:bg-[color:var(--ui-bg-soft)] hover:text-[color:var(--ui-ink)]",
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
