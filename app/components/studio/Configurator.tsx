"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { autoFix } from "@/lib/studio/engine/compat.js";
import ProductArt, { type ArtKind } from "./ProductArt";
import DesignPanel, { Messages } from "./DesignPanel";
import type { EngineSnapshot } from "./useStudioEngine";

/**
 * The customer configurator: one section per choice (walls, base, faucet,
 * door, extras), stacked - no sideways scrolling. A closed section shows what
 * is chosen; an open one shows the options as picture cards, each with its
 * price difference against the current design.
 *
 * Price differences are never "this product minus that product": each
 * candidate is the whole design with that option (after the engine's own
 * compatibility fixes), priced by the server's pricing engine.
 */
export type SectionId = "walls" | "base" | "fixture" | "door" | "extras";
type PriceApi = (designs: unknown[], projectType: string) => Promise<{ totals: (number | null)[] }>;

export const money0 = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
function deltaText(d: number | null | undefined) {
  if (d === undefined) return "…";
  if (d === null) return "Price on review";
  if (Math.abs(d) < 50) return "Same price";
  return d > 0 ? `+${money0(d)}` : `−${money0(-d)}`;
}

function familiesOf(list: any[]) {
  const out: { key: string; name: string; items: any[] }[] = [];
  const at = new Map<string, number>();
  for (const x of list) {
    const key = x.family?.key || `sku:${x.id}`;
    if (!at.has(key)) { at.set(key, out.length); out.push({ key, name: x.family?.label || x.label || x.name, items: [] }); }
    out[at.get(key)!].items.push(x);
  }
  return out;
}
const testKey = (k: string) => k.replace(/[^\w-]+/g, "-").slice(0, 60);
/** The variant a family card stands for: the chosen one, else the same colour and size as now, else the first. */
function representative(items: any[], current: any) {
  return items.find((x) => x.id === current?.id)
    || items.find((x) => x.variant?.color && x.variant.color === current?.variant?.color && x.variant?.size === current?.variant?.size)
    || items.find((x) => x.variant?.color && x.variant.color === current?.variant?.color)
    || items[0];
}

