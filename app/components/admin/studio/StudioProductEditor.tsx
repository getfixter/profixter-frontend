"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { adminStudio, apiUrl } from "@/lib/studio/api";
import { swatchDataUrl } from "@/lib/studio/engine/textures.js";
import { inputClass } from "./StudioAdmin";
import { ManufacturerImage } from "./StudioManufacturersAdmin";
import { CATS, STAGE } from "./StudioCatalogManager";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const lab = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";
const btn = "min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50";
const primary = "min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const TABS = [
  { id: "product", label: "Product & pricing" },
  { id: "photos", label: "Photos & appearance" },
  { id: "publish", label: "Compatibility & publishing" },
  { id: "advanced", label: "Advanced" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const toDollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
const toCents = (s: string) => (String(s).trim() === "" ? null : Math.round(Number(String(s).replace(/[$,]/g, "")) * 100));
export function getPath(o: any, path: string) { return path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o); }
export function setPath(o: any, path: string, v: any) {
  const out = structuredClone(o || {});
  const ks = path.split(".");
  let cur = out;
  for (const k of ks.slice(0, -1)) cur = cur[k] && typeof cur[k] === "object" ? cur[k] : (cur[k] = {});
  cur[ks[ks.length - 1]] = v;
  return out;
}
/** Where each publishing requirement is fixed. */
function targetOf(blocker: string): { tab: Tab; focus?: string } {
  if (/selling price/i.test(blocker)) return { tab: "product", focus: "product-price" };
  if (/photo/i.test(blocker)) return { tab: "photos" };
  if (/^Visualization details/i.test(blocker)) return { tab: "advanced" };
  return { tab: "publish" };
}
/** The engine field that holds the colour shown in the preview, per category. */
const colorKey = (p: any) => (p.category === "fixture" || p.type === "grabBar" || p.type === "rod" ? "finishColor" : p.category === "enclosure" ? "frameColor" : "color");

/**
 * The Studio product editor: what the owner needs every day up front (photo,
 * name, price, publish), everything else one tap away, and every technical
 * setting kept - unchanged - under Advanced.
 */
