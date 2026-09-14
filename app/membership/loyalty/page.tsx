import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";

/**
 * Loyalty Benefits, explained.
 *
 * DELIBERATELY SMALL. One scroll on a phone, three rungs, one table, and the
 * honest small print at the bottom. A programme whose promise is "stay a member
 * and your benefits get better" cannot be explained on a page that reads like
 * terms and conditions — if a homeowner has to study it, the offer has already
 * failed.
 *
 * Linkable rather than a modal, because the account screen, the cancellation
 * screen, the plans page and the unlock email all point here, and because it
 * should be findable.
 */

const MILESTONES = [
  {
    months: "3",
    when: "After 3 months",
    headline: "A month of the plan above yours",
    detail:
      "Your membership carries on exactly as it is. For one billing month we treat your home as though it were on the next plan up.",
    elite: "Elite members get an extra Full Day instead — there is no plan above Elite.",
  },
  {
    months: "6",
    when: "After 6 months",
    headline: "Two months of the plan above yours",
    detail: "The same benefit, for two billing months instead of one.",
    elite: "Elite members get a second extra Full Day.",
  },
  {
    months: "12",
    when: "After 12 months",
    headline: "Your next month is on us",
    detail:
      "A full month of your membership, free. Nothing changes about your plan and nothing is cancelled — your next renewal is simply $0.",
    elite: "Every plan, including Elite.",
  },
];

const LADDER: { plan: string; three: string; six: string; twelve: string }[] = [
  { plan: "Basic", three: "1 month of Plus", six: "2 months of Plus", twelve: "Next month free" },
  { plan: "Plus", three: "1 month of Premium", six: "2 months of Premium", twelve: "Next month free" },
  { plan: "Premium", three: "1 month of Elite", six: "2 months of Elite", twelve: "Next month free" },
  { plan: "Elite", three: "1 extra Full Day", six: "1 more extra Full Day", twelve: "Next month free" },
];

export default function LoyaltyBenefitsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        {/* ── Opening ─────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1100px] px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
            Included with every monthly membership
          </p>
          <h1 className="mt-3 max-w-[16ch] text-[32px] font-semibold leading-[1.05] tracking-[-0.035em] text-[#0B1628] sm:text-[46px]">
            Stay a member. Your benefits get better.
          </h1>
          <p className="mt-4 max-w-[60ch] text-[16px] leading-7 text-[#4A5462] sm:text-[18px] sm:leading-8">
            Loyalty Benefits are automatic. There is nothing to claim, no points to collect
            and nothing to keep track of. Keep your membership going and the rewards arrive
            on their own.
          </p>
        </section>

        {/* ── The three rungs ─────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1100px] px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {MILESTONES.map((milestone) => (
              <div
                key={milestone.months}
                className="flex flex-col rounded-[10px] border border-[#E4E9F2] bg-white p-5 sm:p-6"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#306EEC]">
                    {milestone.months}
                  </span>
                  <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6E6E73]">
                    months
                  </span>
                </div>
                <h2 className="mt-4 text-[19px] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0B1628]">
                  {milestone.headline}
                </h2>
                <p className="mt-2 flex-1 text-[14.5px] leading-6 text-[#4A5462]">
                  {milestone.detail}
                </p>
                <p className="mt-4 border-t border-[#EDF1F7] pt-3 text-[13px] leading-5 text-[#6E6E73]">
                  {milestone.elite}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── What each plan gets ─────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1100px] px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
          <h2 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#0B1628] sm:text-[30px]">
            What your plan unlocks
          </h2>

          {/*
            Wide content scrolls inside its own container. The page body must
            never scroll sideways on a phone, and most Profixter traffic is a
            phone.
          */}
          <div className="mt-5 overflow-x-auto rounded-[10px] border border-[#E4E9F2] bg-white">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFF]">
                  <th className="border-b border-[#E4E9F2] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
                    Your plan
                  </th>
                  <th className="border-b border-[#E4E9F2] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
                    3 months
                  </th>
                  <th className="border-b border-[#E4E9F2] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
                    6 months
                  </th>
                  <th className="border-b border-[#E4E9F2] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
                    12 months
                  </th>
                </tr>
              </thead>
              <tbody>
                {LADDER.map((row) => (
                  <tr key={row.plan} className="last:border-b-0">
                    <td className="border-b border-[#EDF1F7] px-4 py-3.5 text-[15px] font-semibold text-[#0B1628]">
                      {row.plan}
                    </td>
                    <td className="border-b border-[#EDF1F7] px-4 py-3.5 text-[14.5px] text-[#4A5462]">
                      {row.three}
                    </td>
                    <td className="border-b border-[#EDF1F7] px-4 py-3.5 text-[14.5px] text-[#4A5462]">
                      {row.six}
                    </td>
                    <td className="border-b border-[#EDF1F7] px-4 py-3.5 text-[14.5px] font-semibold text-[#0B1628]">
                      {row.twelve}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Annual, framed honestly ─────────────────────────── */}
        <section className="mx-auto w-full max-w-[1100px] px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
          <div className="rounded-[10px] border border-[#E4E9F2] bg-[#F8FAFF] p-5 sm:p-7">
            <h2 className="text-[20px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#0B1628] sm:text-[24px]">
              On an annual membership? Your loyalty savings are already built in.
            </h2>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-7 text-[#4A5462]">
              Annual members pay for 10 months and get 12 — two months of membership, free,
              from the day you join. That is the same reward, taken up front instead of
              earned over the year, which is why annual memberships are not on the monthly
              ladder above.
            </p>
          </div>
        </section>

        {/* ── The honest small print ──────────────────────────── */}
        <section className="mx-auto w-full max-w-[1100px] px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[#0B1628]">
            The details, in plain words
          </h2>
          <ul className="mt-4 max-w-[70ch] space-y-3 text-[14.5px] leading-6 text-[#4A5462]">
            <li>
              <strong className="font-semibold text-[#0B1628]">You keep paying your own plan.</strong>{" "}
              A complimentary upgrade does not change your membership or your price. We simply
              treat your home as being on the higher plan for the reward period, then it
              returns to normal.
            </li>
            <li>
              <strong className="font-semibold text-[#0B1628]">Months count when your membership renews.</strong>{" "}
              Each successful monthly renewal is one month of progress. A payment that fails
              and is sorted out later still counts once it goes through.
            </li>
            <li>
              <strong className="font-semibold text-[#0B1628]">Your reward matches the plan you have been on.</strong>{" "}
              If you change plans partway through, the reward follows the plan you actually
              held during those months.
            </li>
            <li>
              <strong className="font-semibold text-[#0B1628]">Loyalty follows the property.</strong>{" "}
              If you have more than one home with us, each membership builds its own progress.
            </li>
            <li>
              <strong className="font-semibold text-[#0B1628]">A long break starts the count again.</strong>{" "}
              If your membership ends and you come back more than 45 days later, progress
              begins from that point. Rewards you have already unlocked are yours.
            </li>
            <li>
              <strong className="font-semibold text-[#0B1628]">Gift months count.</strong>{" "}
              If somebody gave you a Profixter membership and you carry on with your own,
              the months you were given count toward your progress.
            </li>
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/membership/plans"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#0B1628] px-6 text-[15px] font-semibold text-white transition hover:bg-[#172033] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] sm:min-w-[210px]"
            >
              See membership plans
            </Link>
            <Link
              href="/account?tab=plan"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white px-6 text-[15px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
            >
              Check my progress
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