export default function Configurator({ snap, engine, catalog, kind, projectType, priceApi, demo, open, setOpen, onChanged, onReview }: {
  snap: EngineSnapshot; engine: () => any; catalog: any; kind: "shower" | "tub"; projectType: string; priceApi: PriceApi; demo?: boolean;
  open: SectionId | null; setOpen: (s: SectionId | null) => void; onChanged: (changes: string[]) => void; onReview: () => void;
}) {
  const e = engine();
  const o = useMemo(() => snap.options || {}, [snap.options]);
  const d = snap.design;
  const cur = snap.current || {};
  const [details, setDetails] = useState<{ item: any; art: ArtKind } | null>(null);
  const change = (fn: (x: any) => void, opts?: any) => onChanged(e?.applyChange(fn, opts) || []);

  const sections: { id: SectionId; title: string; summary: string; art: ArtKind; item: any }[] = [
    { id: "walls", title: "Walls", summary: [cur.finish?.label, cur.finish?.variant?.color].filter(Boolean).join(" · "), art: "finish", item: cur.finish },
    { id: "base", title: kind === "tub" ? "Bathtub" : "Shower base", summary: [cur.base?.label, cur.base?.variant?.size].filter(Boolean).join(" · "), art: "base", item: cur.base },
    { id: "fixture", title: "Faucet & shower", summary: cur.fixture?.label || "", art: "fixture", item: cur.fixture },
    { id: "door", title: kind === "tub" ? "Door or curtain" : "Shower door", summary: cur.enclosure ? cur.enclosure.label : "No door", art: cur.enclosure ? "enclosure" : "none", item: cur.enclosure },
    { id: "extras", title: "Extras", summary: d?.accessories?.length ? d.accessories.map((a: any) => (catalog.accessories || []).find((x: any) => x.id === a.productId)?.label).filter(Boolean).join(", ") : "None added", art: "accessory", item: (catalog.accessories || []).find((x: any) => x.id === d?.accessories?.[0]?.productId) },
  ];

  // ---------------------------------------------------------------- candidates for the open section
  const candidates = useMemo(() => {
    if (!d || !open) return [] as { key: string; design: any }[];
    const with_ = (fn: (x: any) => void) => { const x = structuredClone(d); fn(x); return autoFix(x, catalog).design; };
    const out: { key: string; design: any }[] = [];
    if (open === "walls") for (const f of o.finishes || []) out.push({ key: `finish:${f.id}`, design: with_((x) => { x.finishId = f.id; }) });
    if (open === "base") for (const b of (o.bases || []).filter((b: any) => b.kind === cur.base?.kind)) out.push({ key: `base:${b.id}`, design: with_((x) => { x.baseId = b.id; }) });
    if (open === "fixture") for (const f of o.fixtures || []) out.push({ key: `fixture:${f.id}`, design: with_((x) => { x.fixtureId = f.id; }) });
    if (open === "door") {
      out.push({ key: "enc:none", design: with_((x) => { x.enclosureId = "none"; x.curtain = false; }) });
      for (const en of o.enclosures || []) out.push({ key: `enc:${en.id}`, design: with_((x) => { x.enclosureId = en.id; }) });
    }
    if (open === "extras") {
      for (const a of o.accessories || []) {
        const has = d.accessories.find((x: any) => x.productId === a.id);
        out.push({ key: `acc:${a.id}`, design: with_((x) => {
          if (has) x.accessories = x.accessories.filter((y: any) => y.key !== has.key);
          else x.accessories.push(a.type === "shelf" ? { key: "price-check", productId: a.id, corner: x.measure.leftWall ? "left" : "right", y: 50 } : { key: "price-check", productId: a.id, wall: "facing", orientation: "horizontal", u: 20, y: 40 });
        }) });
      }
    }
    return out;
  }, [d, open, o, catalog, cur.base?.kind]);

  const [totals, setTotals] = useState<Map<string, number | null>>(new Map());
  const [base, setBase] = useState<number | null | undefined>(undefined);
  const cache = useRef(new Map<string, number | null>());
  const reqKey = useMemo(() => JSON.stringify({ d, projectType, keys: candidates.map((c) => c.key) }), [d, projectType, candidates]);
  useEffect(() => {
    if (!d || !candidates.length) return;
    let live = true;
    const t = window.setTimeout(async () => {
      const designs = [d, ...candidates.map((c) => c.design)];
      const keys = designs.map((x) => `${projectType}|${JSON.stringify(x)}`);
      const missing = keys.map((k, i) => (cache.current.has(k) ? -1 : i)).filter((i) => i >= 0);
      try {
        for (let i = 0; i < missing.length; i += 40) {
          const part = missing.slice(i, i + 40);
          const r = await priceApi(part.map((j) => designs[j]), projectType);
          part.forEach((j, n) => cache.current.set(keys[j], r.totals[n] ?? null));
        }
      } catch { /* the cards show "…"; the main total still comes from the quote */ }
      if (!live) return;
      setBase(cache.current.get(keys[0]));
      setTotals(new Map(candidates.map((c, i) => [c.key, cache.current.has(keys[i + 1]) ? cache.current.get(keys[i + 1])! : (undefined as any)])));
    }, 220);
    return () => { live = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);
  const delta = (key: string): number | null | undefined => {
    if (!totals.has(key) || base === undefined) return undefined;
    const t = totals.get(key);
    if (t === undefined) return undefined;
    if (t === null || base === null) return null;
    return t - base;
  };

  /** Open a section and bring it just below the picture (it stays visible above). */
  const go = (id: SectionId | null) => {
    setOpen(id);
    if (id) window.setTimeout(() => document.getElementById(`studio-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  if (!e || !d) return null;
  const idx = sections.findIndex((s) => s.id === open);
  const next = idx >= 0 && idx < sections.length - 1 ? sections[idx + 1] : null;

  return (
    <div className="grid gap-3" data-testid="configurator">
      {demo ? <p className="m-0 text-center text-[12px] font-semibold uppercase tracking-wide text-[#8A5200]">Demo prices</p> : null}
      {sections.map((s) => {
        const isOpen = open === s.id;
        return (
          <section key={s.id} id={`studio-section-${s.id}`} className={`scroll-mt-[calc(30vh+110px)] overflow-hidden rounded-3xl border bg-white transition-shadow sm:scroll-mt-[calc(40vh+110px)] lg:scroll-mt-32 ${isOpen ? "border-[#BFD0F7] shadow-[0_10px_30px_rgba(48,110,236,0.10)]" : "border-[#E3E8F1]"}`}>
            <button type="button" onClick={() => go(isOpen ? null : s.id)} aria-expanded={isOpen} data-testid={`section-${s.id}`}
              className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <ProductArt kind={s.art} item={s.item} label={false} className="h-12 w-12 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">{s.title}</span>
                <span className="block truncate text-[15px] font-semibold text-[#0B1628]">{s.summary || "Choose"}</span>
              </span>
              <span className={`grid h-8 w-8 place-items-center rounded-full bg-[#F1F5FF] text-[#306EEC] transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>⌄</span>
            </button>
            {isOpen ? (
              <div className="border-t border-[#EEF2F8] px-3 pb-4 pt-3 sm:px-4">
                {s.id === "walls" || s.id === "base" ? (
                  <FamilyGrid list={s.id === "walls" ? o.finishes || [] : (o.bases || []).filter((b: any) => b.kind === cur.base?.kind)}
                    selected={s.id === "walls" ? cur.finish : cur.base} art={s.id === "walls" ? "finish" : "base"} prefix={s.id === "walls" ? "finish" : "base"}
                    delta={(id) => delta(`${s.id === "walls" ? "finish" : "base"}:${id}`)} onDetails={(item) => setDetails({ item, art: s.id === "walls" ? "finish" : "base" })}
                    onPick={(id) => (s.id === "walls" ? change((x) => { x.finishId = id; }, { finishOnly: true }) : change((x) => { x.baseId = id; }))} />
                ) : null}
                {s.id === "fixture" ? (
                  <Grid>{(o.fixtures || []).map((f: any) => <OptionCard key={f.id} testId={`fixture-${f.id}`} item={f} art="fixture" selected={f.id === d.fixtureId} delta={delta(`fixture:${f.id}`)} onDetails={() => setDetails({ item: f, art: "fixture" })} onPick={() => change((x) => { x.fixtureId = f.id; })} />)}</Grid>
                ) : null}
                {s.id === "door" ? (
                  <>
                    <Grid>
                      <OptionCard testId="enclosure-none" item={{ label: kind === "tub" ? "No door" : "Open (no door)" }} art="none" selected={d.enclosureId === "none"} delta={delta("enc:none")} onPick={() => change((x) => { x.enclosureId = "none"; x.curtain = false; })} />
                      {(o.enclosures || []).map((en: any) => <OptionCard key={en.id} testId={`enclosure-${en.id}`} item={en} art="enclosure" selected={en.id === d.enclosureId} delta={delta(`enc:${en.id}`)} onDetails={() => setDetails({ item: en, art: "enclosure" })} onPick={() => change((x) => { x.enclosureId = en.id; if (en.kind !== "rod") x.curtain = false; })} />)}
                    </Grid>
                    {cur.enclosure?.kind === "rod" ? <label className="mt-3 flex min-h-[44px] items-center gap-3 text-[14px] text-[#0B1628]"><input type="checkbox" className="h-5 w-5" checked={d.curtain} onChange={(ev) => change((x) => { x.curtain = ev.target.checked; })} /> Show a curtain in the picture</label> : null}
                  </>
                ) : null}
                {s.id === "extras" ? (
                  <>
                    <p className="mb-2 mt-0 text-[13px] text-[#64748B]">Tap to add or remove.</p>
                    <Grid>
                      {(o.accessories || []).map((a: any) => {
                        const has = d.accessories.find((x: any) => x.productId === a.id);
                        return (
                          <OptionCard key={a.id} testId={`acc-${a.id}`} item={a} art="accessory" selected={Boolean(has)} selectedText="Added" delta={delta(`acc:${a.id}`)} onDetails={() => setDetails({ item: a, art: "accessory" })}
                            onPick={() => {
                              if (has) return onChanged(e.removeAccessory(has.key) || []);
                              const ch1 = e.addAccessory(a.type) || [];
                              const added = engine()?.S?.design?.accessories?.at(-1);
                              const ch2 = added && added.productId !== a.id ? e.updateAccessory(added.key, { productId: a.id }) || [] : [];
                              onChanged([...ch1, ...ch2]);
                            }} />
                        );
                      })}
                    </Grid>
                    {d.accessories.length ? (
                      <details className="mt-3 rounded-2xl bg-[#F8FAFF] p-3 text-[14px]">
                        <summary className="cursor-pointer font-semibold text-[#306EEC]">Adjust where they go</summary>
                        <div className="mt-2"><DesignPanel snap={snap} engine={engine} section="extras" onChanged={onChanged} /></div>
                      </details>
                    ) : null}
                  </>
                ) : null}
                <Messages list={snap.messages.design.filter((m) => m.kind === "err")} className="mt-3" />
                <button type="button" onClick={() => (next ? go(next.id) : onReview())} className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#0B1628] px-4 text-[15px] font-semibold text-white" data-testid={`section-next-${s.id}`}>
                  {next ? `Next: ${next.title}` : "Review my design"}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
      {details ? <DetailsSheet {...details} onClose={() => setDetails(null)} /> : null}
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">{children}</div>;

function OptionCard({ item, art, selected, delta, onPick, onDetails, testId, selectedText = "Selected", sub }: {
  item: any; art: ArtKind; selected: boolean; delta: number | null | undefined; onPick: () => void; onDetails?: () => void; testId?: string; selectedText?: string; sub?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white transition ${selected ? "border-[#306EEC] ring-2 ring-[#306EEC]" : "border-[#E3E8F1] hover:border-[#9DB6F2]"}`}>
      <button type="button" onClick={onPick} aria-pressed={selected} data-testid={testId} className="block w-full text-left">
        <ProductArt kind={art} item={item} className="aspect-[4/3] w-full" />
        <span className="block px-2.5 pb-2.5 pt-2">
          <span className="line-clamp-2 block min-h-[2.4em] text-[13.5px] font-semibold leading-tight text-[#0B1628]">{item?.label || item?.name}</span>
          {sub ? <span className="mt-0.5 block truncate text-[12px] text-[#64748B]">{sub}</span> : null}
          <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${selected ? "bg-[#306EEC] text-white" : delta === null ? "bg-[#FFF5E5] text-[#8A5200]" : "bg-[#F1F5FF] text-[#2558c9]"}`} data-testid={testId ? `${testId}-delta` : undefined}>
            {selected ? selectedText : deltaText(delta)}
          </span>
        </span>
      </button>
      {selected ? <span className="pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#306EEC] text-[13px] text-white" aria-hidden>✓</span> : null}
      {onDetails && item?.name ? <button type="button" onClick={onDetails} className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[13px] font-bold text-[#475569] shadow" aria-label={`Details: ${item.label || item.name}`}>i</button> : null}
    </div>
  );
}

/** One card per product family; the chosen family shows its sizes and colours as chips (wrapping, never sideways). */
function FamilyGrid({ list, selected, art, prefix, delta, onPick, onDetails }: {
  list: any[]; selected: any; art: ArtKind; prefix: string; delta: (id: string) => number | null | undefined; onPick: (id: string) => void; onDetails: (item: any) => void;
}) {
  const fams = familiesOf(list);
  const current = fams.find((f) => f.items.some((x) => x.id === selected?.id));
  const sizes = current ? [...new Set(current.items.map((x) => x.variant?.size || ""))].filter(Boolean) : [];
  const colours = current && selected ? current.items.filter((x) => (x.variant?.size || "") === (selected.variant?.size || "")) : [];
  return (
    <>
      <Grid>
        {fams.map((fm) => {
          const rep = representative(fm.items, selected);
          const many = fm.items.length > 1;
          const isSel = fm.items.some((x) => x.id === selected?.id);
          return (
            <OptionCard key={fm.key} testId={many ? `family-${prefix}-${testKey(fm.key)}` : `${prefix}-${rep.id}`} item={{ ...rep, label: fm.name }} art={art} selected={isSel}
              sub={many ? `${fm.items.length} options` : rep.variant?.size || undefined} delta={delta(rep.id)} onPick={() => onPick(rep.id)} onDetails={() => onDetails(rep)} />
          );
        })}
      </Grid>
      {current && current.items.length > 1 && selected ? (
        <div className="mt-3 grid gap-3 rounded-2xl bg-[#F4F7FC] p-3" data-testid={`variants-${prefix}`}>
          {sizes.length > 1 ? (
            <div>
              <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">Size</div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => {
                  const pick = current.items.find((x) => (x.variant?.size || "") === sz && x.variant?.color === selected.variant?.color) || current.items.find((x) => (x.variant?.size || "") === sz)!;
                  const on = (selected.variant?.size || "") === sz;
                  const dl = delta(pick.id);
                  return <button key={sz} type="button" aria-pressed={on} onClick={() => onPick(pick.id)} className={`min-h-[44px] rounded-xl border px-3 text-[13px] ${on ? "border-[#306EEC] bg-white font-semibold text-[#0B1628]" : "border-[#DDE3EE] bg-white text-[#475569]"}`}>{sz}{!on && dl ? <span className="ml-1.5 text-[#2558c9]">{deltaText(dl)}</span> : null}</button>;
                })}
              </div>
            </div>
          ) : null}
          {colours.length > 1 || colours[0]?.variant?.color ? (
            <div>
              <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#64748B]">Color: <span className="normal-case text-[#0B1628]">{selected.variant?.color}</span></div>
              <div className="flex flex-wrap gap-2">
                {colours.map((x) => {
                  const on = x.id === selected.id;
                  const dl = delta(x.id);
                  return (
                    <button key={x.id} type="button" aria-pressed={on} title={x.variant?.color || x.label} onClick={() => onPick(x.id)} data-testid={`${prefix}-${x.id}`}
                      className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 text-[13px] ${on ? "border-[#306EEC] bg-white font-semibold text-[#0B1628]" : "border-[#DDE3EE] bg-white text-[#475569]"}`}>
                      <span className="inline-block h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: x.variant?.colorHex || "#e8e6e1" }} />
                      {x.variant?.color || "Standard"}{!on && dl && Math.abs(dl) >= 50 ? <span className="text-[#2558c9]">{deltaText(dl)}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function DetailsSheet({ item, art, onClose }: { item: any; art: ArtKind; onClose: () => void }) {
  const size = item.variant?.size || (item.dims ? `${item.dims.length}″ × ${item.dims.width}″` : item.length ? `${item.length}″` : "");
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="Product details">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(ev) => ev.stopPropagation()}>
        <ProductArt kind={art} item={item} className="aspect-[4/3] w-full rounded-2xl" />
        <h3 className="mt-4 text-[18px] font-bold text-[#0B1628]">{item.label || item.name}</h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
          {[["Product", item.name], ["Maker", item.manufacturer], ["Model", item.model], ["Size", size], ["Color", item.variant?.color]].filter(([, v]) => v).map(([k, v]) => (
            <Fragment key={k}><dt className="text-[#64748B]">{k}</dt><dd className="text-[#0B1628]">{v}</dd></Fragment>
          ))}
        </dl>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#64748B]">{item.photo ? "Product photo." : "The picture is an illustration drawn from the product's size and color, not a photo of the product."} Fit and finish are confirmed at the free in-home measurement.</p>
        <button type="button" onClick={onClose} className="mt-4 min-h-[48px] w-full rounded-2xl bg-[#0B1628] text-[15px] font-semibold text-white">Close</button>
      </div>
    </div>
  );
}
