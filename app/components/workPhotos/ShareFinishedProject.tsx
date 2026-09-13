"use client";

import { useEffect, useState } from "react";
import WorkPhotoUploadSheet from "@/app/components/workPhotos/WorkPhotoUploadSheet";
import { fetchSubmittableJobs } from "@/lib/work-photo-submissions";

/**
 * An invitation to share finished work, on the page where people book it.
 *
 * WHY THIS IS NOT A BOOKING ACTION.
 *
 * It used to be one: an "Add photos" button on each completed visit. That
 * button read as paperwork - attach something to this job - when the thing
 * being asked for is the opposite: would you show other people what we fixed
 * in your home. Those are different requests and they deserve different
 * shapes, so this is one small invitation that belongs to the customer rather
 * than one action repeated on every card in their history.
 *
 * WHY IT SITS BELOW THE BOOKING FORM.
 *
 * Booking is why anybody opens this page and stays the only primary thing on
 * it. This is deliberately quieter: no banner, no image, no colour block, one
 * sentence and a secondary button, placed where somebody who has just finished
 * booking will pass it rather than buried in the visit list underneath.
 *
 * WHO SEES IT.
 *
 * Only accounts the server would actually accept a submission from. /my-jobs
 * answers 403 for anyone who may not submit, so an unsuccessful load hides the
 * card entirely - better absent than offering something that fails on send.
 * A member with no completed jobs still sees it; they may still have a photo.
 */

export default function ShareFinishedProject({ className = "" }: { className?: string }) {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSubmittableJobs(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setEligible(true);
      })
      .catch(() => {
        /* Not signed in, no membership, or offline: say nothing at all. */
      });
    return () => controller.abort();
  }, []);

  if (!eligible) return null;

  return (
    <div
      className={`rounded-[14px] border border-[#E4E9F2] bg-white px-4 py-4 sm:px-5 sm:py-[18px] ${className}`}
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-[#F0F5FF] text-[#306EEC]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-black leading-tight text-[#0B1628]">
              Share your finished project
            </h3>
            <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-[#6A6D71]">
              Happy with something we fixed? Share a photo and a few words about the
              work. We may feature it on our What We Fix page.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 w-full flex-shrink-0 rounded-[10px] border border-[#306EEC] bg-white px-5 text-[14px] font-black text-[#306EEC] transition hover:bg-[#F2F7FF] sm:w-auto"
        >
          Share photos
        </button>
      </div>

      <WorkPhotoUploadSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Share your finished project"
        intro="Add a photo or two of the finished work."
        notePrompt="What did we fix?"
        notePlaceholder="Tell us about the work — what it was, how it turned out."
        offerJobPicker
        sharingNotice="By submitting, you're sharing these photos and your note with Profixter for possible use on our public website. We'll review everything before it's posted."
        doneMessage="Thanks for sharing. We'll review your photos before anything appears on the Profixter website."
      />
    </div>
  );
}
