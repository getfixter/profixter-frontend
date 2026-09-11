"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhotoLightbox from "../ui/PhotoLightbox";
import RecentWorkUploader from "./RecentWorkUploader";
import {
  STATUS_LABELS,
  STATUS_TONES,
  UPLOADER_LABELS,
  countdownTo,
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminWorkPhoto | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const requestRef = useRef(0);

  /* One second is the resolution a countdown needs and no more. */
  useEffect(() => {
    if (!photos.some((photo) => photo.status === "scheduled")) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [photos]);

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
   * out the screen is stale, so refresh once rather than leaving an admin
   * looking at a timer that reached zero and did nothing.
   */
  useEffect(() => {
    const due = photos.filter(
      (photo) => photo.status === "scheduled" && photo.publishAt && new Date(photo.publishAt).getTime() <= now
    );
    if (due.length) {
      const timer = setTimeout(() => load({ quiet: true }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [photos, now, load]);

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

  const onReject = (photo: AdminWorkPhoto) => {
    const reason = window.prompt("Why is this being rejected? (optional)") ?? "";
    return act(photo, () => rejectPhoto(photo.id, reason), "Rejected");
  };

  const onDelete = (photo: AdminWorkPhoto) => {
    const warning =
      photo.status === "published"
        ? "Delete this photo? It is live right now, and deleting removes the image permanently. To take it off the site but keep it, use Unpublish."
        : "Delete this photo permanently? The image file is removed and cannot be recovered.";
    if (!window.confirm(warning)) return Promise.resolve();
    return act(photo, () => deletePhoto(photo.id), "Photo deleted");
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
          <h2 className="text-lg font-semibold text-slate-900">Recent Work</h2>
          <p className="text-[13px] text-slate-500">
            Photos of real jobs, for the public gallery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploaderOpen(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 md:min-h-[38px]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add photos
        </button>
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
              className={`flex min-h-[42px] flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition md:min-h-[34px] ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : needsAttention
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-900">
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
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="min-h-[42px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 sm:max-w-[220px] md:min-h-[34px]"
        >
          <option value="">All categories</option>
          {categories.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
        {(searchQuery || category) && (
          <span className="text-xs text-slate-500">
            {photos.length} match{photos.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {/* -------------------------------- grid ------------------------------- */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-square animate-pulse bg-slate-100" />
              <div className="space-y-2 p-2.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
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
              onOpen={() => setLightboxIndex(index)}
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

      {activePhoto && lightboxIndex !== null && (
        <PhotoLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          actions={
            <LightboxActions
              photo={activePhoto}
              busy={busyId === activePhoto.id}
              onPublish={() => onPublish(activePhoto)}
              onUnpublish={() => onUnpublish(activePhoto)}
              onReject={() => onReject(activePhoto)}
              onDelete={async () => {
                await onDelete(activePhoto);
                setLightboxIndex(null);
              }}
              onToggleFeatured={() => onToggleFeatured(activePhoto)}
              onEdit={() => {
                setEditing(activePhoto);
                setLightboxIndex(null);
              }}
            />
          }
        />
      )}

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
  const countdown = countdownTo(photo.publishAt, now);
  const needsReview = photo.status === "pending_review";
  /*
   * Approve and Reject only in the review tab. In a mixed Library grid two
   * buttons on one tile stretch the whole row, so every other photo sits above
   * a band of empty white - and Library is for browsing anyway. Moderating from
   * there still works: open the photo and the same actions are there.
   */
  const moderating = showModeration && needsReview;

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white transition ${
        needsReview ? "border-amber-200" : "border-slate-200"
      } ${busy ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group relative block aspect-square w-full overflow-hidden bg-slate-100"
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
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-100 px-2 text-center text-slate-400">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 17 5-5 4 4 3-3 6 6" />
              <path d="M3 3l18 18" />
            </svg>
            <span className="text-[10px] font-semibold leading-tight">Preview unavailable</span>
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
          className={`absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONES[photo.status]}`}
        >
          {countdown ? `Live in ${countdown}` : STATUS_LABELS[photo.status]}
        </span>
        {photo.featured && (
          <span
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-slate-900/80 text-white"
            title="Featured"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
            </svg>
          </span>
        )}
      </button>

      <div className="p-2.5">
        <div className="truncate text-[13px] font-semibold text-slate-900">
          {photo.title || "Untitled"}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">
          {UPLOADER_LABELS[photo.uploaderType]} · {relativeDate(photo.createdAt)}
        </div>

        {moderating && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              className="flex min-h-[36px] items-center justify-center rounded-lg bg-emerald-600 px-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="flex min-h-[36px] items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
    "flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition disabled:opacity-50 sm:min-w-[116px] sm:flex-none sm:px-5";
  const ghost = `${base} border border-white/20 text-white hover:bg-white/10`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      {photo.caption && <p className="text-xs leading-5 text-white/70">{photo.caption}</p>}

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
            className={`${base} bg-emerald-600 text-white hover:bg-emerald-500`}
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
          className={`${base} border border-rose-400/40 text-rose-200 hover:bg-rose-500/20`}
        >
          Delete
        </button>
      </div>

      {photo.status === "published" && (
        <p className="text-[11px] text-white/50">
          Unpublish takes it off the site and keeps it in the Library. Delete removes the file for good.
        </p>
      )}
      {photo.rejectionReason && (
        <p className="text-[11px] text-rose-200">Rejected: {photo.rejectionReason}</p>
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

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">Edit photo</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbUrl}
              alt=""
              width={160}
              height={160}
              style={{ height: "5rem", width: "5rem" }}
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover"
            />
            <div className="min-w-0 text-xs text-slate-500">
              <div>
                <span className="font-semibold text-slate-700">
                  {STATUS_LABELS[photo.status]}
                </span>{" "}
                · {UPLOADER_LABELS[photo.uploaderType]}
              </div>
              {photo.uploadedByName && <div className="truncate">By {photo.uploadedByName}</div>}
              {photo.bookingNumber && <div>Booking #{photo.bookingNumber}</div>}
              <div>
                {photo.sourceWidth}×{photo.sourceHeight} · {Math.round(photo.bytes / 1024)} KB
              </div>
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Caption
            </span>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={3}
              maxLength={400}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            >
              {categories.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Town / City (public)
            </span>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={80}
              placeholder="Babylon, NY"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Town and state only, never a street address.
            </span>
          </label>
        </div>

        <div
          className="flex gap-2 border-t border-slate-200 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <div className="text-sm font-semibold text-slate-900">Nothing matches that</div>
        <p className="mt-1 text-[13px] text-slate-500">Try a different word or clear the filters.</p>
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <svg
        className="mx-auto h-10 w-10 text-slate-300"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <path d="m21 15-5-5-9 9" />
      </svg>
      <div className="mt-3 text-sm font-semibold text-slate-900">{copy.title}</div>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{copy.body}</p>
      {copy.cta && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Add photos
        </button>
      )}
    </div>
  );
}
