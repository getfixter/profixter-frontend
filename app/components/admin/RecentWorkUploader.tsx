"use client";

import { useEffect, useRef, useState } from "react";
import {
  uploadPhotos,
  type UploadResult,
  type WorkPhotoCategory,
} from "@/lib/recent-work-service";

/**
 * Getting photos off a phone and into the gallery in as few taps as possible.
 *
 * The normal flow is: tap Upload, pick the photos, tap Upload again. Everything
 * else - title, category, caption - is optional and folded away, because the
 * job this has to be good at is emptying a camera roll after a day's work, not
 * cataloguing. A form that demanded a title per photo would mean the photos
 * never got uploaded at all.
 *
 * One title and category apply to the whole batch on purpose. Photos from one
 * job describe one job, and typing the same thing eight times is how somebody
 * decides to do it later.
 */

interface RecentWorkUploaderProps {
  categories: WorkPhotoCategory[];
  onClose: () => void;
  onUploaded: (result: UploadResult) => void;
  onToast: (message: string) => void;
}

interface Selection {
  id: string;
  file: File;
  preview: string;
}

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;

export default function RecentWorkUploader({
  categories,
  onClose,
  onUploaded,
  onToast,
}: RecentWorkUploaderProps) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("general-handyman");
  const [publicLocation, setPublicLocation] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Object URLs are a leak if nobody revokes them; a long admin session adds up. */
  useEffect(
    () => () => {
      selections.forEach((s) => URL.revokeObjectURL(s.preview));
    },
    [selections]
  );

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const room = MAX_FILES - selections.length;

    const rejected: string[] = [];
    const accepted = incoming.slice(0, Math.max(room, 0)).filter((file) => {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name} is not an image`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} is over 25 MB`);
        return false;
      }
      return true;
    });

    if (incoming.length > room && room >= 0) {
      rejected.push(`Only ${MAX_FILES} photos at a time`);
    }
    if (rejected.length) onToast(rejected[0]);

    setSelections((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeAt = (id: string) => {
    setSelections((current) => {
      const target = current.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((s) => s.id !== id);
    });
  };

  const submit = async () => {
    if (!selections.length || uploading) return;
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadPhotos(
        selections.map((s) => s.file),
        { title, caption, category, publicLocation, publishNow },
        setProgress
      );
      setProgress(100);
      onUploaded(result);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Upload failed. Nothing was saved.";
      onToast(message);
      setUploading(false);
      setProgress(0);
    }
  };

  const count = selections.length;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Add work photos</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/*
            * accept="image/*" with no capture attribute is what gives a phone
            * both options - take a photo now, or pick what is already there -
            * rather than forcing one of them.
            */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {count === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-400 hover:bg-slate-100"
            >
              <svg className="h-9 w-9 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10.5" r="1.5" />
                <path d="m21 15-5-5-9 9" />
              </svg>
              <span className="text-sm font-semibold text-slate-900">Choose photos</span>
              <span className="text-xs text-slate-500">Up to {MAX_FILES} at a time, 25 MB each</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {selections.map((selection) => (
                <div key={selection.id} className="group relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selection.preview}
                    alt=""
                    style={{ height: "100%", width: "100%" }}
                    className="absolute inset-0 rounded-lg border border-slate-200 object-cover"
                  />
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeAt(selection.id)}
                      aria-label="Remove this photo"
                      className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow-sm"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {count < MAX_FILES && !uploading && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-[11px] font-semibold">Add</span>
                </button>
              )}
            </div>
          )}

          {count > 0 && (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Kitchen cabinet install"
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
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

              {showDetails ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Caption
                    </span>
                    <textarea
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      rows={3}
                      maxLength={400}
                      placeholder="What was done, in a sentence."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Town / City (public)
                    </span>
                    <input
                      value={publicLocation}
                      onChange={(event) => setPublicLocation(event.target.value)}
                      placeholder="Babylon, NY"
                      maxLength={80}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Shown on the public gallery. Town and state only, never a street address.
                    </span>
                  </label>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDetails(true)}
                  className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                >
                  Add caption and town
                </button>
              )}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {publishNow ? "Publish now" : "Save to Library"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {publishNow
                      ? "Visible on the public gallery straight away."
                      : "Kept for later. Nobody outside sees it."}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={publishNow}
                  aria-label="Publish now"
                  onClick={() => setPublishNow((current) => !current)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    publishNow ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                      publishNow ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="border-t border-slate-200 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {uploading && (
            <div className="mb-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-900 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                {progress < 100 ? `Uploading ${count} photo${count === 1 ? "" : "s"}…` : "Finishing up…"}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!count || uploading}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {uploading
              ? "Uploading…"
              : count
                ? `Upload ${count} photo${count === 1 ? "" : "s"}`
                : "Choose photos to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
