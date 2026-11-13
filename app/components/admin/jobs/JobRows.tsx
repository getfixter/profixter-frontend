"use client";

import { ArrowTopRightOnSquareIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Menu, StatusBadge, TypeBadge, cx, setMapsApp, useMapsApp, type MapsApp } from "@/app/components/admin/ui";
import { badgeTypeOf, nyYMD, relativeDay, routeLegs, routeUrl, shortFlagLabel, shortName, shortTypeLabel, stopAddress, timeNY, topFlag, type JobFlag, type JobRow } from "@/lib/admin/jobs";
import { markOpenedFromList } from "./openedFrom";

/**
 * A flag as a badge: problems red with the alert icon, attention amber with
 * the clock. `short` gives the one- or two-word list label ("Review",
 * "Payment"); the full wording stays in its title (and in the job sheet).
 */
export function FlagBadge({ flag, className, short = false }: { flag: JobFlag; className?: string; short?: boolean }) {
  return (
    <StatusBadge tone={flag.severity === "problem" ? "problem" : "attention"} className={className} title={short ? flag.label : undefined}>
      {short ? shortFlagLabel(flag) : flag.label}
    </StatusBadge>
  );
}

/** What a row shows first on its meta line: the most important flag (short), else a final status, else "Scheduled now". */
function rowSignal(row: JobRow): ReactNode {
  const flag = topFlag(row);
  if (flag) return <FlagBadge flag={flag} short />;
  if (row.status === "Completed" || row.status === "Canceled") return <StatusBadge status={row.status} />;
  if (row.timing?.key === "scheduled_now") return <StatusBadge tone="info">{row.timing.label}</StatusBadge>;
  return null;
}

/**
 * One job, the whole row opens it and holds no buttons. Names and addresses
 * are never squeezed: on a phone each gets its own line and wraps rather
 * than cuts off, and the short badges go underneath (rows ~84-100px):
 *   8:00   Christopher Montgomery-Smith
 *   AM     12 Oak St, Huntington Station
 *          [Review] [Free visit] T. One
 * From 640px the badges move to the right of the name and address.
 */
