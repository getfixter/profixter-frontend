"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previewStudio, publicStudio, localDesign, apiUrl, type PublicCatalog, type PublicQuote, type MeasureSource } from "@/lib/studio/api";
import { EXAMPLE_SCENES, STANDARD_SIZE } from "@/lib/studio/examples";
import { trackLead } from "@/lib/meta";
import StudioStage from "@/app/components/studio/StudioStage";
import DesignPanel, { Messages } from "@/app/components/studio/DesignPanel";
import { useStudioEngine } from "@/app/components/studio/useStudioEngine";
import { preparePhoto } from "@/app/components/studio/photoPrep";

type Step = "start" | "customize" | "result" | "request";
type Kind = "shower" | "tub";
const STEPS: { id: Exclude<Step, "start">; label: string }[] = [
  { id: "customize", label: "Customize" },
  { id: "result", label: "Design & price" },
  { id: "request", label: "Request" },
];
const CUSTOM_TABS = [
  { id: "walls", label: "Walls" },
  { id: "base", label: "Base" },
  { id: "fixture", label: "Faucet" },
  { id: "door", label: "Door" },
  { id: "extras", label: "Extras" },
] as const;
const SCENE = EXAMPLE_SCENES[0];
const PRICE_PENDING = "Price confirmed after review.";

const btn = "inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-semibold transition disabled:opacity-50";
const primary = `${btn} bg-[#306EEC] text-white hover:bg-[#2558c9]`;
const secondary = `${btn} border border-[#C5CBD8] bg-white text-[#0B1628] hover:border-[#306EEC]`;
const link = "text-[14px] font-semibold text-[#306EEC] underline-offset-2 hover:underline";
const input = "min-h-[48px] w-full rounded-xl border border-[#C5CBD8] bg-white px-3 text-[16px] text-[#0B1628] outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/20";

/**
 * The public Shower Studio: Start -> Customize -> Design & price -> Request.
 * Starts on an example bathroom at a standard size: no photo, no measuring,
 * no account. A photo and real measurements are optional extras.
 */
/** Set only by the owner's local demo (BackEnd/scripts/studio_demo_env.js --demo); never on the live site. */
const DEMO = process.env.NEXT_PUBLIC_STUDIO_DEMO === "1";
function DemoBanner({ preview }: { preview?: boolean }) {
  return (
    <div className="mb-4 rounded-2xl bg-[#0B1628] px-4 py-2.5 text-center text-[12.5px] font-semibold text-white" data-testid="demo-banner">
      {preview ? "OWNER PREVIEW · demo products and demo prices · nothing is saved or sent" : "DEMO · sample products and demo prices · requests stay on this computer"}
    </div>
  );
}

/**
 * `preview`: the owner's live preview on profixter.com - the same customer
 * flow against /api/studio-preview (owner only on the server, demo catalog and
 * DEMO prices). Nothing is saved: no design, no photo upload, no request, no
 * analytics event; the photo stays in this browser.
 */
