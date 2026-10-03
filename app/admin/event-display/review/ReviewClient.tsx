"use client";

/**
 * Taking customer photos off the booth display.
 *
 * Every eligible booking photo plays by default: the owner chose that on
 * 2026-10-02, knowing the technical filters cannot see faces, mail, house
 * numbers or screens. This page is how an individual photo comes off: tap it,
 * press "Hide". A hidden photo can be restored from the Hidden tab. Photos
 * that look like screenshots, are too small or will not load are labelled so
 * they are easy to spot; nothing is hidden or shown without a press here.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";
import {
  fetchReviewPhotos,
  setPhotoStatus,
  type ReviewPhoto,
  type ReviewStatus,
} from "@/lib/event-display-service";

const PAGE_SIZE = 40;
type Flag = "small" | "screenshot" | "broken";
type Tab = "showing" | "hidden";

const FLAG_LABEL: Record<Flag, string> = {
  small: "Too small",
  screenshot: "Looks like a screenshot",
  broken: "Won't load",
};

export default function ReviewClient() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">Loading...</p>
      </div>
    );
  }
  if (!user || !isAdminUser(user)) {
    return (
      <div className="min-h-screen bg-white px-5 py-10">
        <div className="mx-auto max-w-[520px] rounded-xl border-2 border-rose-300 bg-rose-50 p-5">
          <p className="text-[17px] font-bold text-rose-900">
            Managing event photos needs an admin session.
          </p>
          <Link
            href="/signin"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-[#0B1628] px-4 text-[14px] font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }
  return <Review />;
}

function Review() {
  const [photos, setPhotos] = useState<ReviewPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("showing");
  const [page, setPage] = useState(0);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Record<string, Flag>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReviewPhoto | null>(null);

  const load = useCallback(async () => {
    const result = await fetchReviewPhotos();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setPhotos(result.data.photos);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showing = useMemo(() => (photos || []).filter((p) => p.status !== "hidden"), [photos]);
  const hidden = useMemo(() => (photos || []).filter((p) => p.status === "hidden"), [photos]);
  const inTab = tab === "showing" ? showing : hidden;
  const pages = Math.max(1, Math.ceil(inTab.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = inTab.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const markedOnPage = visible.filter((p) => marked.has(p.id));

  const switchTab = (next: Tab) => {
    setTab(next);
    setPage(0);
    setMarked(new Set());
  };

  const goToPage = (next: number) => {
    setPage(next);
    setMarked(new Set());
    window.scrollTo({ top: 0 });
  };

  const toggle = (id: string) =>
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const flag = useCallback((id: string, value: Flag) => {
    setFlags((prev) => (prev[id] ? prev : { ...prev, [id]: value }));
  }, []);

  const apply = async (ids: string[], status: ReviewStatus) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const result = await setPhotoStatus(ids, status);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMarked(new Set());
      setPreview(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const markIds = markedOnPage.map((p) => p.id);

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-40 text-[#0B1628]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Event display
            </p>
            <h1 className="text-[18px] font-bold">Customer photos</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin"
              className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-[13px] font-semibold text-slate-600"
            >
              Admin
            </Link>
            <Link
              href="/event"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#0B1628] px-4 text-[13px] font-semibold text-white"
            >
              Open display →
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-4 pb-2">
          {(
            [
              { id: "showing", label: "On display", count: showing.length },
              { id: "hidden", label: "Hidden", count: hidden.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`min-h-[38px] whitespace-nowrap rounded-full px-4 text-[13px] font-semibold ${
                tab === t.id ? "bg-[#306EEC] text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.label} <span className="opacity-70">{photos === null ? "…" : t.count}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pt-4">
        <p className="mb-4 max-w-[760px] text-[13px] leading-relaxed text-slate-600">
          {tab === "showing"
            ? "Every eligible customer booking photo plays on the display, newest first here. If you see one you don't want shown, tap it and press Hide. The public display stops serving it at once, and drops it from rotation on its next refresh (within 30 minutes, or reload the display)."
            : "These never play. Tap any to put them back on the display."}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {photos === null && !error && <p className="text-[13px] text-slate-500">Loading photos…</p>}

        {photos !== null && inTab.length === 0 && (
          <p className="rounded-xl bg-white px-4 py-10 text-center text-[14px] text-slate-500">
            {tab === "hidden" ? "Nothing is hidden." : "No eligible photos."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((photo) => (
            <Tile
              key={photo.id}
              photo={photo}
              marked={marked.has(photo.id)}
              flag={flags[photo.id]}
              onToggle={() => toggle(photo.id)}
              onPreview={() => setPreview(photo)}
              onFlag={(value) => flag(photo.id, value)}
            />
          ))}
        </div>

        {pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-[13px] font-semibold text-slate-600">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => goToPage(current - 1)}
              className="min-h-[40px] rounded-lg bg-white px-4 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span>
              Page {current + 1} of {pages}
            </span>
            <button
              type="button"
              disabled={current >= pages - 1}
              onClick={() => goToPage(current + 1)}
              className="min-h-[40px] rounded-lg bg-white px-4 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {markedOnPage.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-[1200px] items-center justify-between gap-2 px-4 py-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => setMarked(new Set())}
              className="min-h-[44px] rounded-lg px-3 text-[13px] font-semibold text-slate-600"
            >
              Clear
            </button>
            {tab === "showing" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply(markIds, "hidden")}
                className="min-h-[44px] rounded-lg bg-rose-600 px-5 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Saving…" : `Hide ${markIds.length} from the display`}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply(markIds, "unreviewed")}
                className="min-h-[44px] rounded-lg bg-[#306EEC] px-5 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Saving…" : `Put ${markIds.length} back on the display`}
              </button>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-black/95"
          role="dialog"
          aria-label="Photo preview"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="" className="min-h-0 flex-1 object-contain p-3" />
          <div
            className="flex justify-center gap-2 p-4"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {preview.status === "hidden" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply([preview.id], "unreviewed")}
                className="min-h-[44px] rounded-lg bg-[#306EEC] px-5 text-[14px] font-semibold text-white"
              >
                Put back on display
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply([preview.id], "hidden")}
                className="min-h-[44px] rounded-lg bg-rose-600 px-5 text-[14px] font-semibold text-white"
              >
                Hide
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="min-h-[44px] rounded-lg bg-white/15 px-5 text-[14px] font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({
  photo,
  marked,
  flag,
  onToggle,
  onPreview,
  onFlag,
}: {
  photo: ReviewPhoto;
  marked: boolean;
  flag?: Flag;
  onToggle: () => void;
  onPreview: () => void;
  onFlag: (flag: Flag) => void;
}) {
  const isHidden = photo.status === "hidden";
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-lg bg-slate-200 ${
        marked ? (isHidden ? "ring-4 ring-[#306EEC]" : "ring-4 ring-rose-500") : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`pointer-events-none absolute inset-0 object-cover transition ${marked ? "opacity-45" : ""}`}
        // Inline: globals.css has an unlayered `img { height: auto }` that beats h-full.
        style={{ width: "100%", height: "100%" }}
        onLoad={(e) => {
          const img = e.currentTarget;
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const aspect = w / Math.max(1, h);
          if (Math.min(w, h) < 360) onFlag("small");
          else if (aspect < 0.5 || aspect > 2.2) onFlag("screenshot");
        }}
        onError={() => onFlag("broken")}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-0 h-full w-full"
        aria-pressed={marked}
        aria-label={marked ? "Unmark photo" : "Mark photo"}
      />
      {marked && (
        <span
          className={`pointer-events-none absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
            isHidden ? "bg-[#306EEC]" : "bg-rose-600"
          }`}
        >
          {isHidden ? "Restore" : "Hide"}
        </span>
      )}
      {flag && (
        <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {FLAG_LABEL[flag]}
        </span>
      )}
      <button
        type="button"
        onClick={onPreview}
        aria-label="View larger"
        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
