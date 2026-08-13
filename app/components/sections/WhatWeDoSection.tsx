"use client";

const TASKS = [
  "TV mounting and shelf installs",
  "Light fixtures and outlet swaps",
  "Faucets, toilets, and minor leaks",
  "Drywall patches and caulking",
  "Doors, locks, and hardware fixes",
  "Furniture assembly and small punch lists",
];

export default function WhatWeDoSection() {
  return (
    <section className="w-full bg-[#eaedfa] py-10 sm:py-9 lg:py-14">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[8px] border border-[#C5CBD8] bg-[#EEF2FF] p-5 sm:p-7 lg:p-8 shadow-[0_0_200px_rgba(0,0,0,0.08)]">
          <div className="max-w-[700px]">
            <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-bold">
              What We Do
            </div>
            <h2 className="mt-2 text-[26px] sm:text-[32px] lg:text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-[#313234]">
              Common handyman jobs homeowners book all the time
            </h2>
            <p className="mt-3 text-[#6A6D71] text-[15px] sm:text-[17px] leading-relaxed">
              Easy fixes, ongoing maintenance, and the small-to-medium jobs that keep your home handled.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {TASKS.map((task) => (
              <div
                key={task}
                className="rounded-[8px] border border-[#E6E8EF] bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-[#306EEC]/10 text-[#306EEC] flex items-center justify-center text-sm font-extrabold shrink-0">
                    +
                  </div>
                  <div className="text-[#313234] text-sm sm:text-[15px] font-extrabold leading-relaxed">
                    {task}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
