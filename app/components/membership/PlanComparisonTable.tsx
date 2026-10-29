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
      className={bare ? "my-6" : "ui-section ui-section--tight"}
    >
      <div className={bare ? "" : "ui-container"}>
        <Heading id={`${id}-title`} className={headingLevel === 2 ? "ui-h2" : "ui-h3"}>
          {title}
        </Heading>
        {intro ? <p className="ui-body mt-3 max-w-[68ch]">{intro}</p> : null}

        {/*
          `relative` is load-bearing: the screen-reader-only labels in the cells
          are absolutely positioned, and without a positioned ancestor they
          escape this scroll box and widen the whole page on a phone (it
          rendered 459px wide at 390px, and taps landed in the wrong place).
        */}
        <div className="relative mt-5 overflow-x-auto rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white">
          <table className="w-full min-w-[600px] border-collapse text-left text-[14px]">
            <caption className="sr-only">
              Profixter handyman membership plans: monthly and annual prices and what each plan includes
            </caption>
            <thead>
              <tr className="border-b border-[color:var(--ui-line)]">
                <th scope="col" className="w-[32%] px-4 py-3">
                  <span className="sr-only">Feature</span>
                </th>
                {plans.map((plan) => (
                  <th key={plan.name} scope="col" className="px-4 py-3 text-[15px] font-semibold text-[color:var(--ui-ink)]">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[color:var(--ui-line)]">
                <th scope="row" className="px-4 py-3 font-medium text-[color:var(--ui-text-2)]">Monthly</th>
                {plans.map((plan) => (
                  <td key={plan.name} className="px-4 py-3 font-semibold tabular-nums text-[color:var(--ui-ink)]">
                    ${plan.price}
                    <span className="font-normal text-[color:var(--ui-text-3)]">/mo</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[color:var(--ui-line)]">
                <th scope="row" className="px-4 py-3 font-medium text-[color:var(--ui-text-2)]">
                  Annual <span className="block text-[13px] font-normal text-[color:var(--ui-text-3)]">12 months for the price of 10</span>
                </th>
                {plans.map((plan) => (
                  <td key={plan.name} className="px-4 py-3 tabular-nums text-[color:var(--ui-ink)]">
                    ${annualPrice(plan).toLocaleString("en-US")}
                    <span className="text-[color:var(--ui-text-3)]">/yr</span>
                  </td>
                ))}
              </tr>
              {BENEFIT_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-[color:var(--ui-line)] last:border-b-0">
                  <th scope="row" className="px-4 py-3 align-top font-medium text-[color:var(--ui-text-2)]">
                    {row.off}
                    {row.detail ? (
                      <span className="mt-0.5 block text-[13px] font-normal leading-[1.45] text-[color:var(--ui-text-3)]">
                        {row.detail}
                      </span>
                    ) : null}
                  </th>
                  {plans.map((plan) => {
                    const included = benefitIncluded(row, plan.name);
                    const label = benefitLabel(row, plan.name);
                    /* A plain check when the cell would only repeat the row name;
                       the words only where they differ by plan ("Book 1 visit at
                       a time", "2 Priority Visits / month"). */
                    const repeats = label === row.off;
                    return (
                      <td key={plan.name} className="px-4 py-3 align-top">
                        {included ? (
                          <span className="inline-flex items-start gap-1.5 text-[color:var(--ui-ink)]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-[3px] flex-none text-[color:var(--ui-accent)]">
                              <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {repeats ? <span className="sr-only">{label}</span> : <span>{label}</span>}
                          </span>
                        ) : (
                          <span className="text-[color:var(--ui-line-2)]">
                            <span aria-hidden="true">&mdash;</span>
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
        <p className="ui-small mt-3 max-w-[70ch]">
          Book as often as you need: your plan sets how many visits you can have booked at the same time.
          Scheduling is subject to availability. Fixtures, appliances and
          project materials are quoted separately.
        </p>
      </div>
    </section>
  );
}
