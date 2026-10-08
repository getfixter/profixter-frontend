"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { plans } from "@/app/data/content";
import { annualPrice } from "@/app/data/plan-benefits";

/**
 * Per visit, or a membership? The arithmetic, done honestly.
 *
 * Two numbers the reader knows better than we do - how often somebody has to
 * come out, and what that usually costs them - against the published Profixter
 * prices. It answers "which is cheaper for me", including when the answer is
 * "not the membership", and says so in words rather than leaving a reader to
 * squint at a chart.
 *
 * Deliberately sends no analytics or pixel events: it is a reading aid, not a
 * conversion step.
 */

const basic = plans.find((plan) => plan.name === "Basic") ?? plans[0];

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function MembershipCalculator({ oneTimePrice = 99 }: { oneTimePrice?: number }) {
  const id = useId();
  const [visits, setVisits] = useState(8);
  const [perVisit, setPerVisit] = useState(150);

  const result = useMemo(() => {
    const perJobTotal = visits * perVisit;
    const oneTimeTotal = visits * oneTimePrice;
    const basicMonthlyTotal = basic.price * 12;
    const basicAnnualTotal = annualPrice(basic);
    const breakEvenVsOneTime = Math.ceil(basicAnnualTotal / oneTimePrice);
    const breakEvenVsLocal = perVisit > 0 ? Math.ceil(basicAnnualTotal / perVisit) : Infinity;
    return { perJobTotal, oneTimeTotal, basicMonthlyTotal, basicAnnualTotal, breakEvenVsOneTime, breakEvenVsLocal };
  }, [visits, perVisit, oneTimePrice]);

  const cheapestPerVisit = Math.min(result.perJobTotal, result.oneTimeTotal);
  const membershipCheaper = result.basicAnnualTotal < cheapestPerVisit;

  return (
    <div className="my-8 rounded-[12px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.05)] sm:p-7">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">Calculator</p>
      <p className="mt-2 text-[20px] font-black leading-tight text-[#0B1628] sm:text-[23px]">
        Per visit or membership: what would a year cost you?
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label htmlFor={`${id}-visits`} className="block">
          <span className="text-[14px] font-semibold text-[#334155]">
            Times a year you need someone to come out
          </span>
          <div className="mt-2 flex items-center gap-3">
            <input
              id={`${id}-visits`}
              type="range"
              min={1}
              max={36}
              value={visits}
              onChange={(e) => setVisits(Number(e.target.value))}
              className="w-full accent-[#306EEC]"
            />
            <span className="w-12 text-right text-[18px] font-black tabular-nums text-[#0B1628]">{visits}</span>
          </div>
        </label>
        <label htmlFor={`${id}-cost`} className="block">
          <span className="text-[14px] font-semibold text-[#334155]">
            What a short handyman visit usually costs you, minimum included
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[18px] font-black text-[#0B1628]">$</span>
            <input
              id={`${id}-cost`}
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              step={5}
              value={perVisit}
              onChange={(e) => setPerVisit(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
              className="h-11 w-28 rounded-[8px] border border-[#D7DEE9] px-3 text-[16px] font-semibold tabular-nums text-[#0B1628] focus:border-[#306EEC] focus:outline-none"
            />
          </div>
        </label>
      </div>

      <dl className="mt-6 grid gap-2 sm:grid-cols-2">
        {[
          { label: `Hiring per visit at ${money(perVisit)}`, value: result.perJobTotal },
          { label: `Profixter One-Time Visits at ${money(oneTimePrice)}`, value: result.oneTimeTotal },
          { label: `Basic membership, billed monthly (${money(basic.price)}/mo)`, value: result.basicMonthlyTotal },
          { label: "Basic membership, billed annually (12 months for 10)", value: result.basicAnnualTotal },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 rounded-[8px] bg-[#F6F8FC] px-4 py-3">
            <dt className="text-[14px] leading-5 text-[#475569]">{row.label}</dt>
            <dd className="text-[17px] font-black tabular-nums text-[#0B1628]">{money(row.value)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-[15px] leading-7 text-[#334155]" aria-live="polite">
        {membershipCheaper ? (
          <>
            At {visits} visits a year, a Basic membership paid annually ({money(result.basicAnnualTotal)}) costs less than
            paying per visit ({money(cheapestPerVisit)} at the cheaper of the two per-visit options).
          </>
        ) : (
          <>
            At {visits} visits a year, paying per visit is cheaper ({money(cheapestPerVisit)}) than a Basic membership paid
            annually ({money(result.basicAnnualTotal)}). On cost alone, a membership is not the right choice for you.
          </>
        )}{" "}
        On price alone, Basic paid annually overtakes {money(oneTimePrice)} One-Time Visits at about{" "}
        {result.breakEvenVsOneTime} visits a year
        {Number.isFinite(result.breakEvenVsLocal) ? (
          <>, and overtakes {money(perVisit)} visits at about {result.breakEvenVsLocal} a year</>
        ) : null}
        .
      </p>
      <p className="mt-3 text-[13px] leading-6 text-[#64748B]">
        What the numbers leave out: a One-Time Visit is built around one small job from a set list, while a member visit
        can cover several tasks in its 90 minutes. Plus and higher plans add small supplies, Priority Visits and project
        time. Prices are Profixter&apos;s published prices; sales tax is not included.{" "}
        <Link href="/membership/plans" className="font-semibold text-[#306EEC] underline underline-offset-2">
          All plan prices
        </Link>
        .
      </p>
    </div>
  );
}