export function JobRowItem({ row, href, showDate = false, conflict = false }: { row: JobRow; href: string; showDate?: boolean; /** The Fixter has another job overlapping this one. */ conflict?: boolean }) {
  const time = row.type === "full_day" ? "Full day" : timeNY(row.date);
  const [clock, period] = time.includes(" ") ? time.split(" ") : [time, ""];
  const place = [row.addressShort, row.town].filter(Boolean).join(", ") || "No address";
  const flag = topFlag(row);
  // "Unassigned" is said once: by the flag when it is the row's flag, else by the Fixter slot.
  const tech = row.technician ? shortName(row.technician.name) || "Assigned" : flag?.key === "unassigned" && !conflict ? "" : "Unassigned";
  const canceled = row.status === "Canceled";
  return (
    <li className={cx("border-b border-adm-line last:border-b-0", conflict && "shadow-[inset_4px_0_0_var(--adm-problem)]")} data-job-row={row.id} data-status={row.status} data-conflict={conflict ? "true" : undefined}>
      <Link
        href={href}
        scroll={false}
        onClick={markOpenedFromList}
        aria-label={[
          row.customer?.name || "Customer",
          showDate && row.date ? relativeDay(nyYMD(row.date)) : "",
          time,
          [row.addressShort, row.town].filter(Boolean).join(", "),
          row.typeLabel,
          row.status,
          row.technician ? row.technician.name : "unassigned",
          conflict ? "conflicts with another job of the same Fixter" : flag?.label || "",
        ]
          .filter(Boolean)
          .join(", ")}
        className="flex min-h-[84px] w-full items-stretch gap-2 px-3 py-2.5 transition-colors hover:bg-adm-bg focus-visible:bg-adm-bg min-[360px]:gap-2.5 sm:gap-3 sm:px-4"
      >
        <span className="flex w-[44px] flex-none flex-col pt-0.5 text-left min-[360px]:w-[48px] sm:w-[52px]" aria-hidden="true">
          <span className={cx("adm-num text-[15px] font-semibold leading-5", canceled ? "text-adm-text-3 line-through" : "text-adm-ink")}>{clock}</span>
          {period && <span className="text-[13px] leading-4 text-adm-text-2">{period}</span>}
          {showDate && row.date && <span className="mt-0.5 text-[12px] leading-4 text-adm-text-3">{shortDay(row.date)}</span>}
        </span>
        <span className="adm-row-body" aria-hidden="true">
          <span className={cx("adm-row-name text-[15px] font-semibold leading-5", canceled ? "text-adm-text-2" : "text-adm-ink")} data-row-name="">
            {row.customer?.name || "Customer"}
          </span>
          <span className="adm-row-place text-[13px] leading-[18px] text-adm-text-2" data-row-place="">
            {place}
          </span>
          <span className="adm-row-meta" data-row-meta="">
            {conflict ? <StatusBadge tone="problem" title="Conflicts with another job of the same Fixter">Conflict</StatusBadge> : rowSignal(row)}
            <TypeBadge type={badgeTypeOf(String(row.type))}>{shortTypeLabel(row)}</TypeBadge>
            {tech && <span className={cx("whitespace-nowrap text-[13px] leading-5", row.technician ? "text-adm-text-2" : "font-semibold text-adm-attn")}>{tech}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

function shortDay(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

/** "Route ↗" through a day's confirmed stops, in the maps app this device chose (asked once). */
export function RouteButton({ rows, label = "Route" }: { rows: JobRow[]; label?: string }) {
  const maps = useMapsApp();
  const [asking, setAsking] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const stops = rows.filter((r) => r.status === "Confirmed" && (r.addressShort || r.town)).map(stopAddress);
  if (!stops.length) return null;
  const legs = routeLegs(stops);
  const open = (app: MapsApp) => {
    // One window per leg: Google takes at most 9 waypoints and the destination.
    for (const leg of app === "apple" ? [stops] : legs) window.open(routeUrl(leg, app), "_blank", "noopener,noreferrer");
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => (maps ? open(maps) : setAsking(true))}
        className="inline-flex min-h-[44px] items-center gap-1 rounded-adm-sm px-2 text-[14px] font-semibold text-adm-accent-ink hover:bg-adm-accent-soft"
        aria-label={`${label}: directions through ${stops.length} confirmed ${stops.length === 1 ? "stop" : "stops"}${legs.length > 1 ? ` in ${legs.length} legs` : ""}`}
        data-route=""
      >
        {label}
        <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      <Menu
        open={asking}
        onClose={() => setAsking(false)}
        anchorRef={ref}
        title="Open the route in"
        items={[
          { label: "Google Maps", hint: "Remembered on this device", icon: <MapPinIcon />, onSelect: () => (setMapsApp("google"), open("google")) },
          { label: "Apple Maps", hint: "Remembered on this device", icon: <MapPinIcon />, onSelect: () => (setMapsApp("apple"), open("apple")) },
        ]}
      />
    </>
  );
}

/** The sticky day heading: "Today · Thu, Nov 12 · 7 jobs · 2 unassigned" and Route ↗. */
export function DayGroup({ ymd, rows, hrefFor, children, route = true, showDate = false, plainHead = false }: { ymd: string; rows: JobRow[]; hrefFor: (row: JobRow) => string; children?: ReactNode; route?: boolean; showDate?: boolean; /** No sticky view bar above (My day). */ plainHead?: boolean }) {
  const unassigned = rows.filter((r) => !r.technician && r.status !== "Completed" && r.status !== "Canceled").length;
  const rel = relativeDay(ymd);
  const title = rel === "Today" || rel === "Tomorrow" || rel === "Yesterday" ? `${rel} · ${relativeDayShort(ymd)}` : rel;
  return (
    <section className="flex flex-col" aria-label={`${title}, ${rows.length} ${rows.length === 1 ? "job" : "jobs"}`} data-day={ymd}>
      <div className={cx("adm-day-head flex min-h-[44px] items-center justify-between gap-2 px-1", plainHead && "adm-day-head--plain")}>
        <h2 className="min-w-0 py-1 text-[15px] font-semibold leading-5 text-adm-ink">
          {title}
          <span className="adm-num font-normal text-adm-text-2">
            {" "}
            · {rows.length} {rows.length === 1 ? "job" : "jobs"}
          </span>
          {unassigned > 0 && <span className="font-semibold text-adm-attn"> · {unassigned} unassigned</span>}
        </h2>
        {route && <RouteButton rows={rows} />}
      </div>
      {children}
      {rows.length > 0 && (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
          {rows.map((row) => (
            <JobRowItem key={row.id} row={row} href={hrefFor(row)} showDate={showDate} />
          ))}
        </ul>
      )}
    </section>
  );
}

function relativeDayShort(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Rows grouped by their New York day, in the order given. */
export function groupByDay(rows: JobRow[]): { ymd: string; rows: JobRow[] }[] {
  const out: { ymd: string; rows: JobRow[] }[] = [];
  for (const row of rows) {
    const ymd = row.date ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(row.date)) : "";
    const last = out[out.length - 1];
    if (last && last.ymd === ymd) last.rows.push(row);
    else out.push({ ymd, rows: [row] });
  }
  return out;
}
