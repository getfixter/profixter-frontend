"use client";

/**
 * Postal mail to the GoHighLevel list. The Outreach agent plans waves (towns,
 * size, postcard copy, cost); nothing is printed until the owner approves the
 * spend here. Export downloads the print vendor's file - names, addresses and
 * each home's personal link / QR (www.profixter.com/m/<wave>-<code>) - so every
 * first free visit from a card is counted against its wave. Approve, export
 * and "mailed" are owner-only, here and on the server.
 */

import { useCallback, useEffect, useState } from "react";
import { decideWave, exportWave, getOutreach, type MailWaveView, type OutreachView } from "@/lib/admin-growth";

const STATUS: Record<MailWaveView["status"], { text: string; cls: string }> = {
  draft: { text: "Waiting for you", cls: "bg-amber-50 text-amber-800" },
  approved: { text: "Approved - export to print", cls: "bg-blue-50 text-blue-700" },
  exported: { text: "Exported - mark mailed when sent", cls: "bg-blue-50 text-blue-700" },
  mailed: { text: "Mailed", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { text: "Cancelled", cls: "bg-slate-100 text-slate-500" },
};

const EXCLUDED: Record<string, string> = {
  outside_service_area: "outside Nassau/Suffolk",
  no_street_address: "no street address",
  asked_to_stop: "asked to stop",
  existing_customer: "already customers",
  same_household: "same household",
  junk_record: "junk/test records",
};

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function OutreachPanel({ owner }: { owner: boolean }) {
  const [data, setData] = useState<OutreachView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getOutreach());
    } catch {
      setError("Mail outreach could not load.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "That did not go through.");
    } finally {
      setBusy(null);
      load();
    }
  };

  const a = data?.audience;
  return (
    <section className="rounded-[22px] border border-slate-200/70 bg-white p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">Mail outreach</h2>
        <span className="text-[12px] text-slate-500">The imported list has no texting or email consent - postcards are the lawful channel.</span>
      </div>
      {error ? <div className="mb-3 rounded-[12px] bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</div> : null}
      {!data ? (
        <div className="h-24 animate-pulse rounded-[14px] bg-slate-100" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-[14px] bg-slate-50 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Mailable homes</div>
              <div className="mt-2 text-[26px] font-bold leading-none text-slate-900">{a?.eligible.toLocaleString() ?? "—"}</div>
              <div className="mt-1 text-[12px] text-slate-500">
                {a?.synced ? `of ${a.synced.toLocaleString()} contacts · ${a.mailableNow.toLocaleString()} not mailed in 90 days` : "List not synced yet"}
              </div>
            </div>
            <div className="rounded-[14px] bg-slate-50 p-4 md:col-span-2">
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Left out</div>
              <div className="mt-2 text-[13px] leading-6 text-slate-600">
                {a && Object.keys(a.excluded).length
                  ? Object.entries(a.excluded)
                      .sort((x, y) => y[1] - x[1])
                      .map(([k, n]) => `${n.toLocaleString()} ${EXCLUDED[k] || k}`)
                      .join(" · ")
                  : "—"}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {data.waves.length === 0 ? (
              <p className="text-[14px] text-slate-500">No waves yet. The Outreach agent plans one on Tuesdays once the list is synced.</p>
            ) : (
              data.waves.map((w) => (
                <div key={w.key} className="rounded-[16px] bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[15px] font-semibold text-slate-900">{w.name}</div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS[w.status].cls}`}>{STATUS[w.status].text}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    {w.size.toLocaleString()} postcards · ZIPs {w.targetZips.join(", ")} · about {money(w.estimatedCostCents)}
                    {w.results ? ` · ${w.results.registrations} sign-ups, ${w.results.firstFreeVisits} first free visits` : ""}
                  </div>
                  <div className="mt-3 rounded-[12px] bg-white p-3 text-[14px] ring-1 ring-slate-200">
                    <div className="font-bold text-slate-900">{w.copy.headline}</div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{w.copy.body}</p>
                    <div className="mt-2 font-semibold text-blue-700">{w.copy.callToAction}</div>
                  </div>
                  {w.rationale ? <p className="mt-2 text-[12px] text-slate-500">Why: {w.rationale}</p> : null}
                  {owner ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {w.status === "draft" ? (
                        <button
                          type="button"
                          disabled={busy === w.key}
                          onClick={() => act(w.key, () => decideWave(w.key, "approve"), `Approve about ${money(w.estimatedCostCents)} for ${w.size} postcards?`)}
                          className="h-9 rounded-[10px] bg-slate-900 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                        >
                          Approve spend
                        </button>
                      ) : null}
                      {w.status === "approved" ? (
                        <button
                          type="button"
                          disabled={busy === w.key}
                          onClick={() => act(w.key, () => exportWave(w.key))}
                          className="h-9 rounded-[10px] bg-slate-900 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                        >
                          Download mailing file
                        </button>
                      ) : null}
                      {w.status === "exported" ? (
                        <button
                          type="button"
                          disabled={busy === w.key}
                          onClick={() => act(w.key, () => decideWave(w.key, "mailed"))}
                          className="h-9 rounded-[10px] bg-slate-900 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                        >
                          Mark mailed
                        </button>
                      ) : null}
                      {w.status === "draft" || w.status === "approved" ? (
                        <button
                          type="button"
                          disabled={busy === w.key}
                          onClick={() => act(w.key, () => decideWave(w.key, "cancel"))}
                          className="h-9 rounded-[10px] bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
