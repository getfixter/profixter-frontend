"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminStudio, apiUrl, money } from "@/lib/studio/api";
import StudioStage from "@/app/components/studio/StudioStage";
import DesignPanel, { Messages } from "@/app/components/studio/DesignPanel";
import { useStudioEngine } from "@/app/components/studio/useStudioEngine";
import { preparePhoto } from "@/app/components/studio/photoPrep";
import { StatusBadge, inputClass } from "./StudioAdmin";
import { exampleById } from "@/lib/studio/examples";

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const label = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";
const smallBtn = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 disabled:opacity-50";
const TYPES: Record<string, string> = { "tub-to-shower": "Tub-to-shower conversion", "shower-replacement": "Shower replacement", "tub-replacement": "Bathtub replacement" };

/** The employee Sales Studio: the same engine as the public Studio, with full controls and pricing. */
export default function StudioDesignEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"photo" | "result" | "compare">("photo");
  const [live, setLive] = useState<any>(null);
  const [customer, setCustomer] = useState<any>({});
  const [projectType, setProjectType] = useState("tub-to-shower");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [verified, setVerified] = useState(false);
  const photoLoaded = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { stageRefs, engine, snap, error: engineError } = useStudioEngine(catalog);
  const [stamp, setStamp] = useState(0);

  const apply = useCallback((r: any, { keepCatalog = true } = {}) => {
    setData(r);
    setLive(r.live);
    setCustomer({ ...r.design.customer });
    setProjectType(r.design.projectType);
    if (!keepCatalog || !catalog) setCatalog(r.catalog);
  }, [catalog]);

  useEffect(() => {
    adminStudio.design(id).then((r) => apply(r, { keepCatalog: false })).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // load the photo (and saved dots/design) into the engine once it exists
  useEffect(() => {
    const e = engine();
    const ph = data?.design?.photo;
    const scene = !ph ? exampleById(data?.design?.exampleScene) : null;
    if (!e || !snap || (!ph && !scene)) return;
    const key = ph ? ph.url : `example:${scene!.id}`;
    if (photoLoaded.current === key) return;
    photoLoaded.current = key;
    // a request made on the example bathroom opens on that example (the customer sent no photo)
    const job = ph ? e.loadPhoto(apiUrl(ph.url), { state: data.design.state || null }) : e.loadExample(scene, { design: data.design.state?.design || null });
    job.then(() => setView(data.design.state ? "result" : "photo")).catch((er: any) => setNotice({ kind: "err", text: er.message }));
  }, [engine, snap, data]);

  useEffect(() => { if (snap?.last?.at) setStamp(snap.last.at); }, [snap?.last?.at]);

  // live staff price (full lines) as the design changes
  const designKey = useMemo(() => (snap?.design ? JSON.stringify(snap.design) : ""), [snap?.design]);
  useEffect(() => {
    const e = engine();
    if (!e || !snap?.ready || !snap.design.baseId) return;
    const t = setTimeout(() => {
      const state = e.getState();
      if (!state) return;
      adminStudio.quote(id, { state, projectType }).then((r) => setLive(r.live)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designKey, projectType, id]);

  const markDirty = () => setDirty(true);
  useEffect(() => { if (snap?.last?.reason === "design" || snap?.last?.reason === "finish") markDirty(); }, [snap?.last?.at, snap?.last?.reason]);

  async function save(silent = false) {
    const e = engine();
    setBusy("Saving…");
    try {
      const state = e?.getState();
      const r = await adminStudio.saveDesign(id, { ...(state ? { state } : {}), projectType, customer, note, ...(verified ? { measureSource: "verified" } : {}) });
      const blob = state ? await e.previewBlob() : null;
      if (blob) await adminStudio.uploadPreview(id, blob).catch(() => {});
      apply(r);
      setNote("");
      setDirty(false);
      if (!silent) setNotice({ kind: "ok", text: "Saved. A revision was recorded." });
      return r;
    } catch (er: any) {
      setNotice({ kind: "err", text: er.message });
      throw er;
    } finally { setBusy(null); }
  }

  async function newPhoto(file?: File | null) {
    if (!file) return;
    setBusy("Uploading photo…");
    try {
      const blob = await preparePhoto(file);
      const r = await adminStudio.uploadPhoto(id, blob);
      apply(r);
      photoLoaded.current = r.design.photo.url;
      await engine()?.loadPhoto(apiUrl(r.design.photo.url));
      setView("photo");
      setDirty(true);
    } catch (er: any) { setNotice({ kind: "err", text: er.message }); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function makeProposal() {
    try {
      if (dirty || !data.design.state) await save(true);
      setBusy("Creating proposal…");
      const r = await adminStudio.proposal(id);
      setProposal(r);
      const fresh = await adminStudio.design(id);
      apply(fresh);
      setNotice({ kind: "ok", text: `Proposal ready: project ${r.projectNumber}, estimate ${r.estimateNumber} (${money(Math.round(r.total * 100))}).` });
    } catch (er: any) { setNotice({ kind: "err", text: er.message }); }
    finally { setBusy(null); }
  }

  if (error) return <div className={card}><p className="text-red-700">{error}</p><button className={`${smallBtn} mt-3`} onClick={onClose}>Back</button></div>;
  if (!data) return <div className={card}>Loading design…</div>;
  const d = data.design;
  const can = data.can || {};
  const locked = d.status === "signed";
  const m = snap?.design?.measure;

  return (
    <div className="min-w-0 space-y-4" data-testid="studio-editor">
      <div className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="min-w-0">
          <button type="button" onClick={onClose} className="text-sm font-bold text-blue-600">← All designs</button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{customer.name || "Unnamed customer"}</h2>
            <StatusBadge status={d.status} />
            <span className="text-xs text-slate-400">{d.origin === "public" ? `Website request${d.submittedAt ? ` · ${new Date(d.submittedAt).toLocaleString()}` : ""}` : "Staff design"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={smallBtn} disabled={Boolean(busy) || locked} onClick={() => save()} data-testid="studio-save">{dirty ? "Save changes" : "Save"}</button>
          {can.propose ? (
            <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={Boolean(busy) || locked || !live?.complete || Boolean(snap?.busy)} onClick={makeProposal} data-testid="studio-proposal">
              Create proposal
            </button>
          ) : null}
        </div>
      </div>

      {notice ? <p className={`rounded-xl px-4 py-3 text-sm ${notice.kind === "err" ? "bg-red-50 text-red-700" : notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"}`} role="status">{notice.text}</p> : null}
      {proposal || d.projectId ? (
        <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
          Next: open the project in <Link className="font-bold underline" href={`/admin?tab=projects${d.projectId ? `&project=${d.projectId}` : ""}`}>Projects</Link> to attach the contract (it is pre-filled from this estimate) and send it for the customer&rsquo;s signature.
        </div>
      ) : null}
      {engineError ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{engineError}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-3">
          <div className={card}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(["photo", "result", "compare"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {v === "photo" ? "Photo & dots" : v === "result" ? "Design" : "Before / after"}
                </button>
              ))}
              <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => newPhoto(e.target.files?.[0])} data-testid="studio-photo-input" />
              <button type="button" className={`${smallBtn} ml-auto`} onClick={() => fileRef.current?.click()} disabled={locked}>{d.photo ? "Replace photo" : "Add photo"}</button>
            </div>
            <div className="relative">
              <StudioStage {...stageRefs} view={view} busy={busy || (view !== "photo" ? snap?.busy : null)} renderStamp={stamp} drawCompare={(b, a) => engine()?.drawCompare(b, a)} />
              {!d.photo ? <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-slate-100 text-slate-500">Add the customer&rsquo;s bathroom photo to start.</div> : null}
            </div>
            {snap?.ready && view === "photo" ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={smallBtn} onClick={() => engine()?.autoFind()}>Find automatically</button>
                  <button type="button" className={smallBtn} onClick={() => engine()?.startTap4()}>Tap 4 corners</button>
                  {[["marks", "Move dots"], ["tapRemove", "Tap to remove"], ["remove", "Remove brush"], ["keep", "Protect brush"], ["erase", "Erase"]].map(([t, l]) => (
                    <button key={t} type="button" onClick={() => engine()?.setTool(t)} className={`rounded-xl px-3 py-2 text-sm font-bold ${snap.tool === t ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{l}</button>
                  ))}
                  <button type="button" className={smallBtn} disabled={!snap.canUndoMask} onClick={() => engine()?.undoMask()}>Undo</button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={snap.snap} onChange={(e) => engine()?.setSnap(e.target.checked)} /> Snap dots</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={snap.autoRemove} onChange={(e) => { engine()?.setAutoRemove(e.target.checked); markDirty(); }} /> Remove old tub leftovers</label>
                  <label className="flex items-center gap-2">Brush <input type="range" min={6} max={80} defaultValue={28} onChange={(e) => { const en = engine(); if (en) en.brushSize = Number(e.target.value); }} /></label>
                </div>
                <Messages list={snap.messages.mark} />
              </div>
            ) : null}
            {snap?.last ? <p className="mt-2 text-xs text-slate-400">Last update: {snap.last.reason} · {Math.round(snap.last.ms)} ms</p> : null}
          </div>

          {snap?.ready ? (
            <div className={card}>
              <h3 className="mb-3 text-lg font-bold text-slate-900">Products</h3>
              <DesignPanel snap={snap} engine={engine} variant="staff" onChanged={(ch) => { markDirty(); if (ch.length) setNotice({ kind: "info", text: ch.join(" ") }); }} />
              <Messages list={snap.messages.design} className="mt-3" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div className={card}>
            <h3 className="mb-3 text-lg font-bold text-slate-900">Customer</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[["name", "Name"], ["phone", "Phone"], ["email", "Email"], ["zip", "ZIP"]].map(([k, l]) => (
                <label key={k} className={label}>{l}<input className={inputClass} value={customer[k] || ""} onChange={(e) => { setCustomer((c: any) => ({ ...c, [k]: e.target.value })); markDirty(); }} /></label>
              ))}
              <label className={`${label} sm:col-span-2`}>Address<input className={inputClass} value={customer.address || ""} onChange={(e) => { setCustomer((c: any) => ({ ...c, address: e.target.value })); markDirty(); }} /></label>
              {customer.notes ? <p className="text-sm text-slate-600 sm:col-span-2"><b>Customer notes:</b> {customer.notes}</p> : null}
              <label className={`${label} sm:col-span-2`}>Project
                <select className={inputClass} value={projectType} onChange={(e) => { setProjectType(e.target.value); markDirty(); }}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
          </div>

          {m ? (
            <div className={card}>
              <h3 className="mb-1 text-lg font-bold text-slate-900">Measurements</h3>
              <p className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${d.measureSource === "verified" ? "bg-emerald-100 text-emerald-700" : d.measureSource === "customer" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`} data-testid="studio-measure-source">{d.measureLabel}</p>
              {d.exampleScene && !d.photo ? <p className="mb-2 text-sm text-amber-800">Designed on the example bathroom - the customer sent no photo. Add a photo of their bathroom when you visit.</p> : null}
              <p className="mb-3 text-sm text-slate-500">Inches, measured on site. The picture and the price update when you leave a field.</p>
              <div className="grid grid-cols-2 gap-3">
                {[["facingWidth", "Facing wall width"], ["sideLength", "Side wall length"], ["rimHeight", "Old rim height"], ["markHeight", "Upper dot height"]].map(([k, l]) => (
                  <label key={`${k}-${m[k]}`} className={label}>{l}
                    <input className={inputClass} inputMode="decimal" defaultValue={Number.isFinite(m[k]) ? m[k] : ""} placeholder={k === "markHeight" ? "estimate" : ""} data-testid={`studio-m-${k}`}
                      onBlur={(e) => { const raw = e.target.value.trim(); engine()?.setMeasure({ [k]: raw === "" ? NaN : Number(raw) }); markDirty(); }} />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-sm text-slate-700">
                {(["leftWall", "rightWall"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={m[k]} onChange={(e) => { engine()?.setMeasure({ [k]: e.target.checked }); markDirty(); }} /> {k === "leftWall" ? "Wall on left" : "Wall on right"}</label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={verified} onChange={(e) => { setVerified(e.target.checked); markDirty(); }} data-testid="studio-verified" /> Measured on site: mark these measurements verified when I save</label>
              <Messages list={snap?.messages.measure} className="mt-3" />
            </div>
          ) : null}

          <PricePanel live={live} data={data} id={id} onData={(r) => { apply(r); setLive(r.live); }} onNotice={setNotice} locked={locked} />

          <div className={card}>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Save with a note</h3>
            <input className={inputClass} placeholder="e.g. Measured on site; valve 2&quot; left of center" value={note} onChange={(e) => setNote(e.target.value)} />
            <h4 className="mb-1 mt-4 text-sm font-bold text-slate-700">Revisions</h4>
            {d.revisions?.length ? (
              <ul className="max-h-48 space-y-1 overflow-auto text-sm text-slate-600">
                {[...d.revisions].reverse().map((r: any) => (
                  <li key={r.id} className="flex justify-between gap-2"><span>{new Date(r.at).toLocaleString()} {r.note ? `· ${r.note}` : ""}</span><span className="font-semibold">{money(r.totalCents)}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">No revisions yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PricePanel({ live, data, id, onData, onNotice, locked }: { live: any; data: any; id: string; onData: (r: any) => void; onNotice: (n: any) => void; locked: boolean }) {
  const can = data.can || {};
  const adders = (data.pricing?.adders || []).filter((a: any) => a.trigger === "manual");
  const [kind, setKind] = useState("adder");
  const [key, setKey] = useState(adders[0]?.key || "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const body: any = { kind: kind === "discountPct" || kind === "discountAmt" ? "discount" : kind, reason };
      if (kind === "adder") body.key = key;
      if (kind === "discountPct") body.percent = Number(amount);
      if (kind === "discountAmt" || kind === "override") body.amountCents = Math.round(Number(amount) * 100);
      const r = await adminStudio.addAdjustment(id, body);
      onData(r); setAmount(""); setReason("");
    } catch (e: any) { onNotice({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-testid="studio-price">
      <h3 className="text-lg font-bold text-slate-900">Estimate</h3>
      {!live ? <p className="mt-2 text-sm text-slate-500">Finish the design to see the price.</p> : (
        <>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {live.lines.map((l: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-2 text-slate-700">{l.label}{l.quantity > 1 ? ` × ${l.quantity}` : ""}{l.reason ? <span className="block text-xs text-slate-400">{l.reason}</span> : null}</td>
                  <td className={`py-1.5 text-right font-semibold ${l.totalCents < 0 ? "text-emerald-700" : "text-slate-900"}`}>{money(l.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!live.complete ? (
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>No total yet - prices missing:</b><ul className="list-disc pl-5">{live.missing.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white"><span className="text-sm">Total</span><span className="text-xl font-bold" data-testid="studio-total">{money(live.totalCents)}</span></div>
          )}
        </>
      )}
      {data.design.adjustments?.length ? (
        <div className="mt-4">
          <h4 className="text-sm font-bold text-slate-700">Adjustments</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {data.design.adjustments.map((a: any) => (
              <li key={a._id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                <span>{a.kind === "discount" ? (a.percent ? `Discount ${a.percent}%` : `Discount ${money(a.amountCents)}`) : a.kind === "override" ? `Total set to ${money(a.amountCents)}` : a.label || a.key}{a.reason ? <span className="text-slate-400"> · {a.reason}</span> : null}</span>
                {!locked && (a.kind === "adder" || can.adjust) ? <button type="button" className="text-xs font-bold text-red-600" onClick={async () => { try { onData(await adminStudio.removeAdjustment(id, a._id)); } catch (e: any) { onNotice({ kind: "err", text: e.message }); } }}>Remove</button> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!locked ? (
        <div className="mt-4 grid gap-2">
          <h4 className="text-sm font-bold text-slate-700">Add to the estimate</h4>
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)} data-testid="adj-kind">
            <option value="adder">Additional work (price list)</option>
            {can.adjust ? <><option value="discountPct">Discount (%)</option><option value="discountAmt">Discount ($)</option><option value="override">Set the total ($)</option></> : null}
          </select>
          {kind === "adder" ? (
            <select className={inputClass} value={key} onChange={(e) => setKey(e.target.value)}>
              {adders.length ? adders.map((a: any) => <option key={a.key} value={a.key}>{a.label}{a.priceCents != null ? ` (${money(a.priceCents)})` : " (no price set)"}</option>) : <option value="">No manual adders in the price list</option>}
            </select>
          ) : (
            <input className={inputClass} inputMode="decimal" placeholder={kind === "discountPct" ? `Percent (max ${data.pricing?.maxDiscountPercent ?? 15}% unless owner)` : "Amount in dollars"} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="adj-amount" />
          )}
          <input className={inputClass} placeholder={kind === "adder" ? "Reason (optional)" : "Reason (required)"} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="adj-reason" />
          <button type="button" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={busy || (kind === "adder" && !key)} onClick={add} data-testid="adj-add">Add</button>
          {!can.adjust ? <p className="text-xs text-slate-400">Discounts and price overrides need the owner to switch on &ldquo;Shower Studio price adjustments&rdquo; for you.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
