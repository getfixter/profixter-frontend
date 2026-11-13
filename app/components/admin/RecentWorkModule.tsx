"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhotoLightbox from "../ui/PhotoLightbox";
import { Button, ConfirmSheet, Field, Select, Sheet, TextInput, Textarea } from "@/app/components/admin/ui";
import RecentWorkUploader, { RecentWorkPairUploader } from "./RecentWorkUploader";
import {
  STATUS_LABELS,
  STATUS_TONES,
  UPLOADER_LABELS,
  deletePhoto,
  fetchGallery,
  publishPhoto,
  rejectPhoto,
  unpublishPhoto,
  updatePhoto,
  type AdminWorkPhoto,
  type GalleryCounts,
  type GalleryView,
  type WorkPhotoCategory,
} from "@/lib/recent-work-service";

/**
 * Recent Work: the gallery an admin actually runs the feature from.
 *
 * THREE VIEWS, AND THE NAMES ARE THE MENTAL MODEL. Needs review is work waiting
 * on a person. Live is what the public can see right now. Library is everything
 * we hold, live or not - which is the view that makes "unpublish" safe to use,
 * because you can watch the photo move rather than vanish.
 *
 * Built for a phone first. The grid is two columns at 390px with real
 * thumbnails, because a list of filenames is useless when the thing you are
 * deciding about is what the photograph looks like. Every action is either on
 * the tile or one tap into the viewer; nothing needs a wide screen.
 */

interface RecentWorkModuleProps {
  onToast: (message: string) => void;
  /** The admin shell owns the search box; this is what is in it. */
  searchQuery: string;
}

const VIEWS: { id: GalleryView; label: string; countKey: keyof GalleryCounts }[] = [
  { id: "pending", label: "Needs review", countKey: "pending" },
  { id: "published", label: "Live", countKey: "published" },
  { id: "library", label: "Library", countKey: "library" },
];

const EMPTY_COUNTS: GalleryCounts = {
  pending: 0,
  scheduled: 0,
  published: 0,
  rejected: 0,
  library: 0,
};

/*
 * Minute resolution. The server publishes a scheduled photo on its own; this
 * text only says roughly when, so "Live in 12 min" replaces a seconds ticker
 * that re-rendered the whole grid every second (audit C.1).
 */
