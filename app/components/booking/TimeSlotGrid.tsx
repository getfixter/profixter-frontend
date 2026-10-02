"use client";

/*
 * One slot list for every calendar that books a visit.
 *
 * Shows every time the day's schedule offers. A bookable time is a button; a
 * time that is booked or otherwise unavailable stays on screen, struck through
 * and natively disabled, so a customer sees the day as it is rather than a day
 * with holes in it. Whether a time is bookable is decided by the caller from
 * the availability API; this only draws the answer.
 *
 * Moved here unchanged from the Membership calendar so that One-Time Visit
 * renders slots exactly the same way.
 */

export type TimeSlotOption = {
  time: string;
  available: boolean;
  remaining: number | null;
};

function formatTime12(t: string): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;

  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function TimeSlotGrid({
  slotOptions,
  selectedTime,
  onSelect,
}: {
  slotOptions: TimeSlotOption[];
  selectedTime: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 sm:gap-1.5 xl:grid-cols-5">
      {slotOptions.map((slot) => {
        const isSelected = slot.available && slot.time === selectedTime;
        const availabilityLabel = slot.available
          ? slot.remaining && slot.remaining > 0
            ? `${slot.remaining} left`
            : "Available"
          : "Unavailable";
        return (
          <button
            key={slot.time}
            type="button"
            data-booking-time={slot.time}
            data-booking-time-available={slot.available ? "true" : "false"}
            disabled={!slot.available}
            onClick={() => {
              if (!slot.available) return;
              onSelect(slot.time);
            }}
            className={[
              "group relative min-h-9 overflow-hidden rounded-[6px] border px-0.5 py-0 text-center transition-all duration-150 ease-out active:scale-[0.99] sm:min-h-11 sm:px-2.5 sm:py-1.5",
              isSelected
                ? "border-[#306EEC] bg-[#EEF5FF] text-[#0B1628] shadow-[0_8px_24px_rgba(48,110,236,0.12)] ring-2 ring-[#306EEC]/20"
                : slot.available
                  ? "border-[#D7DEE9] bg-white text-[#0B1628] hover:border-[#306EEC] hover:bg-[#F8FAFF]"
                  : "border-[#E2E8F0] bg-[#F1F5F9] text-[#94A3B8]",
              !slot.available ? "cursor-not-allowed" : "",
              isSelected ? "cursor-default" : "",
            ].join(" ")}
          >
            {slot.available && (
              <div
                className={[
                  "pointer-events-none absolute inset-x-0 top-0 h-[44%] transition-opacity duration-200",
                  isSelected ? "bg-[#306EEC]/5 opacity-100" : "bg-[#306EEC]/0 opacity-0 group-hover:opacity-100",
                ].join(" ")}
              />
            )}

            <div className="relative z-[1] flex items-center justify-center gap-0.5 sm:gap-1">
              <div
                  className={`text-[11px] font-bold leading-tight tracking-[-0.01em] sm:text-[14px] ${
                  slot.available ? "" : "line-through"
                } ${isSelected ? "text-[#0B1628]" : ""}`}
              >
                {formatTime12(slot.time)}
              </div>
              {isSelected && (
                <div className="inline-flex items-center text-[#306EEC]">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="flex-shrink-0 sm:h-3 sm:w-3">
                    <path
                      d="M2.5 6.2L4.8 8.5L9.5 3.7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
            <span className="sr-only">{availabilityLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
