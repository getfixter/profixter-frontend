"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { adminStudio, apiUrl, money } from "@/lib/studio/api";
import { inputClass } from "./StudioAdmin";
import { ManufacturerImage } from "./StudioManufacturersAdmin";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const btn = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50";
export const CATS: Record<string, string> = { wall: "Wall kits", base: "Bases & tubs", fixture: "Valve trims", enclosure: "Doors & rods", accessory: "Accessories" };
/** Where a product stands (from the server's readiness check). */
export const STAGE: Record<string, { label: string; tone: string }> = {
  published: { label: "Published", tone: "bg-emerald-100 text-emerald-700" },
  ready: { label: "Ready to publish", tone: "bg-blue-100 text-blue-700" },
  review: { label: "Ready for review", tone: "bg-violet-100 text-violet-700" },
  incomplete: { label: "Draft - incomplete", tone: "bg-slate-100 text-slate-600" },
  archived: { label: "Archived", tone: "bg-slate-200 text-slate-500" },
};
const FILTERS: [string, string][] = [
  ["all", "All"], ["draft", "Drafts"], ["review", "Ready for review"], ["ready", "Ready to publish"], ["published", "Published"],
  ["missingPrice", "Missing selling price"], ["missingPhoto", "Missing photo"], ["compatibility", "Compatibility unverified"],
  ["visual", "Preview to check"], ["changes", "Manufacturer changes"], ["archived", "Archived"],
];
const ACTIONS: [string, string][] = [
  ["publish", "Publish (ready ones only)"], ["draft", "Back to draft"], ["archive", "Archive drafts"], ["compatibilityReviewed", "Mark compatibility reviewed…"],
  ["show", "Show on the website"], ["hide", "Hide from the website"], ["feature", "Feature"], ["unfeature", "Unfeature"],
];

/**
 * Admin -> Studio Catalog -> Products: every Studio product, grouped into
 * families (series -> size -> colour), filtered and paged on the server so a
 * manufacturer range of thousands stays quick. Bulk changes go through the
 * same checks as single ones.
 */
