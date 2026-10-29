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
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
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
            /* ring-2 marks the selection; the booking tests read it. */
            className={[
              "relative flex min-h-11 items-center justify-center gap-1 rounded-[var(--ui-r-sm)] border px-1 text-center text-[14px] font-medium tabular-nums transition-colors duration-200 active:scale-[0.99] sm:min-h-12 sm:text-[15px]",
              isSelected
                ? "cursor-default border-[color:var(--ui-ink)] bg-[color:var(--ui-ink)] text-white ring-2 ring-[color:var(--ui-ink)]/15"
                : slot.available
                  ? "border-[color:var(--ui-line-2)] bg-white text-[color:var(--ui-ink)] hover:border-[#b9c1cd]"
                  : "cursor-not-allowed border-[color:var(--ui-line)] bg-[color:var(--ui-bg-soft)] text-[#9aa3b2] line-through",
            ].join(" ")}
          >
            {formatTime12(slot.time)}
            <span className="sr-only">{availabilityLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
