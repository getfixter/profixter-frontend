"use client";

const VISIT_CATEGORIES = [
  {
    icon: "⚡",
    title: "Electrical",
    examples: [
      "Light fixtures",
      "Ceiling fans",
      "Outlets & switches",
      "Smart devices",
      "Small electrical repairs",
    ],
  },
  {
    icon: "🚿",
    title: "Plumbing",
    examples: [
      "Faucets",
      "Minor leaks",
      "Toilet repairs",
      "Shower hardware",
      "Small plumbing fixes",
    ],
  },
  {
    icon: "🔨",
    title: "Repairs & Installations",
    examples: [
      "TV mounting",
      "Shelves & hardware",
      "Doors & locks",
      "Furniture assembly",
      "Drywall patches",
    ],
  },
  {
    icon: "🏠",
    title: "Home Maintenance",
    examples: [
      "Punch lists",
      "Caulking",
      "Paint touch-ups",
      "Seasonal maintenance",
      "Small home projects",
    ],
  },
];

export default function IncludedVisitsSection() {
  return (
    <section
      id="included-visits"
      className="w-full bg-[#F5F5F7] px-4 py-12 sm:px-5 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="text-[30px] font-semibold leading-[1.08] tracking-normal text-[#111111] sm:text-[48px] sm:leading-[1.05]">
            What&apos;s Included In Your Visits?
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-[15px] leading-6 text-[#6E6E73] sm:mt-4 sm:text-lg sm:leading-7">
            Most small home tasks are included. If it fits within your visit time, we can usually help.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {VISIT_CATEGORIES.map((category) => (
            <article
              key={category.title}
              className="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-[0_16px_54px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-7 sm:shadow-[0_20px_70px_rgba(15,23,42,0.06)]"
            >
              <div className="text-[34px] leading-none sm:text-[42px]" aria-hidden="true">
                {category.icon}
              </div>
              <h3 className="mt-4 min-h-[52px] text-[21px] font-semibold leading-tight tracking-normal text-[#111111] sm:mt-5 sm:min-h-[64px] sm:text-[24px]">
                {category.title}
              </h3>
              <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                {category.examples.map((example) => (
                  <li key={example} className="flex gap-2.5 text-[14px] leading-5 text-[#1D1D1F] sm:gap-3 sm:text-[15px] sm:leading-6">
                    <span className="mt-[1px] flex-none text-sm font-semibold text-[#111111]">
                      ✓
                    </span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-7 max-w-[980px] rounded-[24px] border border-[#DDE3EE] bg-white p-5 shadow-[0_16px_54px_rgba(15,23,42,0.06)] sm:mt-10 sm:rounded-[28px] sm:p-7 sm:shadow-[0_20px_70px_rgba(15,23,42,0.06)] lg:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#306EEC]">
                Included
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#1D1D1F]">
                Electrical, plumbing, repairs, installations, maintenance, and most small home projects.
              </p>
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#6E6E73]">
                Not Included
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#6E6E73]">
                Large remodels, full-room painting, major electrical work, major plumbing work, roofing, siding, and projects that exceed visit time.
              </p>
            </div>
          </div>
          <p className="mt-6 border-t border-[#E5E7EB] pt-5 text-center text-[15px] font-medium leading-7 text-[#1D1D1F]">
            A visit is designed for small and medium tasks that can typically be completed within your visit time.
          </p>
        </div>
      </div>
    </section>
  );
}
