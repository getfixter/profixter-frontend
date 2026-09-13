"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
  submitWorkPhotos,
} from "@/lib/work-photo-submissions";

/**
 * Sending finished-work photos, from a phone, in a hallway.
 *
 * ONE SHEET FOR BOTH CONTRIBUTORS.
 *
 * A customer adding photos of work in their kitchen and a Fixter adding photos
 * before leaving the job are the same act with different labels, so they are
 * the same component. What differs is the wording and where the booking comes
 * from, and both are props. A second near-identical uploader would drift within
 * a month and then behave differently on retry for no reason anybody could name.
 *
 * WHAT IT DELIBERATELY CANNOT DO.
 *
 * Publish, unpublish, approve, reorder, or show anybody else's photos. Not
 * because those controls are hidden - because it has never been given a way to
 * ask for them. The server assigns the status from the account, and for both of
 * these roles it is "pending_review".
 *
 * BUILT FOR THE WORST CONNECTION IT WILL MEET. Selection is local and instant,
 * previews come from object URLs rather than a round trip, the upload reports
 * real progress, and a partial failure leaves the successful photos alone so a
 * retry sends only what is missing rather than duplicating what arrived.
 */

interface Selected {
  id: string;
  file: File;
  url: string;
  /** Set once the server has accepted this exact file, so a retry skips it. */
  sent: boolean;
  error: string;
}

type Phase = "choosing" | "uploading" | "done";

