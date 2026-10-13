"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { autoFix, plumbingHand } from "@/lib/studio/engine/compat.js";
import ProductArt, { type ArtKind } from "../ProductArt";
import { useEscape } from "./useEscape";
import { Icon, T } from "./ui";
import { usePriceDeltas, deltaText, type PriceApi, type Candidate } from "./usePriceDeltas";
import type { EngineSnapshot } from "../useStudioEngine";

export type Category = "walls" | "base" | "fixture" | "door" | "extras" | "layout";

// ------------------------------------------------------------------ catalog helpers
type Fam = { key: string; name: string; items: any[] };
export function familiesOf(list: any[]): Fam[] {
  const out: Fam[] = [];
  const at = new Map<string, number>();
  for (const x of list) {
    const key = x.family?.key || `sku:${x.id}`;
    if (!at.has(key)) { at.set(key, out.length); out.push({ key, name: x.family?.label || x.label || x.name, items: [] }); }
    out[at.get(key)!].items.push(x);
  }
  return out;
}
const testKey = (k: string) => k.replace(/[^\w-]+/g, "-").slice(0, 60);
const colorName = (x: any) => x?.variant?.color || "";
const hexOf = (x: any) => {
  const c = x?.variant?.colorHex ?? x?.color ?? x?.finishColor ?? x?.frameColor ?? x?.render?.finishColor ?? x?.render?.color;
  return typeof c === "number" ? `#${c.toString(16).padStart(6, "0")}` : typeof c === "string" ? c : "#e8e6e1";
};
/** Size without the drain side: the drain end follows the plumbing, so customers never pick it. */
const sizeOf = (x: any) => String(x?.variant?.size || "").replace(/,?\s*(left|right)[- ]hand drain/i, "").trim();
const drainHandOf = (x: any) => (x?.drains || []).map((d: any) => d.id).find((id: string) => id === "left" || id === "right") || null;

/** The variant a family card stands for: the chosen one, else the same colour (and drain hand), else the first. */
function representative(items: any[], current: any, hand: string | null) {
  const pool = hand && items.some((x) => drainHandOf(x) === hand) ? items.filter((x) => !drainHandOf(x) || drainHandOf(x) === hand) : items;
  return pool.find((x) => x.id === current?.id)
    || pool.find((x) => colorName(x) && colorName(x) === colorName(current) && sizeOf(x) === sizeOf(current))
    || pool.find((x) => colorName(x) && colorName(x) === colorName(current))
    || pool[0] || items[0];
}

function finishLook(f: any) {
  const t = f?.pattern?.type || "smooth";
  if (t === "marble") return "Marble look";
  if (t === "stone") return "Stone look";
  if (t === "beadboard") return "Beadboard";
  if (t === "tile") return "Tile look";
  return "Smooth";
}

