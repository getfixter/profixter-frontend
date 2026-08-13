"use client";

/**
 * A faithful, lightweight depiction of the real ProFixter booking screen.
 *
 * Built in markup rather than shipped as a screenshot: it stays sharp at any
 * density, adapts to width, costs no image payload, and can be kept in step
 * with the product. Every label here mirrors what the customer actually sees
 * when booking - date, time, task details, required photo.
 */

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** A fixed month grid. Leading blanks then 1..30, with a chosen day. */
const CELLS: Array<number | null> = [
  null, null, null, null, null, null, 1,
  2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29,
];
const CHOSEN = 13;
const UNAVAILABLE = new Set([2, 3, 9, 16, 23, 6, 20]);

const TIMES = ["8:00 AM", "10:00 AM", "12:00 PM"];

export default function BookingPreview({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-[300px] rounded-[8px] border border-black/[0.06] bg-white p-3 shadow-[0_28px_70px_-20px_rgba(11,22,40,0.35)] sm:max-w-[330px] sm:p-3.5 ${className}`}
      aria-hidden="true"
    >
      <div className="rounded-[8px] bg-[#F7F8FA] p-3.5 sm:p-4">
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#111111]">
          Book your visit
        </p>

        {/* Month */}
        <div className="mt-3 rounded-[8px] bg-white p-2.5 shadow-[0_1px_2px_rgba(11,22,40,0.05)]">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-semibold text-[#111111]">August</span>
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D2D2D7]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#D2D2D7]" />
            </span>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-y-0.5">
            {DAYS.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="text-center text-[8px] font-semibold uppercase tracking-[0.04em] text-[#A1A1A6]"
              >
                {d}
              </span>
            ))}
            {CELLS.map((n, i) => {
              if (n === null) return <span key={`b-${i}`} />;
              const chosen = n === CHOSEN;
              const off = UNAVAILABLE.has(n);
              return (
                <span
                  key={n}
                  className={[
                    "mx-auto mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[10px] font-semibold",
                    chosen
                      ? "bg-[#306EEC] text-white shadow-[0_2px_6px_rgba(48,110,236,0.4)]"
                      : off
                        ? "text-[#D2D2D7]"
                        : "bg-[#EEF4FF] text-[#1F5ED8]",
                  ].join(" ")}
                >
                  {n}
                </span>
              );
            })}
          </div>
        </div>

        {/* Times */}
        <div className="mt-2.5 flex gap-1.5">
          {TIMES.map((t, i) => (
            <span
              key={t}
              className={[
                "flex-1 rounded-[6px] py-1.5 text-center text-[9.5px] font-semibold",
                i === 0
                  ? "bg-[#0B1628] text-white"
                  : "border border-[#E5E5EA] bg-white text-[#6E6E73]",
              ].join(" ")}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Task + photo */}
        <div className="mt-2.5 rounded-[8px] bg-white p-2.5 shadow-[0_1px_2px_rgba(11,22,40,0.05)]">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#A1A1A6]">
            What needs doing
          </p>
          <p className="mt-1 text-[11.5px] leading-[1.35] text-[#111111]">
            Bedroom door doesn&rsquo;t close right
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#EEF4FF]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-1.8h6.2L15.8 6h2.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z"
                  stroke="#306EEC"
                  strokeWidth="1.7"
                />
                <circle cx="12" cy="12.5" r="3.2" stroke="#306EEC" strokeWidth="1.7" />
              </svg>
            </span>
            <span className="h-8 w-8 rounded-[6px] bg-gradient-to-br from-[#C7D2E4] to-[#9FB0C9]" />
            <span className="text-[9.5px] text-[#A1A1A6]">Photo added</span>
          </div>
        </div>

        {/* Confirm */}
        <div className="mt-2.5 flex items-center justify-between rounded-[6px] bg-[#306EEC] px-3 py-2.5">
          <span className="text-[11.5px] font-semibold text-white">Book visit</span>
          <span className="text-[11.5px] font-semibold text-white/80">$0</span>
        </div>
      </div>
    </div>
  );
}
