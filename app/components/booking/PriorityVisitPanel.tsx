import Link from "next/link";
import { CUSTOMER_CARE } from "@/lib/fixter";
import MembershipUpgradePrompt, {
  PRIORITY_VISITS_PER_MONTH,
  planLabel,
  type PlanKey,
} from "@/app/components/membership/MembershipUpgradePrompt";

/**
 * Priority Visit.
 *
 * Deliberately not self-service. There is no calendar, no availability call, no
 * checkout and no way to create an appointment from this panel - whether a
 * request can be brought forward depends on the day, and only a person can
 * answer that. Booking one automatically would be promising something ProFixter
 * cannot reliably keep.
 *
 * The copy is careful for the same reason. It says service "may be available",
 * never guarantees a time, and never presents ProFixter as an emergency
 * response service. Calling is the primary action because this is a
 * conversation, not a transaction.
 */
export default function PriorityVisitPanel({
  currentPlan = null,
  isMember = false,
}: {
  currentPlan?: PlanKey | null;
  /** Drives the membership note only. Entitlements still come from the plan. */
  isMember?: boolean;
}) {
  const includedVisits = currentPlan ? PRIORITY_VISITS_PER_MONTH[currentPlan] : undefined;

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8">
      <div className="max-w-[600px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
          Priority Visit
        </p>
        <h1 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0B1628] sm:text-[32px]">
          Need help sooner?
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[#4A5462] sm:text-[17px] sm:leading-7">
          For urgent handyman needs, same-day or next-day service may be available.
        </p>

        {/*
          Two plain rows rather than cards. The customer needs to grasp "how
          soon, and is it certain" in a glance, and the honest answer to the
          second half is "subject to availability" in both cases.
        */}
        <div className="mt-6 overflow-hidden rounded-[8px] border border-[#E4E9F2]">
          {[
            { when: "Same day", note: "Subject to availability" },
            { when: "Next day", note: "Subject to availability" },
          ].map((row) => (
            <div
              key={row.when}
              className="flex items-baseline justify-between gap-3 border-b border-[#EDF1F7] px-4 py-3.5 last:border-b-0"
            >
              <span className="text-[15px] font-semibold text-[#0B1628]">{row.when}</span>
              <span className="text-[13px] text-[#6E6E73]">{row.note}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a
            href={CUSTOMER_CARE.callHref}
            aria-label={`Call ProFixter at ${CUSTOMER_CARE.phoneDisplay}`}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[8px] bg-[#0B1628] px-6 text-[15px] font-semibold text-white transition hover:bg-[#172033] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] sm:min-w-[210px]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6.6 3.5h2.2l1.4 3.6-1.8 1.3a12.4 12.4 0 0 0 5.2 5.2l1.3-1.8 3.6 1.4v2.2a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Call ProFixter
          </a>
          <a
            href={`sms:${CUSTOMER_CARE.phoneE164}`}
            aria-label={`Text ProFixter at ${CUSTOMER_CARE.phoneDisplay}`}
            className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white px-6 text-[15px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
          >
            Text ProFixter
          </a>
        </div>

        <p className="mt-3 text-[16px] font-semibold tracking-[-0.01em] text-[#0B1628]">
          {CUSTOMER_CARE.phoneDisplay}
        </p>

        {currentPlan && includedVisits ? (
          /*
            We know their plan, so telling them a fee "may" apply would be
            evasive. This states the benefit only. It deliberately does not say
            how many are left this month: that would need entitlement tracking
            that does not exist yet, and a number we cannot stand behind is
            worse than no number.
          */
          <div className="mt-5 rounded-[8px] border border-[#D9E7D2] bg-[#F4F9F1] px-4 py-3.5">
            <p className="text-[14px] font-semibold text-[#1E4620]">
              Included with your {planLabel(currentPlan)} plan
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#41603F]">
              Your membership includes {includedVisits} Priority Visit
              {includedVisits === 1 ? "" : "s"} per month.
            </p>
          </div>
        ) : null}

        <p className="mt-5 text-[13px] leading-5 text-[#6E6E73]">
          Priority Visits are arranged directly with our team and cannot be booked
          online.
          {includedVisits ? "" : " Priority Visits may have an additional service fee."}
        </p>

        {/* Priority is a plan benefit, so the suggestion here is Premium or Elite. */}
        <MembershipUpgradePrompt currentPlan={currentPlan} variant="priority" className="mt-7" />

        {/*
         * For somebody without a membership, the upgrade prompt above renders
         * nothing, because there is no current plan to step up from. They are
         * still entitled to know that Priority comes included on the higher
         * plans, so this says it once, quietly, and does not repeat the pitch
         * the Book Fixter tab already makes.
         */}
        {!isMember && (
          <p className="mt-7 text-[13.5px] leading-6 text-[#4A5462]">
            Priority Visits are included every month on the Premium and Elite plans.{" "}
            <Link
              href="/membership/plans"
              className="font-semibold text-[#306EEC] underline underline-offset-2 hover:text-[#2558C9]"
            >
              See plans
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