// ------------------------------------------------------------------ the chooser
export default function Chooser({ category, snap, engine, catalog, projectType, priceApi, onChanged, onCategory, onOpenPhoto, onOpenMeasure, kind, onKind, setProjectType, source, focusAcc, setFocusAcc }: {
  category: Category; snap: EngineSnapshot; engine: () => any; catalog: any; projectType: string; priceApi: PriceApi;
  onChanged: (c: string[]) => void; onCategory: (c: Category) => void; onOpenPhoto: () => void; onOpenMeasure: () => void;
  kind: "shower" | "tub"; onKind: (k: "shower" | "tub") => void; setProjectType: (p: string) => void; source: "example" | "photo";
  focusAcc: string | null; setFocusAcc: (k: string | null) => void;
}) {
  const e = engine();
  const d = snap.design;
  const o = useMemo(() => snap.options || {}, [snap.options]);
  const cur = snap.current || {};
  const hand = plumbingHand(d);
  const [look, setLook] = useState<string>("All");
  const [details, setDetails] = useState<{ item: any; art: ArtKind } | null>(null);
  const change = (fn: (x: any) => void, opts?: any) => onChanged(e?.applyChange(fn, opts) || []);

  const lists = useMemo(() => ({
    walls: o.finishes || [],
    base: (o.bases || []).filter((b: any) => b.kind === cur.base?.kind),
    fixture: o.fixtures || [],
    door: o.enclosures || [],
    extras: o.accessories || [],
  }), [o, cur.base?.kind]);

  // ---------------------------------------------------------------- candidates (whole designs) for the price differences
  const candidates = useMemo(() => {
    if (!d) return [] as Candidate[];
    const with_ = (fn: (x: any) => void) => { const x = structuredClone(d); fn(x); return autoFix(x, catalog).design; };
    const out: Candidate[] = [];
    const add = (key: string, fn: (x: any) => void) => { if (!out.some((c) => c.key === key)) out.push({ key, design: with_(fn) }); };
    if (category === "walls") for (const f of lists.walls) add(`walls:${f.id}`, (x) => { x.finishId = f.id; });
    if (category === "base") for (const b of lists.base) add(`base:${b.id}`, (x) => { x.baseId = b.id; });
    if (category === "fixture") for (const f of lists.fixture) add(`fixture:${f.id}`, (x) => { x.fixtureId = f.id; });
    if (category === "door") {
      add("door:none", (x) => { x.enclosureId = "none"; x.curtain = false; });
      for (const en of lists.door) add(`door:${en.id}`, (x) => { x.enclosureId = en.id; x.curtain = Boolean(en.curtainColor != null); });
    }
    if (category === "extras") {
      for (const a of lists.extras) {
        const has = d.accessories.find((x: any) => x.productId === a.id);
        const sameFam = d.accessories.find((x: any) => (catalog.accessories || []).find((p: any) => p.id === x.productId)?.family?.key === a.family?.key && a.family?.key);
        add(`extras:${a.id}`, (x) => {
          if (has) x.accessories = x.accessories.filter((y: any) => y.key !== has.key);
          else if (sameFam) x.accessories = x.accessories.map((y: any) => (y.key === sameFam.key ? { ...y, productId: a.id } : y));
          else x.accessories.push(a.type === "shelf" ? { key: "price-check", productId: a.id, corner: x.measure.leftWall ? "left" : "right", y: 50 } : { key: "price-check", productId: a.id, wall: "facing", orientation: "horizontal", u: 20, y: 40 });
        });
      }
    }
    return out;
  }, [d, category, lists, catalog]);
  const delta = usePriceDeltas(d, candidates, projectType, priceApi);

  if (!e || !d) return null;

  // ---------------------------------------------------------------- categories
  if (category === "walls") {
    const looks = ["All", ...Array.from(new Set(familiesOf(lists.walls).map((f) => finishLook(f.items[0]))))];
    const fams = familiesOf(lists.walls).filter((f) => look === "All" || finishLook(f.items[0]) === look || f.items.some((x) => x.id === cur.finish?.id));
    return (
      <Section title="Choose your wall style" hint="Every style comes in several colors.">
        {looks.length > 2 ? (
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter wall styles">
            {looks.map((l) => (
              <button key={l} type="button" aria-pressed={look === l} onClick={() => setLook(l)}
                className={`min-h-[34px] rounded-full px-3 text-[13px] font-semibold transition ${look === l ? "bg-[#1C1B19] text-white" : "bg-[#F1EDE6] text-[#5F5A52] hover:bg-[#E8E2D8]"}`}>{l}</button>
            ))}
          </div>
        ) : null}
        <FamilyGrid fams={fams} selected={cur.finish} hand={null} art="finish" prefix="finish" catPrefix="walls" delta={delta}
          onPick={(id) => change((x) => { x.finishId = id; }, { finishOnly: true })} onDetails={(it) => setDetails({ item: it, art: "finish" })} />
        <Details value={details} onClose={() => setDetails(null)} />
      </Section>
    );
  }

  if (category === "base") {
    const isTub = cur.base?.kind === "tub";
    return (
      <Section title={isTub ? "Choose your bathtub" : "Choose your shower base"} hint={hand ? `The drain sits under your faucet, on the ${hand}.` : undefined}>
        <FamilyGrid fams={familiesOf(lists.base)} selected={cur.base} hand={hand} art="base" prefix="base" catPrefix="base" delta={delta}
          onPick={(id) => change((x) => { x.baseId = id; })} onDetails={(it) => setDetails({ item: it, art: "base" })} />
        <Details value={details} onClose={() => setDetails(null)} />
      </Section>
    );
  }

  if (category === "fixture") {
    return (
      <Section title="Choose your faucet & shower" hint={cur.base?.kind === "tub" ? "Tub packages include the spout." : undefined}>
        <FamilyGrid fams={familiesOf(lists.fixture)} selected={cur.fixture} hand={null} art="fixture" prefix="fixture" catPrefix="fixture" delta={delta}
          onPick={(id) => change((x) => { x.fixtureId = id; })} onDetails={(it) => setDetails({ item: it, art: "fixture" })} />
        <Details value={details} onClose={() => setDetails(null)} />
      </Section>
    );
  }

  if (category === "door") {
    const none = d.enclosureId === "none";
    return (
      <Section title={cur.base?.kind === "tub" ? "Door or curtain" : "Choose your shower door"}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <Card testId="enclosure-none" name={cur.base?.kind === "tub" ? "No door" : "Open, no door"} art={<ProductArt kind="none" className="aspect-[16/10] w-full" label={false} />}
            selected={none} deltaVal={delta("door:none")} onPick={() => change((x) => { x.enclosureId = "none"; x.curtain = false; })} />
          {familiesOf(lists.door).map((fm) => {
            const rep = representative(fm.items, cur.enclosure, null);
            const sel = fm.items.some((x) => x.id === d.enclosureId);
            const many = fm.items.length > 1;
            return (
              <Card key={fm.key} testId={many ? `family-enclosure-${testKey(fm.key)}` : `enclosure-${rep.id}`} name={fm.name} sub={many ? `${countVariants(fm.items)}` : undefined}
                art={<ProductArt kind="enclosure" item={rep} className="aspect-[16/10] w-full" />} selected={sel} deltaVal={delta(`door:${rep.id}`)}
                onPick={() => change((x) => { x.enclosureId = rep.id; x.curtain = rep.curtainColor != null; })} onDetails={() => setDetails({ item: rep, art: "enclosure" })} />
            );
          })}
        </div>
        {cur.enclosure ? <Variants fam={familiesOf(lists.door).find((f) => f.items.some((x) => x.id === d.enclosureId))} selected={cur.enclosure} prefix="enclosure" catPrefix="door" hand={null} delta={delta}
          onPick={(id) => { const en = lists.door.find((x: any) => x.id === id); change((x) => { x.enclosureId = id; x.curtain = en?.curtainColor != null; }); }} /> : null}
        <Details value={details} onClose={() => setDetails(null)} />
      </Section>
    );
  }

  if (category === "extras") {
    const byType: [string, string][] = [["grabBar", "Grab bars"], ["shelf", "Shelves"], ["seat", "Shower seats"]];
    const added = d.accessories.map((a: any) => ({ a, p: (catalog.accessories || []).find((x: any) => x.id === a.productId) })).filter((x: any) => x.p);
    return (
      <Section title="Add extras" hint="Optional. Tap to add; drag them on the picture to move.">
        {added.length ? (
          <div className="mb-5 grid gap-2">
            {added.map(({ a, p }: any) => (
              <AddedAccessory key={a.key} a={a} p={p} focused={focusAcc === a.key} engine={engine} onChanged={onChanged} setFocus={setFocusAcc}
                fam={familiesOf(lists.extras).find((f) => f.items.some((x) => x.id === p.id))} delta={delta} />
            ))}
          </div>
        ) : null}
        {byType.map(([type, title]) => {
          const fams = familiesOf(lists.extras.filter((x: any) => x.type === type));
          if (!fams.length) return null;
          return (
            <div key={type} className="mb-5">
              <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8C867C]">{title}</h4>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {fams.map((fm) => {
                  const has = d.accessories.find((x: any) => fm.items.some((it) => it.id === x.productId));
                  const rep = has ? fm.items.find((it) => it.id === has.productId) : fm.items[0];
                  return (
                    <Card key={fm.key} testId={`acc-${rep.id}`} name={fm.name} sub={fm.items.length > 1 ? countVariants(fm.items) : undefined}
                      art={<ProductArt kind="accessory" item={rep} className="aspect-[16/10] w-full" />} selected={Boolean(has)} selectedText="Added" deltaVal={delta(`extras:${rep.id}`)}
                      onPick={() => {
                        if (has) { onChanged(e.removeAccessory(has.key) || []); setFocusAcc(null); return; }
                        const ch1 = e.addAccessory(rep.type) || [];
                        const added2 = e.S.design.accessories.at(-1);
                        const ch2 = added2 && added2.productId !== rep.id ? e.updateAccessory(added2.key, { productId: rep.id }) || [] : [];
                        onChanged([...ch1, ...ch2]);
                        if (added2) setFocusAcc(added2.key);
                      }} onDetails={() => setDetails({ item: rep, art: "accessory" })} />
                  );
                })}
              </div>
            </div>
          );
        })}
        <Details value={details} onClose={() => setDetails(null)} />
      </Section>
    );
  }

  // ---------------------------------------------------------------- layout: shower or tub, plumbing side, size, photo
  const m = d.measure;
  const frontOpen = m.leftWall && m.rightWall;
  return (
    <Section title="Your bathroom">
      <Label>What are you designing?</Label>
      <div className="grid grid-cols-2 gap-3">
        {(["shower", "tub"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => onKind(k)} data-testid={`kind-${k}`}
            className={`flex min-h-[86px] flex-col items-start justify-between rounded-[18px] p-3.5 text-left ring-1 transition ${kind === k ? "bg-[#1C1B19] text-white ring-[#1C1B19]" : "bg-white text-[#1C1B19] ring-[#E7E1D8] hover:ring-[#1C1B19]/40"}`}>
            <Icon name={k === "tub" ? "tub" : "base"} className="h-7 w-7" />
            <span className="text-[15px] font-semibold">{k === "shower" ? "Walk-in shower" : "Bathtub"}</span>
          </button>
        ))}
      </div>
      {kind === "shower" ? (
        <div className="mt-4">
          <Label>What&rsquo;s there now?</Label>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-[#F1EDE6] p-1" role="group">
            {([["tub-to-shower", "A bathtub"], ["shower-replacement", "An old shower"]] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={projectType === v} onClick={() => setProjectType(v)} data-testid={`replacing-${v}`}
                className={`min-h-[42px] rounded-full text-[14px] font-semibold transition ${projectType === v ? "bg-white text-[#1C1B19] shadow-sm" : "text-[#5F5A52]"}`}>{l}</button>
            ))}
          </div>
        </div>
      ) : null}

      {frontOpen ? (
        <div className="mt-5">
          <Label>Where is the faucet?</Label>
          <p className="-mt-1 mb-2 text-[13px] text-[#8C867C]">The side where the plumbing is now. The drain goes on the same side.</p>
          <div className="grid grid-cols-2 gap-3">
            {(["left", "right"] as const).map((w) => (
              <button key={w} type="button" aria-pressed={d.plumbing?.wall === w} onClick={() => onChanged(e.setPlumbing(w) || [])} data-testid={`plumbing-${w}`}
                className={`rounded-[18px] p-3 text-left ring-1 transition ${d.plumbing?.wall === w ? "bg-white ring-2 ring-[#1C1B19]" : "bg-white ring-[#E7E1D8] hover:ring-[#1C1B19]/40"}`}>
                <PlumbingDiagram side={w} tub={kind === "tub"} />
                <span className="mt-2 block text-[14.5px] font-semibold text-[#1C1B19]">On the {w}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-2">
        <Label>Size and photo (optional)</Label>
        <Row icon="ruler" title={snap.design ? `${m.facingWidth}″ × ${m.sideLength}″` : ""} sub="Standard size. Enter yours for a closer estimate." action="Enter" onClick={onOpenMeasure} testId="open-measure" />
        <Row icon="camera" title={source === "photo" ? "Your photo" : "See it in your bathroom"} sub={source === "photo" ? "Change or adjust your photo." : "Take or choose a photo of your tub or shower."} action={source === "photo" ? "Change" : "Add"} onClick={onOpenPhoto} testId="open-photo" />
      </div>
      <button type="button" className="mt-5 text-[14px] font-semibold text-[#5F5A52] underline underline-offset-4" onClick={() => onCategory("walls")}>Back to the walls</button>
    </Section>
  );
}

// ------------------------------------------------------------------ pieces
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="studio-fade">
      <h3 className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[#1C1B19] sm:text-[20px]">{title}</h3>
      {hint ? <p className="studio-hint mt-0.5 text-[13px] text-[#8C867C]">{hint}</p> : null}
      <div className="mt-3 sm:mt-4">{children}</div>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8C867C]">{children}</div>;
}
function Row({ icon, title, sub, action, onClick, testId }: { icon: string; title: string; sub: string; action: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-[64px] items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-[#E7E1D8] transition hover:ring-[#1C1B19]/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F1EDE6] text-[#1C1B19]"><Icon name={icon} className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-[#1C1B19]">{title}</span><span className="block text-[13px] text-[#8C867C]">{sub}</span></span>
      <span className="shrink-0 rounded-full bg-[#F1EDE6] px-3 py-1.5 text-[13px] font-semibold text-[#1C1B19]">{action}</span>
    </button>
  );
}

const countVariants = (items: any[]) => {
  const colors = new Set(items.map(colorName).filter(Boolean)).size;
  const sizes = new Set(items.map(sizeOf).filter(Boolean)).size;
  return [colors > 1 ? `${colors} colors` : "", sizes > 1 ? `${sizes} sizes` : ""].filter(Boolean).join(" · ") || "";
};

export function DeltaPill({ value, selected, selectedText = "Selected", testId }: { value: number | null | undefined; selected?: boolean; selectedText?: string; testId?: string }) {
  if (selected) return <span className="inline-flex items-center gap-1 rounded-full bg-[#1C1B19] px-2.5 py-[3px] text-[12px] font-semibold text-white" data-testid={testId}>{selectedText}</span>;
  const txt = deltaText(value);
  const neg = typeof value === "number" && value <= -50;
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold tabular-nums ${value === undefined ? "bg-[#F1EDE6] text-[#B5AEA3]" : neg ? "bg-[#E7F1EB] text-[#2F6B4F]" : value === null ? "bg-[#F1EDE6] text-[#5F5A52]" : "bg-[#F1EDE6] text-[#1C1B19]"}`}>{txt}</span>
  );
}

function Card({ testId, name, sub, art, selected, deltaVal, onPick, onDetails, selectedText }: {
  testId: string; name: string; sub?: string; art: React.ReactNode; selected: boolean; deltaVal: number | null | undefined; onPick: () => void; onDetails?: () => void; selectedText?: string;
}) {
  return (
    <div className="relative">
      <button type="button" onClick={onPick} aria-pressed={selected} data-testid={testId}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-white text-left transition duration-150 active:scale-[0.985] ${selected ? "ring-2 ring-[#1C1B19] shadow-[0_10px_26px_rgba(28,27,25,0.12)]" : "ring-1 ring-[#E7E1D8] hover:ring-[#1C1B19]/35"}`}>
        <div className="relative w-full overflow-hidden bg-[#F6F3EE]">{art}</div>
        <div className="flex flex-1 flex-col gap-1 px-3 pb-2.5 pt-2">
          <span className="line-clamp-2 text-[13.5px] font-semibold leading-[1.25] text-[#1C1B19]">{name}</span>
          <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <DeltaPill value={deltaVal} selected={selected} selectedText={selectedText} testId={`${testId}-delta`} />
            {sub ? <span className="text-[11.5px] text-[#8C867C]">{sub}</span> : null}
          </span>
        </div>
      </button>
      {selected ? <span className="pointer-events-none absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#1C1B19] text-white shadow" aria-hidden><Icon name="check" className="h-4 w-4" /></span> : null}
      {onDetails ? (
        <button type="button" onClick={onDetails} aria-label={`Details: ${name}`} className="absolute left-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#5F5A52] shadow-sm ring-1 ring-black/5 transition hover:text-[#1C1B19]">
          <Icon name="info" className="h-[18px] w-[18px]" />
        </button>
      ) : null}
    </div>
  );
}

function FamilyGrid({ fams, selected, hand, art, prefix, catPrefix, delta, onPick, onDetails }: {
  fams: Fam[]; selected: any; hand: string | null; art: ArtKind; prefix: string; catPrefix: string;
  delta: (k: string) => number | null | undefined; onPick: (id: string) => void; onDetails: (it: any) => void;
}) {
  const current = fams.find((f) => f.items.some((x) => x.id === selected?.id));
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {fams.map((fm) => {
          const rep = representative(fm.items, selected, hand);
          const many = fm.items.length > 1;
          const isSel = fm.items.some((x) => x.id === selected?.id);
          return (
            <Card key={fm.key} testId={many ? `family-${prefix}-${testKey(fm.key)}` : `${prefix}-${rep.id}`} name={fm.name} sub={many ? countVariants(fm.items) : sizeOf(rep) || undefined}
              art={<ProductArt kind={art} item={isSel ? selected : rep} className="aspect-[16/10] w-full" />} selected={isSel} deltaVal={delta(`${catPrefix}:${rep.id}`)}
              onPick={() => onPick(rep.id)} onDetails={() => onDetails(isSel ? selected : rep)} />
          );
        })}
      </div>
      {current ? <Variants fam={current} selected={selected} prefix={prefix} catPrefix={catPrefix} hand={hand} delta={delta} onPick={onPick} /> : null}
    </>
  );
}

