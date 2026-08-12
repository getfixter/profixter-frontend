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

export const VISIT_TYPES = ["membership", "additional", "priority"] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const DEFAULT_VISIT_TYPE: VisitType = "membership";

export function parseVisitType(value: string | null | undefined): VisitType {
  return VISIT_TYPES.includes(value as VisitType) ? (value as VisitType) : DEFAULT_VISIT_TYPE;
}

const TABS: { type: VisitType; short: string; full: string }[] = [
  { type: "membership", short: "Membership", full: "Membership Visit" },
  // No price on the tab. It is a label, not an offer, and the price is
  // unmissable inside the section itself.
  { type: "additional", short: "Extra", full: "Extra Visit" },
  { type: "priority", short: "Priority", full: "Priority Visit" },
];

export default function VisitTypeNav({ active }: { active: VisitType }) {
  return (
    <nav
      aria-label="Visit type"
      className="mx-auto w-full max-w-[1280px] px-4 pt-3 sm:px-6 sm:pt-5 lg:px-8"
    >
      <div className="flex w-full gap-1 rounded-[14px] border border-[#E4E9F2] bg-[#F1F4F9] p-1 sm:max-w-[620px]">
        {TABS.map((tab) => {
          const selected = tab.type === active;
          return (
            <Link
              key={tab.type}
              href={`/book?visit=${tab.type}`}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={[
                "flex min-h-[42px] flex-1 items-center justify-center rounded-[11px] px-2 text-center text-[12.5px] font-semibold leading-tight tracking-[-0.01em] transition sm:min-h-[44px] sm:text-[14px]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]",
                selected
                  ? "bg-white text-[#0B1628] shadow-[0_1px_3px_rgba(11,22,40,0.12)]"
                  : "text-[#5C6672] hover:text-[#0B1628]",
              ].join(" ")}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.full}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
