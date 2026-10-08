"use client";

import { useId } from "react";

/**
 * A checklist a homeowner can tick on screen or print and stick on the fridge.
 *
 * The content is passed in from the guide and rendered on the server like any
 * other HTML (a client component still renders into the served page); only the
 * Print button needs the browser. Printing shows the checklist alone, so a
 * reader gets a clean page rather than the whole site.
 */
export default function PrintableChecklist({
  title,
  intro,
  groups,
  blankLines = 4,
}: {
  title: string;
  intro?: string;
  groups: { name: string; items: string[] }[];
  blankLines?: number;
}) {
  const id = useId();
  return (
    <div className="pf-printable my-8 rounded-[12px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.05)] sm:p-7">
      <style>{`@media print {
  body * { visibility: hidden !important; }
  .pf-printable, .pf-printable * { visibility: visible !important; }
  .pf-printable { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; box-shadow: none; padding: 0; }
  .pf-no-print { display: none !important; }
}`}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">Printable checklist</p>
          <p className="mt-2 text-[20px] font-black leading-tight text-[#0B1628] sm:text-[23px]">{title}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="pf-no-print inline-flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white px-4 text-[14px] font-bold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC]"
        >
          Print this list
        </button>
      </div>
      {intro ? <p className="mt-3 text-[14px] leading-6 text-[#64748B]">{intro}</p> : null}
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        {groups.map((group, g) => (
          <fieldset key={group.name} className="min-w-0">
            <legend className="text-[13px] font-black uppercase tracking-[0.1em] text-[#0B1628]">{group.name}</legend>
            <ul className="mt-2 grid gap-1.5">
              {group.items.map((item, i) => (
                <li key={item}>
                  <label htmlFor={`${id}-${g}-${i}`} className="flex cursor-pointer gap-2.5 text-[14px] leading-6 text-[#334155]">
                    <input id={`${id}-${g}-${i}`} type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#306EEC]" />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
      {blankLines > 0 ? (
        <div className="mt-6">
          <p className="text-[13px] font-black uppercase tracking-[0.1em] text-[#0B1628]">Your own items</p>
          <ul className="mt-2 grid gap-3" aria-hidden="true">
            {Array.from({ length: blankLines }).map((_, i) => (
              <li key={i} className="flex items-end gap-2.5">
                <span className="mb-0.5 h-4 w-4 shrink-0 rounded-[3px] border border-[#94A3B8]" />
                <span className="h-6 flex-1 border-b border-[#CBD5E1]" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
