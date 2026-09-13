"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WorkPhotoUploadSheet from "@/app/components/workPhotos/WorkPhotoUploadSheet";
import {
  describeJob,
  fetchOwnSubmissions,
  fetchSubmittableJobs,
  type OwnSubmission,
  type SubmittableJob,
} from "@/lib/work-photo-submissions";

/**
 * Work Photos, for a Fixter.
 *
 * THIS IS NOT THE ADMIN GALLERY, AND IT IS NOT A SMALL VERSION OF IT.
 *
 * The admin module is a moderation desk: statuses, counts, publish, unpublish,
 * reject, reorder, captions, categories. A Fixter needs none of that and should
 * not be handed a reduced copy of it - a reduced copy is still a gallery
 * manager, and the first question it invites is "why can I not publish this".
 *
 * What a Fixter needs is one screen that answers: which job, then send. So the
 * page is a job list. Tapping a job opens the camera sheet already pointed at
 * that job; there is nothing to configure and nothing to approve.
 *
 * WHY THE JOB LIST IS THE PAGE RATHER THAN A DROPDOWN.
 *
 * A dropdown would be smaller, and it would also be the thing a technician
 * standing in somebody's hallway has to tap, read, scroll and choose from with
 * one hand. The jobs they might mean are almost always the two or three they
 * did today, so those are buttons, in order, largest first.
 *
 * The list comes from /my-jobs, which the server scopes to this Fixter's own
 * assignments - and the upload re-checks that claim server-side regardless of
 * what this screen offered.
 */

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * What a contributor is told about their own submission.
 *
 * Three outcomes, no jargon. "library" and "scheduled" are internal states that
 * mean the team has it and has not put it on the site, which from here is the
 * same sentence as pending - so they say the same thing rather than leaking a
 * workflow the Fixter cannot act on.
 */
const SUBMISSION_LABEL: Record<string, { text: string; tone: string }> = {
  pending_review: { text: "With the team", tone: "bg-[#FFF6E9] text-[#8A5A1B]" },
  library: { text: "With the team", tone: "bg-[#FFF6E9] text-[#8A5A1B]" },
  scheduled: { text: "With the team", tone: "bg-[#FFF6E9] text-[#8A5A1B]" },
  published: { text: "On the website", tone: "bg-[#F0FDF4] text-[#166534]" },
  rejected: { text: "Not used", tone: "bg-[#F4F5F7] text-[#6A6D71]" },
};

export default function FixterWorkPhotos() {
  const [jobs, setJobs] = useState<SubmittableJob[] | null>(null);
  const [mine, setMine] = useState<OwnSubmission[]>([]);
  const [error, setError] = useState("");
  const [sheetFor, setSheetFor] = useState<SubmittableJob | "none" | null>(null);

  /*
   * Both reads in one place, and every setState behind an await.
   *
   * Written as a promise chain rather than as a helper the effect calls
   * directly: a setState that runs synchronously inside an effect body
   * schedules a cascading render, and the lint rule that catches it cannot see
   * through a useCallback to know the writes are already asynchronous.
   */
  const load = useCallback((signal?: AbortSignal) => {
    return Promise.all([
      fetchSubmittableJobs(signal),
      fetchOwnSubmissions(signal).catch(() => [] as OwnSubmission[]),
    ])
      .then(([nextJobs, nextMine]) => {
        if (signal?.aborted) return;
        setJobs(nextJobs);
        setMine(nextMine);
        setError("");
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        const response = (err as { response?: { data?: { message?: string } } })?.response;
        setJobs([]);
        setError(response?.data?.message || "Could not load your jobs.");
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const recent = useMemo(() => (jobs || []).slice(0, 12), [jobs]);

  return (
    <div className="pb-8">
      <div className="mb-5">
        <h2 className="text-[22px] font-black leading-tight text-slate-900 sm:text-[26px]">
          Work Photos
        </h2>
        <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-slate-600">
          Finished a job? Send a few photos. The office decides what goes on the
          Profixter website &mdash; nothing you upload appears there on its own.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-[10px] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      {/* ------------------------------- jobs ------------------------------- */}
      {jobs === null ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-[68px] animate-pulse rounded-[12px] bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {recent.map((job) => (
              <li key={job.bookingNumber}>
                {/*
                  A whole row is the target, not an icon inside it. This gets
                  tapped with a thumb, often with gloves on.
                */}
                <button
                  type="button"
                  onClick={() => setSheetFor(job)}
                  className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:border-[#C7D9FF] hover:bg-[#F8FAFF] active:bg-[#EFF5FF]"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-slate-900">
                      {job.service || "Visit"}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                      {formatDay(job.date)}
                      {job.city ? ` · ${job.city}` : ""} · #{job.bookingNumber}
                    </span>
                  </span>
                  <span className="flex-shrink-0 rounded-[8px] bg-[#306EEC] px-3.5 py-2 text-[13px] font-black text-white">
                    Add photos
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {!recent.length && !error ? (
            <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <p className="font-semibold text-slate-900">No recent jobs assigned to you</p>
              <p className="mt-1 text-sm text-slate-500">
                Jobs you are assigned to appear here for 120 days.
              </p>
            </div>
          ) : null}

          {/*
            Photos with no job attached.

            Offered second and quietly, because a photo that arrives without a
            job costs the office the context they moderate from. It exists
            because refusing the upload entirely would mean a good photo of
            finished work gets lost when the job is older than the list.
          */}
          <button
            type="button"
            onClick={() => setSheetFor("none")}
            className="mt-4 w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-[13.5px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Send photos without picking a job
          </button>
        </>
      )}

      {/* --------------------------- own submissions ------------------------ */}
      {mine.length > 0 && (
        <div className="mt-8">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Photos you sent
          </h3>
          <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-6">
            {mine.map((photo) => {
              const label = SUBMISSION_LABEL[photo.status] || SUBMISSION_LABEL.pending_review;
              return (
                <li key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-[10px] border border-slate-200 object-cover"
                  />
                  <span
                    className={`absolute inset-x-1 bottom-1 rounded-[6px] px-1.5 py-1 text-center text-[10.5px] font-bold ${label.tone}`}
                  >
                    {label.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <WorkPhotoUploadSheet
        open={sheetFor !== null}
        onClose={() => setSheetFor(null)}
        bookingNumber={sheetFor && sheetFor !== "none" ? sheetFor.bookingNumber : undefined}
        jobLabel={sheetFor && sheetFor !== "none" ? describeJob(sheetFor) : "No job selected"}
        title="Upload work photos"
        intro={
          sheetFor === "none"
            ? "These will not be linked to a job, so add a note in the office if the context matters."
            : undefined
        }
        onUploaded={() => {
          void load();
        }}
      />
    </div>
  );
}