function minutesUntil(publishAt: string | null, now: number): string | null {
  if (!publishAt) return null;
  const remaining = new Date(publishAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function relativeDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default function RecentWorkModule({ onToast, searchQuery }: RecentWorkModuleProps) {
  const [view, setView] = useState<GalleryView>("published");
  const [photos, setPhotos] = useState<AdminWorkPhoto[]>([]);
  const [counts, setCounts] = useState<GalleryCounts>(EMPTY_COUNTS);
  const [categories, setCategories] = useState<WorkPhotoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminWorkPhoto | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rejecting, setRejecting] = useState<AdminWorkPhoto | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleting, setDeleting] = useState<AdminWorkPhoto | null>(null);
  const requestRef = useRef(0);
  const openerRef = useRef<HTMLElement | null>(null);
  const hasScheduled = photos.some((photo) => photo.status === "scheduled");

  /*
   * The countdown is in minutes, so the clock ticks once a minute, only while
   * a scheduled photo is on screen and the page is visible, and catches up
   * when the tab comes back.
   */
  useEffect(() => {
    if (!hasScheduled) return undefined;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer || document.visibilityState !== "visible") return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 60_000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasScheduled]);

  const load = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      const ticket = ++requestRef.current;
      if (!options.quiet) setLoading(true);
      try {
        const data = await fetchGallery({
          view,
          q: searchQuery.trim() || undefined,
          category: category || undefined,
          limit: 60,
        });
        /* A slow earlier request must not overwrite a newer answer. */
        if (ticket !== requestRef.current) return;
        setPhotos(data.photos);
        setCounts(data.counts);
        if (data.categories?.length) setCategories(data.categories);
      } catch {
        if (ticket === requestRef.current) onToast("Could not load the gallery");
      } finally {
        if (ticket === requestRef.current) setLoading(false);
      }
    },
    [view, searchQuery, category, onToast]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(), searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, searchQuery]);

  /*
   * A scheduled photo publishes itself server-side. When its countdown runs
   * out the screen is stale. One timer for the earliest publish time (plus a
   * few seconds for the server's own sweep) reloads the grid once, instead of
   * polling.
   */
  useEffect(() => {
    const times = photos
      .filter((photo) => photo.status === "scheduled" && photo.publishAt)
      .map((photo) => new Date(photo.publishAt as string).getTime())
      .filter((t) => Number.isFinite(t));
    if (!times.length) return undefined;
    const wait = Math.max(0, Math.min(...times) - Date.now()) + 3000;
    // setTimeout overflows past ~24.8 days; a later reload picks those up.
    if (wait > 2_000_000_000) return undefined;
    const timer = setTimeout(() => load({ quiet: true }), wait);
    return () => clearTimeout(timer);
  }, [photos, load]);

  /** Optimistic where it is safe, reloaded where counts move. */
  const act = async (
    photo: AdminWorkPhoto,
    action: () => Promise<AdminWorkPhoto | { deleted: boolean }>,
    successMessage: string
  ) => {
    if (busyId) return;
    setBusyId(photo.id);
    try {
      await action();
      onToast(successMessage);
      await load({ quiet: true });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "That did not work";
      onToast(message);
    } finally {
      setBusyId(null);
    }
  };

  const onPublish = (photo: AdminWorkPhoto) =>
    act(photo, () => publishPhoto(photo.id), photo.status === "pending_review" ? "Approved and published" : "Published");

  const onUnpublish = (photo: AdminWorkPhoto) =>
    act(photo, () => unpublishPhoto(photo.id), "Moved to Library");

  /* Reject and Delete ask in a sheet. From the viewer, the viewer closes first: one dialog at a time. */
  const onReject = (photo: AdminWorkPhoto) => {
    setLightboxIndex(null);
    setRejectReason("");
    setRejecting(photo);
  };

  const onDelete = (photo: AdminWorkPhoto) => {
    setLightboxIndex(null);
    setDeleting(photo);
  };

  /* Inside a confirm sheet a failure is shown in the sheet, so this throws instead of toasting. */
  const confirmAct = async (photo: AdminWorkPhoto, action: () => Promise<unknown>, successMessage: string) => {
    setBusyId(photo.id);
    try {
      await action();
      onToast(successMessage);
      void load({ quiet: true });
    } finally {
      setBusyId(null);
    }
  };

  const openLightbox = (index: number) => {
    openerRef.current = (document.activeElement as HTMLElement) || null;
    setLightboxIndex(index);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    const opener = openerRef.current;
    if (opener && document.contains(opener)) requestAnimationFrame(() => opener.focus());
  };

  const onToggleFeatured = (photo: AdminWorkPhoto) =>
    act(
      photo,
      () => updatePhoto(photo.id, { featured: !photo.featured }),
      photo.featured ? "Removed from featured" : "Featured"
    );

  const lightboxItems = useMemo(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        /*
         * The 1280px display variant, not the 2000px full one. On any screen
         * an admin is actually using, display is indistinguishable and roughly
         * half the bytes - and this viewer is opened to decide about a photo,
         * not to pixel-peep it. full stays in the DTO for anything that later
         * needs true detail.
         */
        url: photo.imageUrl || photo.fullUrl,
        title: photo.title || "Untitled",
        subtitle: [
          STATUS_LABELS[photo.status],
          UPLOADER_LABELS[photo.uploaderType],
          photo.bookingNumber ? `#${photo.bookingNumber}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [photos]
  );

  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <div className="space-y-4">
      {/* ------------------------------- header ------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] text-adm-text-2">
            Photos of real jobs, and the before &amp; after pairs shown in What&rsquo;s Included.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setPairOpen(true)}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M12 5v14" />
              </svg>
            }
          >
            Add before &amp; after
          </Button>
          <Button
            onClick={() => setUploaderOpen(true)}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            }
          >
            Add photos
          </Button>
        </div>
      </div>

      {/* -------------------------------- views ------------------------------ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:flex-wrap md:gap-2">
        {VIEWS.map((item) => {
          const isActive = view === item.id;
          const count = counts[item.countKey];
          const needsAttention = item.id === "pending" && count > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-pressed={isActive}
              className={`flex min-h-[44px] flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition ${
                isActive
                  ? "border-adm-ink bg-adm-ink text-white"
                  : needsAttention
                    ? "border-adm-attn-bg bg-adm-attn-bg text-adm-attn"
                    : "border-adm-line bg-adm-surface text-adm-text-2 hover:bg-adm-sunk"
              }`}
            >
              {item.label}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}

      </div>

      {counts.scheduled > 0 && (
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 rounded-adm-sm border border-adm-line bg-adm-sunk px-2.5 py-1.5 text-[12px] font-semibold text-adm-ink">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {counts.scheduled} Fixter photo{counts.scheduled === 1 ? "" : "s"} publishing shortly
          </span>
        </div>
      )}

      {/*
        * Only the category filter lives here. The text search is the admin
        * shell's own box at the top of the page - two search fields on one
        * screen is two places to wonder why your typing had no effect.
        */}
      <div className="flex items-center gap-2">
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="flex-1 sm:max-w-[220px]"
          options={[{ value: "", label: "All categories" }, ...categories.map((option) => ({ value: option.slug, label: option.label }))]}
        />
        {(searchQuery || category) && (
          <span className="text-[12px] text-adm-text-3">
            {photos.length} match{photos.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {/* -------------------------------- grid ------------------------------- */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
              <div className="aspect-square animate-pulse bg-adm-sunk" />
              <div className="space-y-2 p-2.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-adm-sunk" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-adm-sunk" />
              </div>
            </div>
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState view={view} searching={Boolean(searchQuery || category)} onAdd={() => setUploaderOpen(true)} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              busy={busyId === photo.id}
              now={now}
              showModeration={view === "pending"}
              onOpen={() => openLightbox(index)}
              onPublish={() => onPublish(photo)}
              onReject={() => onReject(photo)}
            />
          ))}
        </div>
      )}

      {/* ------------------------------ overlays ----------------------------- */}
      {uploaderOpen && (
        <RecentWorkUploader
          categories={categories}
          onToast={onToast}
          onClose={() => setUploaderOpen(false)}
          onUploaded={(result) => {
            setUploaderOpen(false);
            const failed = result.failed?.length || 0;
            onToast(
              failed
                ? `${result.created.length} uploaded, ${failed} could not be used`
                : result.message
            );
            if (result.created[0]?.status === "published") setView("published");
            else if (result.created.length) setView("library");
            load({ quiet: true });
          }}
        />
      )}

      {pairOpen && (
        <RecentWorkPairUploader
          categories={categories}
          onToast={onToast}
          onClose={() => setPairOpen(false)}
          onUploaded={(result) => {
            setPairOpen(false);
            onToast(result.message);
            if (result.created[0]?.status === "published") setView("published");
            else if (result.created.length) setView("library");
            load({ quiet: true });
          }}
        />
      )}

      {activePhoto && lightboxIndex !== null && (
        <PhotoLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={closeLightbox}
          actions={
            <LightboxActions
              photo={activePhoto}
              busy={busyId === activePhoto.id}
              onPublish={() => onPublish(activePhoto)}
              onUnpublish={() => onUnpublish(activePhoto)}
              onReject={() => onReject(activePhoto)}
              onDelete={() => onDelete(activePhoto)}
              onToggleFeatured={() => onToggleFeatured(activePhoto)}
              onEdit={() => {
                setEditing(activePhoto);
                setLightboxIndex(null);
              }}
            />
          }
        />
      )}

      <ConfirmSheet
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this photo?"
        consequence="It stays off the website and leaves Needs review."
        confirmLabel="Reject photo"
        onConfirm={() => rejecting && confirmAct(rejecting, () => rejectPhoto(rejecting.id, rejectReason.trim()), "Rejected")}
      >
        <Field label="Why is this being rejected? (optional)">
          <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={3} maxLength={300} />
        </Field>
      </ConfirmSheet>

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this photo?"
        tone="danger"
        consequence={
          deleting?.status === "published"
            ? "Delete this photo? It is live right now, and deleting removes the image permanently. To take it off the site but keep it, use Unpublish."
            : "Delete this photo permanently? The image file is removed and cannot be recovered."
        }
        confirmLabel="Delete photo"
        onConfirm={() => deleting && confirmAct(deleting, () => deletePhoto(deleting.id), "Photo deleted")}
      />

      {editing && (
        <EditSheet
          photo={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            onToast(message);
            load({ quiet: true });
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PhotoTile({
  photo,
  busy,
  now,
  showModeration,
  onOpen,
  onPublish,
  onReject,
}: {
  photo: AdminWorkPhoto;
  busy: boolean;
  now: number;
  showModeration: boolean;
  onOpen: () => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const countdown = minutesUntil(photo.publishAt, now);
  const needsReview = photo.status === "pending_review";
  /*
   * Approve and Reject only in the review tab. In a mixed Library grid two
   * buttons on one tile stretch the whole row, so every other photo sits above
   * a band of empty white - and Library is for browsing anyway. Moderating from
   * there still works: open the photo and the same actions are there.
   */
  const moderating = showModeration && needsReview;
  const isPair = photo.kind === "before_after";

  return (
    <article
      className={`overflow-hidden rounded-adm-md border bg-adm-surface transition ${
        needsReview ? "border-adm-attn-bg" : "border-adm-line"
      } ${busy ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group relative block aspect-square w-full overflow-hidden bg-adm-sunk"
        aria-label={`Open ${photo.title || "photo"}`}
      >
        {/*
          * A photo that will not load must say so. The browser's broken-image
          * glyph in a grid of photographs reads as "this one is corrupt" when
          * the real answer is usually "the storage is not reachable from here",
          * and an admin deciding whether to delete something needs to know
          * which of those it is.
          */}
        {broken ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-adm-sunk px-2 text-center text-adm-text-3">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 17 5-5 4 4 3-3 6 6" />
              <path d="M3 3l18 18" />
            </svg>
            <span className="text-[12px] font-semibold leading-tight">Preview unavailable</span>
          </span>
        ) : isPair ? (
          /* A pair: BEFORE on the left half, AFTER on the right. */
          <span className="absolute inset-0 grid grid-cols-2 gap-px bg-adm-surface">
            {[photo.beforeThumbUrl || "", photo.thumbUrl].map((src, side) => (
              <span key={side} className="relative overflow-hidden bg-adm-sunk">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={side === 0 ? `Before: ${photo.title || "pair"}` : `After: ${photo.title || "pair"}`}
                  loading="lazy"
                  decoding="async"
                  width={240}
                  height={480}
                  onError={() => setBroken(true)}
                  className="absolute inset-0 object-cover"
                  style={{ height: "100%", width: "100%" }}
                />
                <span className="absolute bottom-1 left-1 rounded bg-adm-ink/70 px-1 py-px text-[12px] font-bold uppercase tracking-wider text-white">
                  {side === 0 ? "Before" : "After"}
                </span>
              </span>
            ))}
          </span>
        ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photo.thumbUrl}
          alt={photo.title || "Work photo"}
          loading="lazy"
          decoding="async"
          width={480}
          height={480}
          onError={() => setBroken(true)}
          className="absolute inset-0 object-cover transition duration-300 group-hover:scale-[1.04]"
          /*
           * Height inline, not as a utility. globals.css carries an unlayered
           * `img { height: auto }`, and an unlayered rule beats Tailwind's
           * h-full because utilities sit in a cascade layer - so the class
           * applies and does nothing, and the photo renders at its own ratio
           * inside a square box. The navbar mark and the gift-card logo hit
           * this before and solved it with bespoke classes; one inline
           * declaration keeps the workaround next to the thing that needs it.
           */
          style={{ height: "100%", width: "100%" }}
        />
        )}
        <span
          className={`absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[12px] font-semibold ${STATUS_TONES[photo.status]}`}
        >
          {countdown ? `Live in ${countdown}` : STATUS_LABELS[photo.status]}
        </span>
        {photo.featured && (
          <span
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-adm-ink/80 text-white"
            title="Featured"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
            </svg>
          </span>
        )}
      </button>

      <div className="p-2.5">
        <div className="truncate text-[13px] font-semibold text-adm-ink">
          {photo.title || "Untitled"}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-adm-text-3">
          {UPLOADER_LABELS[photo.uploaderType]} · {relativeDate(photo.createdAt)}
        </div>
        {isPair || photo.illustrative ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {isPair ? (
              <span className="rounded-md border border-adm-line bg-adm-info-bg px-1.5 py-0.5 text-[12px] font-semibold text-adm-accent-ink">
                Before/After{photo.group ? ` · ${photo.group}` : ""}
              </span>
            ) : null}
            {photo.illustrative ? (
              <span className="rounded-md border border-adm-line bg-adm-sunk px-1.5 py-0.5 text-[12px] font-semibold text-adm-ink">
                Illustrative
              </span>
            ) : null}
          </div>
        ) : null}

        {/*
          What the person who sent it said about it.

          On the card rather than one tap deeper, because this is the tab
          where a photo is approved or rejected and the sender's own sentence
          is often the only thing that says what is being looked at. It is
          their words, not a caption: nothing here is on the website, and
          putting any of it there is a separate, deliberate act in the editor.
        */}
        {moderating && photo.internalNote ? (
          <p
            title={photo.internalNote}
            className="mt-1.5 line-clamp-3 rounded-md bg-adm-sunk px-2 py-1.5 text-[12px] leading-4 text-adm-text-2"
          >
            {photo.internalNote}
          </p>
        ) : null}

        {moderating && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              className="flex min-h-[44px] items-center justify-center rounded-adm-sm bg-adm-ok px-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="flex min-h-[44px] items-center justify-center rounded-adm-sm border border-adm-line px-2 text-[12px] font-semibold text-adm-text-2 transition hover:bg-adm-sunk disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function LightboxActions({
  photo,
  busy,
  onPublish,
  onUnpublish,
  onReject,
  onDelete,
  onToggleFeatured,
  onEdit,
}: {
  photo: AdminWorkPhoto;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onReject: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onEdit: () => void;
}) {
  /*
   * Full-width targets on a phone, content-width on a desktop. A Publish
   * button three hundred pixels wide is not more clickable, it just looks like
   * nobody looked at it on a large screen.
   */
  const base =
    "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-adm-sm px-3 text-[13px] font-semibold transition disabled:opacity-50 sm:min-w-[116px] sm:flex-none sm:px-5";
  const ghost = `${base} border border-white/20 text-white hover:bg-white/10`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      {photo.caption && <p className="text-[12px] leading-5 text-white/70">{photo.caption}</p>}

      <div className="flex flex-wrap gap-2">
        {photo.status === "published" ? (
          <button type="button" onClick={onUnpublish} disabled={busy} className={ghost}>
            Unpublish
          </button>
        ) : photo.status !== "archived" ? (
          <button
            type="button"
            onClick={onPublish}
            disabled={busy}
            className={`${base} bg-adm-ok text-white hover:opacity-90`}
          >
            {photo.status === "pending_review" ? "Approve & publish" : "Publish"}
          </button>
        ) : null}

        {photo.status === "pending_review" && (
          <button type="button" onClick={onReject} disabled={busy} className={ghost}>
            Reject
          </button>
        )}

        <button type="button" onClick={onEdit} disabled={busy} className={ghost}>
          Edit
        </button>

        <button type="button" onClick={onToggleFeatured} disabled={busy} className={ghost}>
          {photo.featured ? "Unfeature" : "Feature"}
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={`${base} border border-white/30 text-adm-problem-bg hover:bg-white/10`}
        >
          Delete
        </button>
      </div>

      {photo.status === "published" && (
        <p className="text-[12px] text-white/50">
          Unpublish takes it off the site and keeps it in the Library. Delete removes the file for good.
        </p>
      )}
      {photo.rejectionReason && (
        <p className="text-[12px] text-adm-problem-bg">Rejected: {photo.rejectionReason}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EditSheet({
  photo,
  categories,
  onClose,
  onSaved,
  onToast,
}: {
  photo: AdminWorkPhoto;
  categories: WorkPhotoCategory[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onToast: (message: string) => void;
}) {
  const [title, setTitle] = useState(photo.title);
  const [caption, setCaption] = useState(photo.caption);
  const [category, setCategory] = useState(photo.category);
  const [location, setLocation] = useState(photo.location);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updatePhoto(photo.id, {
        title,
        caption,
        category,
        publicLocation: location,
      });
      onSaved("Saved");
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not save";
      onToast(message);
      setSaving(false);
    }
  };

  const dirty =
    title !== photo.title || caption !== photo.caption || category !== photo.category || location !== photo.location;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit photo"
      dirty={dirty}
      busy={saving}
      footer={
        <>
          <Button variant="secondary" large onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button large onClick={save} busy={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbUrl}
            alt=""
            width={160}
            height={160}
            style={{ height: "5rem", width: "5rem" }}
            className="shrink-0 rounded-adm-sm border border-adm-line bg-adm-sunk object-cover"
          />
          <div className="min-w-0 text-[12px] text-adm-text-3">
            <div>
              <span className="font-semibold text-adm-text-2">{STATUS_LABELS[photo.status]}</span> ·{" "}
              {UPLOADER_LABELS[photo.uploaderType]}
            </div>
            {photo.uploadedByName && <div className="truncate">By {photo.uploadedByName}</div>}
            {photo.bookingNumber && <div>Booking #{photo.bookingNumber}</div>}
            <div>
              {photo.sourceWidth}×{photo.sourceHeight} · {Math.round(photo.bytes / 1024)} KB
            </div>
          </div>
        </div>

        <Field label="Title">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </Field>

        {/*
          The sender's note, immediately above the caption written from it.

          Read-only on purpose, and never copied across on its own. "Use as
          caption" fills the field below and nothing else - the admin still
          edits it, still saves, still publishes. A customer's sentence
          about their own home does not become site copy by arriving.
        */}
        {photo.internalNote ? (
          <div className="rounded-adm-sm border border-adm-line bg-adm-sunk p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-adm-text-2">From the sender</span>
              <Button
                variant="secondary"
                onClick={() =>
                  /* The attribution is for the office. It is not site copy. */
                  setCaption(photo.internalNote.replace(/^(?:Customer|Fixter) note:\s*/i, "").slice(0, 400))
                }
              >
                Use as caption
              </Button>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-5 text-adm-text-2">{photo.internalNote}</p>
            <p className="mt-1.5 text-[12px] text-adm-text-3">
              Internal. Not shown on the website unless you put it in the caption.
            </p>
          </div>
        ) : null}

        <Field label="Caption">
          <Textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} maxLength={400} />
        </Field>

        <Field label="Category">
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={categories.map((option) => ({ value: option.slug, label: option.label }))}
          />
        </Field>

        <Field label="Town / City (public)" help="Town and state only, never a street address.">
          <TextInput
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={80}
            placeholder="Babylon, NY"
          />
        </Field>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function EmptyState({
  view,
  searching,
  onAdd,
}: {
  view: GalleryView;
  searching: boolean;
  onAdd: () => void;
}) {
  if (searching) {
    return (
      <div className="rounded-adm-md border border-dashed border-adm-line-2 bg-adm-surface px-6 py-12 text-center">
        <div className="text-sm font-semibold text-adm-ink">Nothing matches that</div>
        <p className="mt-1 text-[13px] text-adm-text-3">Try a different word or clear the filters.</p>
      </div>
    );
  }

  const copy = {
    pending: {
      title: "Nothing waiting on you",
      body: "Member submissions land here for approval before anyone else sees them.",
      cta: false,
    },
    published: {
      title: "Nothing is live yet",
      body: "Published photos appear on the public gallery. Add a few to get started.",
      cta: true,
    },
    library: {
      title: "The library is empty",
      body: "Every photo we keep lives here, whether or not it is public.",
      cta: true,
    },
  }[view];

  return (
    <div className="rounded-adm-md border border-dashed border-adm-line-2 bg-adm-surface px-6 py-12 text-center">
      <svg
        className="mx-auto h-10 w-10 text-adm-text-3"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <path d="m21 15-5-5-9 9" />
      </svg>
      <div className="mt-3 text-sm font-semibold text-adm-ink">{copy.title}</div>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-adm-text-3">{copy.body}</p>
      {copy.cta && (
        <Button onClick={onAdd} className="mt-4">
          Add photos
        </Button>
      )}
    </div>
  );
}