export default function WorkPhotoUploadSheet({
  open,
  onClose,
  bookingNumber,
  jobLabel,
  title = "Add finished-work photos",
  intro,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  bookingNumber?: string;
  jobLabel?: string;
  title?: string;
  intro?: string;
  onUploaded?: (count: number) => void;
}) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* Object URLs are a leak if nobody revokes them; a phone gallery is big. */
  useEffect(() => {
    return () => {
      selected.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setSelected((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setPhase("choosing");
    setPercent(0);
    setError("");
    setSentCount(0);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      setError("");
      setSelected((current) => {
        const room = MAX_FILES_PER_UPLOAD - current.length;
        if (room <= 0) {
          setError(`You can send ${MAX_FILES_PER_UPLOAD} photos at a time.`);
          return current;
        }
        const incoming: Selected[] = [];
        for (const file of Array.from(files).slice(0, room)) {
          /*
           * Refused here as well as on the server. A 40MB photo rejected after
           * it has been pushed up a hallway connection is a minute of somebody's
           * life for an answer their phone already knew.
           */
          if (file.size > MAX_UPLOAD_BYTES) {
            setError(`${file.name || "That photo"} is larger than 25 MB.`);
            continue;
          }
          incoming.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            url: URL.createObjectURL(file),
            sent: false,
            error: "",
          });
        }
        if (files.length > room) setError(`Only the first ${room} were added.`);
        return [...current, ...incoming];
      });
    },
    []
  );

  const removeAt = useCallback((id: string) => {
    setSelected((current) => {
      const gone = current.find((item) => item.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const pending = useMemo(() => selected.filter((item) => !item.sent), [selected]);

  const upload = useCallback(async () => {
    if (!pending.length || phase === "uploading") return;
    setPhase("uploading");
    setPercent(0);
    setError("");

    try {
      const result = await submitWorkPhotos({
        files: pending.map((item) => item.file),
        bookingNumber,
        onProgress: setPercent,
      });

      /*
       * The server answers with counts, not with which file was which, so the
       * successful ones are marked from the front of the batch. That is exactly
       * how the server processed them - in order - and it is what makes a retry
       * send only the remainder instead of duplicating what already arrived.
       */
      const accepted = result.created.length;
      setSelected((current) => {
        let remaining = accepted;
        return current.map((item) => {
          if (item.sent || remaining <= 0) return item;
          remaining -= 1;
          return { ...item, sent: true, error: "" };
        });
      });

      setSentCount((n) => n + accepted);
      setPercent(100);

      if (result.failed.length) {
        setError(
          accepted
            ? `${accepted} sent. ${result.failed.length} could not be processed — you can try those again.`
            : result.failed[0]?.message || "Those photos could not be processed."
        );
        setPhase("choosing");
        return;
      }

      onUploaded?.(accepted);
      setPhase("done");
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } })?.response;
      setError(response?.data?.message || "That upload did not go through. Please try again.");
      setPhase("choosing");
    }
  }, [pending, phase, bookingNumber, onUploaded]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 px-0 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[20px] bg-white p-5 shadow-[0_-8px_60px_rgba(15,23,42,0.35)] sm:rounded-[20px] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-black leading-tight text-[#0B1628]">{title}</h2>
            {jobLabel ? (
              <p className="mt-1 text-[13px] font-semibold text-[#6A6D71]">{jobLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-[#E0E6F5] text-[#6A6D71] transition hover:bg-[#F5F7FB]"
          >
            ×
          </button>
        </div>

        {phase === "done" ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#E8F1FF] text-[26px]">
              ✓
            </div>
            <p className="text-[17px] font-black text-[#0B1628]">
              {sentCount} photo{sentCount === 1 ? "" : "s"} sent
            </p>
            {/*
              Says what actually happens next, without a paragraph of legal
              copy. A contributor who is told their photo is "live" and then
              cannot find it has been misled; this is the true and short version.
            */}
            <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-[#6A6D71]">
              Thank you. Our team reviews photos before any of them appear on the
              Profixter website.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-6 h-12 w-full rounded-[10px] bg-[#0B1628] text-[15px] font-black text-white transition hover:bg-[#17263D]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {intro ? (
              <p className="mt-3 text-[13.5px] leading-relaxed text-[#6A6D71]">{intro}</p>
            ) : null}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                /* Cleared so re-picking the same file fires change again. */
                event.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={phase === "uploading"}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[#C7D6F5] bg-[#F7FAFF] text-[15px] font-bold text-[#306EEC] transition hover:bg-[#EFF5FF] disabled:opacity-50"
            >
              {selected.length ? "Add more photos" : "Take or choose photos"}
            </button>
            <p className="mt-2 text-center text-[12px] text-[#8A9099]">
              Up to {MAX_FILES_PER_UPLOAD} photos, 25 MB each
            </p>

            {selected.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {selected.map((item) => (
                  <li key={item.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className={`aspect-square w-full rounded-[10px] object-cover ${
                        item.sent ? "opacity-45" : ""
                      }`}
                    />
                    {item.sent ? (
                      <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-[#0B1628]/35 text-[20px] text-white">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeAt(item.id)}
                        disabled={phase === "uploading"}
                        aria-label="Remove photo"
                        className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#0B1628] text-[15px] font-bold text-white shadow-md disabled:opacity-40"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {phase === "uploading" && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8EDF7]">
                  <div
                    className="h-full rounded-full bg-[#306EEC] transition-[width] duration-200"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-[12.5px] font-semibold text-[#6A6D71]">
                  Sending {pending.length} photo{pending.length === 1 ? "" : "s"}… {percent}%
                </p>
              </div>
            )}

            {error ? (
              <p className="mt-4 rounded-[8px] bg-[#FFF4F3] px-3 py-2.5 text-[13px] font-semibold text-[#B4342B]">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={upload}
              disabled={!pending.length || phase === "uploading"}
              className="mt-5 h-13 min-h-[52px] w-full rounded-[10px] bg-[#306EEC] text-[15px] font-black text-white transition hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {phase === "uploading"
                ? "Sending…"
                : sentCount
                  ? `Send ${pending.length} remaining`
                  : `Send ${pending.length || ""} photo${pending.length === 1 ? "" : "s"}`.replace("  ", " ")}
            </button>

            <p className="mt-3 text-center text-[12px] leading-relaxed text-[#8A9099]">
              Photos are reviewed by our team before anything appears publicly.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