export default function StudioApp({ preview = false }: { preview?: boolean } = {}) {
  const [cat, setCat] = useState<PublicCatalog | null>(null);
  const [catError, setCatError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [mine, setMine] = useState<{ id: string; token: string; startedAt: number } | null>(null);
  const [resumable, setResumable] = useState<any>(null);
  const [kind, setKind] = useState<Kind>("shower");
  const [projectType, setProjectType] = useState("tub-to-shower");
  const [source, setSource] = useState<"example" | "photo">("example");
  const [measureSource, setMeasureSource] = useState<MeasureSource>("standard");
  const [pending, setPending] = useState<null | { kind: Kind; design?: any; photoUrl?: string; state?: any }>(null);
  const [panel, setPanel] = useState<null | "measure" | "photo">(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof CUSTOM_TABS)[number]["id"]>("walls");
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [submitted, setSubmitted] = useState<{ reference?: string } | null>(null);
  const { stageRefs, engine, snap, error: engineError, loaded } = useStudioEngine(cat?.catalog || null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stamp, setStamp] = useState(0);

  const toast = useCallback((t: string) => { setNotice(t); window.setTimeout(() => setNotice((n) => (n === t ? null : n)), 5200); }, []);
  const showChanges = (changes: string[]) => { if (changes?.length) toast(changes.join(" ")); };

  // ---------------------------------------------------------------- catalog + anything saved in this browser
  useEffect(() => {
    if (preview) {
      previewStudio.catalog().then(setCat).catch((e) => setCatError(e.status === 403 ? "This preview is for the Profixter owner account only." : e.message));
      return;
    }
    publicStudio.catalog().then(setCat).catch((e) => setCatError(e.message));
    const m = localDesign.get();
    if (m) {
      publicStudio.get(m.id, m.token).then((d) => {
        setMine(m);
        if (d.status !== "draft") { setSubmitted({}); return; }
        if (d.state || d.photo) setResumable(d);
      }).catch(() => localDesign.clear());
    }
  }, [preview]);
  useEffect(() => { if (snap?.last?.at) setStamp(snap.last.at); }, [snap?.last?.at]);

  // ---------------------------------------------------------------- draw the picture once the engine exists
  useEffect(() => {
    const e = engine();
    if (!loaded || !e || !pending) return;
    const job = pending;
    setPending(null);
    (async () => {
      try {
        if (job.photoUrl) await e.loadPhoto(apiUrl(job.photoUrl), { state: job.state || null });
        else await e.loadExample(SCENE, { kind: job.kind === "tub" ? "tub" : "pan", design: job.design || null });
      } catch (er: any) {
        toast(er?.message || "The picture could not be prepared on this device.");
      }
    })();
  }, [loaded, pending, engine, toast]);

  // ---------------------------------------------------------------- auto-save and the live price
  const designKey = useMemo(() => (snap?.design ? JSON.stringify(snap.design) : ""), [snap?.design]);
  useEffect(() => {
    if (!mine || !snap?.ready || submitted) return;
    const t = window.setTimeout(() => {
      const state = engine()?.getState();
      if (state) publicStudio.save(mine.id, mine.token, { state, projectType, measureSource }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(t);
  }, [designKey, projectType, measureSource, mine, snap?.ready, submitted, engine]);
  useEffect(() => {
    if (!snap?.design?.baseId) return;
    const t = window.setTimeout(() => { (preview ? previewStudio.quote : publicStudio.quote)(snap.design, projectType, measureSource).then(setQuote).catch(() => setQuote(null)); }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designKey, projectType, measureSource]);

  // ---------------------------------------------------------------- actions
  async function begin(k: Kind) {
    setKind(k);
    const pt = k === "tub" ? "tub-replacement" : "tub-to-shower";
    setProjectType(pt);
    setSource("example");
    setMeasureSource("standard");
    setStep("customize");
    setPending({ kind: k });
    window.scrollTo({ top: 0 });
    if (preview) { setSubmitted(null); return; }
    try {
      if (mine && !submitted) await publicStudio.remove(mine.id, mine.token).catch(() => {});
      const created = await publicStudio.create(pt, { exampleScene: SCENE.id, measureSource: "standard" });
      const m = { id: created.id, token: created.token, startedAt: Date.now() };
      localDesign.set(m);
      setMine(m);
      setSubmitted(null);
    } catch {
      // designing still works offline; saving and sending need the connection back
    }
  }

  function resume() {
    const d = resumable;
    if (!d) return;
    setProjectType(d.projectType);
    setKind(d.projectType === "tub-replacement" ? "tub" : "shower");
    setMeasureSource(d.measureSource || "standard");
    setSource(d.photo ? "photo" : "example");
    setStep("customize");
    if (d.photo) setPending({ kind: "shower", photoUrl: d.photo.url, state: d.state });
    else setPending({ kind: d.projectType === "tub-replacement" ? "tub" : "shower", design: d.state?.design || null });
  }

  async function startOver() {
    if (mine && !submitted) await publicStudio.remove(mine.id, mine.token).catch(() => {});
    localDesign.clear();
    setMine(null); setResumable(null); setSubmitted(null); setQuote(null); setPanel(null);
    setStep("start");
  }

  function chooseKind(k: Kind) {
    if (k === kind) return;
    const changes = engine()?.setKind(k === "tub" ? "tub" : "pan");
    if (changes === null) { toast(k === "tub" ? "None of our bathtubs fit this size." : "None of our shower bases fit this size."); return; }
    setKind(k);
    setProjectType(k === "tub" ? "tub-replacement" : "tub-to-shower");
    showChanges(changes || []);
  }

  async function onPhoto(file?: File | null) {
    if (!file || (!mine && !preview)) return;
    setUploading(true);
    try {
      const blob = await preparePhoto(file);
      if (preview) {
        await engine()?.loadPhoto(URL.createObjectURL(blob));
        setSource("photo");
        return;
      }
      if (!mine) return;
      const r = await publicStudio.uploadPhoto(mine.id, mine.token, blob);
      await engine()?.loadPhoto(apiUrl(r.photo.url));
      setSource("photo");
    } catch (e: any) {
      toast(e.message || "That photo could not be used. Please try another.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function backToExample() {
    setSource("example");
    setPanel(null);
    if (mine) await publicStudio.save(mine.id, mine.token, { exampleScene: SCENE.id }).catch(() => {});
    await engine()?.loadExample(SCENE, { design: engine()?.S.design });
  }

  const go = (s: Step) => { setStep(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const view: "photo" | "result" | "compare" = panel === "photo" && source === "photo" ? "photo" : step === "result" ? "compare" : "result";

  if (catError) return <Shell><p className="text-[#A3261B]">The Shower Studio is unavailable right now: {catError}</p></Shell>;
  if (!cat) return <Shell><p className="text-[#475569]">Loading…</p></Shell>;
  if (!cat.catalog.finishes.length || !cat.catalog.bases.length) {
    return <Shell><h1 className="text-[30px] font-bold text-[#0B1628]">Shower Studio is coming soon</h1><p className="mt-3 text-[#475569]">Call us and we&rsquo;ll design your new shower with you.</p></Shell>;
  }
  const idx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {DEMO || preview ? <DemoBanner preview={preview} /> : null}
      {step !== "start" && !submitted ? (
        <nav aria-label="Steps" className="mb-4 flex gap-1.5 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={i === idx ? "step" : undefined} disabled={!snap?.ready}
              className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${i === idx ? "bg-[#306EEC] text-white" : i < idx ? "bg-[#E3ECFD] text-[#2558c9]" : "bg-white text-[#94A3B8]"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${i === idx ? "bg-white/25" : i < idx ? "bg-[#306EEC] text-white" : "bg-[#EEF2F8]"}`}>{i < idx ? "✓" : i + 1}</span>{s.label}
            </button>
          ))}
        </nav>
      ) : null}

      {notice ? <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-[#0B1628] px-4 py-3 text-[14px] text-white shadow-2xl">{notice}</div> : null}
      {engineError ? <p className="mb-4 rounded-xl bg-[#FDECEB] px-4 py-3 text-[14px] text-[#A3261B]">{engineError} You can still request a free design consultation by phone.</p> : null}

      {submitted ? (
        <Done reference={submitted.reference} onNew={startOver} preview={preview} />
      ) : (
        <div className={step === "start" ? "" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]"}>
          {/* the picture: always mounted (the engine draws into it) */}
          <section className={step === "start" ? "hidden" : step === "customize" ? "sticky top-14 z-10 -mx-4 bg-[#F8FAFF] px-4 pb-2 lg:top-28 lg:mx-0 lg:self-start lg:px-0" : "lg:sticky lg:top-28 lg:self-start"}>
            <div className="relative rounded-3xl bg-white p-2 shadow-[0_8px_30px_rgba(11,22,40,0.06)] sm:p-3">
              <StudioStage
                {...stageRefs} view={view} compact={step === "customize"} className={snap?.ready ? "" : "hidden"}
                busy={uploading ? "Preparing your photo…" : panel === "photo" ? null : snap?.busy}
                renderStamp={stamp} drawCompare={(b, a) => engine()?.drawCompare(b, a)}
                illustrativeNote={source === "example" ? "Example bathroom at a standard size - not a picture of your home." : "Illustrative preview of your bathroom. Exact fit is confirmed on site."}
              />
              {!snap?.ready ? <div className="grid aspect-[3/4] max-h-[34vh] w-full place-items-center rounded-2xl bg-[#EEF2F8] text-[14px] text-[#64748B] sm:max-h-[58vh]">Preparing your design…</div> : null}
              {snap?.ready ? (
                <span className={`pointer-events-none absolute left-4 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-semibold text-[#0B1628] shadow ${view === "compare" ? "bottom-16" : "top-4"}`} data-testid="picture-badge">
                  {source === "example" ? "Example bathroom" : "Your photo"} · {measureSource === "customer" ? "your measurements" : "standard 60″ × 30″ size"}
                </span>
              ) : null}
            </div>
          </section>

          <section className={step === "start" ? "" : "min-w-0"}>
            {step === "start" && <Start canResume={Boolean(resumable)} onBegin={begin} onResume={resume} onNew={startOver} />}

            {step === "customize" && (
              <Panel title={kind === "tub" ? "Design your new bathtub" : "Design your walk-in shower"} sub="Tap any option. The picture and the price update right away.">
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#EEF2F8] p-1" role="group" aria-label="Shower or bathtub">
                  {(["shower", "tub"] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} onClick={() => chooseKind(k)} data-testid={`kind-${k}`} disabled={!snap?.ready}
                      className={`min-h-[44px] rounded-xl text-[14.5px] font-semibold ${kind === k ? "bg-white text-[#0B1628] shadow" : "text-[#475569]"}`}>
                      {k === "shower" ? "Walk-in shower" : "Bathtub"}
                    </button>
                  ))}
                </div>
                {kind === "shower" ? (
                  <label className="mb-4 flex items-center justify-between gap-3 text-[13.5px] text-[#475569]">
                    <span>What&rsquo;s there now?</span>
                    <select className="min-h-[40px] rounded-xl border border-[#C5CBD8] bg-white px-3 text-[14px] text-[#0B1628]" value={projectType} onChange={(e) => setProjectType(e.target.value)} data-testid="replacing">
                      <option value="tub-to-shower">A bathtub</option>
                      <option value="shower-replacement">An old shower</option>
                    </select>
                  </label>
                ) : null}
                <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1" role="tablist">
                  {CUSTOM_TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                      className={`min-h-[40px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${tab === t.id ? "bg-[#0B1628] text-white" : "bg-white text-[#475569]"}`}>{t.label}</button>
                  ))}
                </div>
                {snap?.ready ? <DesignPanel snap={snap} engine={engine} section={tab} onChanged={showChanges} /> : <p className="text-[14px] text-[#64748B]">Preparing the options…</p>}
                <Messages list={snap?.messages.design.filter((m) => m.kind === "err")} className="mt-4" />
                <PriceStrip quote={quote} />

                <div className="mt-5 grid gap-2 rounded-2xl border border-dashed border-[#C5CBD8] p-4">
                  <p className="m-0 text-[13px] font-semibold text-[#0B1628]">Optional</p>
                  <button type="button" className={`${link} text-left`} onClick={() => setPanel(panel === "measure" ? null : "measure")} data-testid="open-measure">
                    {measureSource === "customer" ? "Change my measurements" : "I know my measurements"}
                  </button>
                  {panel === "measure" && snap ? (
                    <MeasurePanel snap={snap} measureSource={measureSource}
                      onApply={(m) => { const ch = engine()?.setMeasure(m); setMeasureSource("customer"); showChanges(ch || []); }}
                      onStandard={() => { engine()?.setMeasure({ ...STANDARD_SIZE }); setMeasureSource("standard"); }} />
                  ) : null}
                  <button type="button" className={`${link} text-left`} onClick={() => setPanel(panel === "photo" ? null : "photo")} data-testid="open-photo">
                    {source === "photo" ? "My photo: adjust or change it" : "Try it on a photo of my bathroom"}
                  </button>
                  {panel === "photo" ? (
                    <div className="grid gap-2">
                      <input ref={fileRef} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} data-testid="photo-input" />
                      <p className="m-0 text-[13px] leading-relaxed text-[#475569]">Stand outside the tub and fit the whole tub area in the photo. {cat.privacyNote || "Your photo is private: only you and the Profixter team can see it, and camera location data is removed."}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={secondary} disabled={uploading || (!mine && !preview)} onClick={() => fileRef.current?.click()}>{source === "photo" ? "Use a different photo" : "Take or upload a photo"}</button>
                        {source === "photo" ? <button type="button" className={secondary} onClick={backToExample}>Back to the example</button> : null}
                      </div>
                      {source === "photo" && snap?.ready ? (
                        <>
                          <p className="m-0 rounded-xl bg-[#F1F5FF] p-3 text-[13px] leading-relaxed text-[#334155]"><b>Check the blue dots</b> on the corners of the wall you&rsquo;re facing. Drag any that are off; they snap into place.</p>
                          <Messages list={snap.messages.mark} />
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={secondary} onClick={() => engine()?.startTap4()}>Tap the 4 corners</button>
                            <button type="button" className={snap.tool === "tapRemove" ? primary : secondary} onClick={() => engine()?.setTool(snap.tool === "tapRemove" ? "marks" : "tapRemove")}>{snap.tool === "tapRemove" ? "Done removing" : "Remove an item"}</button>
                            {snap.canUndoMask ? <button type="button" className={secondary} onClick={() => engine()?.undoMask()}>Undo</button> : null}
                            <button type="button" className={primary} onClick={() => setPanel(null)} data-testid="photo-done">Done</button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Nav onBack={() => go("start")} onNext={() => go("result")} nextLabel="View design & price" nextDisabled={!snap?.ready || Boolean(snap?.busy)} />
              </Panel>
            )}

            {step === "result" && (
              <Panel title={kind === "tub" ? "Your new bathtub" : "Your new walk-in shower"} sub="Slide to compare before and after.">
                <PriceCard quote={quote} disclaimer={cat.disclaimer} />
                {source === "example" ? <p className="mt-3 rounded-xl bg-[#F1F5FF] px-3 py-2 text-[13px] text-[#334155]" data-testid="example-note">This is an <b>example bathroom</b>, not a picture of your home. We confirm sizes and fit with a free in-home measurement.</p> : null}
                <Nav onBack={() => go("customize")} onNext={() => go("request")} nextLabel="Request installation" />
              </Panel>
            )}

            {step === "request" && (
              <RequestForm
                quote={quote}
                privacyNote={cat.privacyNote}
                onBack={() => go("result")}
                onSubmit={async (form) => {
                  if (preview) {
                    const r = await previewStudio.submit({ ...form, state: engine()?.getState(), projectType, measureSource, exampleScene: source === "example" ? SCENE.id : null, photo: source === "photo" });
                    setSubmitted({ reference: r.reference });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                  }
                  let m = mine;
                  if (!m) {
                    const created = await publicStudio.create(projectType, { exampleScene: source === "example" ? SCENE.id : null, measureSource });
                    m = { id: created.id, token: created.token, startedAt: Date.now() };
                    localDesign.set(m); setMine(m);
                  }
                  const state = engine()?.getState();
                  if (state) await publicStudio.save(m.id, m.token, { state, projectType, measureSource, ...(source === "example" ? { exampleScene: SCENE.id } : {}) });
                  const previewImg = await engine()?.previewBlob();
                  if (previewImg) await publicStudio.uploadPreview(m.id, m.token, previewImg).catch(() => {});
                  const r = await publicStudio.submit(m.id, m.token, form);
                  try { trackLead({ content_name: "Shower Studio", content_category: "bathroom" }, { dataLayerEvent: null }); } catch { /* analytics never blocks */ }
                  setSubmitted({ reference: r.reference });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
          </section>
        </div>
      )}
      {step !== "start" && source === "example" ? <p className="mt-6 text-center text-[11.5px] text-[#94A3B8]">{SCENE.credit}</p> : null}
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

function MeasurePanel({ snap, measureSource, onApply, onStandard }: { snap: any; measureSource: MeasureSource; onApply: (m: any) => void; onStandard: () => void }) {
  const m = snap.design.measure;
  const [v, setV] = useState({ facingWidth: String(m.facingWidth), sideLength: String(m.sideLength), rimHeight: String(m.rimHeight) });
  const field = (k: keyof typeof v, label: string) => (
    <label className="grid gap-1 text-[12.5px] text-[#475569]">{label}
      <span className="relative">
        <input className={`${input} pr-14`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} data-testid={`m-${k}`} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94A3B8]">inches</span>
      </span>
    </label>
  );
  return (
    <div className="grid gap-2 rounded-xl bg-[#F8FAFF] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {field("facingWidth", "Width of the faucet wall")}
        {field("sideLength", "Length of the tub")}
        {field("rimHeight", "Height of the tub edge")}
      </div>
      <Messages list={snap.messages.measure} />
      <p className="m-0 text-[12px] text-[#64748B]">Your measurements are used to choose products that fit and to estimate the price. The picture stays an illustration.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primary} data-testid="apply-measure" onClick={() => onApply({ facingWidth: Number(v.facingWidth), sideLength: Number(v.sideLength), rimHeight: Number(v.rimHeight) })}>Use my measurements</button>
        {measureSource === "customer" ? <button type="button" className={secondary} onClick={onStandard}>Back to the standard size</button> : null}
      </div>
    </div>
  );
}

function PriceStrip({ quote }: { quote: PublicQuote | null }) {
  if (!quote) return null;
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#0B1628] px-4 py-3 text-white">
      <span className="text-[13px] text-white/70">{quote.complete ? "Estimated total" : "Price"}</span>
      <span className="text-right text-[17px] font-bold" data-testid="price-strip">{quote.complete ? quote.display : PRICE_PENDING}</span>
    </div>
  );
}

function PriceCard({ quote, disclaimer }: { quote: PublicQuote | null; disclaimer: string }) {
  return (
    <div className="rounded-2xl border border-[#DDE3EE] bg-[#F8FAFF] p-5" data-testid="price-card">
      <div className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B]" data-testid="price-label">{quote?.complete ? quote.label : "Price"}</div>
      <div className="mt-1 text-[32px] font-bold leading-tight text-[#0B1628]" data-testid="price-total">{quote?.complete ? quote.display : PRICE_PENDING}</div>
      {quote?.complete ? <p className="mt-2 text-[13px] font-semibold text-[#334155]" data-testid="price-basis">{quote.basis}</p> : null}
      <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">{quote?.complete ? disclaimer : "Some prices for this design are still being set; our team confirms your price after a quick review."}</p>
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

function RequestForm({ quote, privacyNote, onBack, onSubmit }: { quote: PublicQuote | null; privacyNote?: string; onBack: () => void; onSubmit: (f: Record<string, unknown>) => Promise<void> }) {
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
    <Panel title="Request installation" sub="No account needed. We'll call to confirm the details and schedule a free in-home measurement.">
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
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} aria-hidden />
        <label className="flex items-start gap-3 text-[13.5px] leading-snug text-[#334155]">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} data-testid="consent" />
          <span>Profixter may contact me by phone, text or email about this request.</span>
        </label>
        {errs.consent ? <span className="text-[12.5px] text-[#A3261B]">{errs.consent}</span> : null}
        {privacyNote ? <p className="m-0 text-[12.5px] leading-relaxed text-[#64748B]" data-testid="privacy-note">{privacyNote}</p> : null}
        <p className="m-0 text-[13px] text-[#475569]" data-testid="request-price">{quote?.complete ? <>Estimated total in your request: <b>{quote.display}</b></> : PRICE_PENDING}</p>
        {msg ? <p className="m-0 rounded-xl bg-[#FDECEB] px-3 py-2 text-[13.5px] text-[#A3261B]">{msg}</p> : null}
        <div className="mt-2 flex gap-2">
          <button type="button" className={secondary} onClick={onBack}>Back</button>
          <button type="submit" className={`${primary} flex-1`} disabled={busy} data-testid="submit-request">{busy ? "Sending…" : "Request installation"}</button>
        </div>
      </form>
    </Panel>
  );
}

function Start({ canResume, onBegin, onResume, onNew }: { canResume: boolean; onBegin: (k: Kind) => void; onResume: () => void; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-4 text-center sm:py-10">
      <span className="inline-block rounded-full bg-[#E3ECFD] px-3 py-1 text-[12.5px] font-semibold text-[#2558c9]">Shower Studio</span>
      <h1 className="mt-4 text-[34px] font-bold leading-[1.1] text-[#0B1628] sm:text-[48px]">Design your new bathroom in a minute</h1>
      <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-[#475569]">Pick walls, a base, a door and extras, and see an estimated price. No photo, no measuring, no account.</p>
      {canResume ? (
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" className={primary} onClick={onResume} data-testid="resume">Continue my design</button>
          <button type="button" className={secondary} onClick={onNew}>Start a new one</button>
        </div>
      ) : null}
      <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
        {([["shower", "Walk-in shower", "Replace a tub or an old shower with a walk-in shower."], ["tub", "Bathtub", "A new bathtub with matching walls."]] as const).map(([k, title, sub]) => (
          <button key={k} type="button" onClick={() => onBegin(k)} data-testid={`start-${k}`}
            className="group overflow-hidden rounded-3xl bg-white text-left shadow-[0_8px_30px_rgba(11,22,40,0.08)] ring-1 ring-[#DDE3EE] transition hover:ring-2 hover:ring-[#306EEC]">
            <div className="relative h-44 overflow-hidden bg-[#EEF2F8] sm:h-52">
              <img src={SCENE.src} alt="" className="h-full w-full object-cover object-[50%_60%] transition group-hover:scale-[1.03]" />
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#475569]">Example bathroom</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between"><span className="text-[18px] font-bold text-[#0B1628]">{title}</span><span className="text-[22px] text-[#306EEC]" aria-hidden>→</span></div>
              <p className="mt-1 text-[13.5px] text-[#64748B]">{sub}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-6 text-[12.5px] text-[#94A3B8]">Want to see it on your own bathroom? You can add a photo later. <Link href="/kitchen-bathroom" className="underline">See our bathroom work</Link></p>
    </div>
  );
}

function Done({ reference, onNew, preview }: { reference?: string; onNew: () => void; preview?: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_8px_30px_rgba(11,22,40,0.06)]" data-testid="request-done">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8F6EE] text-[28px]" aria-hidden>✓</div>
      <h2 className="mt-4 text-[26px] font-bold text-[#0B1628]">We have your design</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#475569]">Thank you! A Profixter designer will contact you to confirm the details and schedule a free measurement. Nothing is booked yet.</p>
      {reference ? <p className="mt-3 text-[13px] text-[#64748B]">Reference: <b>{reference}</b></p> : null}
      {preview ? <p className="mt-3 rounded-xl bg-[#F1F5FF] px-3 py-2 text-[13px] text-[#334155]" data-testid="preview-not-sent">Owner preview: this request was checked like a real one, but nothing was saved or sent.</p> : null}
      <button type="button" className={`${secondary} mt-6`} onClick={onNew}>Design another bathroom</button>
    </div>
  );
}
