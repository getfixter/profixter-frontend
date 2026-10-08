"use client";

/**
 * Customer Map: where Profixter's customers are, on the Long Island outline.
 *
 * Private by construction: the points come from /api/admin/overview/map,
 * which requires the analytics.map permission, and each point carries only
 * what its card shows - first name and initial, town, plan, dates, source.
 * No street address, email or phone ever reaches this component.
 *
 * Pins, not density (V1). Exact positions where the address was verified with
 * coordinates; otherwise a stable spot inside the customer's ZIP.
 */

import { useEffect, useMemo, useState } from "react";
import { ISLAND_PATH, MAP_VIEWBOX } from "@/app/components/home/MembershipMap/island-geometry";
import { getOverviewMap, customerHref, planLabel, shortDate, type MapPoint, type OverviewMap } from "@/lib/admin-overview";

type Layer = "all" | "members" | "free" | "onetime" | "new";
const LAYERS: Array<{ key: Layer; label: string }> = [
  { key: "all", label: "All" },
  { key: "members", label: "Members" },
  { key: "free", label: "Free Visits" },
  { key: "onetime", label: "One-Time" },
  { key: "new", label: "New this period" },
];
const PLAN_COLORS: Record<string, string> = { basic: "#86b6ef", plus: "#3987e5", premium: "#1c5cab", elite: "#0d366b" };

export default function CustomerMap({
  periodFrom,
  periodTo,
  cityFilter,
  onClearCity,
  linkCustomers = false,
}: {
  periodFrom: string;
  periodTo: string;
  cityFilter: string | null;
  onClearCity: () => void;
  /* Only someone with All Users gets "View customer". */
  linkCustomers?: boolean;
}) {
  const [data, setData] = useState<OverviewMap | null>(null);
  const [error, setError] = useState("");
  const [layer, setLayer] = useState<Layer>("all");
  const [plan, setPlan] = useState<string | null>(null);
  const [picked, setPicked] = useState<MapPoint | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOverviewMap()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError("The customer map couldn't load."));
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const from = new Date(periodFrom).getTime();
    const to = new Date(periodTo).getTime();
    return data.points.filter((p) => {
      if (cityFilter && p.city.toLowerCase() !== cityFilter.toLowerCase()) return false;
      if (plan && p.plan !== plan) return false;
      if (layer === "members") return p.member;
      if (layer === "free") return p.freeVisit;
      if (layer === "onetime") return p.oneTime;
      if (layer === "new") {
        const t = new Date(p.joinedAt).getTime();
        return t >= from && t < to;
      }
      return true;
    });
  }, [data, layer, plan, cityFilter, periodFrom, periodTo]);

  const W = MAP_VIEWBOX.width;
  const H = MAP_VIEWBOX.height;

  const body = (
    <div className={full ? "flex h-full flex-col" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLayer(l.key)}
              aria-pressed={layer === l.key}
              className={`h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold transition ${layer === l.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {Object.keys(PLAN_COLORS).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(plan === p ? null : p)}
              aria-pressed={plan === p}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${plan === p ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[p] }} />
              {planLabel(p)}
            </button>
          ))}
        </div>
        {cityFilter ? (
          <button type="button" onClick={onClearCity} className="h-9 rounded-full bg-blue-50 px-3 text-[12px] font-semibold text-blue-700">
            {cityFilter} ×
          </button>
        ) : null}
      </div>

      <div className={`relative mt-3 overflow-hidden rounded-[18px] bg-[#f4f7fc] ${full ? "flex-1" : ""}`}>
        {error ? (
          <p className="p-10 text-center text-[14px] text-slate-500">{error}</p>
        ) : !data ? (
          <div className="ov-skel aspect-[1000/449] w-full" />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-label={`${visible.length} customers on the map`}>
            <path d={ISLAND_PATH} fill="#ffffff" stroke="#d5deeb" strokeWidth={1.2} />
            {visible.map((p) => {
              const color = p.member ? PLAN_COLORS[p.plan || "basic"] : "#9aa6b8";
              const active = picked?.id === p.id;
              return (
                <g key={p.id} onClick={() => setPicked(p)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={active ? 6.5 : 4.6} fill={color} stroke="#fff" strokeWidth={1.6} className="ov-pin" />
                </g>
              );
            })}
          </svg>
        )}

        {picked ? (
          <div className="absolute bottom-3 left-3 right-3 rounded-[16px] border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_-18px_rgba(11,22,40,0.45)] backdrop-blur sm:left-auto sm:w-[290px]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[16px] font-bold text-slate-900">{picked.name}</div>
                <div className="text-[13px] text-slate-500">{picked.city || "—"}</div>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="-mr-1 -mt-1 h-8 w-8 rounded-full text-[18px] text-slate-400 hover:bg-slate-100" aria-label="Close">
                ×
              </button>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <dt className="text-slate-400">Plan</dt>
              <dd className="font-semibold text-slate-800">{picked.member ? `${planLabel(picked.plan)}${picked.gift ? " (gift)" : ""}` : "Not a member"}</dd>
              <dt className="text-slate-400">Joined</dt>
              <dd className="text-slate-700">{shortDate(picked.memberSince || picked.joinedAt)}</dd>
              <dt className="text-slate-400">Source</dt>
              <dd className="text-slate-700">{picked.source}</dd>
              <dt className="text-slate-400">Last visit</dt>
              <dd className="text-slate-700">{shortDate(picked.lastVisit)}</dd>
              <dt className="text-slate-400">Upcoming</dt>
              <dd className="text-slate-700">{shortDate(picked.nextVisit)}</dd>
            </dl>
            {linkCustomers ? (
              <a href={customerHref(picked.ref)} className="mt-3 inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-[13px] font-semibold text-white">
                View customer
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
        <span>
          {data ? `${visible.length.toLocaleString()} shown · ${data.placed.toLocaleString()} of ${data.total.toLocaleString()} customers have a mappable address` : " "}
        </span>
        <button type="button" onClick={() => setFull((v) => !v)} className="font-semibold text-blue-600">
          {full ? "Close full screen" : "Full screen"}
        </button>
      </div>
    </div>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-[95] bg-white p-4 md:p-8" role="dialog" aria-modal="true" aria-label="Customer map">
        {body}
      </div>
    );
  }
  return body;
}
