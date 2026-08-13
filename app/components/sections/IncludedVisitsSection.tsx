"use client";

type CategoryKind = "electrical" | "plumbing" | "repairs" | "maintenance";

const VISIT_CATEGORIES: {
  kind: CategoryKind;
  title: string;
  examples: string[];
}[] = [
  {
    kind: "electrical",
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
    kind: "plumbing",
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
    kind: "repairs",
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
    kind: "maintenance",
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

function CategoryIcon({ kind }: { kind: CategoryKind }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  } as const;

  if (kind === "electrical") {
    return (
      <svg {...common}>
        <path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "plumbing") {
    return (
      <svg {...common}>
        <path d="M4 9h10a4 4 0 0 1 4 4v1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M8 5v8M4 5h8M16 14c-1.7 2-2.5 3.4-2.5 4.5a2.5 2.5 0 0 0 5 0c0-1.1-.8-2.5-2.5-4.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "repairs") {
    return (
      <svg {...common}>
        <path d="m14.5 5.5 4 4M3.5 20.5l5.8-1.3 9.9-9.9a2.8 2.8 0 0 0-4-4L5.3 15.2 3.5 20.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-[3px] flex-none text-[#306EEC]">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function IncludedVisitsSection() {
  return (
    <section
      id="included-visits"
      className="w-full bg-[#F5F5F7] px-4 py-8 sm:px-5 sm:py-13 lg:py-12"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto max-w-[760px] text-center">
          <h2 className="text-[26px] font-semibold leading-[1.08] tracking-normal text-[#111111] sm:text-[36px] sm:leading-[1.05]">
            The home list, handled over time.
          </h2>
          <p className="mx-auto mt-3 max-w-[640px] text-[15px] leading-6 text-[#6E6E73] sm:mt-4 sm:text-lg sm:leading-7">
            Membership is built for the small and medium tasks that keep a home working, comfortable, and cared for.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {VISIT_CATEGORIES.map((category) => (
            <article
              key={category.title}
              className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 shadow-[0_16px_54px_rgba(15,23,42,0.06)] sm:p-7 sm:shadow-[0_20px_70px_rgba(15,23,42,0.06)]"
            >
              <div className="grid h-12 w-12 place-items-center rounded-[8px] bg-[#EEF5FF] text-[#306EEC]" aria-hidden="true">
                <CategoryIcon kind={category.kind} />
              </div>
              <h3 className="mt-4 min-h-[46px] text-[19px] font-semibold leading-tight tracking-normal text-[#111111] sm:mt-5 sm:min-h-[64px] sm:text-[23px]">
                {category.title}
              </h3>
              <ul className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
                {category.examples.map((example) => (
                  <li key={example} className="flex gap-2.5 text-[14px] leading-5 text-[#1D1D1F] sm:gap-3 sm:text-[15px] sm:leading-6">
                    <CheckMark />
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-7 max-w-[980px] rounded-[8px] border border-[#DDE3EE] bg-white p-5 shadow-[0_16px_54px_rgba(15,23,42,0.06)] sm:mt-10 sm:p-7 sm:shadow-[0_20px_70px_rgba(15,23,42,0.06)] lg:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#306EEC]">
                Built for
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#1D1D1F]">
                Small repairs, maintenance, installations, punch lists, and practical home tasks that fit within a membership visit.
              </p>
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#6E6E73]">
                Better as a project
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#6E6E73]">
                Larger remodels, roofing, siding, full-room painting, major trade work, and jobs that should be planned as a separate estimate.
              </p>
            </div>
          </div>
          <p className="mt-6 border-t border-[#E5E7EB] pt-5 text-center text-[15px] font-medium leading-7 text-[#1D1D1F]">
            If something is too large for a visit, you still stay with Profixter. We move it into the right project path.
          </p>
        </div>
      </div>
    </section>
  );
}
