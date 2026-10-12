"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminStudio, apiUrl, money } from "@/lib/studio/api";
import { inputClass } from "./StudioAdmin";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const lab = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";
const btn = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50";
const CATS: Record<string, string> = { wall: "Wall kits", base: "Bases & tubs", fixture: "Valve trims", enclosure: "Doors & rods", accessory: "Accessories" };
const STATUS_TONE: Record<string, string> = { published: "bg-emerald-100 text-emerald-700", draft: "bg-slate-100 text-slate-600", archived: "bg-slate-200 text-slate-500" };

const toDollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
const toCents = (s: string) => (String(s).trim() === "" ? null : Math.round(Number(String(s).replace(/[$,]/g, "")) * 100));

/** Admin -> Studio Catalog: products, visual assets, compatibility data and every Studio price. */
export default function StudioCatalogAdmin() {
  const [tab, setTab] = useState<"products" | "pricing" | "review">("products");
  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Studio Catalog</h2>
          <p className="mt-1 text-sm text-slate-500">What customers can choose in the Shower Studio, how it is drawn, what fits with what, and what it costs. Changes go live on save; quoted designs keep their prices.</p>
        </div>
        <div className="flex gap-2">
          {(["products", "pricing", "review"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
              {t === "products" ? "Products" : t === "pricing" ? "Prices & packages" : "Completeness"}
            </button>
          ))}
        </div>
      </div>
      {tab === "products" ? <Products /> : tab === "pricing" ? <Pricing /> : <Review />}
    </div>
  );
}

