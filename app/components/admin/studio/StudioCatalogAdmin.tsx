"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { adminStudio, money } from "@/lib/studio/api";
import { inputClass } from "./StudioAdmin";
import StudioManufacturersAdmin from "./StudioManufacturersAdmin";
import StudioCatalogManager from "./StudioCatalogManager";
import ProductEditor from "./StudioProductEditor";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const lab = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";
const btn = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50";
const CATS: Record<string, string> = { wall: "Wall kits", base: "Bases & tubs", fixture: "Valve trims", enclosure: "Doors & rods", accessory: "Accessories" };

const toDollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
const toCents = (s: string) => (String(s).trim() === "" ? null : Math.round(Number(String(s).replace(/[$,]/g, "")) * 100));

/** Admin -> Studio Catalog: products, visual assets, compatibility data and every Studio price. */
export default function StudioCatalogAdmin() {
  const [tab, setTab] = useState<"products" | "manufacturers" | "pricing" | "review">("products");
  const [openSku, setOpenSku] = useState<string | null>(null);
  const [mfrFilter, setMfrFilter] = useState("");
  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Studio Catalog</h2>
          <p className="mt-1 text-sm text-slate-500">What customers can choose in the Shower Studio, how it is drawn, what fits with what, and what it costs. Changes go live on save; quoted designs keep their prices.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["products", "manufacturers", "pricing", "review"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} data-testid={`catalog-tab-${t}`}>
              {t === "products" ? "Products" : t === "manufacturers" ? "Manufacturers" : t === "pricing" ? "Prices & packages" : "Completeness"}
            </button>
          ))}
        </div>
      </div>
      {tab === "products" ? <Products openSku={openSku} onOpened={() => setOpenSku(null)} manufacturer={mfrFilter} /> : tab === "manufacturers" ? <StudioManufacturersAdmin onOpenProduct={(sku) => { setOpenSku(sku); setTab("products"); }} onOpenCatalog={(m) => { setMfrFilter(m); setTab("products"); }} /> : tab === "pricing" ? <Pricing /> : <Review />}
    </div>
  );
}

// ===================================================================== products
function Products({ openSku, onOpened, manufacturer }: { openSku?: string | null; onOpened?: () => void; manufacturer?: string }) {
  const [fields, setFields] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState<any>(null);
  const [arrange, setArrange] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => { adminStudio.fields().then((r) => setFields(r.categories)).catch(() => {}); }, []);
  useEffect(() => {
    if (!openSku) return;
    let live = true;
    adminStudio.families({ q: openSku, stage: "all" }).then((r) => {
      if (!live) return;
      const p = r.families.flatMap((x: any) => x.products).find((x: any) => x.sku === openSku);
      if (p) setEditId(p._id);
      onOpened?.();
    }).catch(() => {});
    return () => { live = false; };
  }, [openSku, onOpened]);
  const back = () => { setEditId(null); setCreating(null); setRound((x) => x + 1); };

  if (creating) return <ProductEditor initial={creating} fields={fields} onClose={back} />;
  if (editId) return <EditorById id={editId} fields={fields} onClose={back} onSwitch={setEditId} />;
  if (arrange) return <ArrangeList onEdit={setEditId} onBack={() => setArrange(false)} />;
  return (
    <StudioCatalogManager key={`${round}-${manufacturer || ""}`} initialManufacturer={manufacturer || ""} onOpen={setEditId} onArrange={() => setArrange(true)}
      onAdd={(cat) => setCreating({ category: cat, type: fields?.[cat]?.[0]?.id, engine: {}, specs: [], sources: [], pricing: { priceCents: null, installCents: 0 }, isPublic: true, visualStatus: "illustrative" })}
      onImportStarter={async () => { try { const r = await adminStudio.importStarter(); return `Added ${r.added} starter products as drafts (unpriced).`; } catch (e: any) { return e.message; } }} />
  );
}

/** Opens any product by id (from the manager, a manufacturer page or a variant switch). */
function EditorById({ id, fields, onClose, onSwitch }: { id: string; fields: any; onClose: () => void; onSwitch: (id: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let live = true; adminStudio.product(id).then((r) => live && setData(r)).catch((e) => live && setErr(e.message)); return () => { live = false; }; }, [id]);
  if (err) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>;
  if (!data || data.product._id !== id) return <p className="text-slate-500">Loading…</p>;
  return <ProductEditor key={id} initial={data.product} siblings={data.siblings || []} fields={fields} onClose={onClose} onSwitch={onSwitch} />;
}

