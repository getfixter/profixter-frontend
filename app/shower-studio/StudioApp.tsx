"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previewStudio, publicStudio, localDesign, apiUrl, type PublicCatalog, type PublicQuote, type MeasureSource } from "@/lib/studio/api";
import { EXAMPLE_SCENES, STANDARD_SIZE } from "@/lib/studio/examples";
import { trackLead } from "@/lib/meta";
import { useStudioEngine } from "@/app/components/studio/useStudioEngine";
import { preparePhoto } from "@/app/components/studio/photoPrep";
import Stage from "@/app/components/studio/v2/Stage";
import Chooser, { type Category } from "@/app/components/studio/v2/Chooser";
import FullPreview from "@/app/components/studio/v2/FullPreview";
import { PhotoSource, PhotoSteps, type PhotoStep } from "@/app/components/studio/v2/PhotoFlow";
import { Icon, DemoTag, btn, input, money0, FONT, T, Spinner } from "@/app/components/studio/v2/ui";
import ProductArt from "@/app/components/studio/ProductArt";

/**
 * The customer Shower Studio: choose (shower or tub) -> customize -> review ->
 * request. A full-screen app with its own design language: on phones the
 * picture fills the top and the choices live in a bottom sheet that can be
 * collapsed so the picture grows; on tablets in landscape and desktops the
 * picture sits beside a side panel. No photo, measurement or account needed.
 *
 * `preview`: the owner's live preview - the same flow against
 * /api/studio-preview (owner only on the server, demo catalog, DEMO prices).
 * Nothing is saved on the server and nothing is sent; a draft stays in this
 * browser tab only.
 */
type Step = "start" | "design" | "review" | "request";
type Kind = "shower" | "tub";
type Sheet = "mini" | "half" | "full";
const SCENE = EXAMPLE_SCENES[0];
const PRICE_PENDING = "Price confirmed after review.";
/** Set only by the owner's local demo (BackEnd/scripts/studio_demo_env.js --demo); never on the live site. */
const DEMO = process.env.NEXT_PUBLIC_STUDIO_DEMO === "1";
const PREVIEW_DRAFT = "profixter:studio-preview:draft";

const TABS: { id: Category; label: string; icon: string }[] = [
  { id: "walls", label: "Walls", icon: "walls" },
  { id: "base", label: "Base", icon: "base" },
  { id: "fixture", label: "Faucet", icon: "faucet" },
  { id: "door", label: "Door", icon: "door" },
  { id: "extras", label: "Extras", icon: "extras" },
  { id: "layout", label: "Room", icon: "layout" },
];