// ===================================================================== products
function Products() {
  const [list, setList] = useState<any[] | null>(null);
  const [fields, setFields] = useState<any>(null);
  const [cat, setCat] = useState("wall");
  const [editing, setEditing] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => adminStudio.products().then((r) => setList(r.products)).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); adminStudio.fields().then((r) => setFields(r.categories)).catch(() => {}); }, [load]);

  const rows = useMemo(() => (list || []).filter((p) => p.category === cat), [list, cat]);
  async function move(i: number, dir: -1 | 1) {
    const ids = rows.map((p) => p._id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await adminStudio.reorder(ids);
    load();
  }

  if (editing) return <ProductEditor initial={editing} fields={fields} onClose={() => { setEditing(null); load(); }} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(CATS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setCat(k)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${cat === k ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {v} <span className="opacity-70">{(list || []).filter((p) => p.category === k).length}</span>
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button type="button" className={btn} onClick={async () => { try { const r = await adminStudio.importStarter(); setMsg(`Added ${r.added} starter products as drafts (unpriced).`); load(); } catch (e: any) { setMsg(e.message); } }}>Import starter products</button>
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setEditing({ category: cat, type: fields?.[cat]?.[0]?.id, engine: {}, specs: [], sources: [], pricing: { priceCents: null, installCents: 0 }, isPublic: true, visualStatus: "illustrative" })} data-testid="catalog-add">Add product</button>
        </div>
      </div>
      {msg ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</p> : null}
      {!list ? <p className="text-slate-500">Loading…</p> : rows.length === 0 ? <div className={`${card} text-center text-slate-500`}>No products in this category.</div> : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {rows.map((p, i) => (
            <div key={p._id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0" data-testid={`catalog-row-${p.sku}`}>
              <div className="flex flex-col">
                <button type="button" aria-label="Move up" className="px-1 text-slate-400 hover:text-slate-800" onClick={() => move(i, -1)}>▲</button>
                <button type="button" aria-label="Move down" className="px-1 text-slate-400 hover:text-slate-800" onClick={() => move(i, 1)}>▼</button>
              </div>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">{p.assets.photos[0]?.url ? <img src={apiUrl(p.assets.photos[0].url)} alt="" className="h-full w-full object-cover" /> : null}</div>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(p)}>
                <div className="truncate font-bold text-slate-900">{p.name} {p.featured ? <span className="text-amber-500">★</span> : null}</div>
                <div className="truncate text-xs text-slate-500">{p.sku} · {p.manufacturer} {p.model}</div>
              </button>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[p.status]}`}>{p.status}</span>
              <span className="w-24 text-right text-sm font-semibold text-slate-900">{p.pricing?.priceCents == null ? <span className="text-amber-600">No price</span> : money(p.pricing.priceCents)}</span>
              <span className={`w-16 text-right text-xs ${p.issues.some((x: any) => x.level === "error") ? "text-red-600" : p.issues.some((x: any) => x.level === "warn") ? "text-amber-600" : "text-slate-400"}`}>{p.issues.filter((x: any) => x.level !== "info").length || "✓"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPath(o: any, path: string) { return path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o); }
function setPath(o: any, path: string, v: any) {
  const out = structuredClone(o || {});
  const ks = path.split(".");
  let cur = out;
  for (const k of ks.slice(0, -1)) cur = cur[k] && typeof cur[k] === "object" ? cur[k] : (cur[k] = {});
  cur[ks[ks.length - 1]] = v;
  return out;
}

function ProductEditor({ initial, fields, onClose }: { initial: any; fields: any; onClose: () => void }) {
  const [p, setP] = useState<any>(structuredClone(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = !p._id;
  const types = fields?.[p.category] || [];
  const defs = types.find((t: any) => t.id === p.type)?.fields || [];
  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const setEng = (k: string, v: any) => setP((x: any) => ({ ...x, engine: setPath(x.engine, k, v) }));

  async function save() {
    setBusy(true); setErrors({}); setMsg(null);
    try {
      const body = {
        sku: p.sku, category: p.category, type: p.type, name: p.name, manufacturer: p.manufacturer, model: p.model, description: p.description, colorName: p.colorName,
        engine: p.engine, specs: p.specs, sources: p.sources, visualStatus: p.visualStatus, isPublic: p.isPublic, featured: p.featured, sortOrder: p.sortOrder,
        pricing: { priceCents: p.pricing?.priceCents ?? null, installCents: p.pricing?.installCents || 0, internalNote: p.pricing?.internalNote || "" },
      };
      const r = creating ? await adminStudio.createProduct(body) : await adminStudio.updateProduct(p._id, body);
      setP(r.product);
      setMsg({ kind: "ok", text: creating ? "Product created as a draft. Add photos, then publish." : "Saved." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
      if (e.errors) setErrors(Object.fromEntries(e.errors.map((x: any) => [x.field, x.message])));
    } finally { setBusy(false); }
  }
  async function status(s: string) {
    setBusy(true);
    try { const r = await adminStudio.setStatus(p._id, s); setP(r.product); setMsg({ kind: "ok", text: s === "published" ? "Published: customers can choose it now." : s === "draft" ? "Unpublished." : "Archived. Designs that used it keep working." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setBusy(false); }
  }
  async function upload(file: File | undefined, kind: "photo" | "texture", extra: Record<string, any> = {}) {
    if (!file) return;
    setBusy(true);
    try { const r = await adminStudio.uploadAsset(p._id, file, { kind, ...extra }); setP(r.product); setMsg({ kind: "ok", text: kind === "texture" ? "Texture uploaded: the preview now uses it." : "Photo added." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setBusy(false); }
  }
  const [tex, setTex] = useState({ widthIn: "12", heightIn: "12" });

  return (
    <div className="space-y-4" data-testid="product-editor">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <button type="button" className="text-sm font-bold text-blue-600" onClick={onClose}>← Back to the catalog</button>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{creating ? `New ${CATS[p.category]?.toLowerCase() || "product"}` : p.name}</h3>
          {!creating ? <p className="text-xs text-slate-500">{p.sku} · <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS_TONE[p.status]}`}>{p.status}</span> · version {p.version}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={save} data-testid="product-save">{creating ? "Create" : "Save"}</button>
          {!creating && p.status !== "published" ? <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => status("published")} data-testid="product-publish">Publish</button> : null}
          {!creating && p.status === "published" ? <button type="button" className={btn} disabled={busy} onClick={() => status("draft")}>Unpublish</button> : null}
          {!creating && p.status !== "archived" ? <button type="button" className={btn} disabled={busy} onClick={() => status("archived")}>Archive</button> : null}
        </div>
      </div>
      {msg ? <p className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role="status">{msg.text}</p> : null}
      {!creating && p.issues?.length ? (
        <ul className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{p.issues.map((i: any, k: number) => <li key={k}>{i.level === "error" ? "⛔" : i.level === "warn" ? "⚠️" : "ℹ️"} {i.message}</li>)}</ul>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={card}>
          <h4 className="mb-3 font-bold text-slate-900">Product</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {creating ? (
              <>
                <label className={lab}>Category<select className={inputClass} value={p.category} onChange={(e) => setP((x: any) => ({ ...x, category: e.target.value, type: fields?.[e.target.value]?.[0]?.id, engine: {} }))}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className={lab}>Type<select className={inputClass} value={p.type} onChange={(e) => set("type", e.target.value)} data-testid="product-type">{types.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
                <Field label="SKU (permanent)" error={errors.sku}><input className={inputClass} value={p.sku || ""} onChange={(e) => set("sku", e.target.value)} data-testid="product-sku" /></Field>
              </>
            ) : null}
            <Field label="Name" error={errors.name}><input className={inputClass} value={p.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="product-name" /></Field>
            <Field label="Manufacturer"><input className={inputClass} value={p.manufacturer || ""} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
            <Field label="Model"><input className={inputClass} value={p.model || ""} onChange={(e) => set("model", e.target.value)} /></Field>
            <Field label="Color / finish name"><input className={inputClass} value={p.colorName || ""} onChange={(e) => set("colorName", e.target.value)} /></Field>
            <label className={`${lab} sm:col-span-2`}>Description (customers see this)<textarea className={`${inputClass} min-h-[80px]`} value={p.description || ""} onChange={(e) => set("description", e.target.value)} /></label>
            <label className={lab}>Preview accuracy<select className={inputClass} value={p.visualStatus} onChange={(e) => set("visualStatus", e.target.value)}><option value="illustrative">Illustrative (approximate)</option><option value="verified">Verified against the real product</option></select></label>
            <div className="flex flex-wrap items-end gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={p.isPublic !== false} onChange={(e) => set("isPublic", e.target.checked)} /> Show on the website</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(p.featured)} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
            </div>
          </div>
          <h4 className="mb-3 mt-5 font-bold text-slate-900">Price</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Price ($) - blank = not priced" error={errors["pricing.priceCents"]}><input className={inputClass} inputMode="decimal" value={toDollars(p.pricing?.priceCents)} onChange={(e) => set("pricing", { ...p.pricing, priceCents: toCents(e.target.value) })} data-testid="product-price" /></Field>
            <Field label="Installation adder ($)"><input className={inputClass} inputMode="decimal" value={toDollars(p.pricing?.installCents)} onChange={(e) => set("pricing", { ...p.pricing, installCents: toCents(e.target.value) ?? 0 })} /></Field>
            <label className={`${lab} sm:col-span-2`}>Internal note (staff only)<input className={inputClass} value={p.pricing?.internalNote || ""} onChange={(e) => set("pricing", { ...p.pricing, internalNote: e.target.value })} /></label>
          </div>
        </div>

        <div className={card}>
          <h4 className="mb-1 font-bold text-slate-900">How it is drawn and what it fits</h4>
          <p className="mb-3 text-xs text-slate-500">Dimensions in inches. These drive the preview and the compatibility rules.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {defs.map((f: any) => <EngineField key={f.key} f={f} value={getPath(p.engine, f.key)} error={errors[f.key]} onChange={(v) => setEng(f.key, v)} />)}
          </div>
        </div>
      </div>

      {!creating ? (
        <div className={card}>
          <h4 className="mb-3 font-bold text-slate-900">Photos and texture</h4>
          <div className="flex flex-wrap gap-3">
            {p.assets.photos.map((ph: any) => (
              <div key={ph.assetId} className="relative h-28 w-28 overflow-hidden rounded-xl bg-slate-100">
                <img src={apiUrl(ph.url)} alt={ph.alt} className="h-full w-full object-cover" />
                <button type="button" className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 text-xs font-bold text-red-600" onClick={async () => setP((await adminStudio.removeAsset(p._id, ph.assetId)).product)}>✕</button>
              </div>
            ))}
            <label className="grid h-28 w-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-center text-xs font-bold text-slate-500">
              + Photo<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], "photo")} data-testid="product-photo-input" />
            </label>
          </div>
          {p.category === "wall" ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-sm text-slate-700"><b>Texture</b> (optional): a straight-on photo of one repeat of the panel surface. The preview tiles it at real size instead of the drawn pattern.</p>
              {p.assets.texture ? (
                <div className="mt-2 flex items-center gap-3">
                  <img src={apiUrl(p.assets.texture.url)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  <span className="text-sm text-slate-600">{p.assets.texture.widthIn}″ × {p.assets.texture.heightIn}″</span>
                  <button type="button" className="text-sm font-bold text-red-600" onClick={async () => setP((await adminStudio.removeAsset(p._id, p.assets.texture.assetId)).product)}>Remove</button>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className={lab}>Width (in)<input className={`${inputClass} w-24`} value={tex.widthIn} onChange={(e) => setTex({ ...tex, widthIn: e.target.value })} /></label>
                <label className={lab}>Height (in)<input className={`${inputClass} w-24`} value={tex.heightIn} onChange={(e) => setTex({ ...tex, heightIn: e.target.value })} /></label>
                <label className={`${btn} cursor-pointer`}>Upload texture<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], "texture", tex)} /></label>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={card}>
        <h4 className="mb-1 font-bold text-slate-900">Specifications</h4>
        <p className="mb-3 text-xs text-slate-500">Mark each value VERIFIED only when read on the manufacturer&rsquo;s spec sheet, and link the source.</p>
        <div className="space-y-2">
          {(p.specs || []).map((s: any, i: number) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_80px_130px_1.4fr_auto]">
              <input className={inputClass} placeholder="Spec" value={s.label || s.key} onChange={(e) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value, key: x.key || e.target.value } : x)))} />
              <input className={inputClass} placeholder="Value" value={s.value} onChange={(e) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <input className={inputClass} placeholder="Unit" value={s.unit} onChange={(e) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, unit: e.target.value } : x)))} />
              <select className={inputClass} value={s.status} onChange={(e) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, status: e.target.value } : x)))}>
                <option>VERIFIED</option><option>ESTIMATE</option><option>APPROXIMATE</option>
              </select>
              <input className={inputClass} placeholder="Source URL" value={s.source} onChange={(e) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, source: e.target.value } : x)))} />
              <button type="button" className="px-2 text-sm font-bold text-red-600" onClick={() => set("specs", p.specs.filter((_: any, j: number) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={`${btn} mt-3`} onClick={() => set("specs", [...(p.specs || []), { key: "", label: "", value: "", unit: "", status: "ESTIMATE", source: "" }])}>+ Specification</button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className={lab}>{label}{children}{error ? <span className="normal-case tracking-normal text-red-600">{error}</span> : null}</label>;
}

function EngineField({ f, value, error, onChange }: { f: any; value: any; error?: string; onChange: (v: any) => void }) {
  const title = `${f.label}${f.kind === "number" && f.unit ? ` (${f.unit})` : ""}${f.required ? "" : " - optional"}`;
  let input: React.ReactNode;
  if (f.kind === "number") input = <input className={inputClass} inputMode="decimal" value={value ?? ""} placeholder={f.default != null ? String(f.default) : ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid={`eng-${f.key}`} />;
  else if (f.kind === "color") input = <div className="flex gap-2"><input type="color" className="h-11 w-14 rounded-lg border border-slate-300" value={value || f.default || "#ffffff"} onChange={(e) => onChange(e.target.value)} /><input className={inputClass} value={value || ""} placeholder={f.default || "#ffffff"} onChange={(e) => onChange(e.target.value)} /></div>;
  else if (f.kind === "choice") input = <select className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>{!f.required ? <option value="">-</option> : null}{f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>;
  else if (f.kind === "bool") input = <label className="flex min-h-[44px] items-center gap-2 text-sm normal-case tracking-normal text-slate-700"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> Yes</label>;
  else if (f.kind === "text") input = <input className={inputClass} value={value ?? ""} placeholder={f.default || ""} onChange={(e) => onChange(e.target.value)} />;
  else if (f.kind === "skus") input = <input className={inputClass} value={(value || []).join(", ")} placeholder="sku-1, sku-2" onChange={(e) => onChange(e.target.value.split(/[\s,]+/).filter(Boolean))} />;
  else if (f.kind === "kinds") input = (
    <div className="flex min-h-[44px] items-center gap-4 text-sm normal-case tracking-normal text-slate-700">
      {[["pan", "Shower base"], ["tub", "Tub"]].map(([k, l]) => (
        <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={(value || []).includes(k)} onChange={(e) => onChange(e.target.checked ? [...new Set([...(value || []), k])] : (value || []).filter((x: string) => x !== k))} /> {l}</label>
      ))}
    </div>
  );
  else if (f.kind === "drains") {
    const list = value || f.default || [];
    input = (
      <div className="space-y-2 normal-case tracking-normal">
        {list.map((d: any, i: number) => (
          <div key={i} className="grid grid-cols-[80px_1fr_70px_70px_auto] gap-1">
            <input className={inputClass} value={d.id} onChange={(e) => onChange(list.map((x: any, j: number) => (j === i ? { ...x, id: e.target.value } : x)))} title="id" />
            <input className={inputClass} value={d.name} onChange={(e) => onChange(list.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value } : x)))} title="Name" />
            <input className={inputClass} value={d.along} onChange={(e) => onChange(list.map((x: any, j: number) => (j === i ? { ...x, along: Number(e.target.value) } : x)))} title="Along (0 at the valve wall, 1 far end)" />
            <input className={inputClass} value={d.across} onChange={(e) => onChange(list.map((x: any, j: number) => (j === i ? { ...x, across: Number(e.target.value) } : x)))} title="Across (0 back wall, 1 threshold)" />
            <button type="button" className="px-1 text-red-600" onClick={() => onChange(list.filter((_: any, j: number) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className={btn} onClick={() => onChange([...list, { id: `drain${list.length + 1}`, name: "Drain", along: 0.5, across: 0.5 }])}>+ Drain</button>
      </div>
    );
  }
  return <label className={`${lab} ${f.kind === "drains" ? "sm:col-span-2" : ""}`}>{title}{input}{error ? <span className="normal-case tracking-normal text-red-600">{error}</span> : f.help ? <span className="font-normal normal-case tracking-normal text-slate-400">{f.help}</span> : null}</label>;
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