/** The hand-ordered list per category (display order in the designer). */
function ArrangeList({ onEdit, onBack }: { onEdit: (id: string) => void; onBack: () => void }) {
  const [cat, setCat] = useState("wall");
  const [list, setList] = useState<any[] | null>(null);
  const load = useCallback(() => adminStudio.products({ category: cat, status: "published" }).then((r) => setList(r.products)).catch(() => setList([])), [cat]);
  useEffect(() => { load(); }, [load]);
  async function move(i: number, dir: -1 | 1) {
    const ids = (list || []).map((p) => p._id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await adminStudio.reorder(ids);
    load();
  }
  return (
    <div className="space-y-4">
      <div className={card}>
        <button type="button" className="text-sm font-bold text-blue-600" onClick={onBack}>← Back to all products</button>
        <h3 className="mt-1 text-lg font-bold text-slate-900">Display order</h3>
        <p className="text-sm text-slate-500">The order customers see published products in each category (featured first).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(CATS).map(([k, v]) => <button key={k} type="button" onClick={() => setCat(k)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${cat === k ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{v}</button>)}
        </div>
      </div>
      {!list ? <p className="text-slate-500">Loading…</p> : list.length === 0 ? <div className={`${card} text-center text-slate-500`}>No published products in this category.</div> : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {list.map((p, i) => (
            <div key={p._id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0">
              <div className="flex flex-col">
                <button type="button" aria-label="Move up" className="px-1 text-slate-400 hover:text-slate-800" onClick={() => move(i, -1)}>▲</button>
                <button type="button" aria-label="Move down" className="px-1 text-slate-400 hover:text-slate-800" onClick={() => move(i, 1)}>▼</button>
              </div>
              <button type="button" className="min-w-0 flex-1 truncate text-left font-semibold text-slate-900" onClick={() => onEdit(p._id)}>{p.name} {p.featured ? <span className="text-amber-500">★</span> : null}</button>
              <span className="text-sm text-slate-600">{money(p.pricing?.priceCents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================================================================== pricing
function Pricing() {
  const [pr, setPr] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  useEffect(() => { adminStudio.pricing().then((r) => setPr(r.pricing)).catch((e) => setMsg({ kind: "err", text: e.message })); adminStudio.products().then((r) => setProducts(r.products)).catch(() => {}); }, []);
  if (!pr) return <p className="text-slate-500">Loading…</p>;
  const upd = (k: string, v: any) => setPr((x: any) => ({ ...x, [k]: v }));
  async function save() {
    try { const r = await adminStudio.savePricing(pr); setPr(r.pricing); setMsg({ kind: "ok", text: "Prices saved. New estimates use them; submitted requests and proposals keep the prices they were quoted." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); }
  }
  return (
    <div className="space-y-4" data-testid="pricing-editor">
      {msg ? <p className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg.text}</p> : null}
      <div className={card}>
        <h4 className="mb-3 font-bold text-slate-900">Base price by project</h4>
        <div className="space-y-3">
          {pr.projectTypes.map((t: any, i: number) => (
            <div key={t.key} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
              <div className="grid gap-2">
                <input className={inputClass} value={t.label} onChange={(e) => upd("projectTypes", pr.projectTypes.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className={`${inputClass} text-sm`} value={t.includes} placeholder="What the base price includes (customers see this)" onChange={(e) => upd("projectTypes", pr.projectTypes.map((x: any, j: number) => (j === i ? { ...x, includes: e.target.value } : x)))} />
              </div>
              <label className={lab}>Base price ($)<input className={inputClass} inputMode="decimal" value={toDollars(t.basePriceCents)} onChange={(e) => upd("projectTypes", pr.projectTypes.map((x: any, j: number) => (j === i ? { ...x, basePriceCents: toCents(e.target.value) } : x)))} data-testid={`base-price-${t.key}`} /></label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={t.enabled !== false} onChange={(e) => upd("projectTypes", pr.projectTypes.map((x: any, j: number) => (j === i ? { ...x, enabled: e.target.checked } : x)))} /> Offered</label>
            </div>
          ))}
        </div>
      </div>
      <div className={card}>
        <h4 className="mb-1 font-bold text-slate-900">Installation adders</h4>
        <p className="mb-3 text-xs text-slate-500">Automatic ones apply when the design calls for them; manual ones are added by staff.</p>
        <div className="space-y-2">
          {pr.adders.map((a: any, i: number) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_190px_130px_auto_auto]">
              <input className={inputClass} value={a.label} onChange={(e) => upd("adders", pr.adders.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <select className={inputClass} value={a.trigger} onChange={(e) => upd("adders", pr.adders.map((x: any, j: number) => (j === i ? { ...x, trigger: e.target.value } : x)))}>
                {[["manual", "Added by staff"], ["paintAbove", "When old tile above is removed"], ["door", "With a glass door"], ["perGrabBar", "Per grab bar"], ["perSeat", "Per seat"], ["perShelf", "Per shelf"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input className={inputClass} inputMode="decimal" placeholder="$" value={toDollars(a.priceCents)} onChange={(e) => upd("adders", pr.adders.map((x: any, j: number) => (j === i ? { ...x, priceCents: toCents(e.target.value) } : x)))} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={a.enabled !== false} onChange={(e) => upd("adders", pr.adders.map((x: any, j: number) => (j === i ? { ...x, enabled: e.target.checked } : x)))} /> On</label>
              <button type="button" className="text-sm font-bold text-red-600" onClick={() => upd("adders", pr.adders.filter((_: any, j: number) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={`${btn} mt-3`} onClick={() => upd("adders", [...pr.adders, { key: `adder-${Date.now().toString(36)}`, label: "New adder", trigger: "manual", priceCents: null, enabled: true }])}>+ Adder</button>
      </div>
      <div className={card}>
        <h4 className="mb-1 font-bold text-slate-900">Packages</h4>
        <p className="mb-3 text-xs text-slate-500">When a design includes every product in a package, the package price replaces their individual prices.</p>
        <div className="space-y-4">
          {pr.packages.map((pk: any, i: number) => (
            <div key={i} className="rounded-xl bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto_auto]">
                <input className={inputClass} value={pk.name} onChange={(e) => upd("packages", pr.packages.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className={inputClass} inputMode="decimal" placeholder="Package $" value={toDollars(pk.priceCents)} onChange={(e) => upd("packages", pr.packages.map((x: any, j: number) => (j === i ? { ...x, priceCents: toCents(e.target.value) } : x)))} />
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={pk.enabled !== false} onChange={(e) => upd("packages", pr.packages.map((x: any, j: number) => (j === i ? { ...x, enabled: e.target.checked } : x)))} /> On</label>
                <button type="button" className="text-sm font-bold text-red-600" onClick={() => upd("packages", pr.packages.filter((_: any, j: number) => j !== i))}>✕</button>
              </div>
              <input className={`${inputClass} mt-2 text-sm`} placeholder="Description" value={pk.description} onChange={(e) => upd("packages", pr.packages.map((x: any, j: number) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-auto">
                {products.filter((p) => p.status !== "archived").map((p) => (
                  <label key={p.sku} className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                    <input type="checkbox" checked={pk.skus.includes(p.sku)} onChange={(e) => upd("packages", pr.packages.map((x: any, j: number) => (j === i ? { ...x, skus: e.target.checked ? [...x.skus, p.sku] : x.skus.filter((s: string) => s !== p.sku) } : x)))} /> {p.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className={`${btn} mt-3`} onClick={() => upd("packages", [...pr.packages, { key: `package-${Date.now().toString(36)}`, name: "New package", description: "", skus: [], priceCents: null, isPublic: true, enabled: true }])}>+ Package</button>
      </div>
      <div className={card}>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <label className={lab}>Max employee discount (%)<input className={inputClass} inputMode="decimal" value={pr.maxDiscountPercent} onChange={(e) => upd("maxDiscountPercent", Number(e.target.value))} /></label>
          <label className={lab}>Customer price note<input className={inputClass} value={pr.disclaimer} onChange={(e) => upd("disclaimer", e.target.value)} /></label>
          <label className={`${lab} sm:col-span-2`}>Privacy note (shown where customers add a photo and send a request)<textarea className={`${inputClass} min-h-[70px]`} value={pr.privacyNote || ""} onChange={(e) => upd("privacyNote", e.target.value)} data-testid="privacy-note-input" /></label>
        </div>
      </div>
      <button type="button" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white" onClick={save} data-testid="pricing-save">Save prices</button>
    </div>
  );
}

// ===================================================================== review
function Review() {
  const [r, setR] = useState<any>(null);
  useEffect(() => { adminStudio.completeness().then(setR).catch(() => {}); }, []);
  if (!r) return <p className="text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {[["Products", r.summary.total], ["Published", r.summary.published], ["Without price", r.summary.unpriced], ["Without photo", r.summary.noPhoto], ["Incomplete", r.summary.incomplete]].map(([l, v]) => (
          <div key={l as string} className={card}><div className="text-xs font-bold uppercase text-slate-500">{l}</div><div className="text-2xl font-bold text-slate-900">{v}</div></div>
        ))}
      </div>
      {r.pricingIssues.length ? <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><b>Price list:</b> {r.pricingIssues.join(" · ")}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {r.products.filter((p: any) => p.issues.length).map((p: any) => (
          <div key={p.id} className="border-b border-slate-100 p-3 last:border-0">
            <div className="font-bold text-slate-900">{p.name} <span className="text-xs font-normal text-slate-400">{p.sku} · {p.status}</span></div>
            <ul className="mt-1 text-sm text-slate-600">{p.issues.map((i: any, k: number) => <li key={k}>{i.level === "error" ? "⛔" : i.level === "warn" ? "⚠️" : "ℹ️"} {i.message}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
