"use client";

import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { Button, IconButton, Sheet, cx } from "@/app/components/admin/ui";
import { useAdminQuery } from "@/lib/admin/query";
import { addDays, dayLabel, fetchJobs, jobKeys, nyYMD, rememberKey, todayYMD } from "@/lib/admin/jobs";

/**
 * ◀ Thu, Nov 12 ▶ and a calendar button (F.1 item 3). Day views move one day,
 * the week view seven. The month picker shows how many jobs each day has
 * (from the server, canceled jobs excluded) and jumps to a day.
 */
export function DateStrip({ date, step, label, onChange, onPickDay }: { date: string; step: 1 | 7; label: string; onChange: (ymd: string) => void; onPickDay: (ymd: string) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="mb-2 flex min-h-[44px] items-center gap-1" data-date-strip="">
      <IconButton label={step === 7 ? "Previous week" : "Previous day"} icon={<ChevronLeftIcon />} onClick={() => onChange(addDays(date, -step))} />
      <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-adm-ink" aria-live="polite" data-date-label="">
        {label}
      </p>
      <IconButton label={step === 7 ? "Next week" : "Next day"} icon={<ChevronRightIcon />} onClick={() => onChange(addDays(date, step))} />
      <IconButton label="Pick a day" icon={<CalendarDaysIcon />} onClick={() => setPicking(true)} data-month-picker="" />
      <Sheet open={picking} onClose={() => setPicking(false)} title="Pick a day" variant="dialog" data-sheet="month-picker">
        <MonthGrid
          selected={date}
          onPick={(ymd) => {
            setPicking(false);
            onPickDay(ymd);
          }}
        />
      </Sheet>
    </div>
  );
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function MonthGrid({ selected, onPick }: { selected: string; onPick: (ymd: string) => void }) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  const today = todayYMD();
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(daysIn).padStart(2, "0")}`;
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  const params = { view: "range" as const, from: first, to: last, limit: 200 };
  const key = jobKeys.list(params);
  rememberKey(key);
  const q = useAdminQuery(key, (signal) => fetchJobs(params, signal), { staleTime: 60_000 });
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of q.data?.rows || []) {
      const d = nyYMD(row.date);
      map.set(d, (map.get(d) || 0) + 1);
    }
    return map;
  }, [q.data]);
  const truncated = Boolean(q.data?.nextCursor);

  const shift = (n: number) => {
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(t.toISOString().slice(0, 7));
  };
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Previous month" icon={<ChevronLeftIcon />} onClick={() => shift(-1)} />
        <p className="text-[15px] font-semibold text-adm-ink" aria-live="polite">
          {title}
        </p>
        <IconButton label="Next month" icon={<ChevronRightIcon />} onClick={() => shift(1)} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={title}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[12px] font-semibold text-adm-text-3" role="columnheader" aria-label={WEEKDAY_NAMES[i]}>
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: daysIn }, (_, i) => {
          const ymd = `${month}-${String(i + 1).padStart(2, "0")}`;
          const count = perDay.get(ymd) || 0;
          const isSel = ymd === selected;
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onPick(ymd)}
              aria-label={`${dayLabel(ymd, { year: true })}${count ? `, ${count} ${count === 1 ? "job" : "jobs"}` : ", no jobs"}`}
              aria-current={isSel ? "date" : undefined}
              data-day-cell={ymd}
              className={cx(
                "flex min-h-[44px] flex-col items-center justify-center rounded-adm-sm text-[14px]",
                isSel ? "bg-adm-ink text-white" : ymd === today ? "border border-adm-accent text-adm-ink" : "text-adm-ink hover:bg-adm-bg"
              )}
            >
              <span className="adm-num leading-4">{i + 1}</span>
              <span className={cx("adm-num text-[12px] leading-4", isSel ? "text-white/80" : count ? "font-semibold text-adm-accent-ink" : "text-transparent")}>{count || "·"}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[13px] text-adm-text-2">{q.isLoading ? "Counting jobs…" : truncated ? "Counts show the first 200 jobs of the month." : "Numbers are jobs that day (canceled not counted)."}</p>
        <Button variant="tertiary" onClick={() => onPick(today)}>
          Today
        </Button>
      </div>
    </div>
  );
}
