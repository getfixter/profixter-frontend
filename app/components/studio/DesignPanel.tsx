"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/studio/api";
import type { EngineSnapshot, Msg } from "./useStudioEngine";

import { swatchDataUrl } from "@/lib/studio/engine/textures.js";

/** Drawn swatch of a finish (same generator the 3D preview tiles), used when there is no product photo. */
function swatch(f: any) {
  if (typeof window === "undefined") return "";
  try { return swatchDataUrl(f); } catch { return ""; }
}

export function Messages({ list, className = "" }: { list?: Msg[]; className?: string }) {
  if (!list?.length) return null;
  const tone: Record<string, string> = {
    ok: "bg-[#E8F6EE] text-[#1F6B44]",
    warn: "bg-[#FFF5E5] text-[#8A5200]",
    err: "bg-[#FDECEB] text-[#A3261B]",
    info: "bg-[#EEF2FF] text-[#475569]",
  };
  return (
    <div className={`grid gap-2 ${className}`}>
      {list.map((m, i) => (
        <p key={i} className={`m-0 rounded-xl px-3 py-2 text-[13.5px] leading-snug ${tone[m.kind] || tone.info}`}>{m.text}</p>
      ))}
    </div>
  );
}

function Card({ selected, onClick, title, subtitle, image, badge, testId }: { selected: boolean; onClick: () => void; title: string; subtitle?: string; image?: string; badge?: string; testId?: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected} data-testid={testId}
      className={`group relative flex w-[150px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-white text-left transition sm:w-[170px] ${selected ? "border-[#306EEC] ring-2 ring-[#306EEC]" : "border-[#DDE3EE] hover:border-[#9DB6F2]"}`}
    >
      <div className="aspect-square w-full bg-[#EEF2F8]">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
      </div>
      <div className="p-2.5">
        <div className="text-[13.5px] font-semibold leading-tight text-[#0B1628]">{title}</div>
        {subtitle ? <div className="mt-0.5 text-[12px] leading-tight text-[#64748B]">{subtitle}</div> : null}
      </div>
      {badge ? <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#475569]">{badge}</span> : null}
      {selected ? <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#306EEC] text-[13px] text-white">✓</span> : null}
    </button>
  );
}

/** Group catalog entries into product families, keeping catalog order. Entries without a family stand alone. */
function familiesOf(list: any[]) {
  const out: { key: string; name: string; items: any[] }[] = [];
  const at = new Map<string, number>();
  for (const x of list) {
    const key = x.family?.key || `sku:${x.id}`;
    if (!at.has(key)) { at.set(key, out.length); out.push({ key, name: x.family?.name || x.name, items: [] }); }
    out[at.get(key)!].items.push(x);
  }
  return out;
}
const testKey = (k: string) => k.replace(/[^\w-]+/g, "-").slice(0, 60);

/**
 * One card per product family; the chosen family shows its sizes and colours
 * as chips. A family with a single product is just that product's card.
 */
function FamilyPicker({ list, selectedId, onPick, prefix, subtitle, image, badge }: {
  list: any[]; selectedId: string; onPick: (id: string) => void; prefix: string;
  subtitle: (x: any, many: boolean) => string | undefined; image: (x: any) => string | undefined; badge?: (x: any) => string | undefined;
}) {
  const fams = familiesOf(list);
  const current = fams.find((fm) => fm.items.some((x) => x.id === selectedId));
  const sel = current?.items.find((x) => x.id === selectedId);
  const sizes = current ? [...new Set(current.items.map((x) => x.variant?.size || ""))].filter(Boolean) : [];
  const colours = current && sel ? current.items.filter((x) => (x.variant?.size || "") === (sel.variant?.size || "")) : [];
  return (
    <>
      <Row>
        {fams.map((fm) => {
          const shown = fm.items.find((x) => x.id === selectedId) || fm.items[0];
          const many = fm.items.length > 1;
          return (
            <Card key={fm.key} testId={many ? `family-${prefix}-${testKey(fm.key)}` : `${prefix}-${shown.id}`} selected={fm.items.some((x) => x.id === selectedId)}
              onClick={() => onPick(shown.id)} title={many ? fm.name : shown.name} subtitle={many ? `${fm.items.length} options` : subtitle(shown, false)} image={image(shown)} badge={badge?.(shown)} />
          );
        })}
      </Row>
      {current && current.items.length > 1 && sel ? (
        <div className="mt-1 grid gap-2 rounded-2xl bg-[#F4F7FC] p-3" data-testid={`variants-${prefix}`}>
          {sizes.length > 1 ? (
            <div>
              <div className="mb-1 text-[12px] font-semibold text-[#475569]">Size</div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => {
                  const pick = current.items.find((x) => (x.variant?.size || "") === sz && x.variant?.color === sel.variant?.color) || current.items.find((x) => (x.variant?.size || "") === sz)!;
                  const on = (sel.variant?.size || "") === sz;
                  return <button key={sz} type="button" aria-pressed={on} onClick={() => onPick(pick.id)} className={`min-h-[40px] rounded-xl border px-3 text-[13px] ${on ? "border-[#306EEC] bg-white font-semibold text-[#0B1628]" : "border-[#DDE3EE] bg-white text-[#475569]"}`}>{sz}</button>;
                })}
              </div>
            </div>
          ) : null}
          {colours.length > 1 || colours[0]?.variant?.color ? (
            <div>
              <div className="mb-1 text-[12px] font-semibold text-[#475569]">Color{sel.variant?.color ? `: ${sel.variant.color}` : ""}</div>
              <div className="flex flex-wrap gap-2">
                {colours.map((x) => {
                  const on = x.id === sel.id;
                  return (
                    <button key={x.id} type="button" aria-pressed={on} title={x.variant?.color || x.name} onClick={() => onPick(x.id)} data-testid={`${prefix}-${x.id}`}
                      className={`flex min-h-[40px] items-center gap-2 rounded-xl border px-2.5 text-[13px] ${on ? "border-[#306EEC] bg-white font-semibold text-[#0B1628]" : "border-[#DDE3EE] bg-white text-[#475569]"}`}>
                      <span className="inline-block h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: x.variant?.colorHex || "#e8e6e1" }} />
                      {x.variant?.color || "Standard"}
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

const Row = ({ children }: { children: React.ReactNode }) => <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">{children}</div>;
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-5 text-[15px] font-bold text-[#0B1628] first:mt-0">{children}</h3>;

/**
 * Product choices for a design. `variant="public"` is the homeowner view;
 * `variant="staff"` adds precise controls (drains, exact placement, brightness).
 */
export default function DesignPanel({ snap, engine, variant = "public", section = "all", onChanged }: {
  snap: EngineSnapshot;
  engine: () => any;
  variant?: "public" | "staff";
  section?: "all" | "walls" | "base" | "fixture" | "door" | "extras";
  onChanged?: (changes: string[]) => void;
}) {
  const e = engine();
  const o = snap.options || {};
  const d = snap.design;
  const cur = snap.current || {};
  const [open, setOpen] = useState<string | null>(null);
  const kind = cur.base?.kind || "pan";
  const change = (fn: (d: any) => void, opts?: any) => onChanged?.(e.applyChange(fn, opts) || []);
  const show = (s: string) => section === "all" || section === s;
  const accErr = useMemo(() => {
    const m = new Map<string, Msg[]>();
    for (const x of [...(snap.check?.errors || []).map((v: any) => ({ ...v, kind: "err" })), ...(snap.check?.warnings || []).map((v: any) => ({ ...v, kind: "warn" }))]) {
      if (!String(x.field).startsWith("accessory:")) continue;
      const k = String(x.field).slice(10);
      m.set(k, [...(m.get(k) || []), { kind: x.kind, text: x.message }]);
    }
    return m;
  }, [snap.check]);
  if (!e || !d) return null;
  const floor = e.floorTop();

  return (
    <div>
      {show("walls") && (
        <>
          <H>Wall style</H>
          <FamilyPicker list={o.finishes || []} selectedId={d.finishId} prefix="finish" onPick={(id) => change((x) => { x.finishId = id; }, { finishOnly: true })}
            subtitle={(f) => (variant === "staff" ? f.kits?.[0]?.model : f.manufacturer)} image={(f) => (f.photo ? apiUrl(f.photo) : swatch(f))} badge={(f) => (f.visualStatus === "illustrative" ? "Illustrative" : undefined)} />
          {!o.finishes?.length ? <p className="text-[13px] text-[#64748B]">No wall style in our catalog fits these measurements. We&rsquo;ll suggest options after measuring.</p> : null}
        </>
      )}
      {show("base") && (
        <>
          <H>{kind === "tub" ? "Bathtub" : "Shower base"}</H>
          <FamilyPicker list={(o.bases || []).filter((b: any) => b.kind === kind)} selectedId={d.baseId} prefix="base" onPick={(id) => change((x) => { x.baseId = id; })}
            subtitle={(b) => `${b.dims.length}″ × ${b.dims.width}″`} image={(b) => (b.photo ? apiUrl(b.photo) : undefined)} />
          {(cur.base?.drains?.length || 0) > 1 ? (
            <label className="mt-2 grid gap-1 text-[13px] text-[#475569]">Drain position
              <select className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[15px] text-[#0B1628]" value={d.drainId} onChange={(ev) => change((x) => { x.drainId = ev.target.value; })}>
                {cur.base.drains.map((dr: any) => <option key={dr.id} value={dr.id}>{dr.name}</option>)}
              </select>
            </label>
          ) : null}
        </>
      )}
      {show("fixture") && (
        <>
          <H>Faucet &amp; showerhead</H>
          <Row>
            {(o.fixtures || []).map((f: any) => (
              <Card key={f.id} testId={`fixture-${f.id}`} selected={f.id === d.fixtureId} onClick={() => change((x) => { x.fixtureId = f.id; })}
                title={f.name} image={f.photo ? apiUrl(f.photo) : undefined} />
            ))}
          </Row>
        </>
      )}
      {show("door") && (
        <>
          <H>Door or curtain</H>
          <Row>
            <Card testId="enclosure-none" selected={d.enclosureId === "none"} onClick={() => change((x) => { x.enclosureId = "none"; x.curtain = false; })} title="No door" subtitle="Keep it open" />
            {(o.enclosures || []).map((en: any) => (
              <Card key={en.id} testId={`enclosure-${en.id}`} selected={en.id === d.enclosureId} onClick={() => change((x) => { x.enclosureId = en.id; if (en.kind !== "rod") x.curtain = false; })}
                title={en.name} subtitle={en.kind === "door" ? `Glass ${en.glassHeight}″ tall` : "Curtain rod"} image={en.photo ? apiUrl(en.photo) : undefined} />
            ))}
          </Row>
          {cur.enclosure?.kind === "rod" ? (
            <label className="mt-2 flex min-h-[44px] items-center gap-3 text-[14px] text-[#0B1628]">
              <input type="checkbox" className="h-5 w-5" checked={d.curtain} onChange={(ev) => change((x) => { x.curtain = ev.target.checked; })} /> Show a curtain (for illustration)
            </label>
          ) : null}
        </>
      )}
      {show("extras") && (
        <>
          <H>Safety &amp; storage</H>
          <div className="flex flex-wrap gap-2">
            {(["grabBar", "shelf", "seat"] as const).map((t) => {
              const label = { grabBar: "+ Grab bar", shelf: "+ Corner shelf", seat: "+ Fold-down seat" }[t];
              const available = (o.accessories || []).some((a: any) => a.type === t);
              return (
                <button key={t} type="button" disabled={!available} data-testid={`add-${t}`}
                  onClick={() => onChanged?.(e.addAccessory(t) || [])}
                  className="min-h-[44px] rounded-full border border-[#C5CBD8] bg-white px-4 text-[14px] font-semibold text-[#0B1628] disabled:opacity-40">
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-3">
            {d.accessories.map((a: any) => {
              const p = (e.catalog.accessories || []).find((x: any) => x.id === a.productId);
              if (!p) return null;
              const same = (e.catalog.accessories || []).filter((x: any) => x.type === p.type);
              const walls = ["facing", "left", "right"].filter((w) => e.wallExists(w));
              const wl = a.wall ? e.wallLength(a.wall) : 0;
              const isOpen = open === a.key || variant === "staff";
              const wallName = (w: string) => (w === "facing" ? "Back (valve) wall" : w === "left" ? "Left wall" : "Right wall");
              return (
                <div key={a.key} className="rounded-2xl border border-[#DDE3EE] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" className="text-left text-[14px] font-semibold text-[#0B1628]" onClick={() => setOpen(isOpen && variant !== "staff" ? null : a.key)}>
                      {p.name}
                      <span className="block text-[12px] font-normal text-[#64748B]">{a.wall ? wallName(a.wall) : `${a.corner === "right" ? "Right" : "Left"} corner`} · {(a.y - floor).toFixed(0)}″ high</span>
                    </button>
                    <button type="button" className="min-h-[40px] rounded-full px-3 text-[13px] font-semibold text-[#A3261B]" onClick={() => onChanged?.(e.removeAccessory(a.key) || [])}>Remove</button>
                  </div>
                  {isOpen ? (
                    <div className="mt-2 grid gap-2">
                      {same.length > 1 ? (
                        <select className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[15px]" value={a.productId} onChange={(ev) => onChanged?.(e.updateAccessory(a.key, { productId: ev.target.value }) || [])}>
                          {same.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      ) : null}
                      {p.type === "shelf" ? (
                        <select className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[15px]" value={a.corner} onChange={(ev) => onChanged?.(e.updateAccessory(a.key, { corner: ev.target.value }) || [])}>
                          {["left", "right"].filter((c) => e.wallExists(c)).map((c) => <option key={c} value={c}>{c === "left" ? "Left corner" : "Right corner"}</option>)}
                        </select>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <select className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[15px]" value={a.wall} onChange={(ev) => onChanged?.(e.updateAccessory(a.key, { wall: ev.target.value }) || [])}>
                              {walls.map((w) => <option key={w} value={w}>{wallName(w)}</option>)}
                            </select>
                            {p.type === "grabBar" ? (
                              <select className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[15px]" value={a.orientation} onChange={(ev) => onChanged?.(e.updateAccessory(a.key, { orientation: ev.target.value }) || [])}>
                                <option value="horizontal">Horizontal</option>
                                <option value="vertical">Vertical</option>
                              </select>
                            ) : <span />}
                          </div>
                          <label className="grid gap-1 text-[12.5px] text-[#475569]">Position along the wall{variant === "staff" ? `: ${a.u.toFixed(1)}″` : ""}
                            <input type="range" min={0} max={wl} step={0.25} value={a.u} className="h-8 accent-[#306EEC]" onChange={(ev) => onChanged?.(e.updateAccessory(a.key, { u: Number(ev.target.value) }) || [])} />
                          </label>
                        </>
                      )}
                      <label className="grid gap-1 text-[12.5px] text-[#475569]">Height above the shower floor (inches)
                        <input type="number" inputMode="decimal" step={0.25} className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[16px]" defaultValue={(a.y - floor).toFixed(1)}
                          onBlur={(ev) => { const v = Number(ev.target.value); if (Number.isFinite(v)) onChanged?.(e.updateAccessory(a.key, { heightAboveFloor: v }) || []); }} />
                      </label>
                    </div>
                  ) : null}
                  <Messages list={accErr.get(a.key)} className="mt-2" />
                </div>
              );
            })}
          </div>
        </>
      )}
      {variant === "staff" && section === "all" ? (
        <>
          <H>Finishing</H>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-[13px] text-[#475569]">Wall above the new panels
              <select className="min-h-[44px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[15px]" value={d.measure.aboveMode} onChange={(ev) => change((x) => { x.measure.aboveMode = ev.target.value; })}>
                <option value="paint">Remove old tile, patch and paint</option>
                <option value="keep">Leave existing tile</option>
              </select>
            </label>
            <label className="grid gap-1 text-[13px] text-[#475569]">Brightness match
              <input type="range" min={0.7} max={1.3} step={0.01} defaultValue={d.measure.exposure} className="h-8 accent-[#306EEC]"
                onChange={(ev) => engine()?.setExposure(Number(ev.target.value))} />
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
