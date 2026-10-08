import { plans } from "@/app/data/content";
import { annualPrice, BENEFIT_ROWS, benefitIncluded, benefitLabel } from "@/app/data/plan-benefits";

/**
 * All four plans, every row, in one table.
 *
 * The interactive plan cards show one plan at a time and switch on a tap, which
 * is the right way to choose and the wrong way to be read: a crawler or an
 * assistant fetching /membership/plans saw $249 and nothing else, and never saw
 * an annual price at all. This is the same data - the plan prices from
 * app/data/content.ts and the benefit matrix PlansSection draws - laid out flat,
 * so the full ladder is in the HTML and a person comparing on a laptop can see
 * it at a glance.
 *
 * No hooks, no client state: it renders identically on the server and in the
 * browser, wherever it is placed.
 */
export default function PlanComparisonTable({
  id = "compare-plans",
  title = "All four plans, side by side",
  intro = "Every plan includes 90-minute visits for everyday home tasks and the same local team. Plans differ in how many visits you can have booked at the same time, supplies, Priority Visits and project time. Month to month, or pay for 10 months and get 12.",
  headingLevel = 2,
  bare = false,
}: {
  id?: string;
  title?: string;
  intro?: string;
  headingLevel?: 2 | 3;
  /** Inside a guide's reading column: no section padding or page-width container. */
  bare?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={bare ? "my-8" : "px-4 py-10 sm:px-6 sm:py-12 lg:px-8"}
    >
      <div className={bare ? "" : "mx-auto max-w-[1180px]"}>
        <Heading
          id={`${id}-title`}
          className="text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#111111] sm:text-[30px]"
        >
          {title}
        </Heading>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.6] text-[#6E6E73] sm:text-[16px]">{intro}</p>

        {/*
          `relative` is load-bearing: the screen-reader-only labels in the cells
          are absolutely positioned, and without a positioned ancestor they
          escape this scroll box and widen the whole page on a phone (it
          rendered 459px wide at 390px, and taps landed in the wrong place).
        */}
        <div className="relative mt-6 overflow-x-auto rounded-[12px] border border-[#E3E8F1] bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left text-[14px] sm:text-[15px]">
            <caption className="sr-only">
              Profixter handyman membership plans: monthly and annual prices and what each plan includes
            </caption>
            <thead>
              <tr className="border-b border-[#E3E8F1] bg-[#F8FAFF]">
                <th scope="col" className="w-[30%] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6E6E73]">
                  <span className="sr-only">Feature</span>
                </th>
                {plans.map((plan) => (
                  <th key={plan.name} scope="col" className="px-4 py-3 text-[16px] font-semibold text-[#0B1628]">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#EEF2F7]">
                <th scope="row" className="px-4 py-3 font-medium text-[#3F4854]">Monthly</th>
                {plans.map((plan) => (
                  <td key={plan.name} className="px-4 py-3 font-semibold tabular-nums text-[#0B1628]">
                    ${plan.price}
                    <span className="font-normal text-[#6E6E73]">/mo</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#EEF2F7]">
                <th scope="row" className="px-4 py-3 font-medium text-[#3F4854]">
                  Annual <span className="font-normal text-[#6E6E73]">(12 months for the price of 10)</span>
                </th>
                {plans.map((plan) => (
                  <td key={plan.name} className="px-4 py-3 tabular-nums text-[#0B1628]">
                    ${annualPrice(plan).toLocaleString("en-US")}
                    <span className="text-[#6E6E73]">/yr</span>
                  </td>
                ))}
              </tr>
              {BENEFIT_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-[#EEF2F7] last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-medium text-[#3F4854]">
                    {row.off}
                    {row.detail ? (
                      <span className="mt-0.5 block text-[12.5px] font-normal leading-[1.45] text-[#8A8F98]">
                        {row.detail}
                      </span>
                    ) : null}
                  </th>
                  {plans.map((plan) => {
                    const included = benefitIncluded(row, plan.name);
                    return (
                      <td key={plan.name} className="px-4 py-3 align-top">
                        {included ? (
                          <span className="text-[#0B1628]">
                            <span aria-hidden="true" className="mr-1.5 font-semibold text-[#306EEC]">✓</span>
                            {benefitLabel(row, plan.name)}
                          </span>
                        ) : (
                          <span className="text-[#A0A6B0]">
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Not included</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[70ch] text-[13px] leading-[1.6] text-[#6E6E73]">
          Book as often as you need: your plan sets how many visits you can have booked at the same time.
          Scheduling is subject to availability. Fixtures, appliances and
          project materials are quoted separately.
        </p>
      </div>
    </section>
  );
}
