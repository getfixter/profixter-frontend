"use client";

/**
 * Deciding which customer photos may be shown at a public booth.
 *
 * Nothing reaches the display until it is approved here. The display needs
 * 50-100 photos, not the whole library, so the default view is the shortlist:
 * up to 150 of the newest unreviewed photos, one per job first (chosen by the
 * server from plain facts, never from what is in the picture). The fast path
 * is a page at a time: tap anything that shows a face, a piece of mail, a
 * house number, a screen or anything else that should not be in public, then
 * "Hide N, approve the rest". Photos that look like screenshots, are too
 * small, or fail to load are marked for you; unmark them if they are fine.
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

const PAGE_SIZE = 30;
const GOAL = { min: 50, max: 100 };
type Flag = "small" | "screenshot" | "broken";

const FLAG_LABEL: Record<Flag, string> = {
  small: "Too small",
  screenshot: "Looks like a screenshot",
  broken: "Won't load",
};

type Tab = ReviewStatus | "shortlist";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "shortlist", label: "Shortlist" },
  { id: "unreviewed", label: "Everything else" },
  { id: "approved", label: "On display" },
  { id: "hidden", label: "Hidden" },
];

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
            Reviewing event photos needs an admin session.
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
  const [counts, setCounts] = useState<Record<Tab, number>>({
    approved: 0,
    hidden: 0,
    unreviewed: 0,
    shortlist: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("shortlist");
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
    setCounts(result.data.counts);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inTab = useMemo(
    () =>
      (photos || []).filter((p) =>
        tab === "shortlist"
          ? p.status === "unreviewed" && p.shortlisted
          : tab === "unreviewed"
            ? p.status === "unreviewed" && !p.shortlisted
            : p.status === tab,
      ),
    [photos, tab],
  );
  const reviewing = tab === "shortlist" || tab === "unreviewed";
  const tabCount = (id: Tab) =>
    id === "unreviewed" ? counts.unreviewed - counts.shortlist : counts[id];
  const pages = Math.max(1, Math.ceil(inTab.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = inTab.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );
  const markedOnPage = visible.filter((p) => marked.has(p.id));
  const unmarkedOnPage = visible.filter((p) => !marked.has(p.id));

  const switchTab = (next: Tab) => {
    setTab(next);
    setPage(0);
    setMarked(new Set());
  };

  const toggle = (id: string) =>
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const flag = useCallback(
    (id: string, value: Flag) => {
      setFlags((prev) => (prev[id] ? prev : { ...prev, [id]: value }));
      // On a review page a suspicious photo starts out marked to hide.
      if (tab === "shortlist" || tab === "unreviewed")
        setMarked((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    },
    [tab],
  );

  const apply = async (
    changes: Array<{ ids: string[]; status: ReviewStatus }>,
  ) => {
    setBusy(true);
    try {
      for (const change of changes) {
        if (change.ids.length === 0) continue;
        const result = await setPhotoStatus(change.ids, change.status);
        if (!result.ok) {
          setError(result.message);
          return;
        }
      }
      setMarked(new Set());
      setPreview(null);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  const ids = (list: ReviewPhoto[]) => list.map((p) => p.id);

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-40 text-[#0B1628]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Event display
            </p>
            <h1 className="text-[18px] font-bold">Review customer photos</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin"
              className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-[13px] font-semibold text-slate-600"
            >
              Admin
            </Link>
            <Link
              href="/admin/event-display"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#0B1628] px-4 text-[13px] font-semibold text-white"
            >
              Open display →
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`min-h-[38px] whitespace-nowrap rounded-full px-4 text-[13px] font-semibold ${
                tab === t.id
                  ? "bg-[#306EEC] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.label} <span className="opacity-70">{tabCount(t.id)}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pt-4">
        <div className="mb-4 rounded-xl bg-white px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-semibold">
              {counts.approved} on display
              <span className="font-normal text-slate-500">
                {" "}
                · aim for {GOAL.min}–{GOAL.max}
              </span>
            </span>
            {counts.approved >= GOAL.min && (
              <span className="font-semibold text-emerald-700">
                Enough for the event
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${counts.approved >= GOAL.min ? "bg-emerald-500" : "bg-[#306EEC]"}`}
              style={{
                width: `${Math.min(100, (counts.approved / GOAL.max) * 100)}%`,
              }}
            />
          </div>
        </div>
        <p className="mb-4 max-w-[760px] text-[13px] leading-relaxed text-slate-600">
          {tab === "shortlist"
            ? "The newest customer photos, one per job first. Tap every photo that shows a face, mail or paperwork, a house number or street, a screen, or anything you would not put in front of strangers. Then hide those and approve the rest. Photos that look wrong are pre-marked for you."
            : tab === "unreviewed"
              ? "Older photos and extra shots of jobs already in the shortlist. Same rules: tap the ones to hide, approve the rest."
              : tab === "approved"
                ? "These play on the display. Tap any to take them off."
                : "These never play. Tap any to put them on the display."}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            {error}{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        )}

        {photos === null && !error && (
          <p className="text-[13px] text-slate-500">Loading photos…</p>
        )}

        {photos !== null && inTab.length === 0 && (
          <p className="rounded-xl bg-white px-4 py-10 text-center text-[14px] text-slate-500">
            {reviewing ? "Everything here has been reviewed." : "Nothing here."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
              onClick={() => {
                setPage(current - 1);
                setMarked(new Set());
              }}
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
              onClick={() => {
                setPage(current + 1);
                setMarked(new Set());
              }}
              className="min-h-[40px] rounded-lg bg-white px-4 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {visible.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <p className="text-[13px] text-slate-600">
              {markedOnPage.length} marked on this page
            </p>
            <div className="flex flex-wrap gap-2">
              {reviewing && (
                <>
                  <button
                    type="button"
                    disabled={busy || markedOnPage.length === 0}
                    onClick={() =>
                      void apply([{ ids: ids(markedOnPage), status: "hidden" }])
                    }
                    className="min-h-[44px] rounded-lg bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Hide marked only
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void apply([
                        { ids: ids(markedOnPage), status: "hidden" },
                        { ids: ids(unmarkedOnPage), status: "approved" },
                      ])
                    }
                    className="min-h-[44px] rounded-lg bg-[#306EEC] px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    {busy
                      ? "Saving…"
                      : `Hide ${markedOnPage.length}, approve ${unmarkedOnPage.length}`}
                  </button>
                </>
              )}
              {tab === "approved" && (
                <button
                  type="button"
                  disabled={busy || markedOnPage.length === 0}
                  onClick={() =>
                    void apply([{ ids: ids(markedOnPage), status: "hidden" }])
                  }
                  className="min-h-[44px] rounded-lg bg-rose-600 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Take {markedOnPage.length} off the display
                </button>
              )}
              {tab === "hidden" && (
                <>
                  <button
                    type="button"
                    disabled={busy || markedOnPage.length === 0}
                    onClick={() =>
                      void apply([
                        { ids: ids(markedOnPage), status: "unreviewed" },
                      ])
                    }
                    className="min-h-[44px] rounded-lg bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Back to review
                  </button>
                  <button
                    type="button"
                    disabled={busy || markedOnPage.length === 0}
                    onClick={() =>
                      void apply([
                        { ids: ids(markedOnPage), status: "approved" },
                      ])
                    }
                    className="min-h-[44px] rounded-lg bg-[#306EEC] px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Approve {markedOnPage.length}
                  </button>
                </>
              )}
            </div>
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
          <img
            src={preview.url}
            alt=""
            className="min-h-0 flex-1 object-contain p-3"
          />
          <div
            className="flex justify-center gap-2 p-4"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {preview.status !== "hidden" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void apply([{ ids: [preview.id], status: "hidden" }])
                }
                className="min-h-[44px] rounded-lg bg-rose-600 px-5 text-[14px] font-semibold text-white"
              >
                Hide
              </button>
            )}
            {preview.status !== "approved" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void apply([{ ids: [preview.id], status: "approved" }])
                }
                className="min-h-[44px] rounded-lg bg-[#306EEC] px-5 text-[14px] font-semibold text-white"
              >
                Approve
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
  const markClass =
    photo.status === "unreviewed" || photo.status === "approved"
      ? "ring-4 ring-rose-500"
      : "ring-4 ring-[#306EEC]";
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-lg bg-slate-200 ${marked ? markClass : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt=""
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
            photo.status === "hidden" ? "bg-[#306EEC]" : "bg-rose-600"
          }`}
        >
          {photo.status === "hidden" ? "Approve" : "Hide"}
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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden
        >
          <path
            d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