export default function StudioCatalogManager({ initialManufacturer = "", onOpen, onAdd, onImportStarter, onArrange }: {
  initialManufacturer?: string; onOpen: (id: string) => void; onAdd: (category: string) => void; onImportStarter: () => Promise<string>; onArrange: () => void;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [category, setCategory] = useState("");
  const [manufacturer, setManufacturer] = useState(initialManufacturer);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ kind: string; text: string; list?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminStudio.families({ q: q.trim(), stage, category, manufacturer, page: String(page), per: "20" });
      setData(r);
      if (r.exact) setOpen(new Set(r.families.map((x: any) => x.key)));
    } catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }, [q, stage, category, manufacturer, page]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  const filter = (fn: () => void) => { fn(); setPage(1); setSel(new Set()); };

  async function bulk(action: string) {
    if (!sel.size) return;
    let note: string | undefined;
    if (action === "compatibilityReviewed") {
      note = window.prompt(`What did you check for these ${sel.size} products? (saved on each)`) || "";
      if (!note.trim()) return;
    } else if (!window.confirm(`${ACTIONS.find((a) => a[0] === action)?.[1]}: ${sel.size} product(s)?`)) return;
    setBusy(true);
    try {
      const r = await adminStudio.bulk(action, [...sel], note);
      setMsg({ kind: r.skipped.length ? "warn" : "ok", text: `${r.done} changed${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}.`, list: r.skipped.slice(0, 12).map((s) => `${s.sku}: ${s.reason}`) });
      setSel(new Set());
      load();
    } catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setBusy(false); }
  }
  const toggle = (ids: string[], on: boolean) => setSel((s) => { const n = new Set(s); for (const id of ids) if (on) n.add(id); else n.delete(id); return n; });
  const pages = data ? Math.max(1, Math.ceil(data.total.families / data.per)) : 1;

  return (
    <div className="space-y-3 pb-24" data-testid="catalog-manager">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputClass} placeholder="Search: exact SKU / part number, name, model, color" value={q} onChange={(e) => filter(() => setQ(e.target.value))} data-testid="catalog-search" />
          <select className={`${inputClass} sm:w-56`} value={manufacturer} onChange={(e) => filter(() => setManufacturer(e.target.value))} aria-label="Source" data-testid="catalog-manufacturer">
            <option value="">All sources</option>
            <option value="own">Added by hand</option>
            {(data?.manufacturers || []).map((m: string) => <option key={m} value={m}>{m === "swan" ? "Swan" : m}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip on={!category} onClick={() => filter(() => setCategory(""))}>All categories</Chip>
          {Object.entries(CATS).map(([k, v]) => <Chip key={k} on={category === k} onClick={() => filter(() => setCategory(k))} testId={`catalog-cat-${k}`}>{v}</Chip>)}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map(([k, v]) => <Chip key={k} on={stage === k} onClick={() => filter(() => setStage(k))} dark testId={`catalog-stage-${k}`}>{v} <span className="opacity-70">{data?.counts?.[k] ?? 0}</span></Chip>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => onAdd(category || "wall")} data-testid="catalog-add">Add product</button>
          <button type="button" className={btn} onClick={async () => setMsg({ kind: "ok", text: await onImportStarter() })}>Import starter products</button>
          <button type="button" className={btn} onClick={onArrange}>Arrange display order</button>
        </div>
      </div>
      {msg ? (
        <div className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "err" ? "bg-red-50 text-red-700" : msg.kind === "warn" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`} role="status" data-testid="catalog-msg">
          {msg.text}{msg.list?.length ? <ul className="mt-1 list-disc pl-5">{msg.list.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
        </div>
      ) : null}
      {!data ? <p className="text-slate-500">Loading…</p> : data.families.length === 0 ? <div className={`${card} text-center text-slate-500`}>No products match.</div> : (
        <>
          <p className="px-1 text-xs text-slate-500">{data.total.products.toLocaleString()} products in {data.total.families.toLocaleString()} families{data.exact ? " · exact SKU match" : ""}</p>
          {data.families.map((fam: any) => {
            const ids = fam.products.map((p: any) => p._id);
            const allOn = ids.every((id: string) => sel.has(id));
            const single = fam.products.length === 1;
            const expanded = single || open.has(fam.key);
            const first = fam.products[0];
            return (
              <div key={fam.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="catalog-family">
                <div className="flex items-center gap-3 p-3">
                  <input type="checkbox" aria-label="Select the whole family" checked={allOn} onChange={(e) => toggle(ids, e.target.checked)} className="h-5 w-5" />
                  <Thumb p={first} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (single ? onOpen(first._id) : setOpen((o) => { const n = new Set(o); if (n.has(fam.key)) n.delete(fam.key); else n.add(fam.key); return n; }))} data-testid={single ? `catalog-row-${first.sku}` : `catalog-family-${fam.key}`}>
                    <div className="truncate font-bold text-slate-900">{single ? first.name : fam.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {fam.manufacturer || "Added by hand"} · {CATS[fam.category]}
                      {single ? ` · ${first.sku}` : ` · ${fam.products.length} products${fam.sizes.length ? ` · ${fam.sizes.length} size${fam.sizes.length === 1 ? "" : "s"}` : ""}${fam.colors.length ? ` · ${fam.colors.length} color${fam.colors.length === 1 ? "" : "s"}` : ""}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {single ? <StageBadge p={first} /> : Object.entries(fam.stages).filter(([, n]) => (n as number) > 0).map(([k, n]) => <span key={k} className={`rounded-full px-1.5 font-bold ${STAGE[k].tone}`}>{n as number} {STAGE[k].label.toLowerCase()}</span>)}
                    </div>
                  </button>
                  {single ? <Price p={first} /> : <span className="text-sm font-bold text-blue-700">{expanded ? "▲" : "▼"}</span>}
                </div>
                {!single && expanded ? (
                  <div className="border-t border-slate-100">
                    {fam.products.map((p: any) => (
                      <div key={p._id} className="flex items-center gap-3 border-b border-slate-50 px-3 py-2 last:border-0" data-testid={`catalog-row-${p.sku}`}>
                        <input type="checkbox" aria-label={`Select ${p.sku}`} checked={sel.has(p._id)} onChange={(e) => toggle([p._id], e.target.checked)} className="h-5 w-5" />
                        <span className="inline-block h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: p.variant.colorHex || "#e8e6e1" }} />
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(p._id)}>
                          <div className="truncate text-sm font-semibold text-slate-900">{[p.variant.size, p.variant.color].filter(Boolean).join(" · ") || p.name}</div>
                          <div className="truncate text-[11px] text-slate-500">{p.sku}{p.unitSku ? ` · walls of ${p.unitSku}` : ""}{p.pendingReview ? ` · ${p.pendingReview} change(s) to review` : ""}</div>
                        </button>
                        <StageBadge p={p} />
                        <Price p={p} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="flex items-center justify-center gap-3 py-2 text-sm">
            <button type="button" className={btn} disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>← Previous</button>
            <span className="text-slate-600">Page {page} of {pages}</span>
            <button type="button" className={btn} disabled={page >= pages} onClick={() => setPage((x) => x + 1)} data-testid="catalog-next">Next →</button>
          </div>
        </>
      )}
      {sel.size ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur" data-testid="catalog-bulk">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="text-sm text-slate-700"><b>{sel.size}</b> selected</span>
            <button type="button" className={btn} onClick={() => setSel(new Set())}>Clear</button>
            <select className={`${inputClass} ml-auto w-auto`} value="" disabled={busy} onChange={(e) => e.target.value && bulk(e.target.value)} aria-label="Bulk action" data-testid="catalog-bulk-action">
              <option value="">Change selected…</option>
              {ACTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ on, onClick, children, dark, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; dark?: boolean; testId?: string }) {
  return <button type="button" onClick={onClick} data-testid={testId} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm ${on ? (dark ? "bg-slate-900 text-white" : "bg-blue-600 text-white") : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{children}</button>;
}
function Thumb({ p }: { p: any }) {
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {p.photoUrl ? <img src={apiUrl(p.photoUrl)} alt="" loading="lazy" className="h-full w-full object-cover" /> : p.manufacturerPhotoUrl ? <ManufacturerImage url={p.manufacturerPhotoUrl} w={120} className="h-full w-full object-contain" /> : null}
      {!p.photoUrl && p.manufacturerPhotoUrl ? <span className="absolute inset-x-0 bottom-0 bg-white/85 text-center text-[9px] font-bold text-amber-700">Admin preview</span> : null}
    </div>
  );
}
function StageBadge({ p }: { p: any }) {
  const st = STAGE[p.readiness?.stage] || STAGE.incomplete;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.tone}`} title={(p.readiness?.blockers || []).join("\n")}>{st.label}</span>;
}
function Price({ p }: { p: any }) {
  return (
    <div className="w-24 shrink-0 text-right">
      <div className="text-sm font-semibold text-slate-900">{p.unitSku ? <span className="text-slate-400">incl.</span> : p.pricing.priceCents == null ? <span className="text-amber-600">No price</span> : money(p.pricing.priceCents)}</div>
      {p.listPriceCents != null ? <div className="text-[10px] text-slate-400">list {money(p.listPriceCents)}</div> : null}
    </div>
  );
}