const readDraft = () => { try { return JSON.parse(sessionStorage.getItem(PREVIEW_DRAFT) || "null"); } catch { return null; } };
const writeDraft = (v: any) => { try { if (v) sessionStorage.setItem(PREVIEW_DRAFT, JSON.stringify(v)); else sessionStorage.removeItem(PREVIEW_DRAFT); } catch { /* private mode: no draft */ } };

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
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("walls");
  const [sheet, setSheet] = useState<Sheet>("half");
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [submitted, setSubmitted] = useState<{ reference?: string } | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [photoStep, setPhotoStep] = useState<PhotoStep | null>(null);
  const [rotating, setRotating] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [focusAcc, setFocusAcc] = useState<string | null>(null);
  const lastPhoto = useRef<{ file: File; rotate: number } | null>(null);
  const { stageRefs, engine, snap, error: engineError, loaded } = useStudioEngine(cat?.catalog || null);
  const [stamp, setStamp] = useState(0);
  const demo = preview || DEMO;

  const toast = useCallback((t: string) => { setNotice(t); window.setTimeout(() => setNotice((n) => (n === t ? null : n)), 5200); }, []);
  const showChanges = useCallback((changes: string[]) => { if (changes?.length) toast(changes.join(" ")); }, [toast]);

  // ---------------------------------------------------------------- catalog + anything saved in this browser
  useEffect(() => {
    if (preview) {
      previewStudio.catalog().then(setCat).catch((e) => setCatError(e.status === 403 ? "This preview is for the Profixter owner account only." : e.message));
      const d = readDraft();
      if (d?.design) setResumable({ preview: true, projectType: d.projectType, state: { design: d.design } });
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
        if (job.photoUrl) { await e.loadPhoto(apiUrl(job.photoUrl), { state: job.state || null }); e.setSimpleMarks(true); }
        else await e.loadExample(SCENE, { kind: job.kind === "tub" ? "tub" : "pan", design: job.design || null });
      } catch (er: any) {
        toast(er?.message || "The picture could not be prepared on this device.");
      }
    })();
  }, [loaded, pending, engine, toast]);

  // ---------------------------------------------------------------- auto-save and the live price
  const designKey = useMemo(() => (snap?.design ? JSON.stringify(snap.design) : ""), [snap?.design]);
  useEffect(() => {
    if (!snap?.ready || submitted) return;
    const t = window.setTimeout(() => {
      if (preview) { if (source === "example") writeDraft({ projectType, design: engine()?.S.design }); return; }
      const state = engine()?.getState();
      if (mine && state) publicStudio.save(mine.id, mine.token, { state, projectType, measureSource }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(t);
  }, [designKey, projectType, measureSource, mine, snap?.ready, submitted, engine, preview, source]);
  useEffect(() => {
    if (!snap?.design?.baseId) return;
    const t = window.setTimeout(() => { (preview ? previewStudio.quote : publicStudio.quote)(snap.design, projectType, measureSource).then(setQuote).catch(() => setQuote(null)); }, 250);
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
    setCategory("walls"); setSheet("half"); setPhotoStep(null);
    setStep("design");
    setPending({ kind: k });
    if (preview) { setSubmitted(null); writeDraft(null); return; }
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
    setStep("design"); setSheet("half"); setCategory("walls");
    if (d.photo) setPending({ kind: "shower", photoUrl: d.photo.url, state: d.state });
    else setPending({ kind: d.projectType === "tub-replacement" ? "tub" : "shower", design: d.state?.design || null });
  }

  async function startOver() {
    if (mine && !submitted && !preview) await publicStudio.remove(mine.id, mine.token).catch(() => {});
    if (!preview) localDesign.clear();
    writeDraft(null);
    setMine(null); setResumable(null); setSubmitted(null); setQuote(null); setPhotoStep(null);
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

  async function takePhoto(file: File, rotate = 0) {
    setPhotoOpen(false); setPhotoErr(null);
    setPhotoStep("working"); setSheet("half");
    try {
      const blob = await preparePhoto(file, { rotate });
      lastPhoto.current = { file, rotate };
      let url: string;
      if (preview) url = URL.createObjectURL(blob);
      else {
        if (!mine) throw new Error("Please check your connection and try again.");
        const r = await publicStudio.uploadPhoto(mine.id, mine.token, blob);
        url = apiUrl(r.photo.url);
      }
      const e = engine();
      await e?.loadPhoto(url);
      e?.setSimpleMarks(true);
      e?.setActiveMark("wallBL");
      setSource("photo");
      setPhotoStep("confirm");
    } catch (er: any) {
      setPhotoStep(null);
      setPhotoErr(er?.message || "That photo could not be used. Please try another.");
      setPhotoOpen(true);
    } finally { setRotating(false); }
  }

  async function backToExample() {
    setPhotoOpen(false); setPhotoStep(null); setSource("example"); setPhotoErr(null);
    if (mine && !preview) await publicStudio.save(mine.id, mine.token, { exampleScene: SCENE.id }).catch(() => {});
    const d = engine()?.S.design;
    const design = d ? { ...structuredClone(d), measure: { ...d.measure, ...STANDARD_SIZE }, plumbing: { wall: d.plumbing?.wall === "right" ? "right" : "left" } } : null;
    setMeasureSource("standard");
    await engine()?.loadExample(SCENE, { kind: kind === "tub" ? "tub" : "pan", design });
  }

  const go = (s: Step) => { setStep(s); setFullOpen(false); setSheet(s === "request" ? "full" : "half"); };
  const pickCategory = (c: Category) => { setCategory(c); if (sheet === "mini") setSheet("half"); };

  // ---------------------------------------------------------------- what the picture shows
  const view: "photo" | "result" | "compare" = photoStep === "confirm" || photoStep === "adjust" ? "photo" : step === "review" && source === "photo" ? "compare" : "result";
  const caption = source === "example"
    ? `Example bathroom · ${measureSource === "customer" ? "your size" : `standard ${snap?.design?.measure?.facingWidth ?? 60}″ × ${snap?.design?.measure?.sideLength ?? 30}″`} · illustration`
    : "Your photo · preview";

  if (catError) return <Plain><p className="text-[16px] text-[#9A3412]">The Shower Studio is unavailable right now: {catError}</p></Plain>;
  if (!cat) return <Plain><Spinner className="mx-auto h-7 w-7 text-[#1C1B19]" /><p className="mt-3 text-[#5F5A52]">Loading the Studio…</p></Plain>;
  if (!cat.catalog.finishes.length || !cat.catalog.bases.length) {
    return <Plain><h1 className="text-[30px] font-semibold text-[#1C1B19]">Shower Studio is coming soon</h1><p className="mt-3 text-[#5F5A52]">Call us and we&rsquo;ll design your new shower with you.</p></Plain>;
  }

  const total = quote?.complete && quote.totalCents != null ? money0(quote.totalCents) : quote ? PRICE_PENDING : "…";
  const inPhoto = Boolean(photoStep);

  return (
    <div className="studio-root" style={{ ...FONT, background: T.bg, color: T.ink }}>
      <StudioStyles />
      {step === "start" ? (
        <Start canResume={Boolean(resumable)} onBegin={begin} onResume={resume} onNew={startOver} demo={demo} preview={preview} submitted={Boolean(submitted && !preview)} />
      ) : (
        <div className="fixed inset-0 flex flex-col" style={{ height: "100dvh", background: T.bg }}>
          {/* top bar */}
          <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 px-2 sm:px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5" aria-label={step === "design" ? "Back to start" : "Back"} onClick={() => (step === "design" ? setStep("start") : go(step === "request" ? "review" : "design"))} data-testid="back">
              <Icon name="arrowLeft" className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold tracking-[-0.01em]">Shower Studio</span>{demo ? <DemoTag /> : null}</div>
              <Steps step={step} />
            </div>
            <button type="button" onClick={() => setFullOpen(true)} disabled={!snap?.ready} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-3.5 text-[14px] font-semibold shadow-sm ring-1 ring-black/5 transition hover:ring-black/20 disabled:opacity-40" data-testid="open-preview">
              <Icon name="expand" className="h-[18px] w-[18px]" /><span>Preview</span>
            </button>
          </header>
          {demo ? <div className="z-10 shrink-0 truncate bg-[#FFF1D6] px-4 py-1 text-center text-[11.5px] font-semibold text-[#7A4F00]" data-testid="demo-banner">{preview ? <>OWNER PREVIEW · DEMO prices<span className="hidden sm:inline"> and demo products</span> · nothing is saved or sent</> : <>DEMO · sample products and DEMO prices<span className="hidden sm:inline"> · requests stay on this computer</span></>}</div> : null}
          {notice ? <div role="status" className="studio-rise pointer-events-none fixed inset-x-4 top-[72px] z-[80] mx-auto max-w-md rounded-2xl bg-[#1C1B19] px-4 py-3 text-[14px] leading-snug text-white shadow-2xl">{notice}</div> : null}

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* the picture */}
            <main className="relative min-h-0 flex-1 px-3 pb-2 pt-1 sm:px-5 lg:p-6" aria-label="Your bathroom">
              {engineError ? <p className="absolute inset-x-4 top-2 z-10 rounded-2xl bg-[#FBEDE7] px-4 py-3 text-[14px] text-[#9A3412]">{engineError} You can still request a free design consultation by phone.</p> : null}
              {submitted ? (
                <div className="grid h-full place-items-center"><Done reference={submitted.reference} onNew={startOver} preview={preview} /></div>
              ) : (
                <Stage refs={stageRefs} view={view} ready={Boolean(snap?.ready)} busy={photoStep === "working" ? "Preparing your photo…" : snap?.busy} engine={engine} snap={snap} stamp={stamp}
                  focusAcc={focusAcc} onFocusAcc={(k) => { setFocusAcc(k); setCategory("extras"); if (sheet === "mini") setSheet("half"); }}
                  onTapEmpty={() => setSheet((s) => (s === "full" ? "half" : s))} interactive={step === "design" && !photoStep}>
                  {snap?.ready ? <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-full bg-white/85 px-2.5 py-1 text-[11.5px] font-medium text-[#5F5A52] shadow-sm backdrop-blur" data-testid="picture-badge">{caption}</span> : null}
                  {snap?.canUndoMove && step === "design" && !photoStep ? (
                    <button type="button" onClick={() => showChanges(engine()?.undoMove() || [])} className="absolute right-2 top-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/92 px-3 text-[13px] font-semibold shadow ring-1 ring-black/5" data-testid="undo-move"><Icon name="undo" className="h-4 w-4" />Undo move</button>
                  ) : null}
                </Stage>
              )}
            </main>

            {/* the controls: a sheet on phones, a side panel on large screens */}
            {!submitted ? (
              <aside className={`studio-sheet relative z-10 flex shrink-0 flex-col rounded-t-[28px] bg-[#FBFAF8] shadow-[0_-12px_40px_rgba(28,27,25,0.10)] lg:h-auto lg:w-[460px] lg:rounded-none lg:border-l lg:border-[#E7E1D8] lg:shadow-none xl:w-[500px] ${sheet === "full" ? "h-[80dvh]" : sheet === "half" ? "h-[50dvh]" : "h-auto"}`}
                data-sheet={sheet} aria-label="Design choices">
                <button type="button" className="flex h-6 w-full shrink-0 items-center justify-center lg:hidden" onClick={() => setSheet((s) => (s === "mini" ? "half" : s === "half" ? "full" : "half"))}
                  aria-label={sheet === "full" ? "Show more of the picture" : "Show more choices"} data-testid="sheet-handle">
                  <span className="h-1.5 w-10 rounded-full bg-[#D6CFC3]" />
                </button>
                {step === "design" && !inPhoto ? (
                  <nav className="grid shrink-0 grid-cols-6 gap-0.5 px-2 lg:px-4 lg:pt-4" role="tablist" aria-label="What to choose">
                    {TABS.map((t) => (
                      <button key={t.id} type="button" role="tab" aria-selected={category === t.id} onClick={() => pickCategory(t.id)} data-testid={`tab-${t.id}`}
                        className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-[11.5px] font-semibold transition ${category === t.id ? "bg-[#1C1B19] text-white" : "text-[#5F5A52] hover:bg-black/5"}`}>
                        <Icon name={t.id === "base" && kind === "tub" ? "tub" : t.icon} className="h-[22px] w-[22px]" />{t.id === "base" && kind === "tub" ? "Tub" : t.label}
                      </button>
                    ))}
                  </nav>
                ) : null}
                <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 lg:px-6 ${sheet === "mini" ? "hidden lg:block" : ""}`} data-testid="sheet-body">
                  {photoStep ? (
                    <PhotoSteps step={photoStep} snap={snap} engine={engine} rotating={rotating}
                      onYes={() => setPhotoStep("plumbing")} onAdjust={() => { engine()?.setActiveMark("wallBL"); setPhotoStep("adjust"); }}
                      onDoneAdjust={() => setPhotoStep("plumbing")}
                      onRotate={() => { const l = lastPhoto.current; if (l) { setRotating(true); takePhoto(l.file, (l.rotate + 90) % 360); } }}
                      onReplace={() => setPhotoOpen(true)} onExample={backToExample}
                      onPlumbing={(w) => showChanges(engine()?.setPlumbing(w) || [])}
                      onFinish={() => { setPhotoStep(null); setCategory("walls"); }} />
                  ) : step === "design" && snap?.ready ? (
                    <Chooser category={category} snap={snap} engine={engine} catalog={cat.catalog} projectType={projectType} kind={kind}
                      priceApi={preview ? previewStudio.quoteOptions : publicStudio.quoteOptions} onChanged={showChanges} onCategory={setCategory}
                      onOpenPhoto={() => { setPhotoErr(null); setPhotoOpen(true); }} onOpenMeasure={() => setMeasureOpen(true)} onKind={chooseKind} setProjectType={setProjectType} source={source}
                      focusAcc={focusAcc} setFocusAcc={setFocusAcc} />
                  ) : step === "design" ? (
                    <div className="grid gap-3" aria-hidden><div className="h-6 w-2/3 animate-pulse rounded-full bg-[#ECE7DF]" /><div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-[20px] bg-[#ECE7DF]" />)}</div></div>
                  ) : step === "review" ? (
                    <Review snap={snap} catalog={cat.catalog} quote={quote} disclaimer={cat.disclaimer} source={source} demo={demo} onEdit={(c) => { setCategory(c); go("design"); }} />
                  ) : (
                    <RequestForm quote={quote} privacyNote={cat.privacyNote} demo={demo}
                      onSubmit={async (form) => {
                        if (preview) {
                          const r = await previewStudio.submit({ ...form, state: engine()?.getState(), projectType, measureSource, exampleScene: source === "example" ? SCENE.id : null, photo: source === "photo" });
                          setSubmitted({ reference: r.reference });
                          writeDraft(null);
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
                      }} />
                  )}
                </div>
                {/* running total + next action, always visible */}
                {step !== "request" && !photoStep ? (
                  <footer className="flex shrink-0 items-center gap-3 border-t border-[#ECE6DD] bg-[#FBFAF8] px-4 py-3 lg:px-6" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#8C867C]">{demo ? "Demo estimate" : quote?.complete ? "Estimated total" : "Price"}</div>
                      <div className={`truncate font-semibold tabular-nums tracking-[-0.01em] text-[#1C1B19] ${quote && !quote.complete ? "text-[14px]" : "text-[22px] leading-tight"}`} data-testid="price-strip">{total}</div>
                    </div>
                    {step === "design" ? (
                      <button type="button" className={`${btn.primary} min-h-[50px] px-5`} onClick={() => go("review")} disabled={!snap?.ready || Boolean(snap?.busy)} data-testid="total-review">Review<Icon name="arrowRight" className="h-5 w-5" /></button>
                    ) : (
                      <button type="button" className={`${btn.primary} min-h-[50px] px-5`} onClick={() => go("request")} data-testid="go-request">Request installation</button>
                    )}
                  </footer>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      )}

      <FullPreview open={fullOpen} onClose={() => setFullOpen(false)} engine={engine} stamp={stamp} hasPhoto={source === "photo"} caption={caption} />
      <PhotoSource open={photoOpen} onClose={() => setPhotoOpen(false)} onFile={(f) => takePhoto(f)} onExample={backToExample} error={photoErr} privacyNote={cat.privacyNote} hasPhoto={source === "photo"} />
      {measureOpen && snap ? (
        <MeasureSheet snap={snap} measureSource={measureSource} onClose={() => setMeasureOpen(false)}
          onApply={(m) => { const ch = engine()?.setMeasure(m); setMeasureSource("customer"); showChanges(ch || []); setMeasureOpen(false); }}
          onStandard={() => { engine()?.setMeasure({ ...STANDARD_SIZE }); setMeasureSource("standard"); setMeasureOpen(false); }} />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ pieces
function StudioStyles() {
  return (
    <style>{`
      .studio-root { -webkit-tap-highlight-color: transparent; }
      .studio-root button { -webkit-touch-callout: none; }
      @keyframes studioFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      @keyframes studioRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
      .studio-fade { animation: studioFade .28s cubic-bezier(.2,.7,.2,1) both; }
      .studio-rise { animation: studioRise .32s cubic-bezier(.2,.7,.2,1) both; }
      .studio-sheet { transition: height .32s cubic-bezier(.2,.7,.2,1); }
      @media (min-width: 1024px) { .studio-sheet { height: auto !important; } }
      @media (prefers-reduced-motion: reduce) { .studio-fade, .studio-rise { animation: none; } .studio-sheet { transition: none; } }
    `}</style>
  );
}

function Plain({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[100dvh] place-items-center px-6 text-center" style={{ ...FONT, background: T.bg }}><div>{children}</div></div>;
}

function Steps({ step }: { step: Step }) {
  const all: [Step, string][] = [["design", "Design"], ["review", "Review"], ["request", "Request"]];
  const i = all.findIndex(([s]) => s === step);
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#8C867C]" aria-label={`Step ${i + 1} of 3`}>
      {all.map(([s, l], k) => (
        <span key={s} className={`flex items-center gap-1.5 ${k === i ? "font-semibold text-[#1C1B19]" : ""}`}>{k > 0 ? <span className="h-px w-3 bg-[#D6CFC3]" aria-hidden /> : null}{l}</span>
      ))}
    </div>
  );
}

function Start({ canResume, onBegin, onResume, onNew, demo, preview, submitted }: { canResume: boolean; onBegin: (k: Kind) => void; onResume: () => void; onNew: () => void; demo: boolean; preview: boolean; submitted: boolean }) {
  return (
    <div className="min-h-[100dvh]" style={{ background: "linear-gradient(180deg,#F6F3EE 0%,#EEE9E1 100%)" }}>
      {demo ? <div className="bg-[#FFF1D6] px-4 py-1.5 text-center text-[12px] font-semibold text-[#7A4F00]" data-testid="demo-banner">{preview ? "OWNER PREVIEW · demo products and DEMO prices · nothing is saved or sent" : "DEMO · sample products and DEMO prices · requests stay on this computer"}</div> : null}
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:pt-14">
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em] text-[#5F5A52]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1C1B19] text-white"><Icon name="sparkle" className="h-4 w-4" /></span>
          Shower Studio <span className="font-normal text-[#8C867C]">by Profixter</span>
        </div>
        <h1 className="mt-6 max-w-2xl text-[38px] font-semibold leading-[1.05] tracking-[-0.025em] text-[#1C1B19] sm:text-[56px]">Design your new shower or bath.</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#5F5A52]">Choose walls, a base, a faucet and a door, see it come together, and get an estimate. No photo, measuring or account needed.</p>
        {submitted ? <p className="mt-6 max-w-xl rounded-2xl bg-white px-4 py-3 text-[14px] text-[#1C1B19] ring-1 ring-[#E7E1D8]">We already have your last design. Start a new one any time.</p> : null}
        {canResume ? (
          <div className="mt-7 flex max-w-xl flex-wrap items-center gap-3 rounded-[22px] bg-white p-3 pl-4 ring-1 ring-[#E7E1D8]">
            <span className="min-w-0 flex-1 text-[15px] font-medium">You have a design in progress.</span>
            <button type="button" className={btn.small} onClick={onNew}>Start new</button>
            <button type="button" className={`${btn.primary} min-h-[44px] px-5 text-[15px]`} onClick={onResume} data-testid="resume">Continue</button>
          </div>
        ) : null}
        <div className="mt-9 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {([["shower", "Walk-in shower", "Replace a tub or an old shower.", "/studio/start-shower.jpg"], ["tub", "Bathtub", "A new tub with matching walls.", "/studio/start-tub.jpg"]] as const).map(([k, title, sub, src]) => (
            <button key={k} type="button" onClick={() => onBegin(k)} data-testid={`start-${k}`}
              className="group relative overflow-hidden rounded-[28px] bg-white text-left shadow-[0_20px_50px_rgba(28,27,25,0.10)] ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(28,27,25,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A47A3E]">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#ECE7DF] sm:aspect-[5/4]">
                <img src={src} alt="" className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.03]" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-medium text-[#5F5A52] backdrop-blur">Illustration</span>
              </div>
              <div className="flex items-center gap-3 p-5">
                <div className="min-w-0 flex-1"><div className="text-[21px] font-semibold tracking-[-0.01em] text-[#1C1B19]">{title}</div><p className="mt-0.5 text-[14px] text-[#8C867C]">{sub}</p></div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1C1B19] text-white transition group-hover:translate-x-0.5"><Icon name="arrowRight" className="h-5 w-5" /></span>
              </div>
            </button>
          ))}
        </div>
        <ol className="mt-10 grid gap-3 text-[14px] text-[#5F5A52] sm:grid-cols-4">
          {["Choose shower or tub", "Pick finishes and extras", "Review your design and price", "Request a free measurement"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[13px] font-semibold text-[#1C1B19] ring-1 ring-[#E7E1D8]">{i + 1}</span>{t}</li>
          ))}
        </ol>
        <p className="mt-8 text-[12.5px] text-[#8C867C]">Pictures are illustrations. Want to see it in your own bathroom? Add a photo any time while you design.</p>
      </div>
    </div>
  );
}

function Review({ snap, catalog, quote, disclaimer, source, demo, onEdit }: { snap: any; catalog: any; quote: PublicQuote | null; disclaimer: string; source: "example" | "photo"; demo: boolean; onEdit: (c: Category) => void }) {
  const cur = snap?.current || {};
  const d = snap?.design;
  const accs = (d?.accessories || []).map((a: any) => (catalog.accessories || []).find((x: any) => x.id === a.productId)).filter(Boolean);
  const rows: { c: Category; label: string; item: any; art: any; text: string }[] = [
    { c: "walls", label: "Walls", item: cur.finish, art: "finish", text: [cur.finish?.family?.label || cur.finish?.label, cur.finish?.variant?.color].filter(Boolean).join(" · ") },
    { c: "base", label: cur.base?.kind === "tub" ? "Bathtub" : "Shower base", item: cur.base, art: "base", text: [cur.base?.family?.label || cur.base?.label, cur.base?.variant?.color].filter(Boolean).join(" · ") },
    { c: "fixture", label: "Faucet & shower", item: cur.fixture, art: "fixture", text: cur.fixture?.family?.label || cur.fixture?.label || "" },
    { c: "door", label: "Door", item: cur.enclosure, art: cur.enclosure ? "enclosure" : "none", text: cur.enclosure ? [cur.enclosure.family?.label || cur.enclosure.label, cur.enclosure.variant?.color].filter(Boolean).join(" · ") : "None" },
    { c: "extras", label: "Extras", item: accs[0], art: accs.length ? "accessory" : "none", text: accs.length ? accs.map((a: any) => a.family?.label || a.label).join(", ") : "None" },
  ];
  return (
    <div className="studio-fade grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <h3 className="text-[22px] font-semibold tracking-[-0.01em]">Your design</h3>
        <p className="mt-1 text-[14px] text-[#8C867C]">{source === "photo" ? "Slide the picture to compare before and after." : "Tap Preview to see it full screen."}</p>
      </div>
      <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        {rows.map((r) => (
          <li key={r.c}>
            <button type="button" onClick={() => onEdit(r.c)} className="flex w-full items-center gap-3 rounded-[18px] bg-white p-2.5 pr-3 text-left ring-1 ring-[#E7E1D8] transition hover:ring-[#1C1B19]/30">
              <ProductArt kind={r.art} item={r.item} label={false} className="h-14 w-14 shrink-0 rounded-[12px]" />
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8C867C]">{r.label}</span><span className="block truncate text-[15px] font-medium">{r.text}</span></span>
              <span className="text-[13px] font-semibold text-[#5F5A52]">Change</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-[22px] bg-[#1C1B19] p-5 text-white" data-testid="price-card">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60" data-testid="price-label">{quote?.complete ? quote.label : "Price"}{demo ? <DemoTag /> : null}</div>
        <div className="mt-1 text-[34px] font-semibold tabular-nums tracking-[-0.02em]" data-testid="price-total">{quote?.complete && quote.totalCents != null ? money0(quote.totalCents) : PRICE_PENDING}</div>
        {quote?.complete ? <p className="mt-1 text-[13px] text-white/75" data-testid="price-basis">{quote.basis}</p> : null}
        <p className="mt-2 text-[13px] leading-relaxed text-white/65">{quote?.complete ? disclaimer : "Some prices for this design are still being set; our team confirms your price after a quick review."}</p>
        {quote?.includes?.length ? (
          <details className="mt-3 text-[13.5px] text-white/85">
            <summary className="cursor-pointer font-semibold">What&rsquo;s included</summary>
            <ul className="mt-2 list-disc pl-5">{quote.includes.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </details>
        ) : null}
      </div>
      {source === "example" ? <p className="rounded-2xl bg-white px-4 py-3 text-[13.5px] leading-relaxed text-[#5F5A52] ring-1 ring-[#E7E1D8]" data-testid="example-note">This is an <b className="text-[#1C1B19]">example bathroom</b>, not a picture of your home. We confirm sizes and fit with a free in-home measurement.</p> : null}
      <p className="text-[12px] text-[#8C867C]">Not a contract. Nothing is booked until Profixter measures and you approve the proposal.</p>
    </div>
  );
}

function MeasureSheet({ snap, measureSource, onApply, onStandard, onClose }: { snap: any; measureSource: MeasureSource; onApply: (m: any) => void; onStandard: () => void; onClose: () => void }) {
  const m = snap.design.measure;
  const [v, setV] = useState({ facingWidth: String(m.facingWidth), sideLength: String(m.sideLength), rimHeight: String(m.rimHeight) });
  const field = (k: keyof typeof v, label: string, hint: string) => (
    <label className="grid gap-1.5"><span className="text-[14px] font-semibold text-[#1C1B19]">{label}</span>
      <span className="relative">
        <input className={`${input} pr-16`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} data-testid={`m-${k}`} />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-[#8C867C]">inches</span>
      </span>
      <span className="text-[12.5px] text-[#8C867C]">{hint}</span>
    </label>
  );
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Your measurements" onClick={onClose}>
      <div className="studio-rise max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#FBFAF8] p-5 sm:rounded-[28px]" onClick={(e) => e.stopPropagation()} style={{ ...FONT, paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-[21px] font-semibold">Your measurements</h2><p className="mt-1 text-[14px] text-[#5F5A52]">Optional. They make the estimate closer; we measure exactly before any work.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid gap-4">
          {field("facingWidth", "Back wall, side to side", "The long wall behind the tub, from one corner to the other.")}
          {field("sideLength", "Depth, back wall to the front edge", "From the back wall to the outside edge of the tub.")}
          {field("rimHeight", "Height of the tub edge", "From the floor to the top of the tub's edge.")}
        </div>
        {snap.messages.measure?.length ? <p className="mt-3 rounded-2xl bg-[#FBEDE7] px-4 py-2.5 text-[13.5px] text-[#9A3412]">{snap.messages.measure[0].text}</p> : null}
        <div className="mt-5 grid gap-2">
          <button type="button" className={btn.primary} data-testid="apply-measure" onClick={() => onApply({ facingWidth: Number(v.facingWidth), sideLength: Number(v.sideLength), rimHeight: Number(v.rimHeight) })}>Use my measurements</button>
          {measureSource === "customer" ? <button type="button" className={btn.ghost} onClick={onStandard}>Back to the standard size</button> : null}
        </div>
      </div>
    </div>
  );
}

function RequestForm({ quote, privacyNote, demo, onSubmit }: { quote: PublicQuote | null; privacyNote?: string; demo: boolean; onSubmit: (f: Record<string, unknown>) => Promise<void> }) {
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
    <label className="grid gap-1.5"><span className="text-[14px] font-semibold text-[#1C1B19]">{label}</span>
      <input className={`${input} ${errs[k] ? "border-[#C2410C]" : ""}`} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errs[k])} name={k} {...props} />
      {errs[k] ? <span className="text-[13px] text-[#9A3412]">{errs[k]}</span> : null}
    </label>
  );
  return (
    <form onSubmit={submit} className="studio-fade grid gap-4" noValidate>
      <div>
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8C867C]">Profixter installation {demo ? <DemoTag /> : null}</div>
        <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Request installation</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-[#5F5A52]">Your design goes to Profixter&rsquo;s bathroom team. We&rsquo;ll call to confirm the details and set up a free in-home measurement. No account needed.</p>
      </div>
      {field("name", "Your name", { autoComplete: "name" })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("phone", "Phone", { autoComplete: "tel", inputMode: "tel" })}
        {field("email", "Email", { autoComplete: "email", inputMode: "email" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        {field("zip", "ZIP code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 5 })}
        {field("address", "Street address (optional)", { autoComplete: "street-address" })}
      </div>
      <label className="grid gap-1.5"><span className="text-[14px] font-semibold">Best way to reach you</span>
        <select className={input} value={f.contactPref} onChange={(e) => set("contactPref", e.target.value)}>
          <option value="phone">Phone call</option><option value="text">Text message</option><option value="email">Email</option>
        </select>
      </label>
      <label className="grid gap-1.5"><span className="text-[14px] font-semibold">Anything we should know? (optional)</span>
        <textarea className={`${input} min-h-[96px] py-3`} maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} aria-hidden />
      <label className="flex items-start gap-3 text-[14px] leading-snug">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#1C1B19]" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} data-testid="consent" />
        <span>Profixter may contact me by phone, text or email about this request.</span>
      </label>
      {errs.consent ? <span className="text-[13px] text-[#9A3412]">{errs.consent}</span> : null}
      {privacyNote ? <p className="m-0 text-[12.5px] leading-relaxed text-[#8C867C]" data-testid="privacy-note">{privacyNote}</p> : null}
      <p className="m-0 rounded-2xl bg-white px-4 py-3 text-[14px] ring-1 ring-[#E7E1D8]" data-testid="request-price">{quote?.complete && quote.totalCents != null ? <>{demo ? "Demo estimate" : "Estimated total"} in your request: <b>{money0(quote.totalCents)}</b></> : PRICE_PENDING}</p>
      {msg ? <p className="m-0 rounded-2xl bg-[#FBEDE7] px-4 py-3 text-[14px] text-[#9A3412]" role="alert">{msg}</p> : null}
      <button type="submit" className={`${btn.primary} w-full`} disabled={busy} data-testid="submit-request">{busy ? <><Spinner className="h-5 w-5" />Sending…</> : "Send my request"}</button>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </form>
  );
}

function Done({ reference, onNew, preview }: { reference?: string; onNew: () => void; preview?: boolean }) {
  return (
    <div className="studio-rise mx-auto max-w-md rounded-[28px] bg-white p-8 text-center shadow-[0_20px_50px_rgba(28,27,25,0.10)]" data-testid="request-done">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E7F1EB] text-[#2F6B4F]"><Icon name="check" className="h-7 w-7" /></div>
      <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.01em]">We have your design</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#5F5A52]">Thank you! A Profixter designer will contact you to confirm the details and set up a free measurement. Nothing is booked yet.</p>
      {reference ? <p className="mt-3 text-[13px] text-[#8C867C]">Reference: <b className="text-[#1C1B19]">{reference}</b></p> : null}
      {preview ? <p className="mt-3 rounded-2xl bg-[#FFF1D6] px-3 py-2 text-[13px] text-[#7A4F00]" data-testid="preview-not-sent">Owner preview: this request was checked like a real one, but nothing was saved or sent.</p> : null}
      <button type="button" className={`${btn.secondary} mt-6`} onClick={onNew}>Design another bathroom</button>
    </div>
  );
}