export default function ProductEditor({ initial, fields, onClose, siblings = [], onSwitch }: { initial: any; fields: any; onClose: () => void; siblings?: any[]; onSwitch?: (id: string) => void }) {
  const [p, setP] = useState<any>(structuredClone(initial));
  const [saved, setSaved] = useState<string>(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = !p._id;
  const [tab, setTab] = useState<Tab>("product");
  const [details, setDetails] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [tex, setTex] = useState({ widthIn: "12", heightIn: "12", textureSource: "owner" });
  const fileRef = useRef<HTMLInputElement>(null);
  const types = fields?.[p.category] || [];
  const defs = types.find((t: any) => t.id === p.type)?.fields || [];
  const set = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const setEng = (k: string, v: any) => setP((x: any) => ({ ...x, engine: setPath(x.engine, k, v) }));
  const fromMfr = Boolean(p.source?.manufacturer);
  const unitWalls = Boolean(p.source?.unitSku);
  const dirty = !creating && JSON.stringify(p) !== saved;
  const mfrPhotos = (p.externalMedia || []).filter((m: any) => m.kind === "photo");
  const mfrDocs = (p.externalMedia || []).filter((m: any) => m.kind !== "photo" && m.kind !== "video");
  const rightsOk = p.imaging?.imageRights === "approved";
  const mainPhoto = p.assets?.photos?.[0];
  const stage = STAGE[p.readiness?.stage] || STAGE.incomplete;
  const blockers: string[] = p.readiness?.blockers || [];

  const accept = (product: any) => { setP(product); setSaved(JSON.stringify(product)); };
  function jump(t: Tab, focus?: string) {
    setTab(t);
    window.setTimeout(() => {
      document.getElementById("editor-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focus) (document.querySelector(`[data-testid="${focus}"]`) as HTMLElement | null)?.focus();
    }, 60);
  }

  async function save() {
    setBusy(true); setErrors({}); setMsg(null);
    try {
      const body = {
        sku: p.sku, category: p.category, type: p.type, name: p.name, manufacturer: p.manufacturer, model: p.model, description: p.description, colorName: p.colorName,
        engine: p.engine, specs: p.specs, sources: p.sources, visualStatus: p.visualStatus, isPublic: p.isPublic, featured: p.featured, sortOrder: p.sortOrder,
        pricing: { priceCents: p.pricing?.priceCents ?? null, costCents: p.pricing?.costCents ?? null, installCents: p.pricing?.installCents || 0, internalNote: p.pricing?.internalNote || "" },
        ...(p.compatibility ? { compatibility: { status: p.compatibility.status, note: p.compatibility.note || "" } } : {}),
        ...(fromMfr ? { review: { info: p.review?.info === true, visual: p.review?.visual === true } } : {}),
      };
      const r = creating ? await adminStudio.createProduct(body) : await adminStudio.updateProduct(p._id, body);
      accept(r.product);
      setMsg({ kind: "ok", text: creating ? "Product created as a draft. Add photos, then publish." : "Saved." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
      if (e.errors) {
        setErrors(Object.fromEntries(e.errors.map((x: any) => [x.field, x.message])));
        if (e.errors.some((x: any) => defs.some((d: any) => d.key === x.field))) setTab("advanced");
      }
    } finally { setBusy(false); }
  }
  async function status(s: string) {
    if (dirty && !window.confirm("You have unsaved changes. Change the status without saving them?")) return;
    if (s === "published" && !fromMfr) {
      const missing = [p.pricing?.priceCents == null ? "no price (designs using it will show \"Price confirmed after review.\")" : "", !p.assets?.photos?.length ? "no product photo" : ""].filter(Boolean);
      if (missing.length && !window.confirm(`This product has ${missing.join(" and ")}. Customers will see it once published. Publish anyway?`)) return;
    }
    setBusy(true);
    try { const r = await adminStudio.setStatus(p._id, s); accept(r.product); setMsg({ kind: "ok", text: s === "published" ? "Published: customers can choose it now." : s === "draft" ? "Unpublished." : "Archived. Designs that used it keep working." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setBusy(false); }
  }
  async function upload(file: File | undefined, kind: "photo" | "texture", extra: Record<string, any> = {}) {
    if (!file) return;
    setBusy(true);
    try { const r = await adminStudio.uploadAsset(p._id, file, { kind, ...extra }); accept({ ...r.product, ...pick(p, r.product) }); setMsg({ kind: "ok", text: kind === "texture" ? "Texture uploaded: the preview now uses it." : "Photo added." }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  /** Asset changes are saved at once; keep any unsaved form edits on top. */
  const pick = (cur: any, fresh: any) => (dirty ? { name: cur.name, description: cur.description, pricing: cur.pricing, engine: cur.engine, specs: cur.specs, colorName: cur.colorName, compatibility: cur.compatibility, review: cur.review, assets: fresh.assets } : {});
  async function assetCall(fn: () => Promise<{ product: any }>, text: string) {
    setBusy(true);
    try { const r = await fn(); accept({ ...r.product, ...pick(p, r.product) }); setMsg({ kind: "ok", text }); }
    catch (e: any) { setMsg({ kind: "err", text: e.message }); } finally { setBusy(false); }
  }
  async function nextNeedingReview() {
    if (dirty && !window.confirm("Leave without saving your changes?")) return;
    for (const stageId of ["review", "incomplete"]) {
      const r = await adminStudio.families({ stage: stageId, manufacturer: p.source?.manufacturer || "", per: "5" }).catch(() => null);
      const next = r?.families.flatMap((x: any) => x.products).find((x: any) => x._id !== p._id && !x.unitSku);
      if (next) return onSwitch?.(next._id);
    }
    setMsg({ kind: "ok", text: "Nothing else is waiting for review." });
  }
  const switchTo = (id: string) => { if (!dirty || window.confirm("Switch without saving your changes?")) onSwitch?.(id); };

  const swatch = useMemo(() => {
    if (p.category !== "wall" || typeof window === "undefined") return "";
    try { const e = p.engine || {}; return swatchDataUrl({ color: e.color, gloss: e.gloss, pattern: e.pattern?.type === "smooth" ? { type: "smooth" } : { ...e.pattern } }); } catch { return ""; }
  }, [p.category, p.engine]);
  const sizes = useMemo(() => [...new Set(siblings.map((x: any) => x.variant.size))], [siblings]);
  const current = siblings.find((x: any) => x._id === p._id);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ----------------------------------------------------------------- sections
  const productSection = (
    <div className="grid gap-3 sm:grid-cols-2">
      {creating ? (
        <>
          <label className={lab}>Category<select className={inputClass} value={p.category} onChange={(e) => setP((x: any) => ({ ...x, category: e.target.value, type: fields?.[e.target.value]?.[0]?.id, engine: {} }))}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className={lab}>Type<select className={inputClass} value={p.type} onChange={(e) => set("type", e.target.value)} data-testid="product-type">{types.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <Field label="SKU (permanent)" error={errors.sku}><input className={inputClass} value={p.sku || ""} onChange={(e) => set("sku", e.target.value)} data-testid="product-sku" /></Field>
          <Field label="Manufacturer"><input className={inputClass} value={p.manufacturer || ""} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
        </>
      ) : null}
      <Field label="Product name" error={errors.name} wide><input className={inputClass} value={p.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="product-name" /></Field>
      <label className={`${lab} sm:col-span-2`}>Description (customers see this)<textarea className={`${inputClass} min-h-[84px]`} value={p.description || ""} onChange={(e) => set("description", e.target.value)} data-testid="product-description" /></label>
      <Field label={unitWalls ? "Selling price (included in the unit)" : fromMfr ? "Selling price ($) - required to publish" : "Selling price ($) - blank = not priced"} error={errors["pricing.priceCents"]}>
        <input className={inputClass} inputMode="decimal" value={toDollars(p.pricing?.priceCents)} onChange={(e) => set("pricing", { ...p.pricing, priceCents: toCents(e.target.value) })} data-testid="product-price" disabled={unitWalls} />
      </Field>
      <Field label="Material cost ($) - internal" error={errors["pricing.costCents"]}><input className={inputClass} inputMode="decimal" value={toDollars(p.pricing?.costCents)} onChange={(e) => set("pricing", { ...p.pricing, costCents: toCents(e.target.value) })} data-testid="product-cost" /></Field>
      <Field label="Installation adder ($)"><input className={inputClass} inputMode="decimal" value={toDollars(p.pricing?.installCents)} onChange={(e) => set("pricing", { ...p.pricing, installCents: toCents(e.target.value) ?? 0 })} data-testid="product-install" /></Field>
      {fromMfr ? (
        <Field label="Manufacturer list price (reference)"><input className={`${inputClass} bg-slate-50 text-slate-500`} value={p.source.listPriceCents == null ? "" : toDollars(p.source.listPriceCents)} readOnly /></Field>
      ) : null}
      {fromMfr ? <p className="text-xs text-slate-500 sm:col-span-2">The list price is the manufacturer&rsquo;s published price, not your cost. Imports never change your cost or selling price. Customers only ever see a total.</p> : null}
      <label className={`${lab} sm:col-span-2`}>Internal note (staff only)<input className={inputClass} value={p.pricing?.internalNote || ""} onChange={(e) => set("pricing", { ...p.pricing, internalNote: e.target.value })} /></label>
      <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700 sm:col-span-2">
        <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={p.isPublic !== false} onChange={(e) => set("isPublic", e.target.checked)} /> Show on the website when published</label>
        <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={Boolean(p.featured)} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
      </div>
    </div>
  );

  const photosSection = creating ? <p className="text-sm text-slate-500">Create the product first, then add photos.</p> : (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2"><h4 className="font-bold text-slate-900">Customer photos</h4><span className="text-xs text-slate-500">The first one is the main photo customers see</span></div>
        <div className="flex flex-wrap gap-3">
          {(p.assets?.photos || []).map((ph: any, i: number) => (
            <div key={ph.assetId} className="w-32">
              <div className="relative h-32 w-32 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                <img src={apiUrl(ph.url)} alt={ph.alt} className="h-full w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{i === 0 ? "Main · customer photo" : "Customer photo"}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs font-bold">
                {i > 0 ? <button type="button" className="text-blue-700" disabled={busy} onClick={() => assetCall(() => adminStudio.orderPhotos(p._id, [ph.assetId, ...p.assets.photos.filter((x: any) => x.assetId !== ph.assetId).map((x: any) => x.assetId)]), "Main photo changed.")}>Make main</button> : <span />}
                <button type="button" className="text-red-600" disabled={busy} onClick={() => assetCall(() => adminStudio.removeAsset(p._id, ph.assetId), "Photo removed.")}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="grid h-32 w-32 place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-center text-xs font-bold text-slate-500 hover:border-blue-400" onClick={() => fileRef.current?.click()} disabled={busy}>
            + Upload photo<span className="block font-normal">you may use</span>
          </button>
        </div>
      </div>
      {fromMfr && (mfrPhotos.length || mfrDocs.length) ? (
        <div className="rounded-2xl bg-slate-50 p-3">
          <h4 className="font-bold text-slate-900">{p.manufacturer} images</h4>
          <p className="mt-0.5 text-xs text-slate-500">{rightsOk ? "Image rights confirmed: tap Use to copy one into the customer photos." : "Preview only: shown to you, never to customers, until you confirm image rights (Manufacturers → Image rights & links)."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {mfrPhotos.map((m: any) => (
              <div key={m.url} className="w-28">
                <div className="relative h-28 w-28 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                  <ManufacturerImage url={m.url} w={240} className="h-full w-full object-contain" />
                  <span className="absolute inset-x-0 bottom-0 bg-white/90 py-0.5 text-center text-[10px] font-bold text-amber-700">Preview only</span>
                </div>
                <button type="button" className="mt-1 w-full text-xs font-bold text-blue-700 disabled:text-slate-400" disabled={busy || !rightsOk} title={rightsOk ? "" : "Confirm image rights first"} onClick={() => assetCall(() => adminStudio.copyManufacturerPhoto(p._id, m.url), "Photo added to the customer photos (copied and optimized).")}>Use as customer photo</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl ring-1 ring-slate-200" style={{ background: getPath(p.engine, colorKey(p)) || "#e8e6e1" }}>
            {p.assets?.texture?.url ? <img src={apiUrl(p.assets.texture.url)} alt="" className="h-full w-full object-cover" /> : swatch ? <img src={swatch} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <p className="mt-1 text-center text-[11px] font-bold text-slate-500">Illustrative rendering</p>
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Field label="Color / finish name"><input className={inputClass} value={p.colorName || ""} onChange={(e) => set("colorName", e.target.value)} /></Field>
          <label className={lab}>Color in the preview
            <div className="flex gap-2"><input type="color" className="h-11 w-14 rounded-lg border border-slate-300" value={getPath(p.engine, colorKey(p)) || "#e8e6e1"} onChange={(e) => setEng(colorKey(p), e.target.value)} aria-label="Preview color" /><input className={inputClass} value={getPath(p.engine, colorKey(p)) || ""} onChange={(e) => setEng(colorKey(p), e.target.value)} /></div>
          </label>
          {p.category === "wall" ? (
            <label className={lab}>Surface<select className={inputClass} value={p.engine?.pattern?.type || "smooth"} onChange={(e) => setEng("pattern.type", e.target.value)}><option value="tile">Tile pattern</option><option value="smooth">Smooth</option><option value="beadboard">Beadboard</option></select></label>
          ) : null}
          <label className={lab}>Preview accuracy<select className={inputClass} value={p.visualStatus} onChange={(e) => set("visualStatus", e.target.value)}><option value="illustrative">Illustrative (approximate)</option><option value="verified">Verified against the real product</option></select></label>
          <p className="text-xs text-slate-500 sm:col-span-2">Tile sizes, grout, gloss and other drawing settings are under Advanced.</p>
        </div>
      </div>
      {p.category === "wall" ? (
        <div className="rounded-2xl bg-slate-50 p-3">
          <h4 className="font-bold text-slate-900">Texture <span className="text-xs font-normal text-slate-500">(optional)</span></h4>
          <p className="mt-0.5 text-xs text-slate-500">A straight-on, seamless image of one repeat of the surface, at real size. The preview tiles it instead of the drawn pattern. Never a bathroom photo.</p>
          {p.assets?.texture ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <img src={apiUrl(p.assets.texture.url)} alt="" className="h-16 w-16 rounded-lg object-cover" />
              {p.assets.texture.widthIn}″ × {p.assets.texture.heightIn}″ · {p.assets.texture.source === "manufacturer" ? "from the manufacturer" : p.assets.texture.source === "approximation" ? "approximation (testing only)" : "your own"}
              <button type="button" className="font-bold text-red-600" onClick={() => assetCall(() => adminStudio.removeAsset(p._id, p.assets.texture.assetId), "Texture removed.")}>Remove</button>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className={lab}>Width (in)<input className={`${inputClass} w-24`} value={tex.widthIn} onChange={(e) => setTex({ ...tex, widthIn: e.target.value })} /></label>
            <label className={lab}>Height (in)<input className={`${inputClass} w-24`} value={tex.heightIn} onChange={(e) => setTex({ ...tex, heightIn: e.target.value })} /></label>
            <label className={lab}>Source<select className={`${inputClass} w-auto`} value={tex.textureSource} onChange={(e) => setTex({ ...tex, textureSource: e.target.value })}><option value="owner">My own photo of the material</option><option value="manufacturer">Supplied by the manufacturer</option><option value="approximation">Approximation (testing only)</option></select></label>
            <label className={`${btn} inline-flex cursor-pointer items-center`}>Upload texture<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], "texture", tex)} /></label>
          </div>
        </div>
      ) : null}
    </div>
  );

  const e = p.engine || {};
  const worksWith = p.category === "wall" ? `Wall kit over ${(e.kit?.forKinds?.length ? e.kit.forKinds : [p.type]).map((k: string) => (k === "tub" ? "bathtubs" : "shower bases")).join(" and ")}`
    : p.category === "base" ? (p.type === "tub" ? "Bathtub" : "Shower base") : p.category === "enclosure" ? `${p.type === "door" ? "Door" : "Rod"} for ${(e.forKinds || []).map((k: string) => (k === "tub" ? "tubs" : "showers")).join(" and ")}`
    : p.category === "fixture" ? (p.type === "tubShower" ? "Tub/shower trim (with spout)" : "Shower-only trim") : CATS[p.category];
  const dims = p.category === "wall" ? `Alcoves ${e.kit?.fitsLengthMin ?? "?"}–${e.kit?.fitsLengthMax ?? "?"}″ long, ${e.kit?.fitsWidthMin ?? "?"}–${e.kit?.fitsWidthMax ?? "?"}″ deep; panels ${e.kit?.height ?? "?"}″ high`
    : p.category === "base" ? `${e.length ?? "?"}″ × ${e.width ?? "?"}″, ${e.height ?? "?"}″ high · threshold ${e.geometry?.thresholdW ?? "?"}″${e.thresholdVerified ? "" : " (estimate)"} · drain: ${(e.drains || []).map((d: any) => d.name).join(", ") || "not set"}`
    : p.category === "enclosure" ? `Openings ${e.openingMin ?? "?"}–${e.openingMax ?? "?"}″` : p.category === "accessory" && e.length ? `${e.length}″` : "";

  const publishSection = (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Works with</div><div className="mt-1 text-sm text-slate-800">{worksWith}</div></div>
        <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Sizes it fits</div><div className="mt-1 text-sm text-slate-800">{dims || "-"}</div></div>
      </div>
      {fromMfr && !unitWalls ? (
        <div>
          <h4 className="font-bold text-slate-900">Compatibility</h4>
          <p className="mb-2 text-xs text-slate-500">The price file does not say which bases, walls and doors go together. Check the drawings, then mark it reviewed. Customers can only combine products that pass the fit rules.</p>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <label className={lab}>Status<select className={inputClass} value={p.compatibility?.status || "unverified"} onChange={(ev) => set("compatibility", { ...(p.compatibility || {}), status: ev.target.value })} data-testid="product-compat"><option value="unverified">Unverified</option><option value="reviewed">Reviewed by me</option></select></label>
            <label className={lab}>Note<input className={inputClass} value={p.compatibility?.note || ""} placeholder="e.g. pairs with SR-3260 bases per the drawing" onChange={(ev) => set("compatibility", { ...(p.compatibility || {}), note: ev.target.value })} /></label>
          </div>
          {report ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm" data-testid="product-compat-report">
              <ul className="space-y-1">{report.checks.map((c: any, i: number) => <li key={i} className={c.status === "ok" ? "text-slate-700" : "text-amber-800"}>{c.status === "ok" ? "✓" : "⚠️"} {c.text}</li>)}</ul>
              {report.pairLabel ? <p className="mt-2 text-xs text-slate-600"><b>{report.pairLabel}: {report.total}.</b> {report.pairs.map((x: any) => `${x.name}${x.status !== "published" ? ` (${x.status})` : ""}`).join(" · ") || "None yet."}{report.total > report.pairs.length ? " …" : ""}</p> : null}
            </div>
          ) : !creating ? <button type="button" className={`${btn} mt-3`} onClick={async () => { try { setReport((await adminStudio.compatibility(p._id)).report); } catch (er: any) { setMsg({ kind: "err", text: er.message }); } }} data-testid="product-compat-check">Show what it fits</button> : null}
        </div>
      ) : null}
      {fromMfr && !unitWalls ? (
        <div>
          <h4 className="font-bold text-slate-900">Your approval</h4>
          <div className="mt-2 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <label className="flex min-h-[44px] items-start gap-3"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={p.review?.info === true} onChange={(ev) => set("review", { ...(p.review || {}), info: ev.target.checked })} data-testid="product-review-info" /> <span>Product information checked: name, description and specifications.</span></label>
            <label className="flex min-h-[44px] items-start gap-3"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={p.review?.visual === true} onChange={(ev) => set("review", { ...(p.review || {}), visual: ev.target.checked })} data-testid="product-review-visual" /> <span>Preview checked against the real product (customers see it labelled &ldquo;Illustrative&rdquo;).{p.source.visualIssues?.length ? <span className="mt-1 block text-xs text-amber-800">To check: {p.source.visualIssues.join(" · ")}</span> : null}</span></label>
          </div>
        </div>
      ) : null}
      {!creating ? (
        <div className="flex flex-wrap gap-2">
          {p.status !== "published" ? <button type="button" className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy || unitWalls} onClick={() => status("published")}>Publish</button> : <button type="button" className={btn} disabled={busy || unitWalls} onClick={() => status("draft")}>Unpublish</button>}
          {p.status !== "archived" ? <button type="button" className={btn} disabled={busy || unitWalls} onClick={() => status("archived")}>Archive</button> : <button type="button" className={btn} disabled={busy} onClick={() => status("draft")}>Restore as draft</button>}
          {unitWalls ? <span className="self-center text-xs text-slate-500">These walls are part of unit {p.source.unitSku}: they follow the unit.</span> : null}
        </div>
      ) : null}
    </div>
  );

  const advancedSection = (
    <div className="space-y-6">
      {!creating ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="SKU"><input className={`${inputClass} bg-slate-50`} value={p.sku} readOnly /></Field>
          <Field label="Manufacturer"><input className={inputClass} value={p.manufacturer || ""} onChange={(ev) => set("manufacturer", ev.target.value)} /></Field>
          <Field label="Model"><input className={inputClass} value={p.model || ""} onChange={(ev) => set("model", ev.target.value)} /></Field>
        </div>
      ) : <Field label="Model"><input className={inputClass} value={p.model || ""} onChange={(ev) => set("model", ev.target.value)} /></Field>}
      <div>
        <h4 className="mb-1 font-bold text-slate-900">Drawing and fit settings</h4>
        <p className="mb-3 text-xs text-slate-500">Inches. These drive the preview and the compatibility rules.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {defs.map((f: any) => <EngineField key={f.key} f={f} value={getPath(p.engine, f.key)} error={errors[f.key]} onChange={(v) => setEng(f.key, v)} />)}
        </div>
      </div>
      <div>
        <h4 className="mb-1 font-bold text-slate-900">Specifications</h4>
        <p className="mb-3 text-xs text-slate-500">Mark a value VERIFIED only when read on the manufacturer&rsquo;s spec sheet, and link the source.</p>
        <div className="space-y-2">
          {(p.specs || []).map((s: any, i: number) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_80px_130px_1.4fr_auto]">
              <input className={inputClass} placeholder="Spec" value={s.label || s.key} onChange={(ev) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, label: ev.target.value, key: x.key || ev.target.value } : x)))} />
              <input className={inputClass} placeholder="Value" value={s.value} onChange={(ev) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, value: ev.target.value } : x)))} />
              <input className={inputClass} placeholder="Unit" value={s.unit} onChange={(ev) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, unit: ev.target.value } : x)))} />
              <select className={inputClass} value={s.status} onChange={(ev) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, status: ev.target.value } : x)))}><option>VERIFIED</option><option>ESTIMATE</option><option>APPROXIMATE</option></select>
              <input className={inputClass} placeholder="Source URL" value={s.source} onChange={(ev) => set("specs", p.specs.map((x: any, j: number) => (j === i ? { ...x, source: ev.target.value } : x)))} />
              <button type="button" className="px-2 text-sm font-bold text-red-600" onClick={() => set("specs", p.specs.filter((_: any, j: number) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className={`${btn} mt-3`} onClick={() => set("specs", [...(p.specs || []), { key: "", label: "", value: "", unit: "", status: "ESTIMATE", source: "" }])}>+ Specification</button>
      </div>
      {fromMfr ? (
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700" data-testid="product-source">
          <h4 className="font-bold text-slate-900">Manufacturer source</h4>
          <p className="mt-1">Part {p.source.partNumber} · model {p.source.modelNumber} · {p.source.seriesName} · availability: {p.source.availability || "active"}{p.source.listPriceEffective ? ` · list price effective ${p.source.listPriceEffective}` : ""}</p>
          {p.source.approximations?.length ? <><p className="mt-2 text-xs font-bold uppercase text-slate-500">How the preview approximates it</p><ul className="list-disc pl-5 text-xs">{p.source.approximations.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></> : null}
          {mfrDocs.length ? <div className="mt-2 flex flex-wrap gap-3 text-xs">{mfrDocs.map((m: any) => <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="font-semibold text-blue-700 underline">{m.kind === "drawing" ? "Technical drawing" : m.kind === "installGuide" ? "Installation guide" : m.kind === "model3d" ? "3D model" : "CAD file"}</a>)}</div> : null}
          {(p.sources || []).length ? <p className="mt-2 text-xs">Sources: {(p.sources || []).join(" · ")}</p> : null}
          <p className="mt-2 text-xs text-slate-500">Compatibility reviewed {p.compatibility?.reviewedAt ? new Date(p.compatibility.reviewedAt).toLocaleString() : "-"} · sign-off {p.review?.at ? new Date(p.review.at).toLocaleString() : "-"} · version {p.version}</p>
        </div>
      ) : null}
    </div>
  );

  // ----------------------------------------------------------------- layout
  return (
    <div className="space-y-4 pb-24" data-testid="product-editor">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(ev) => upload(ev.target.files?.[0], "photo")} data-testid="product-photo-input" />
      <div className={`${card} space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="min-h-[40px] text-sm font-bold text-blue-600" onClick={() => { if (!dirty || window.confirm("Leave without saving your changes?")) onClose(); }}>← Back to the catalog</button>
          {!creating && onSwitch ? <button type="button" className="min-h-[40px] text-sm font-bold text-slate-600 hover:text-blue-700" onClick={nextNeedingReview} data-testid="product-next">Next needing review →</button> : null}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <button type="button" className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200" onClick={() => !creating && jump("photos")} aria-label="Photos">
              {mainPhoto?.url ? <img src={apiUrl(mainPhoto.url)} alt="" className="h-full w-full object-cover" />
                : mfrPhotos[0] ? <><ManufacturerImage url={mfrPhotos[0].url} w={200} className="h-full w-full object-contain" /><span className="absolute inset-x-0 bottom-0 bg-white/90 py-0.5 text-center text-[10px] font-bold text-amber-700">Preview only</span></>
                : swatch ? <img src={swatch} alt="" className="h-full w-full object-cover" /> : null}
            </button>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 sm:text-xl">{creating ? `New ${CATS[p.category]?.toLowerCase() || "product"}` : p.family?.label || p.name}</h3>
              {!creating ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  {p.variant?.size ? <span className="font-semibold text-slate-700">{p.variant.size}</span> : null}
                  {p.colorName ? <span className="font-semibold text-slate-700">· {p.colorName}</span> : null}
                  <span>· {p.manufacturer || "Added by hand"} · {p.sku}</span>
                  <span className={`rounded-full px-2 py-0.5 font-bold ${stage.tone}`} data-testid="product-stage">{stage.label}</span>
                  {dirty ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">Unsaved changes</span> : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {!creating && !unitWalls ? (
              <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Selling price
                <div className="flex items-center rounded-xl border border-slate-300 bg-white pl-3 focus-within:border-blue-500"><span className="text-slate-400">$</span><input className="min-h-[44px] w-28 rounded-xl px-2 text-lg font-bold text-slate-900 outline-none" inputMode="decimal" value={toDollars(p.pricing?.priceCents)} onChange={(ev) => set("pricing", { ...p.pricing, priceCents: toCents(ev.target.value) })} aria-label="Selling price" data-testid="header-price" /></div>
              </label>
            ) : null}
            <button type="button" className={`${primary} ${dirty ? "ring-2 ring-blue-300" : ""}`} disabled={busy} onClick={save} data-testid="product-save">{creating ? "Create" : "Save"}</button>
            {!creating && p.status !== "published" && !unitWalls ? <button type="button" className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => status("published")} data-testid="product-publish">Publish</button> : null}
            {!creating && p.status === "published" && !unitWalls ? <button type="button" className={btn} disabled={busy} onClick={() => status("draft")} data-testid="product-unpublish">Unpublish</button> : null}
          </div>
        </div>
        {!creating && siblings.length > 1 ? (
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center" data-testid="product-siblings">
            {sizes.length > 1 ? (
              <select className={`${inputClass} sm:w-60`} value={current?.variant.size ?? ""} onChange={(ev) => { const next = siblings.find((x: any) => x.variant.size === ev.target.value && x.variant.color === p.colorName) || siblings.find((x: any) => x.variant.size === ev.target.value); if (next) switchTo(next._id); }} aria-label="Size" data-testid="product-size">
                {sizes.map((s) => <option key={String(s)} value={String(s)}>{String(s) || "Standard"}</option>)}
              </select>
            ) : null}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {siblings.filter((x: any) => x.variant.size === (current?.variant.size ?? x.variant.size)).map((x: any) => (
                <button key={x._id} type="button" disabled={x._id === p._id} onClick={() => switchTo(x._id)} className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs ring-1 ${x._id === p._id ? "bg-blue-50 font-bold ring-blue-400" : "bg-white ring-slate-200 hover:ring-blue-300"}`} data-testid={`sibling-${x.sku}`} title={x.sku}>
                  <span className="inline-block h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: x.variant.colorHex || "#e8e6e1" }} />
                  {x.variant.color || x.sku}{x.status === "published" ? " ✓" : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {msg ? <p className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "err" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role="status">{msg.text}</p> : null}

      {!creating && p.readiness ? (
        <div className={card} data-testid="product-readiness">
          {blockers.length && p.status !== "published" ? (
            <>
              <div className="font-bold text-slate-900">{blockers.length} {blockers.length === 1 ? "item" : "items"} remaining before publishing</div>
              <ul className="mt-2 grid gap-1.5">
                {blockers.map((b, i) => {
                  const t = targetOf(b);
                  return <li key={i}><button type="button" className="flex min-h-[40px] w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => jump(t.tab, t.focus)}><span className="text-slate-400">○</span><span className="flex-1">{b.split(":")[0].replace(/\.$/, "")}</span><span className="text-xs font-bold text-blue-700">{TABS.find((x) => x.id === t.tab)?.label} →</span></button></li>;
                })}
              </ul>
            </>
          ) : <div className="font-bold text-emerald-700">{p.status === "published" ? "✓ Published. Customers see it once the Shower Studio is public." : "✓ Ready to publish."}</div>}
          {dirty ? <p className="mt-1 text-xs text-amber-700">Save to update this list.</p> : null}
          {p.source?.pendingReview?.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {p.source.pendingReview.length} manufacturer change(s) since your last review.
              <button type="button" className="font-bold underline" onClick={() => setDetails(true)}>See</button>
              <button type="button" className="font-bold underline" disabled={busy} onClick={() => assetCall(() => adminStudio.sourceReviewed(p._id), "Marked as reviewed.")}>Mark reviewed</button>
            </div>
          ) : null}
          <button type="button" className="mt-2 text-xs font-bold text-slate-500 underline" onClick={() => setDetails((x) => !x)}>{details ? "Hide details" : "Show details"}</button>
          {details ? (
            <div className="mt-2 space-y-2 text-xs text-slate-600">
              {p.imaging ? <p data-testid="product-imaging">Customer photos: <b>{p.imaging.publicPhotos}</b>{p.imaging.manufacturerImages ? <> · manufacturer images: {p.imaging.manufacturerImages} (rights {p.imaging.imageRights === "approved" ? "confirmed" : p.imaging.imageRights === "denied" ? "denied" : "unconfirmed - preview only"})</> : null} · texture: {p.imaging.texture ? (p.imaging.texture === "owner" ? "your own" : p.imaging.texture) : "none (pattern drawn)"} · preview: {p.imaging.visualization === "needs-review" ? "needs your check" : p.imaging.visualization}</p> : null}
              {blockers.length ? <ul className="list-disc pl-5">{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul> : null}
              {p.source?.pendingReview?.length ? <ul className="list-disc pl-5 text-amber-900">{p.source.pendingReview.map((r: any, i: number) => <li key={i}>{r.message}</li>)}</ul> : null}
              {p.issues?.length ? <ul className="list-disc pl-5">{p.issues.map((x: any, i: number) => <li key={i}>{x.message}</li>)}</ul> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {creating ? (
        <>
          <Section title="Product & pricing">{productSection}</Section>
          <Section title="Drawing and fit settings">{advancedSection}</Section>
        </>
      ) : (
        <div className={card}>
          <div id="editor-tabs" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`editor-tab-${t.id}`}
                className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold transition ${tab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t.label}</button>
            ))}
          </div>
          {tab === "product" ? productSection : tab === "photos" ? photosSection : tab === "publish" ? publishSection : advancedSection}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={card}><h4 className="mb-3 font-bold text-slate-900">{title}</h4>{children}</div>;
}
function Field({ label, error, children, wide }: { label: string; error?: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`${lab} ${wide ? "sm:col-span-2" : ""}`}>{label}{children}{error ? <span className="normal-case tracking-normal text-red-600">{error}</span> : null}</label>;
}

export function EngineField({ f, value, error, onChange }: { f: any; value: any; error?: string; onChange: (v: any) => void }) {
  const title = `${f.label}${f.kind === "number" && f.unit ? ` (${f.unit})` : ""}${f.required ? "" : " - optional"}`;
  let input: React.ReactNode;
  if (f.kind === "number") input = <input className={inputClass} inputMode="decimal" value={value ?? ""} placeholder={f.default != null ? String(f.default) : ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} data-testid={`eng-${f.key}`} />;
  else if (f.kind === "color") input = <div className="flex gap-2"><input type="color" className="h-11 w-14 rounded-lg border border-slate-300" value={value || f.default || "#ffffff"} onChange={(e) => onChange(e.target.value)} /><input className={inputClass} value={value || ""} placeholder={f.default || "#ffffff"} onChange={(e) => onChange(e.target.value)} data-testid={`eng-${f.key}`} /></div>;
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
        <button type="button" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700" onClick={() => onChange([...list, { id: `drain${list.length + 1}`, name: "Drain", along: 0.5, across: 0.5 }])}>+ Drain</button>
      </div>
    );
  }
  return <label className={`${lab} ${f.kind === "drains" ? "sm:col-span-2" : ""}`}>{title}{input}{error ? <span className="normal-case tracking-normal text-red-600">{error}</span> : f.help ? <span className="font-normal normal-case tracking-normal text-slate-400">{f.help}</span> : null}</label>;
}