/** Size and colour choices for the chosen family, each with its price difference. */
function Variants({ fam, selected, prefix, catPrefix, hand, delta, onPick }: {
  fam?: Fam; selected: any; prefix: string; catPrefix: string; hand: string | null; delta: (k: string) => number | null | undefined; onPick: (id: string) => void;
}) {
  if (!fam || fam.items.length < 2 || !selected) return null;
  const pool = hand && fam.items.some((x) => drainHandOf(x) === hand) ? fam.items.filter((x) => !drainHandOf(x) || drainHandOf(x) === hand) : fam.items;
  const sizes = [...new Set(pool.map(sizeOf))].filter(Boolean);
  const colours = pool.filter((x) => sizeOf(x) === sizeOf(selected));
  const showColours = colours.length > 1 || Boolean(colorName(colours[0]));
  if (sizes.length < 2 && !showColours) return null;
  return (
    <div className="studio-fade mt-4 grid gap-4 rounded-[20px] bg-[#F6F3EE] p-4" data-testid={`variants-${prefix}`}>
      {sizes.length > 1 ? (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-[#5F5A52]">Size</div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((sz) => {
              const pick = pool.find((x) => sizeOf(x) === sz && colorName(x) === colorName(selected)) || pool.find((x) => sizeOf(x) === sz)!;
              const on = sizeOf(selected) === sz;
              const dl = delta(`${catPrefix}:${pick.id}`);
              return (
                <button key={sz} type="button" aria-pressed={on} onClick={() => onPick(pick.id)}
                  className={`min-h-[44px] rounded-full px-4 text-[14px] transition ${on ? "bg-[#1C1B19] font-semibold text-white" : "bg-white text-[#1C1B19] ring-1 ring-[#E1DACF]"}`}>
                  {sz}{!on && typeof dl === "number" && Math.abs(dl) >= 50 ? <span className={`ml-1.5 ${dl < 0 ? "text-[#2F6B4F]" : "text-[#8C867C]"}`}>{deltaText(dl)}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {showColours ? (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-[#5F5A52]">Color <span className="font-normal text-[#1C1B19]">· {colorName(selected) || "Standard"}</span></div>
          <div className="flex flex-wrap gap-2.5">
            {colours.map((x) => {
              const on = x.id === selected.id;
              const dl = delta(`${catPrefix}:${x.id}`);
              return (
                <button key={x.id} type="button" aria-pressed={on} aria-label={colorName(x) || x.label} title={colorName(x) || x.label} onClick={() => onPick(x.id)} data-testid={`${prefix}-${x.id}`}
                  className="group flex w-[64px] flex-col items-center gap-1 text-center">
                  <span className={`block h-12 w-12 rounded-full transition ${on ? "ring-2 ring-[#1C1B19] ring-offset-2 ring-offset-[#F6F3EE]" : "ring-1 ring-black/10 group-hover:ring-black/30"}`} style={{ background: hexOf(x) }} />
                  <span className={`text-[11.5px] leading-tight ${on ? "font-semibold text-[#1C1B19]" : "text-[#5F5A52]"}`}>{colorName(x) || "Standard"}</span>
                  {!on && typeof dl === "number" && Math.abs(dl) >= 50 ? <span className={`text-[11px] tabular-nums ${dl < 0 ? "text-[#2F6B4F]" : "text-[#8C867C]"}`}>{deltaText(dl)}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddedAccessory({ a, p, fam, focused, engine, onChanged, setFocus, delta }: {
  a: any; p: any; fam?: Fam; focused: boolean; engine: () => any; onChanged: (c: string[]) => void; setFocus: (k: string | null) => void; delta: (k: string) => number | null | undefined;
}) {
  const e = engine();
  const nudge = (du: number, dy: number) => onChanged(e.nudgeAccessory(a.key, du, dy) || []);
  return (
    <div className={`rounded-[20px] bg-white p-3 ring-1 transition ${focused ? "ring-2 ring-[#1C1B19]" : "ring-[#E7E1D8]"}`} data-testid={`added-${a.key}`}>
      <div className="flex items-center gap-3">
        <ProductArt kind="accessory" item={p} label={false} className="h-14 w-14 shrink-0 rounded-xl" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setFocus(focused ? null : a.key)}>
          <span className="block truncate text-[15px] font-semibold text-[#1C1B19]">{p.family?.label || p.label}</span>
          <span className="block text-[12.5px] text-[#8C867C]">{[p.variant?.size, colorName(p)].filter(Boolean).join(" · ") || "Added"} · drag it on the picture</span>
        </button>
        <button type="button" aria-label={`Remove ${p.label}`} className="grid h-10 w-10 place-items-center rounded-full text-[#8C867C] hover:bg-black/5 hover:text-[#1C1B19]" onClick={() => { onChanged(e.removeAccessory(a.key) || []); setFocus(null); }}>
          <Icon name="trash" className="h-5 w-5" />
        </button>
      </div>
      {focused ? (
        <div className="studio-fade mt-3 grid gap-3">
          {fam && fam.items.length > 1 ? (
            <Variants fam={fam} selected={p} prefix={`accv-${a.key}`} catPrefix="extras" hand={null} delta={delta} onPick={(id) => onChanged(e.updateAccessory(a.key, { productId: id }) || [])} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] font-semibold text-[#5F5A52]">Move</span>
            {p.type !== "shelf" ? <NudgeBtn icon="left" label="Move left" onClick={() => nudge(-1, 0)} /> : null}
            <NudgeBtn icon="up" label="Move up" onClick={() => nudge(0, 1)} />
            <NudgeBtn icon="down" label="Move down" onClick={() => nudge(0, -1)} />
            {p.type !== "shelf" ? <NudgeBtn icon="right" label="Move right" onClick={() => nudge(1, 0)} /> : null}
            <button type="button" className="ml-auto min-h-[40px] rounded-full px-3 text-[13.5px] font-semibold text-[#5F5A52] ring-1 ring-[#E1DACF]" onClick={() => onChanged(e.resetAccessory(a.key) || [])} data-testid={`reset-${a.key}`}>Reset position</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function NudgeBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full bg-[#F1EDE6] text-[#1C1B19] transition active:scale-95"><Icon name={icon} className="h-5 w-5" /></button>;
}

function PlumbingDiagram({ side, tub }: { side: "left" | "right"; tub: boolean }) {
  const vx = side === "left" ? 14 : 106;
  return (
    <svg viewBox="0 0 120 64" className="h-auto w-full" aria-hidden>
      <rect x="0" y="0" width="120" height="64" rx="10" fill="#F6F3EE" />
      <path d="M10 8h100v48" fill="none" stroke="#C9C1B4" strokeWidth="3" /><path d="M10 8v48" fill="none" stroke="#C9C1B4" strokeWidth="3" />
      <rect x="14" y="12" width="92" height="40" rx={tub ? 12 : 4} fill="#fff" stroke="#D9D2C6" />
      {tub ? <rect x="22" y="18" width="76" height="28" rx="10" fill="#F6F3EE" /> : null}
      <circle cx={side === "left" ? 28 : 92} cy="32" r="3.5" fill="#8C867C" />
      <circle cx={vx} cy="32" r="6" fill="#A47A3E" /><path d={`M${vx} 26v-6`} stroke="#A47A3E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Details({ value, onClose }: { value: { item: any; art: ArtKind } | null; onClose: () => void }) {
  useEscape(Boolean(value), onClose);
  if (!value) return null;
  const it = value.item;
  const rows: [string, string][] = [
    ["Product", it.name], ["Brand", it.manufacturer || it.brand || ""], ["Model", it.variant?.model || it.model || ""],
    ["Size", it.variant?.size || (it.dims ? `${it.dims.length}″ × ${it.dims.width}″` : "")], ["Color / finish", colorName(it)], ["Material", it.material || ""],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Product details" onClick={onClose}>
      <div className="studio-rise w-full max-w-md overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px]" onClick={(ev) => ev.stopPropagation()} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="relative"><ProductArt kind={value.art} item={it} className="aspect-[16/9] w-full" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow"><Icon name="close" className="h-5 w-5" /></button></div>
        <div className="p-5">
          <h3 className="text-[19px] font-semibold text-[#1C1B19]">{it.family?.label || it.label}</h3>
          <dl className="mt-3 grid gap-2 text-[14px]">
            {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-[#8C867C]">{k}</dt><dd className="text-[#1C1B19]">{v}</dd></div>)}
          </dl>
          {it.description ? <p className="mt-3 text-[13.5px] leading-relaxed text-[#5F5A52]">{it.description}</p> : null}
          <p className="mt-3 text-[12px] text-[#8C867C]">{it.photo ? "Photo approved by Profixter." : "Picture is an illustration drawn from the product's size and color, not a manufacturer photo."}</p>
        </div>
      </div>
    </div>
  );
}

export { T };
