"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publicStudio, localDesign, apiUrl, type PublicCatalog, type PublicQuote } from "@/lib/studio/api";
import { trackLead } from "@/lib/meta";
import StudioStage from "@/app/components/studio/StudioStage";
import DesignPanel, { Messages } from "@/app/components/studio/DesignPanel";
import { useStudioEngine } from "@/app/components/studio/useStudioEngine";
import { preparePhoto } from "@/app/components/studio/photoPrep";

const STEPS = [
  { id: "start", label: "Start" },
  { id: "photo", label: "Photo" },
  { id: "measure", label: "Measure" },
  { id: "type", label: "Shower / Tub" },
  { id: "customize", label: "Customize" },
  { id: "result", label: "Price" },
  { id: "request", label: "Request" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const TYPE_ICON: Record<string, string> = { "tub-to-shower": "🚿", "shower-replacement": "✨", "tub-replacement": "🛁" };
const CUSTOM_TABS = [
  { id: "walls", label: "Walls" },
  { id: "base", label: "Base" },
  { id: "fixture", label: "Faucet" },
  { id: "door", label: "Door" },
  { id: "extras", label: "Extras" },
] as const;

const btn = "inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-semibold transition disabled:opacity-50";
const primary = `${btn} bg-[#306EEC] text-white hover:bg-[#2558c9]`;
const secondary = `${btn} border border-[#C5CBD8] bg-white text-[#0B1628] hover:border-[#306EEC]`;
const input = "min-h-[48px] w-full rounded-xl border border-[#C5CBD8] bg-white px-3 text-[16px] text-[#0B1628] outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/20";

export default function StudioApp() {
  const [cat, setCat] = useState<PublicCatalog | null>(null);
  const [catError, setCatError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("start");
  const [mine, setMine] = useState<{ id: string; token: string; startedAt: number } | null>(null);
  const [saved, setSaved] = useState<{ status: string; hasPhoto: boolean } | null>(null);
  const [projectType, setProjectType] = useState<string>("tub-to-shower");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof CUSTOM_TABS)[number]["id"]>("walls");
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [submitted, setSubmitted] = useState<{ reference?: string } | null>(null);
  const { stageRefs, engine, snap, error: engineError } = useStudioEngine(cat?.catalog || null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [renderStamp, setRenderStamp] = useState(0);

  // ---------------------------------------------------------------- load catalog + any design in this browser
  useEffect(() => {
    publicStudio.catalog().then(setCat).catch((e) => setCatError(e.message));
    const m = localDesign.get();
    if (m) {
      publicStudio.get(m.id, m.token).then((d) => {
        setMine(m);
        setProjectType(d.projectType);
        setSaved({ status: d.status, hasPhoto: Boolean(d.photo) });
        if (d.status !== "draft") setSubmitted({});
      }).catch(() => localDesign.clear());
    }
  }, []);

  useEffect(() => { if (snap?.last?.at) setRenderStamp(snap.last.at); }, [snap?.last?.at]);

  const toast = (t: string) => { setNotice(t); window.setTimeout(() => setNotice((n) => (n === t ? null : n)), 5200); };
  const showChanges = (changes: string[]) => { if (changes?.length) toast(changes.join(" ")); };

  // ---------------------------------------------------------------- auto-save (debounced) and live price
  const designKey = useMemo(() => (snap?.design ? JSON.stringify(snap.design) : ""), [snap?.design]);
  useEffect(() => {
    if (!mine || !snap?.ready || submitted) return;
    const t = window.setTimeout(() => {
      const state = engine()?.getState();
      if (state) publicStudio.save(mine.id, mine.token, { state, projectType }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(t);
  }, [designKey, projectType, mine, snap?.ready, snap?.last?.at, submitted, engine]);

  useEffect(() => {
    if (!snap?.design?.baseId) return;
    const t = window.setTimeout(() => {
      publicStudio.quote(snap.design, projectType).then(setQuote).catch(() => setQuote(null));
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designKey, projectType]);

  // ---------------------------------------------------------------- actions
  const ensureDesign = useCallback(async () => {
    if (mine && !submitted) return mine;
    const created = await publicStudio.create(projectType);
    const m = { id: created.id, token: created.token, startedAt: Date.now() };
    localDesign.set(m);
    setMine(m);
    setSubmitted(null);
    return m;
  }, [mine, projectType, submitted]);

  async function onPhoto(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await preparePhoto(file);
      const m = await ensureDesign();
      const r = await publicStudio.uploadPhoto(m.id, m.token, blob);
      await engine()?.loadPhoto(apiUrl(r.photo.url));
      setSaved({ status: "draft", hasPhoto: true });
    } catch (e: any) {
      toast(e.message || "That photo could not be used. Please try another.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function resume() {
    if (!mine) return;
    try {
      const d = await publicStudio.get(mine.id, mine.token);
      setProjectType(d.projectType);
      if (d.photo) {
        await engine()?.loadPhoto(apiUrl(d.photo.url), { state: d.state || null });
        setStep(d.state ? "customize" : "photo");
      } else setStep("photo");
    } catch (e: any) {
      toast(e.message);
    }
  }

  async function startOver() {
    if (mine && !submitted) await publicStudio.remove(mine.id, mine.token).catch(() => {});
    localDesign.clear();
    setMine(null); setSaved(null); setSubmitted(null); setQuote(null);
    setStep("photo");
  }

  function chooseType(key: string) {
    setProjectType(key);
    const want = key === "tub-replacement" ? "tub" : "pan";
    const e = engine();
    if (!e) return;
    const fits = (snap?.options?.bases || []).filter((b: any) => b.kind === want);
    // options are filtered by the current design's base kind for finishes; bases are size-filtered only
    if (!fits.length) { toast(want === "tub" ? "None of our tubs fit these measurements. We'll suggest options after measuring." : "None of our shower bases fit these measurements. We'll suggest options after measuring."); return; }
    showChanges(e.applyChange((d: any) => { if ((e.cur().base?.kind || "") !== want) d.baseId = fits[0].id; }) || []);
    setStep("customize");
  }

  const go = (s: StepId) => { setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const view: "photo" | "result" | "compare" = step === "photo" || step === "measure" ? "photo" : step === "result" ? "compare" : "result";
  const idx = STEPS.findIndex((s) => s.id === step);

  if (catError) return <Shell><p className="text-[#A3261B]">The Shower Studio is unavailable right now: {catError}</p></Shell>;
  if (!cat) return <Shell><p className="text-[#475569]">Loading…</p></Shell>;
  if (!cat.catalog.finishes.length || !cat.catalog.bases.length) {
    return <Shell><h1 className="text-[30px] font-bold text-[#0B1628]">Shower Studio is coming soon</h1><p className="mt-3 text-[#475569]">Call us and we&rsquo;ll design your new shower with you.</p></Shell>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* progress */}
      {step !== "start" && !submitted ? (
        <nav aria-label="Steps" className="sticky top-16 z-20 -mx-4 mb-4 overflow-x-auto bg-[#F8FAFF]/95 px-4 py-2 backdrop-blur">
          <ol className="flex min-w-max gap-1.5">
            {STEPS.slice(1).map((s, i) => {
              const n = i + 1, done = n < idx, current = n === idx;
              const reachable = done || current || (saved?.hasPhoto && n <= 6);
              return (
                <li key={s.id}>
                  <button type="button" disabled={!reachable} onClick={() => go(s.id)} aria-current={current ? "step" : undefined}
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${current ? "bg-[#306EEC] text-white" : done ? "bg-[#E3ECFD] text-[#2558c9]" : "bg-white text-[#94A3B8]"}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${current ? "bg-white/25" : done ? "bg-[#306EEC] text-white" : "bg-[#EEF2F8]"}`}>{done ? "✓" : n}</span>{s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      {notice ? <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-[#0B1628] px-4 py-3 text-[14px] text-white shadow-2xl">{notice}</div> : null}
      {engineError ? <p className="mb-4 rounded-xl bg-[#FDECEB] px-4 py-3 text-[14px] text-[#A3261B]">{engineError} You can still request a free design consultation by phone.</p> : null}

      {submitted ? (
        <Done reference={submitted.reference} onNew={startOver} />
      ) : (
        <div className={step === "start" ? "" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]"}>
          {/* the picture (always mounted: the engine draws into it) */}
          <section className={step === "start" ? "hidden" : step === "customize" ? "sticky top-14 z-10 -mx-4 bg-[#F8FAFF] px-4 pb-2 lg:top-32 lg:mx-0 lg:self-start lg:px-0" : "lg:sticky lg:top-32 lg:self-start"}>
            <div className="rounded-3xl bg-white p-2 shadow-[0_8px_30px_rgba(11,22,40,0.06)] sm:p-3">
              {/* mounted exactly once: the engine keeps references to these canvases */}
              <StudioStage
                {...stageRefs} view={view} compact={step === "customize"} className={snap?.ready ? "" : "hidden"}
                busy={uploading ? "Preparing your photo…" : step !== "photo" && step !== "measure" ? snap?.busy : null}
                renderStamp={renderStamp} drawCompare={(b, a) => engine()?.drawCompare(b, a)}
              />
              {!snap?.ready ? (
                <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-[#EEF2F8] p-6 text-center text-[#64748B]">
                  {uploading ? "Preparing your photo…" : saved?.hasPhoto ? "Loading your design…" : "Your bathroom photo will appear here."}
                </div>
              ) : null}
            </div>
            {snap?.ready && step === "customize" ? (
              <p className="mt-2 text-center text-[12px] text-[#64748B]">Tap a style below - the picture updates in about a second.</p>
            ) : null}
          </section>

          <section className={step === "start" ? "" : "min-w-0"}>
            {step === "start" && <Start cat={cat} hasSaved={Boolean(mine && saved?.hasPhoto)} onStart={() => go("photo")} onResume={resume} onNew={startOver} />}

            {step === "photo" && (
              <Panel title="Your bathroom photo" sub="Stand outside the tub and fit the whole tub area - from the tub up to the top of the tile - in one photo.">
                <input ref={fileRef} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} data-testid="photo-input" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primary} onClick={() => fileRef.current?.click()} disabled={uploading || Boolean(engineError)}>{snap?.ready ? "Use a different photo" : "Take or upload a photo"}</button>
                </div>
                {snap?.ready ? (
                  <>
                    <div className="mt-5 rounded-2xl bg-[#F1F5FF] p-4 text-[14px] leading-relaxed text-[#334155]">
                      <b className="text-[#0B1628]">Check the blue dots.</b> They mark the corners of the wall you&rsquo;re facing - at the edge of the tub and higher up the wall. Drag any dot that&rsquo;s off; it snaps to the nearest corner. Orange dots: your faucet and showerhead.
                    </div>
                    <Messages list={snap.messages.mark} className="mt-3" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className={secondary} onClick={() => engine()?.startTap4()} data-testid="tap4">Tap the 4 corners myself</button>
                      <button type="button" className={snap.tool === "tapRemove" ? primary : secondary} onClick={() => engine()?.setTool(snap.tool === "tapRemove" ? "marks" : "tapRemove")}>
                        {snap.tool === "tapRemove" ? "Done removing" : "Remove an item (towel, bottles)"}
                      </button>
                      {snap.canUndoMask ? <button type="button" className={secondary} onClick={() => engine()?.undoMask()}>Undo</button> : null}
                    </div>
                    <Nav onBack={() => go("start")} onNext={() => go("measure")} nextLabel="The dots look right" />
                  </>
                ) : (
                  <p className="mt-4 text-[13px] text-[#64748B]">Your photo is private: only you and the Profixter team can see it. We remove camera location data automatically.</p>
                )}
              </Panel>
            )}

            {step === "measure" && snap && (
              <Panel title="A few measurements" sub="A tape measure is all you need. Not sure? Most tubs are 60″ long, 30″ wide and about 15″ high.">
                <button type="button" className={`${secondary} mb-4`} onClick={() => engine()?.setMeasure({ facingWidth: 30, sideLength: 60, rimHeight: 15 })}>Use a standard 60″ tub</button>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Num key={`f${snap.design.measure.facingWidth}`} label="Width of the wall with the faucet" value={snap.design.measure.facingWidth} onChange={(v) => engine()?.setMeasure({ facingWidth: v })} testId="m-facing" />
                  <Num key={`s${snap.design.measure.sideLength}`} label="Length of the tub" value={snap.design.measure.sideLength} onChange={(v) => engine()?.setMeasure({ sideLength: v })} testId="m-side" />
                  <Num key={`r${snap.design.measure.rimHeight}`} label="Height of the tub edge" value={snap.design.measure.rimHeight} onChange={(v) => engine()?.setMeasure({ rimHeight: v })} testId="m-rim" />
                </div>
                <p className="mb-1 mt-4 text-[14px] font-semibold text-[#0B1628]">Which sides have a wall?</p>
                <div className="flex flex-wrap gap-2">
                  {(["leftWall", "rightWall"] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={snap.design.measure[k]} onClick={() => engine()?.setMeasure({ [k]: !snap.design.measure[k] })}
                      className={snap.design.measure[k] ? primary : secondary}>{k === "leftWall" ? "Wall on the left" : "Wall on the right"}</button>
                  ))}
                </div>
                <Messages list={snap.messages.measure} className="mt-3" />
                <Nav onBack={() => go("photo")} onNext={() => go("type")} nextDisabled={Boolean(snap.messages.measure.length)} />
              </Panel>
            )}

            {step === "type" && (
              <Panel title="What would you like?" sub="Choose the kind of project. You can change it any time.">
                <div className="grid gap-3">
                  {cat.projectTypes.map((t) => (
                    <button key={t.key} type="button" onClick={() => chooseType(t.key)} aria-pressed={projectType === t.key} data-testid={`type-${t.key}`}
                      className={`flex min-h-[72px] items-start gap-3 rounded-2xl border bg-white p-4 text-left ${projectType === t.key ? "border-[#306EEC] ring-2 ring-[#306EEC]" : "border-[#DDE3EE]"}`}>
                      <span className="text-[26px] leading-none" aria-hidden>{TYPE_ICON[t.key]}</span>
                      <span><span className="block text-[16px] font-semibold text-[#0B1628]">{t.label}</span><span className="mt-0.5 block text-[13px] text-[#64748B]">{t.includes}</span></span>
                    </button>
                  ))}
                </div>
                <Nav onBack={() => go("measure")} />
              </Panel>
            )}

            {step === "customize" && snap && (
              <Panel title="Make it yours" sub="Every option here fits your measurements.">
                <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1" role="tablist">
                  {CUSTOM_TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                      className={`min-h-[40px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${tab === t.id ? "bg-[#0B1628] text-white" : "bg-white text-[#475569]"}`}>{t.label}</button>
                  ))}
                </div>
                <DesignPanel snap={snap} engine={engine} section={tab} onChanged={showChanges} />
                <Messages list={snap.messages.design.filter((m) => m.kind !== "info")} className="mt-4" />
                <PriceStrip quote={quote} />
                <Nav onBack={() => go("type")} onNext={() => go("result")} nextLabel="See my price" nextDisabled={Boolean(snap.busy)} />
              </Panel>
            )}

            {step === "result" && snap && (
              <Panel title="Your new shower" sub="Slide to compare before and after.">
                <PriceCard quote={quote} disclaimer={cat.disclaimer} />
                <Messages list={snap.messages.design.filter((m) => m.kind === "warn")} className="mt-3" />
                <Nav onBack={() => go("customize")} onNext={() => go("request")} nextLabel="Request installation" nextDisabled={Boolean(snap.busy)} />
              </Panel>
            )}

            {step === "request" && mine && (
              <RequestForm
                quote={quote}
                onBack={() => go("result")}
                onSubmit={async (form) => {
                  const state = engine()?.getState();
                  if (state) await publicStudio.save(mine.id, mine.token, { state, projectType });
                  const preview = await engine()?.previewBlob();
                  if (preview) await publicStudio.uploadPreview(mine.id, mine.token, preview).catch(() => {});
                  const r = await publicStudio.submit(mine.id, mine.token, form);
                  try { trackLead({ content_name: "Shower Studio", content_category: "bathroom" }, { dataLayerEvent: null }); } catch { /* analytics never blocks */ }
                  setSubmitted({ reference: r.reference });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-16 text-center">{children}</div>;
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(11,22,40,0.06)] sm:p-6">
      <h2 className="text-[22px] font-bold leading-tight text-[#0B1628] sm:text-[26px]">{title}</h2>
      {sub ? <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#475569]">{sub}</p> : null}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continue", nextDisabled }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="mt-6 flex gap-2">
      {onBack ? <button type="button" className={secondary} onClick={onBack}>Back</button> : null}
      {onNext ? <button type="button" className={`${primary} flex-1`} onClick={onNext} disabled={nextDisabled}>{nextLabel}</button> : null}
    </div>
  );
}

/** Keyed by its value in the parent, so a new value (e.g. "standard tub") resets the text. */
function Num({ label, value, onChange, testId }: { label: string; value: number; onChange: (v: number) => void; testId?: string }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  return (
    <label className="grid gap-1 text-[13px] text-[#475569]">{label}
      <span className="relative">
        <input className={`${input} pr-12`} inputMode="decimal" value={text} data-testid={testId}
          onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.trim() === "" ? NaN : Number(text))} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">inches</span>
      </span>
    </label>
  );
}

function PriceStrip({ quote }: { quote: PublicQuote | null }) {
  if (!quote) return null;
  return (
    <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#0B1628] px-4 py-3 text-white">
      <span className="text-[13px] text-white/70">Estimated total</span>
      <span className="text-[18px] font-bold" data-testid="price-strip">{quote.complete ? quote.display : "Confirmed after review"}</span>
    </div>
  );
}

function PriceCard({ quote, disclaimer }: { quote: PublicQuote | null; disclaimer: string }) {
  return (
    <div className="rounded-2xl border border-[#DDE3EE] bg-[#F8FAFF] p-5">
      <div className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">Estimated total</div>
      <div className="mt-1 text-[34px] font-bold leading-none text-[#0B1628]" data-testid="price-total">{quote?.complete ? quote.display : "We'll confirm your price"}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#475569]">{quote?.complete ? disclaimer : quote?.message || "Our team reviews your design and confirms the price."}</p>
      {quote?.includes?.length ? (
        <details className="mt-3 text-[13.5px] text-[#334155]">
          <summary className="cursor-pointer font-semibold text-[#306EEC]">What&rsquo;s included</summary>
          <ul className="mt-2 list-disc pl-5">{quote.includes.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
      ) : null}
      <p className="mt-3 text-[12px] text-[#94A3B8]">Not a contract. No installation date is booked until we measure and you approve the proposal.</p>
    </div>
  );
}

function RequestForm({ quote, onBack, onSubmit }: { quote: PublicQuote | null; onBack: () => void; onSubmit: (f: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", zip: "", address: "", contactPref: "phone", notes: "", consent: false, website: "" });
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (f.name.trim().length < 2) local.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) local.email = "Please enter a valid email.";
    if (f.phone.replace(/\D/g, "").length < 10) local.phone = "Please enter your phone number.";
    if (!/^\d{5}$/.test(f.zip.trim())) local.zip = "Please enter your 5-digit ZIP code.";
    if (!f.consent) local.consent = "Please agree so we can contact you.";
    setErrs(local);
    if (Object.keys(local).length) return;
    setBusy(true); setMsg(null);
    try { await onSubmit({ ...f, name: f.name.trim(), email: f.email.trim(), zip: f.zip.trim() }); }
    catch (er: any) {
      setMsg(er.message);
      if (er.errors) setErrs(Object.fromEntries(er.errors.map((x: any) => [x.field, x.message])));
    } finally { setBusy(false); }
  }
  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid gap-1 text-[13px] text-[#475569]">{label}
      <input className={`${input} ${errs[k] ? "border-[#A3261B]" : ""}`} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errs[k])} name={k} {...props} />
      {errs[k] ? <span className="text-[12.5px] text-[#A3261B]">{errs[k]}</span> : null}
    </label>
  );
  return (
    <Panel title="Request installation" sub="Send us your design. We'll call to confirm details and schedule a free in-home measurement.">
      <form onSubmit={submit} className="grid gap-3" noValidate>
        {field("name", "Your name", { autoComplete: "name" })}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("phone", "Phone", { autoComplete: "tel", inputMode: "tel" })}
          {field("email", "Email", { autoComplete: "email", inputMode: "email" })}
        </div>
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          {field("zip", "ZIP code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 5 })}
          {field("address", "Street address (optional)", { autoComplete: "street-address" })}
        </div>
        <label className="grid gap-1 text-[13px] text-[#475569]">Best way to reach you
          <select className={input} value={f.contactPref} onChange={(e) => set("contactPref", e.target.value)}>
            <option value="phone">Phone call</option><option value="text">Text message</option><option value="email">Email</option>
          </select>
        </label>
        <label className="grid gap-1 text-[13px] text-[#475569]">Anything we should know? (optional)
          <textarea className={`${input} min-h-[90px] py-2`} maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>
        {/* honeypot: hidden from people, filled by bots */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} aria-hidden />
        <label className="flex items-start gap-3 text-[13.5px] leading-snug text-[#334155]">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} data-testid="consent" />
          <span>Profixter may contact me by phone, text or email about this request. Your photo and design are used only for this request.</span>
        </label>
        {errs.consent ? <span className="text-[12.5px] text-[#A3261B]">{errs.consent}</span> : null}
        {quote?.complete ? <p className="m-0 text-[13px] text-[#475569]">Estimated total in your request: <b>{quote.display}</b></p> : null}
        {msg ? <p className="m-0 rounded-xl bg-[#FDECEB] px-3 py-2 text-[13.5px] text-[#A3261B]">{msg}</p> : null}
        <div className="mt-2 flex gap-2">
          <button type="button" className={secondary} onClick={onBack}>Back</button>
          <button type="submit" className={`${primary} flex-1`} disabled={busy} data-testid="submit-request">{busy ? "Sending…" : "Request installation"}</button>
        </div>
      </form>
    </Panel>
  );
}

function Start({ cat, hasSaved, onStart, onResume, onNew }: { cat: PublicCatalog; hasSaved: boolean; onStart: () => void; onResume: () => void; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-6 text-center sm:py-12">
      <span className="inline-block rounded-full bg-[#E3ECFD] px-3 py-1 text-[12.5px] font-semibold text-[#2558c9]">Shower Studio</span>
      <h1 className="mt-4 text-[34px] font-bold leading-[1.1] text-[#0B1628] sm:text-[48px]">See your new shower before we build it</h1>
      <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-[#475569]">Snap a photo of your tub, pick walls, a base, a door and accessories, and see the result with an estimated price. No account needed.</p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {hasSaved ? (
          <>
            <button type="button" className={primary} onClick={onResume} data-testid="resume">Continue my design</button>
            <button type="button" className={secondary} onClick={onNew}>Start a new one</button>
          </>
        ) : (
          <button type="button" className={`${primary} min-w-[240px]`} onClick={onStart} data-testid="start">Start with a photo</button>
        )}
      </div>
      <div className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[["📸", "1. Photo", "Your tub or shower, from outside."], ["🎨", "2. Design", `${cat.catalog.finishes.length} wall styles, bases, doors and more.`], ["💬", "3. Request", "We confirm, measure and schedule."]].map(([i, t, s]) => (
          <div key={t} className="rounded-2xl bg-white p-4 shadow-[0_4px_20px_rgba(11,22,40,0.05)]">
            <div className="text-[22px]" aria-hidden>{i}</div>
            <div className="mt-1 text-[15px] font-semibold text-[#0B1628]">{t}</div>
            <div className="text-[13px] text-[#64748B]">{s}</div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-[12.5px] text-[#94A3B8]">Previews are illustrative. Your photo stays private. <Link href="/kitchen-bathroom" className="underline">See our bathroom work</Link></p>
    </div>
  );
}

function Done({ reference, onNew }: { reference?: string; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_8px_30px_rgba(11,22,40,0.06)]" data-testid="request-done">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8F6EE] text-[28px]" aria-hidden>✓</div>
      <h2 className="mt-4 text-[26px] font-bold text-[#0B1628]">We have your design</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#475569]">Thank you! A Profixter designer will contact you shortly to confirm the details and schedule a free measurement. Nothing is booked yet.</p>
      {reference ? <p className="mt-3 text-[13px] text-[#64748B]">Reference: <b>{reference}</b></p> : null}
      <button type="button" className={`${secondary} mt-6`} onClick={onNew}>Design another bathroom</button>
    </div>
  );
}
