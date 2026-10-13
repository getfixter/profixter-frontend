"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminManufacturers, apiUrl, money } from "@/lib/studio/api";
import { inputClass } from "./StudioAdmin";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const lab = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";
const btn = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50";
const primary = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const AVAIL: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-emerald-50 text-emerald-700" },
  "special-order": { label: "Special order", tone: "bg-violet-50 text-violet-700" },
  discontinued: { label: "Discontinued", tone: "bg-red-50 text-red-700" },
  unlisted: { label: "No longer listed", tone: "bg-amber-50 text-amber-800" },
};
const MEDIA_LABEL: Record<string, string> = { photo: "Photo", drawing: "Technical drawing", installGuide: "Installation guide", cad: "CAD file", model3d: "3D model", video: "Video" };

/**
 * A manufacturer image, loaded from the manufacturer's own site for the owner
 * to evaluate (never copied, never shown to customers). Cloudinary links are
 * shrunk by the manufacturer's CDN to a small, modern-format thumbnail.
 */
export function thumb(url: string | null | undefined, w = 480) {
  if (!url) return "";
  return url.replace(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/, `$1c_limit,w_${w},f_auto,q_auto/`);
}
export function ManufacturerImage({ url, w = 480, className = "", alt = "" }: { url: string; w?: number; className?: string; alt?: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div className={`grid place-items-center bg-slate-100 text-center text-[11px] text-slate-400 ${className}`}>Image unavailable</div>;
  return <img src={thumb(url, w)} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={className} onError={() => setBad(true)} />;
}

const inches = (v: any) => (v == null ? "" : `${Number(v)}″`);
function sizeOf(d: any) {
  if (!d) return "";
  const parts = [d.lengthIn, d.widthIn, d.heightIn].filter((x) => x != null && x > 0.5);
  return parts.length ? parts.map((x) => inches(x)).join(" × ") : "";
}
const fileSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/** Admin -> Studio Catalog -> Manufacturers. */
export default function StudioManufacturersAdmin({ onOpenProduct, onOpenCatalog }: { onOpenProduct?: (sku: string) => void; onOpenCatalog?: (manufacturer: string) => void }) {
  const [list, setList] = useState<any[] | null>(null);
  const [key, setKey] = useState<string>("swan");
  const [view, setView] = useState<"browse" | "import" | "colors" | "rights">("browse");
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => adminManufacturers.list().then((r) => setList(r.manufacturers)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const m = list?.find((x) => x.key === key);

  if (err) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>;
  if (!list || !m) return <p className="text-slate-500">Loading…</p>;
  const empty = m.counts.variants === 0;
  return (
    <div className="space-y-4" data-testid="manufacturers">
      <div className={card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {list.length > 1 ? (
                <select className={`${inputClass} w-auto`} value={key} onChange={(e) => setKey(e.target.value)}>{list.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
              ) : <h3 className="text-xl font-bold text-slate-900">{m.name}</h3>}
              <span className="text-sm text-slate-500">{m.company}</span>
              <RightsBadge status={m.imageRights.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {empty ? "No price file imported yet." : <>{m.counts.variants.toLocaleString()} variants · {m.counts.groups.reduce((s: number, g: any) => s + g.series, 0)} series · {m.counts.inStudio} in your Studio catalog</>}
              {m.lastImport ? <> · last import {new Date(m.lastImport.appliedAt).toLocaleDateString()} ({m.lastImport.fileName})</> : null}
            </p>
            <p className="mt-1 text-xs text-slate-500">Private: nothing here is visible to customers. Products you add become drafts with no price.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["browse", "import", "colors", "rights"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${view === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} data-testid={`mfr-tab-${v}`}>
                {v === "browse" ? "Products" : v === "import" ? "Import price file" : v === "colors" ? "Colors & textures" : "Image rights & links"}
              </button>
            ))}
          </div>
        </div>
        {m.pendingImport?.status === "previewed" && view !== "import" ? (
          <button type="button" className="mt-3 w-full rounded-xl bg-amber-50 px-4 py-2 text-left text-sm text-amber-900" onClick={() => setView("import")}>A price file preview is waiting for your confirmation ({m.pendingImport.fileName}). Review it →</button>
        ) : null}
      </div>
      {view === "browse" ? (empty ? <EmptyState onImport={() => setView("import")} /> : <Browse mkey={key} name={m.name} groups={m.counts.groups} onOpenProduct={onOpenProduct} onOpenCatalog={onOpenCatalog} onChanged={load} />) : null}
      {view === "import" ? <ImportPanel mkey={key} m={m} onDone={load} /> : null}
      {view === "colors" ? <ColorsPanel mkey={key} /> : null}
      {view === "rights" ? <RightsPanel mkey={key} m={m} onChanged={load} /> : null}
    </div>
  );
}

function RightsBadge({ status }: { status: string }) {
  const s = status === "approved" ? ["Image rights confirmed", "bg-emerald-100 text-emerald-700"] : status === "denied" ? ["Images not permitted", "bg-red-100 text-red-700"] : ["Image rights unconfirmed", "bg-amber-100 text-amber-800"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s[1]}`}>{s[0]}</span>;
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className={`${card} text-center`}>
      <p className="text-slate-700">Import the manufacturer&rsquo;s price file to browse its products here.</p>
      <button type="button" className={`${primary} mt-3`} onClick={onImport}>Import price file</button>
    </div>
  );
}

// ===================================================================== browse
function Browse({ mkey, name, groups, onOpenProduct, onOpenCatalog, onChanged }: { mkey: string; name: string; groups: any[]; onOpenProduct?: (sku: string) => void; onOpenCatalog?: (m: string) => void; onChanged: () => void }) {
  const [group, setGroup] = useState<string>(groups[0]?.key || "walls");
  const [bulk, setBulk] = useState(false);
  const [designer, setDesigner] = useState("");
  const [q, setQ] = useState("");
  const [availability, setAvailability] = useState("current");
  const [series, setSeries] = useState<any[] | null>(null);
  const [openSeries, setOpenSeries] = useState<any>(null);
  const [searchItems, setSearchItems] = useState<any[] | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      if (q.trim()) {
        const r = await adminManufacturers.items(mkey, { q: q.trim(), availability, per: "120", ...(designer ? { designer } : {}) });
        if (live) { setSearchItems(r.items); }
      } else {
        setSearchItems(null);
        const r = await adminManufacturers.series(mkey, { group, availability });
        if (live) setSeries(r.series);
      }
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [mkey, group, q, availability, designer]);

  if (bulk) return <BulkAdd mkey={mkey} name={name} onClose={() => { setBulk(false); onChanged(); }} onOpenCatalog={onOpenCatalog} />;
  if (detail) return <VariantDetail mkey={mkey} part={detail} onBack={() => setDetail(null)} onPick={setDetail} onOpenProduct={onOpenProduct} onChanged={onChanged} />;
  if (openSeries && !q.trim()) return <SeriesView mkey={mkey} series={openSeries} availability={availability} designer={designer} onBack={() => setOpenSeries(null)} onDetail={setDetail} onChanged={onChanged} />;
  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-col gap-3 border-blue-200 bg-gradient-to-r from-blue-50 to-white sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <div className="font-bold text-slate-900">Bring {name} into your Studio</div>
          <p className="text-sm text-slate-600">Add one product from its page, or every product the designer can draw at once. Everything arrives as a private draft with no selling price.</p>
        </div>
        <button type="button" className={`${primary} shrink-0 px-5 py-3`} onClick={() => setBulk(true)} data-testid="mfr-bulk-open">Add eligible products to Studio</button>
      </div>
      <div className={`${card} space-y-3`}>
        <input className={inputClass} placeholder="Search by model or part number (e.g. MTMK72-3450, SR-3260) or name" value={q} onChange={(e) => setQ(e.target.value)} data-testid="mfr-search" />
        <div className="flex flex-wrap items-center gap-2">
          {!q.trim() ? groups.map((g) => (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${group === g.key ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`} data-testid={`mfr-group-${g.key}`}>
              {g.label} <span className="opacity-70">{g.variants.toLocaleString()}</span>
            </button>
          )) : <span className="text-sm text-slate-500">Searching all categories</span>}
          <select className={`${inputClass} ml-auto w-auto py-1.5 text-sm`} value={availability} onChange={(e) => setAvailability(e.target.value)} aria-label="Availability">
            <option value="current">Available (active & special order)</option>
            <option value="active">Active only</option>
            <option value="special-order">Special order only</option>
            <option value="discontinued">Discontinued</option>
            <option value="unlisted">No longer listed</option>
            <option value="all">Everything</option>
          </select>
          <select className={`${inputClass} w-auto py-1.5 text-sm`} value={designer} onChange={(e) => setDesigner(e.target.value)} aria-label="Designer support" data-testid="mfr-designer-filter">
            <option value="">Drawable or not</option>
            <option value="supported">Drawable in the designer</option>
            <option value="unsupported">Catalog only (not drawable)</option>
          </select>
        </div>
      </div>
      {searchItems ? (
        <ItemList items={searchItems} onDetail={setDetail} mkey={mkey} onChanged={onChanged} />
      ) : !series ? <p className="text-slate-500">Loading…</p> : series.length === 0 ? <div className={`${card} text-center text-slate-500`}>Nothing here.</div> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {series.map((s) => (
            <button key={s.key} type="button" onClick={() => setOpenSeries(s)} className={`${card} flex gap-3 text-left transition hover:border-blue-300`} data-testid="mfr-series">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-50">{s.photoUrl ? <ManufacturerImage url={s.photoUrl} w={200} className="h-full w-full object-contain" /> : null}</div>
              <div className="min-w-0">
                <div className="line-clamp-2 font-bold leading-snug text-slate-900">{s.name}</div>
                <div className="mt-1 text-xs text-slate-500">{s.models} {s.models === 1 ? "size/model" : "sizes/models"} · {s.colors.length || 1} {s.colors.length === 1 ? "color" : "colors"} · {s.variants} variants</div>
                <div className="mt-1 text-xs text-slate-500">List {money(s.priceMinCents)}{s.priceMaxCents !== s.priceMinCents ? ` – ${money(s.priceMaxCents)}` : ""}{s.inStudio ? <span className="ml-1 font-bold text-blue-700">· {s.inStudio} in Studio</span> : null}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One series: its models (sizes / drain sides) with their colors as selectable chips. */
function SeriesView({ mkey, series, availability, designer, onBack, onDetail, onChanged }: { mkey: string; series: any; availability: string; designer: string; onBack: () => void; onDetail: (p: string) => void; onChanged: () => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const reload = useCallback(() => adminManufacturers.items(mkey, { series: series.key, availability, per: "200", ...(designer ? { designer } : {}) }).then((r) => setItems(r.items)), [mkey, series.key, availability, designer]);
  useEffect(() => { reload(); }, [reload]);
  return (
    <div className="space-y-3">
      <div className={card}>
        <button type="button" className="text-sm font-bold text-blue-600" onClick={onBack}>← All series</button>
        <h3 className="mt-1 text-lg font-bold text-slate-900">{series.name}</h3>
        <p className="text-sm text-slate-500">{series.models} sizes/models · {series.variants} variants · list {money(series.priceMinCents)}{series.priceMaxCents !== series.priceMinCents ? ` – ${money(series.priceMaxCents)}` : ""}</p>
      </div>
      {!items ? <p className="text-slate-500">Loading…</p> : <ItemList items={items} onDetail={onDetail} mkey={mkey} onChanged={() => { reload(); onChanged(); }} grouped />}
    </div>
  );
}

/** Variants grouped by model; pick colors and add them to the Studio as drafts. */
function ItemList({ items, onDetail, mkey, onChanged, grouped = true }: { items: any[]; onDetail: (p: string) => void; mkey: string; onChanged: () => void; grouped?: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const models = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const it of items) { const k = grouped ? it.baseModel : it.partNumber; if (!m.has(k)) m.set(k, []); m.get(k)!.push(it); }
    return [...m.values()];
  }, [items, grouped]);
  const toggle = (p: string) => setSel((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  async function add(parts: string[] = [...sel]) {
    setBusy(true); setResult(null);
    try { const r = await adminManufacturers.addToStudio(mkey, parts); setResult(r); setSel(new Set()); onChanged(); }
    catch (e: any) { setResult({ error: e.message }); } finally { setBusy(false); }
  }
  const sellable = (it: any) => it.availability === "active" || it.availability === "special-order";
  return (
    <div className="space-y-3 pb-20">
      {result ? (
        <div className={`rounded-xl px-4 py-3 text-sm ${result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-900"}`} role="status" data-testid="mfr-add-result">
          {result.error || <>Added {result.added.length} {result.added.length === 1 ? "product" : "products"} to your Studio catalog as <b>drafts with no price</b>. Set your material cost and selling price in Products.{result.skipped.length ? <ul className="mt-1 text-amber-900">{result.skipped.map((s: any) => <li key={s.partNumber}>{s.partNumber}: {s.reason}</li>)}</ul> : null}</>}
        </div>
      ) : null}
      {models.map((variants) => {
        const v0 = variants[0];
        const drawable = v0.designer.supported;
        return (
          <div key={v0.baseModel + v0.partNumber} className={`${card} p-3 sm:p-4`} data-testid="mfr-model">
            <div className="flex gap-3">
              <button type="button" className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-50" onClick={() => onDetail(v0.partNumber)} aria-label="Details">
                {v0.photoUrl ? <ManufacturerImage url={v0.photoUrl} w={200} className="h-full w-full object-contain" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" className="text-left" onClick={() => onDetail(v0.partNumber)}>
                  <div className="font-bold text-slate-900">{v0.modelNumber} <span className="font-normal text-slate-500">{sizeOf(v0.dims)}{v0.configuration ? ` · ${v0.configuration} drain` : ""}</span></div>
                  <div className="line-clamp-1 text-xs text-slate-500">{v0.seriesName}</div>
                </button>
                {(() => {
                  const open = variants.filter((it) => drawable && !it.studioSku && sellable(it));
                  return open.length ? (
                    <button type="button" className={`${btn} float-right ml-2 border-blue-300 text-blue-700`} disabled={busy} onClick={() => add(open.map((it) => it.partNumber))} data-testid="mfr-model-add">
                      {open.length === 1 ? "Add to Studio" : `Add all ${open.length} colors`}
                    </button>
                  ) : variants.some((it) => it.studioSku) ? <span className="float-right ml-2 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">In Studio</span> : null;
                })()}
                <div className="mt-1 text-xs">
                  {drawable ? <span className="text-emerald-700">Drawable in the designer ({v0.designer.category === "base" ? (v0.designer.type === "tub" ? "tub" : "shower base") : v0.designer.category === "wall" ? "wall kit" : v0.designer.type})</span> : <span className="text-slate-500">Catalog only: {v0.designer.reason}</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {variants.map((it) => {
                const inStudio = Boolean(it.studioSku);
                const selectable = drawable && !inStudio && sellable(it);
                const on = sel.has(it.partNumber);
                return (
                  <label key={it.partNumber} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 ${on ? "bg-blue-50 ring-blue-400" : "bg-white ring-slate-200"} ${!selectable ? "cursor-default opacity-80" : ""}`} data-testid={`mfr-variant-${it.partNumber}`}>
                    {selectable ? <input type="checkbox" checked={on} onChange={() => toggle(it.partNumber)} /> : null}
                    <span className="font-semibold text-slate-800">{it.color?.name || it.partNumber}</span>
                    <span className="text-slate-500">{money(it.listPriceCents)}</span>
                    {inStudio ? <span className="rounded-full bg-blue-100 px-2 text-[11px] font-bold text-blue-700">In Studio</span> : null}
                    {it.availability !== "active" ? <span className={`rounded-full px-2 text-[11px] font-bold ${AVAIL[it.availability]?.tone}`}>{AVAIL[it.availability]?.label}</span> : null}
                    {it.programs?.includes("express") ? <span className="rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">SwanXpress</span> : null}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      {sel.size ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="text-sm text-slate-700"><b>{sel.size}</b> selected</span>
            <button type="button" className={btn} onClick={() => setSel(new Set())}>Clear</button>
            <button type="button" className={`${primary} ml-auto`} disabled={busy} onClick={() => add()} data-testid="mfr-add">{busy ? "Adding…" : "Add to Studio as drafts"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "Add eligible products to Studio": preview per category, choose, confirm, follow progress. */
function BulkAdd({ mkey, name, onClose, onOpenCatalog }: { mkey: string; name: string; onClose: () => void; onOpenCatalog?: (m: string) => void }) {
  const [pv, setPv] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadAll = useCallback(async () => {
    try {
      const [p, j] = await Promise.all([adminManufacturers.eligible(mkey), adminManufacturers.bulkJobs(mkey)]);
      setPv(p); setJobs(j.jobs);
      setChosen((c) => (c.size ? c : new Set(p.groups.filter((g: any) => g.new > 0).map((g: any) => g.key))));
    } catch (e: any) { setErr(e.message); }
  }, [mkey]);
  useEffect(() => { loadAll(); }, [loadAll]);
  const running = jobs.find((j) => j.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(loadAll, 1500);
    return () => clearInterval(t);
  }, [running, loadAll]);
  async function start(groups: string[]) {
    const n = (pv?.groups || []).filter((g: any) => groups.includes(g.key)).reduce((s: number, g: any) => s + g.new, 0);
    if (!window.confirm(`Add ${n.toLocaleString()} ${name} products to your Studio as PRIVATE DRAFTS?\n\nNo selling prices are set, nothing is published, and ${name} images stay Admin previews.`)) return;
    setBusy(true); setErr(null);
    try { await adminManufacturers.startBulkAdd(mkey, groups); await loadAll(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const last = jobs[0];
  const sel = (pv?.groups || []).filter((g: any) => chosen.has(g.key));
  const count = sel.reduce((s: number, g: any) => s + g.new, 0);
  return (
    <div className="space-y-4" data-testid="mfr-bulk">
      <div className={card}>
        <button type="button" className="text-sm font-bold text-blue-600" onClick={onClose}>← Back to the library</button>
        <h3 className="mt-1 text-xl font-bold text-slate-900">Add eligible {name} products to Studio</h3>
        <p className="mt-1 text-sm text-slate-600">Every product the designer can draw and {name} still sells. They arrive as <b>private drafts</b>: no selling price, compatibility unverified, {name} images visible to you only. Nothing reaches customers until you set prices, add photos you may use, review and publish each one.</p>
      </div>
      {err ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{err}</p> : null}
      {running ? (
        <div className={card} data-testid="mfr-bulk-progress">
          <div className="font-bold text-slate-900">Adding products… {running.processed.toLocaleString()} of {running.total.toLocaleString()}</div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${running.total ? Math.round((running.processed / running.total) * 100) : 100}%` }} /></div>
          <p className="mt-2 text-xs text-slate-500">You can leave this page; it keeps going. If it stops, start it again: products already added are skipped.</p>
        </div>
      ) : last && last.status !== "running" ? (
        <div className={`rounded-xl px-4 py-3 text-sm ${last.status === "done" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} role="status" data-testid="mfr-bulk-result">
          {last.status === "done" ? <>Last run ({new Date(last.finishedAt || last.updatedAt).toLocaleString()}): <b>{last.added.toLocaleString()} products added</b>{last.companions ? ` (incl. walls of ${last.companions} one-piece units)` : ""}{last.skipped ? `, ${last.skipped} skipped` : ""} in {Math.round((last.durationMs || 0) / 100) / 10}s.</> : <>Last run {last.status}: {last.error || ""} <button type="button" className="font-bold underline" onClick={() => start(last.groups)}>Continue</button></>}
          {last.status === "done" && onOpenCatalog ? <button type="button" className="ml-2 font-bold underline" onClick={() => onOpenCatalog(mkey)}>Review them in Products</button> : null}
        </div>
      ) : null}
      {!pv ? <p className="text-slate-500">Checking the catalog…</p> : (
        <div className={card}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Eligible", pv.totals.eligible], ["New to add", pv.totals.new], ["Already in Studio", pv.totals.alreadyInStudio], ["Stay in the library", pv.totals.unsupported + pv.totals.notSold]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase text-slate-500">{l}</div><div className="text-xl font-bold text-slate-900">{Number(v).toLocaleString()}</div></div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="py-1 pr-2" /><th className="py-1 pr-2">Category</th><th className="py-1 pr-2 text-right">New</th><th className="py-1 pr-2 text-right">In Studio</th><th className="py-1 pr-2 text-right">Not drawable</th><th className="py-1 pr-2 text-right">Missing specs</th><th className="py-1 text-right">No usable photo link</th></tr></thead>
              <tbody>
                {pv.groups.map((g: any) => (
                  <tr key={g.key} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-2">{g.new ? <input type="checkbox" aria-label={`Add ${g.label}`} checked={chosen.has(g.key)} onChange={(e) => setChosen((c) => { const n = new Set(c); if (e.target.checked) n.add(g.key); else n.delete(g.key); return n; })} data-testid={`mfr-bulk-group-${g.key}`} /> : null}</td>
                    <td className="py-2 pr-2">
                      <div className="font-semibold text-slate-800">{g.label}</div>
                      {g.unsupported ? <details className="text-xs text-slate-500"><summary className="cursor-pointer">Why {g.unsupported} stay in the library</summary><ul className="mt-1 list-disc pl-4">{Object.entries(g.unsupportedReasons).map(([r, n]) => <li key={r}>{n as number}: {r}</li>)}</ul></details> : null}
                      {g.units ? <div className="text-xs text-slate-500">{g.units} one-piece units (their walls are added with them)</div> : null}
                      {g.specialOrder ? <div className="text-xs text-violet-700">{g.specialOrder} special order</div> : null}
                    </td>
                    <td className="py-2 pr-2 text-right font-bold">{g.new.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right">{g.alreadyInStudio.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right">{(g.unsupported + g.notSold).toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right">{g.missingSpecs.toLocaleString()}</td>
                    <td className="py-2 text-right">{g.noPhoto.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            <li>Compatibility: every new product starts <b>unverified</b>; wall kits use an assumed trim-to-fit range. The editor shows what each one fits.</li>
            <li>Missing specs: something the drawing needs is not in the price file (e.g. threshold width, rim height, pattern size); the preview uses an estimate and asks you to check it.</li>
            <li>{pv.linkChecked ? "Photo links as of the last link check." : "Photo links not checked yet (Image rights & links → Check links)."} Image rights: {pv.imageRights === "approved" ? "confirmed" : "unconfirmed - images stay Admin previews"}.</li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className={`${primary} px-5 py-3`} disabled={busy || Boolean(running) || !count} onClick={() => start([...chosen])} data-testid="mfr-bulk-start">{running ? "Adding…" : count ? `Add ${count.toLocaleString()} products as private drafts` : "Nothing new to add"}</button>
            <span className="text-xs text-slate-500">Safe to repeat: products already in the Studio are never duplicated, and your prices are never changed.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantDetail({ mkey, part, onBack, onPick, onOpenProduct, onChanged }: { mkey: string; part: string; onBack: () => void; onPick?: (part: string) => void; onOpenProduct?: (sku: string) => void; onChanged: () => void }) {
  const [d, setD] = useState<any>(null);
  const [big, setBig] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => adminManufacturers.item(mkey, part).then(setD).catch((e) => setMsg(e.message)), [mkey, part]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="text-slate-500">{msg || "Loading…"}</p>;
  const it = d.item;
  const photos = it.media.filter((m: any) => m.kind === "photo");
  const docs = it.media.filter((m: any) => m.kind !== "photo");
  const canAdd = d.designer.supported && !d.product && (it.availability === "active" || it.availability === "special-order");
  async function addThis() {
    setAdding(true); setMsg(null);
    try {
      const r = await adminManufacturers.addToStudio(mkey, [it.partNumber]);
      onChanged();
      if (r.added.length && onOpenProduct) return onOpenProduct(r.added[0].sku);
      setMsg(r.added.length ? "Added to your Studio catalog as a private draft." : r.skipped[0]?.reason || null);
      load();
    } catch (e: any) { setMsg(e.message); } finally { setAdding(false); }
  }
  return (
    <div className="space-y-4" data-testid="mfr-detail">
      <div className={card}>
        <button type="button" className="text-sm font-bold text-blue-600" onClick={onBack}>← Back</button>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{it.name}</h3>
            <p className="text-sm text-slate-500">Part {it.partNumber} · model {it.modelNumber}{it.upc ? ` · UPC ${it.upc}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-0.5 font-bold ${AVAIL[it.availability]?.tone}`}>{AVAIL[it.availability]?.label}{it.discontinuedAt ? ` ${it.discontinuedAt}` : ""}</span>
              {it.programs?.includes("express") ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-600">SwanXpress</span> : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase text-slate-500">Manufacturer list price</div>
            <div className="text-2xl font-bold text-slate-900">{money(it.listPriceCents)}</div>
            <div className="text-xs text-slate-500">{it.listPriceEffective ? `effective ${it.listPriceEffective} · ` : ""}not your cost</div>
          </div>
        </div>
        <div className="mt-4" data-testid="mfr-detail-action">
          {d.product ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center">
              <div className="text-sm text-emerald-900">
                <div className="font-bold">✓ Already in Studio</div>
                <div>{d.product.status === "published" ? "Published" : d.product.status === "archived" ? "Archived" : "Private draft"} · your price {d.product.priceCents == null ? "not set" : money(d.product.priceCents)} · cost {d.product.costCents == null ? "not set" : money(d.product.costCents)}</div>
              </div>
              {onOpenProduct ? <button type="button" className={`${primary} sm:ml-auto`} onClick={() => onOpenProduct(it.studioSku)} data-testid="mfr-detail-open">Open in editor</button> : null}
            </div>
          ) : canAdd ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-blue-50 px-4 py-3 sm:flex-row sm:items-center">
              <p className="text-sm text-blue-900">Creates a <b>private draft</b> with {it.modelNumber}&rsquo;s specifications, size and color. No selling price is set. The editor opens next.</p>
              <button type="button" className={`${primary} px-6 py-3 text-base sm:ml-auto`} disabled={adding} onClick={addThis} data-testid="mfr-detail-add">{adding ? "Adding…" : "Add to Studio"}</button>
            </div>
          ) : !d.designer.supported ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="mfr-detail-unsupported">
              <b>Not available in the designer.</b> {d.designer.reason} It stays in the Manufacturer Library with its specifications and list price.
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700"><b>Can&rsquo;t be added:</b> the manufacturer lists it as {AVAIL[it.availability]?.label.toLowerCase()}.</div>
          )}
        </div>
        {msg ? <p className="mt-2 text-sm text-slate-700" role="status">{msg}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className={card}>
          <h4 className="font-bold text-slate-900">Manufacturer images</h4>
          <p className="mb-3 text-xs text-slate-500">Previews loaded from {mkey === "swan" ? "Swan" : "the manufacturer"}&rsquo;s site for your evaluation. {d.imageRights.status === "approved" ? "Image rights confirmed: you can use them on Studio products." : "Not shown to customers until you confirm image rights."}</p>
          {photos.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p: any) => (
                <button key={p.url} type="button" className="relative aspect-square overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100" onClick={() => setBig(p.url)}>
                  <ManufacturerImage url={p.url} w={400} className="h-full w-full object-contain" />
                  {p.check ? <span className={`absolute left-1 top-1 rounded px-1.5 text-[10px] font-bold ${p.check.status === "ok" ? "bg-emerald-100 text-emerald-700" : p.check.status === "broken" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{p.check.status === "ok" ? "Link OK" : p.check.status === "broken" ? `Broken ${p.check.httpStatus || ""}` : "Unreachable"}</span> : null}
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">No images in the price file.</p>}
          {big ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setBig(null)}>
              <ManufacturerImage url={big} w={1400} className="max-h-[85vh] max-w-full rounded-xl bg-white object-contain" />
            </div>
          ) : null}
          <h4 className="mt-5 font-bold text-slate-900">Documents</h4>
          {docs.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {docs.map((x: any) => (
                <li key={x.url} className="flex flex-wrap items-center gap-2">
                  <a href={x.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="font-semibold text-blue-700 underline">{MEDIA_LABEL[x.kind] || x.kind}</a>
                  <span className="text-xs text-slate-400">{x.url.split("/").pop()?.split("?")[0]}</span>
                  {x.check && x.check.status !== "ok" ? <span className="text-xs font-bold text-red-600">{x.check.status === "broken" ? `broken (${x.check.httpStatus || "?"})` : "unreachable"}</span> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">None.</p>}
        </div>

        <div className="space-y-4">
          <div className={card}>
            <h4 className="font-bold text-slate-900">In the designer</h4>
            {d.designer.supported ? (
              <>
                <p className="mt-1 text-sm text-emerald-700">Drawn as {d.designer.category === "base" ? (d.designer.type === "tub" ? "a tub" : "a shower base") : d.designer.category === "wall" ? "a wall kit" : `a ${d.designer.type}`}{d.designer.unit ? " with its integral walls" : ""}, from the manufacturer&rsquo;s dimensions.</p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">Approximations (shown as illustrative)</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">{d.designer.approximations.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
                <p className="mt-2 text-xs text-slate-500">Compatibility with other products is not in the price file: it starts as <b>unverified</b> and needs your review before publishing.</p>
              </>
            ) : <p className="mt-1 text-sm text-slate-600">{d.designer.reason}</p>}
          </div>
          <div className={card}>
            <h4 className="font-bold text-slate-900">Specifications <span className="text-xs font-normal text-slate-400">from the price file</span></h4>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {[
                ["Size (L × W × H)", sizeOf(it.dims)], ["Threshold", inches(it.dims?.thresholdWidthIn)], ["Color", it.color?.name], ["Material", it.material], ["Surface", it.surface],
                ["Installation", it.installationType], ["Drain", it.configuration], ["Shape", it.shape], ["Pieces", it.pieces], ["Accessibility", it.accessibility], ["Code", it.codeCompliancy], ["Warranty", it.warranty],
              ].filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => <Fragment key={String(k)}><dt className="text-slate-500">{k}</dt><dd className="text-slate-900">{String(v)}</dd></Fragment>)}
            </dl>
            {it.features?.length ? <p className="mt-2 text-sm text-slate-600">{it.features.join(" · ")}</p> : null}
          </div>
          <div className={card}>
            <h4 className="font-bold text-slate-900">Other colors of this model</h4>
            <div className="mt-2 flex flex-wrap gap-2">{d.variants.map((v: any) => <button type="button" key={v.partNumber} disabled={v.partNumber === it.partNumber} onClick={() => onPick?.(v.partNumber)} data-testid={`mfr-detail-variant-${v.partNumber}`} className={`min-h-[36px] rounded-lg px-2 py-1 text-xs ring-1 ${v.partNumber === it.partNumber ? "bg-blue-50 font-bold ring-blue-300" : "ring-slate-200 hover:ring-blue-300"}`}>{v.color?.name || v.partNumber} · {money(v.listPriceCents)}{v.inStudio ? " · in Studio" : ""}</button>)}</div>
            {it.priceHistory?.length > 1 ? (
              <>
                <h4 className="mt-4 font-bold text-slate-900">List price history</h4>
                <ul className="mt-1 text-sm text-slate-600">{it.priceHistory.map((h: any, i: number) => <li key={i}>{money(h.cents)}{h.effective ? ` (effective ${h.effective})` : ""}</li>)}</ul>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================== import
function ImportPanel({ mkey, m, onDone }: { mkey: string; m: any; onDone: () => void }) {
  const [imp, setImp] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scope, setScope] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const loadHistory = useCallback(() => adminManufacturers.imports(mkey).then((r) => setHistory(r.imports)).catch(() => {}), [mkey]);
  useEffect(() => {
    loadHistory();
    if (m.pendingImport) adminManufacturers.importDetail(mkey, m.pendingImport.id).then((r) => setImp(r.import)).catch(() => {});
  }, [mkey, m.pendingImport, loadHistory]);
  useEffect(() => { if (imp?.summary?.byGroup) setScope(new Set(imp.summary.byGroup.map((g: any) => g.key))); }, [imp?.id, imp?.summary?.byGroup]);
  useEffect(() => {
    if (imp?.status !== "applying") return;
    const t = setInterval(async () => { const r = await adminManufacturers.importDetail(mkey, imp.id); if (r.import.status !== "applying") { setImp(r.import); loadHistory(); onDone(); } }, 1500);
    return () => clearInterval(t);
  }, [imp?.status, imp?.id, mkey, loadHistory, onDone]);

  async function preview(file?: File) {
    if (!file) return;
    setBusy(true); setErr(null); setImp(null);
    try { const r = await adminManufacturers.preview(mkey, file); setImp(r.import); loadHistory(); onDone(); }
    catch (e: any) { setErr(e.message); loadHistory(); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function apply() {
    const all = imp.summary.byGroup.length === scope.size;
    const n = imp.summary.byGroup.filter((g: any) => scope.has(g.key)).reduce((s: number, g: any) => s + g.variants, 0);
    if (!window.confirm(`Import ${n.toLocaleString()} ${m.name} variants into the private manufacturer catalog?\n\nNothing is published and no prices are set. Your Studio products keep your prices.`)) return;
    setBusy(true); setErr(null);
    try { const r = await adminManufacturers.apply(mkey, imp.id, all ? null : [...scope]); setImp(r.import); if (r.import.status !== "applying") { loadHistory(); onDone(); } }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  const s = imp?.summary;
  return (
    <div className="space-y-4" data-testid="mfr-import">
      <div className={card}>
        <h4 className="font-bold text-slate-900">Import a price file</h4>
        <p className="mt-1 text-sm text-slate-600">{m.fileHelp} Upload the file; you will see what changes before anything is imported. Your prices, costs and published products are never changed by an import.</p>
        <label className={`${primary} mt-3 inline-flex cursor-pointer items-center`}>
          {busy && !imp ? "Reading the file…" : "Choose .xlsx file"}
          <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => preview(e.target.files?.[0])} disabled={busy} data-testid="mfr-file" />
        </label>
        {err ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{err}</p> : null}
      </div>

      {imp ? (
        <div className={card} data-testid="mfr-preview">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-slate-900">{imp.status === "applied" ? "Imported" : imp.status === "applying" ? "Importing…" : imp.status === "failed" ? "This file cannot be imported" : "Preview"} · {imp.fileName} <span className="font-normal text-slate-400">({fileSize(imp.fileBytes)})</span></h4>
            {s?.sameAsLastApplied ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">Same file as the last import</span> : null}
          </div>
          {imp.error ? <p className="mt-2 text-sm text-red-700">{imp.error}</p> : null}
          {s?.variants ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Variants", s.variants], ["New", s.new], ["Changed", s.changed], ["Unchanged", s.unchanged], ["List price changes", s.priceChanged], ["To mark discontinued", s.toDiscontinue], ["No longer listed", s.toUnlist], ["Your Studio products affected", s.studioProductsAffected]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase text-slate-500">{l}</div><div className="text-xl font-bold text-slate-900">{Number(v).toLocaleString()}</div></div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{s.models} models in {s.series} series · {s.byAvailability?.["special-order"] || 0} special order · {s.express} SwanXpress · {s.discontinuedListed.toLocaleString()} part numbers listed as discontinued in the file.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1 pr-2">{imp.status === "previewed" ? "Import" : ""}</th><th className="py-1 pr-2">Category</th><th className="py-1 pr-2 text-right">Variants</th><th className="py-1 pr-2 text-right">New</th><th className="py-1 text-right">Changed</th></tr></thead>
                  <tbody>
                    {s.byGroup.map((g: any) => (
                      <tr key={g.key} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">{imp.status === "previewed" ? <input type="checkbox" checked={scope.has(g.key)} onChange={(e) => setScope((x) => { const n = new Set(x); if (e.target.checked) n.add(g.key); else n.delete(g.key); return n; })} aria-label={`Import ${g.label}`} /> : null}</td>
                        <td className="py-1.5 pr-2 font-semibold text-slate-800">{g.label}</td>
                        <td className="py-1.5 pr-2 text-right">{g.variants.toLocaleString()}</td>
                        <td className="py-1.5 pr-2 text-right">{g.new.toLocaleString()}</td>
                        <td className="py-1.5 text-right">{g.changed.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Samples imp={imp} />
              {imp.issues?.length ? (
                <details className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <summary className="cursor-pointer font-bold">{imp.issues.length} notes about the file</summary>
                  <ul className="mt-2 space-y-1">{imp.issues.map((i: any, k: number) => <li key={k}>{i.level === "error" ? "⛔" : i.level === "warn" ? "⚠️" : "ℹ️"} {i.message}{i.row ? <span className="text-amber-700"> ({i.sheet} row {i.row})</span> : null}</li>)}</ul>
                </details>
              ) : null}
              {imp.status === "previewed" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className={primary} disabled={busy || !scope.size} onClick={apply} data-testid="mfr-apply">{busy ? "Starting…" : scope.size === s.byGroup.length ? "Import everything" : `Import ${scope.size} ${scope.size === 1 ? "category" : "categories"}`}</button>
                  <span className="text-xs text-slate-500">Imports into the private manufacturer catalog only. Nothing is published.</span>
                </div>
              ) : null}
              {imp.status === "applied" && imp.result ? (
                <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">Imported in {Math.round((imp.durationMs || 0) / 100) / 10}s: {imp.result.added} added, {imp.result.updated} updated, {imp.result.discontinued} marked discontinued, {imp.result.unlisted} no longer listed{imp.result.studioProductsFlagged ? `, ${imp.result.studioProductsFlagged} of your Studio products flagged for review` : ""}.</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div className={card}>
        <h4 className="font-bold text-slate-900">Import history</h4>
        {history.length ? (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${h.status === "applied" ? "bg-emerald-100 text-emerald-700" : h.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{h.status}</span>
                <span className="font-semibold text-slate-800">{h.fileName || "file"}</span>
                <span className="text-slate-500">{new Date(h.createdAt).toLocaleString()}</span>
                {h.result ? <span className="text-slate-500">· {h.result.added} added, {h.result.updated} updated{h.scope?.groups ? ` (${h.scope.groups.join(", ")})` : ""}</span> : h.summary?.variants ? <span className="text-slate-500">· {h.summary.variants.toLocaleString()} variants</span> : null}
                {h.error ? <span className="text-red-600">· {h.error}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-slate-500">No imports yet.</p>}
      </div>
    </div>
  );
}

function Samples({ imp }: { imp: any }) {
  const sm = imp.samples || {};
  const blocks: [string, any[], (x: any) => React.ReactNode][] = [
    ["List price changes", sm.priceChanged || [], (x) => <>{x.partNumber} · {money(x.from)} → <b>{money(x.to)}</b>{x.inStudio ? " · in your Studio" : ""}</>],
    ["To mark discontinued", sm.toDiscontinue || [], (x) => <>{x.partNumber} · {x.name}{x.inStudio ? " · in your Studio" : ""}</>],
    ["No longer listed", sm.toUnlist || [], (x) => <>{x.partNumber} · {x.name}{x.inStudio ? " · in your Studio" : ""}</>],
    ["Other changes", (sm.changed || []).filter((c: any) => !c.fields.includes("listPriceCents")), (x) => <>{x.partNumber} · {x.fields.join(", ")}</>],
    ["New (first 25)", sm.new || [], (x) => <>{x.partNumber} · {x.name} · {money(x.listPriceCents)}</>],
  ];
  return (
    <div className="mt-3 space-y-2">
      {blocks.filter(([, l]) => l.length).map(([title, list, row]) => (
        <details key={title} className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
          <summary className="cursor-pointer font-bold text-slate-800">{title} ({list.length}{list.length >= 25 ? "+" : ""})</summary>
          <ul className="mt-1 space-y-0.5 text-slate-600">{list.map((x: any, i: number) => <li key={i} className="truncate">{row(x)}</li>)}</ul>
        </details>
      ))}
    </div>
  );
}

// ===================================================================== colors
function ColorsPanel({ mkey }: { mkey: string }) {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const load = useCallback(() => adminManufacturers.get(mkey).then(setD).catch((e) => setMsg({ kind: "err", text: e.message })), [mkey]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="text-slate-500">Loading…</p>;
  const series = [...new Set(d.colors.map((c: any) => c.series))] as string[];
  return (
    <div className="space-y-4" data-testid="mfr-colors">
      <div className={`${card} text-sm text-slate-600`}>
        <p><b>Four different things:</b> the manufacturer&rsquo;s <b>swatch</b> (a photo of a sample, to look at), the <b>drawing color</b> the designer uses (measured from the swatch: an approximation), a <b>texture</b> (a seamless, repeatable image of the surface at real size, only if you have one), and the <b>product photo</b>. A bathroom photo is never used as a texture.</p>
        <p className="mt-2">Swan does not publish seamless textures or 3D models for its showers. Until you have them, walls are drawn with the official pattern sizes in the measured color and marked <i>illustrative</i>.</p>
      </div>
      {msg ? <p className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role="status">{msg.text}</p> : null}
      {series.map((sr) => (
        <div key={sr} className={card}>
          <h4 className="mb-3 font-bold text-slate-900">{sr}</h4>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {d.colors.filter((c: any) => c.series === sr).map((c: any) => <ColorCard key={c.code} mkey={mkey} c={c} onColors={(colors, text) => { setD({ ...d, colors }); if (text) setMsg({ kind: "ok", text }); }} onError={(text) => setMsg({ kind: "err", text })} />)}
          </div>
        </div>
      ))}
      <div className={card}>
        <h4 className="mb-1 font-bold text-slate-900">Wall patterns</h4>
        <p className="mb-3 text-xs text-slate-500">Tile sizes as published by Swan; the designer draws these sizes.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {d.patterns.map((p: any) => (
            <div key={p.code} className="rounded-xl bg-slate-50 p-3">
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-white"><ManufacturerImage url={p.manufacturerImageUrl} w={360} className="h-full w-full object-contain" /></div>
              <div className="mt-2 font-bold text-slate-900">{p.name} <span className="text-xs font-normal text-slate-400">{p.code}</span></div>
              <div className="text-xs text-slate-500">{p.pattern.type === "tile" ? `${p.pattern.tileW}″ wide × ${p.pattern.tileH}″ high, ${p.pattern.orientation}` : "No pattern"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorCard({ mkey, c, onColors, onError }: { mkey: string; c: any; onColors: (colors: any[], text?: string) => void; onError: (t: string) => void }) {
  const [hex, setHex] = useState<string>(c.ownHex || c.measuredHex || "#e8e6e1");
  const [tex, setTex] = useState({ widthIn: "24", heightIn: "24", textureSource: "" });
  const drawn = c.ownHex || c.measuredHex;
  async function up(file: File | undefined, kind: "swatch" | "texture") {
    if (!file) return;
    try {
      const r = await adminManufacturers.uploadColorAsset(mkey, c.code, file, kind === "texture" ? { kind, ...tex } : { kind });
      onColors(r.colors, kind === "texture" ? `Texture saved for ${c.name}${r.appliedToProducts ? ` and applied to ${r.appliedToProducts} wall product(s)` : ""}.` : `Swatch saved for ${c.name}.`);
    } catch (e: any) { onError(e.message); }
  }
  return (
    <div className="rounded-xl border border-slate-200 p-3" data-testid={`mfr-color-${c.code}`}>
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
          {c.swatch?.url ? <img src={apiUrl(c.swatch.url)} alt="" className="h-full w-full object-cover" /> : c.manufacturerSwatchUrl ? <ManufacturerImage url={c.manufacturerSwatchUrl} w={160} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900">{c.name} <span className="text-xs font-normal text-slate-400">{c.code}</span></div>
          <div className="text-xs text-slate-500">{c.materials.join(", ")}{c.look ? ` · ${c.look} look` : ""} · {c.variants} variants</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-4 w-4 rounded ring-1 ring-slate-300" style={{ background: drawn || "transparent" }} />
            {c.ownHex ? "Your drawing color" : c.measuredFrom === "swatch" ? "Measured from Swan's swatch (approximate)" : c.measuredFrom === "generic" ? "Generic approximation" : "No swatch: neutral placeholder"}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="color" aria-label={`Drawing color for ${c.name}`} className="h-9 w-12 rounded border border-slate-300" value={hex} onChange={(e) => setHex(e.target.value)} />
        <button type="button" className={btn} onClick={async () => { try { onColors((await adminManufacturers.setColor(mkey, c.code, hex)).colors, `Drawing color saved for ${c.name}. Products you add from now on use it.`); } catch (e: any) { onError(e.message); } }}>Use this color</button>
        {c.ownHex ? <button type="button" className="text-xs font-bold text-slate-500 underline" onClick={async () => onColors((await adminManufacturers.setColor(mkey, c.code, null)).colors)}>Reset</button> : null}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-bold text-blue-700">Swatch & texture</summary>
        <div className="mt-2 space-y-2">
          <label className={`${btn} inline-block cursor-pointer text-xs`}>Upload swatch photo<input type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0], "swatch")} /></label>
          {c.texture ? (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <img src={apiUrl(c.texture.url)} alt="" className="h-10 w-10 rounded object-cover" />
              Texture {c.texture.widthIn}″ × {c.texture.heightIn}″ · {c.texture.source === "manufacturer" ? "from the manufacturer" : "approximation for testing"}
              <button type="button" className="font-bold text-red-600" onClick={async () => onColors((await adminManufacturers.removeColorAsset(mkey, c.code, "texture")).colors)}>Remove</button>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className={lab}>Repeat width (in)<input className={inputClass} value={tex.widthIn} onChange={(e) => setTex({ ...tex, widthIn: e.target.value })} /></label>
            <label className={lab}>Repeat height (in)<input className={inputClass} value={tex.heightIn} onChange={(e) => setTex({ ...tex, heightIn: e.target.value })} /></label>
          </div>
          <select className={inputClass} value={tex.textureSource} onChange={(e) => setTex({ ...tex, textureSource: e.target.value })} aria-label="Texture source">
            <option value="">Where is this texture from?</option>
            <option value="manufacturer">Supplied by the manufacturer as a texture</option>
            <option value="approximation">My approximation, for internal testing</option>
          </select>
          <label className={`${btn} inline-block cursor-pointer text-xs ${!tex.textureSource ? "pointer-events-none opacity-50" : ""}`}>Upload seamless texture<input type="file" accept="image/*" className="hidden" disabled={!tex.textureSource} onChange={(e) => up(e.target.files?.[0], "texture")} /></label>
        </div>
      </details>
    </div>
  );
}

// ===================================================================== rights & links
function RightsPanel({ mkey, m, onChanged }: { mkey: string; m: any; onChanged: () => void }) {
  const [status, setStatus] = useState(m.imageRights.status);
  const [note, setNote] = useState(m.imageRights.note);
  const [evidenceUrl, setEvidenceUrl] = useState(m.imageRights.evidenceUrl);
  const [trim, setTrim] = useState(String(m.settings.trimAllowanceIn ?? ""));
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const lc = m.linkCheck || {};
  useEffect(() => {
    if (lc.status !== "running") return;
    const t = setInterval(onChanged, 3000);
    return () => clearInterval(t);
  }, [lc.status, onChanged]);
  async function save(body: any, text: string) {
    try { await adminManufacturers.update(mkey, body); setMsg({ kind: "ok", text }); onChanged(); } catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }
  return (
    <div className="space-y-4" data-testid="mfr-rights">
      {msg ? <p className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role="status">{msg.text}</p> : null}
      <div className={card}>
        <h4 className="font-bold text-slate-900">Image rights</h4>
        <p className="mt-1 text-sm text-slate-600">
          Product photos, swatches and drawings belong to {m.name}. Publicly visible does not mean free to reuse. Until you record the manufacturer&rsquo;s permission, their images are previews in Admin only (loaded from their site, never copied) and never appear in the public Studio.
          Ask {m.name} (your dealer rep or marketing) for written permission to use product images, swatches and drawings on profixter.com and in customer proposals.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={lab}>Status<select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="unconfirmed">Unconfirmed (Admin previews only)</option><option value="approved">Confirmed: I have permission</option><option value="denied">Not permitted</option></select></label>
          <label className={lab}>Link to the permission (optional)<input className={inputClass} value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" /></label>
          <label className={`${lab} sm:col-span-2`}>What permission do you have? (who, when, what it covers)<textarea className={`${inputClass} min-h-[70px]`} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <button type="button" className={`${primary} mt-3`} onClick={() => save({ imageRights: { status, note, evidenceUrl } }, "Image rights saved.")}>Save image rights</button>
        <p className="mt-2 text-xs text-slate-500">Only the owner can change this.</p>
      </div>
      <div className={card}>
        <h4 className="font-bold text-slate-900">Image and document links</h4>
        <p className="mt-1 text-sm text-slate-600">Checks every product image, drawing, guide and CAD link in the price file (videos excluded). Takes a few minutes.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className={btn} disabled={lc.status === "running"} onClick={async () => { try { await adminManufacturers.linkCheck(mkey); onChanged(); } catch (e: any) { setMsg({ kind: "err", text: e.message }); } }} data-testid="mfr-linkcheck">{lc.status === "running" ? "Checking…" : "Check links"}</button>
          {lc.total ? <span className="text-slate-600">{lc.status === "running" ? `${lc.checked || 0} of ${lc.total} checked · ` : `Last check ${lc.finishedAt ? new Date(lc.finishedAt).toLocaleString() : ""}: `}<b className="text-emerald-700">{lc.ok} working</b> · <b className="text-red-700">{lc.broken} broken</b> · <b className="text-amber-700">{lc.unreachable} unreachable</b></span> : <span className="text-slate-500">Not checked yet.</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">Broken = the manufacturer&rsquo;s server says the file is gone. Unreachable = no answer (the server refused the connection or timed out); may be temporary.</p>
      </div>
      <div className={card}>
        <h4 className="font-bold text-slate-900">Wall kit sizing</h4>
        <p className="mt-1 text-sm text-slate-600">Glue-up wall kits are trimmed to fit. The designer offers a kit for alcoves up to its size and down by this much (an assumption, shown on each product until you review it).</p>
        <div className="mt-3 flex items-end gap-2">
          <label className={lab}>Trim allowance (in)<input className={`${inputClass} w-28`} inputMode="decimal" value={trim} onChange={(e) => setTrim(e.target.value)} /></label>
          <button type="button" className={btn} onClick={() => save({ settings: { trimAllowanceIn: trim === "" ? null : Number(trim) } }, "Saved. Applies to products you add from now on.")}>Save</button>
        </div>
      </div>
    </div>
  );
}
