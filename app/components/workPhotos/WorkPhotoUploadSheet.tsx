"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
  describeJob,
  fetchSubmittableJobs,
  submitWorkPhotos,
  type SubmittableJob,
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

/*
 * Comfortably inside what the server keeps (420 characters, plus the line that
 * says who wrote it). The counter runs out in front of the person typing,
 * which is the only place a limit should ever be met - a note silently losing
 * its last sentence somewhere between here and the office is worse than a
 * field that visibly stops accepting one.
 */
const NOTE_MAX = 380;

export default function WorkPhotoUploadSheet({
  open,
  onClose,
  bookingNumber,
  jobLabel,
  title = "Add finished-work photos",
  intro,
  notePrompt,
  notePlaceholder,
  offerJobPicker = false,
  sharingNotice,
  doneMessage = "Thank you. Our team reviews photos before any of them appear on the Profixter website.",
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  bookingNumber?: string;
  jobLabel?: string;
  title?: string;
  intro?: string;
  /** Shows the optional note field when set. Customer surface only. */
  notePrompt?: string;
  notePlaceholder?: string;
  /** Offers "which visit was this?" when the caller has no booking in hand. */
  offerJobPicker?: boolean;
  /**
   * What submitting actually means, shown beside the button that does it.
   *
   * Customer surface only. A Fixter uploading from a job is doing their work;
   * a customer is volunteering something of their home for possible public
   * use, and that is a different thing to be told before pressing send.
   */
  sharingNotice?: string;
  doneMessage?: string;
  onUploaded?: (count: number) => void;
}) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [note, setNote] = useState("");
  const [jobs, setJobs] = useState<SubmittableJob[]>([]);
  const [chosenJob, setChosenJob] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  /*
   * The optional "which visit was this?" list.
   *
   * Loaded only when the sheet is open and only where it is offered, because
   * the customer surface is launched without a job in hand and most people
   * will leave it alone. A failure here is silent: not knowing which visit a
   * photo belongs to costs the office a little context and must never cost
   * the customer the ability to send it.
   */
  useEffect(() => {
    if (!open || !offerJobPicker) return;
    const controller = new AbortController();
    fetchSubmittableJobs(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setJobs(rows);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open, offerJobPicker]);

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
    setNote("");
    setChosenJob("");
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;

      /*
       * COPIED OUT OF THE INPUT BEFORE ANYTHING ELSE HAPPENS.
       *
       * A FileList is a live view of the input, not a snapshot of it, and the
       * change handler clears input.value immediately afterwards so that
       * picking the same photo twice still fires. Reading the list inside a
       * state updater - which React runs later, during render - therefore read
       * an input that had already been emptied, and every photo a person chose
       * silently vanished on the way to the preview grid.
       */
      const chosen = Array.from(files);
      const room = MAX_FILES_PER_UPLOAD - selected.length;
      if (room <= 0) {
        setError(`You can send ${MAX_FILES_PER_UPLOAD} photos at a time.`);
        return;
      }

      let message = "";
      const incoming: Selected[] = [];
      for (const file of chosen.slice(0, room)) {
        /*
         * Refused here as well as on the server. A 40MB photo rejected after
         * it has been pushed up a hallway connection is a minute of somebody's
         * life for an answer their phone already knew.
         */
        if (file.size > MAX_UPLOAD_BYTES) {
          message = `${file.name || "That photo"} is larger than 25 MB.`;
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
      if (chosen.length > room) message = `Only the first ${room} were added.`;

      setError(message);
      /* The updater stays pure: no object URL is created twice by a replay. */
      setSelected((current) => [...current, ...incoming]);
    },
    [selected.length]
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
        /* The caller's job if it has one, else whatever the picker chose. */
        bookingNumber: bookingNumber || chosenJob || undefined,
        note: note.trim() || undefined,
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
  }, [pending, phase, bookingNumber, chosenJob, note, onUploaded]);

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
            <p className="mx-auto mt-2 max-w-[330px] text-[13.5px] leading-relaxed text-[#6A6D71]">
              {doneMessage}
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

            {/*
              WHICH VISIT, OPTIONALLY.

              Offered only where the sheet was opened without a job, and
              never required. A customer who cannot remember which visit a
              photo came from still has a photo worth sending, and the office
              can usually tell from the picture. The server re-checks any
              number chosen here against this account's own bookings.
            */}
            {offerJobPicker && !bookingNumber && jobs.length > 0 && (
              <div className="mt-4">
                <label
                  htmlFor="work-photo-visit"
                  className="block text-[13px] font-bold text-[#0B1628]"
                >
                  Which visit was this?{" "}
                  <span className="font-semibold text-[#8A9099]">(optional)</span>
                </label>
                <select
                  id="work-photo-visit"
                  value={chosenJob}
                  onChange={(event) => setChosenJob(event.target.value)}
                  disabled={phase === "uploading"}
                  className="mt-1.5 h-12 w-full rounded-[10px] border border-[#E0E6F5] bg-white px-3 text-[14px] text-[#0B1628] outline-none transition focus:border-[#306EEC] disabled:opacity-50"
                >
                  <option value="">I&rsquo;d rather not say</option>
                  {jobs.map((job) => (
                    <option key={job.bookingNumber} value={job.bookingNumber}>
                      {describeJob(job)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/*
              THE CUSTOMER'S OWN WORDS.

              Optional, and it travels to the office rather than to the site.
              Nothing typed here is published as written: an admin reads it
              while reviewing and writes the public caption themselves. That
              is why the field promises nothing about where the words go.
            */}
            {notePrompt ? (
              <div className="mt-4">
                <label
                  htmlFor="work-photo-note"
                  className="block text-[13px] font-bold text-[#0B1628]"
                >
                  {notePrompt}{" "}
                  <span className="font-semibold text-[#8A9099]">(optional)</span>
                </label>
                <textarea
                  id="work-photo-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
                  disabled={phase === "uploading"}
                  rows={3}
                  placeholder={notePlaceholder}
                  className="mt-1.5 w-full resize-none rounded-[10px] border border-[#E0E6F5] bg-white px-3 py-2.5 text-[14px] leading-relaxed text-[#0B1628] outline-none transition placeholder:text-[#A8AEB8] focus:border-[#306EEC] disabled:opacity-50"
                />
                <p className="mt-1 text-right text-[11.5px] text-[#A8AEB8]">
                  {note.length}/{NOTE_MAX}
                </p>
              </div>
            ) : null}

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

            {/*
              WHAT SUBMITTING MEANS, BESIDE THE BUTTON THAT DOES IT.

              Not in the terms, not in a link, not after the fact. A customer
              sharing a photo of their own home is entitled to know it may be
              used publicly before they press send - and equally entitled not
              to be told it will be, because that is not a promise we keep.
            */}
            {sharingNotice ? (
              <p className="mt-5 rounded-[10px] bg-[#F5F8FF] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#4A5568]">
                {sharingNotice}
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

            {sharingNotice ? null : (
              <p className="mt-3 text-center text-[12px] leading-relaxed text-[#8A9099]">
                Photos are reviewed by our team before anything appears publicly.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
