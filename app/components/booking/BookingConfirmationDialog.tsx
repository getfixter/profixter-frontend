"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

export type BookingConfirmation = {
  dateLabel?: string;
  address?: string;
  bookingReference?: string;
  status?: string;
  /** Set when this booking used the free introductory visit. */
  isFreeVisit?: boolean;
};

export default function BookingConfirmationDialog({
  confirmation,
  onClose,
  onViewVisit,
}: {
  confirmation: BookingConfirmation | null;
  onClose: () => void;
  onViewVisit: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirmation) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const overlay = document.querySelector("[data-booking-confirmation-overlay]");
    const siblings = Array.from(document.body.children).filter((child) => child !== overlay);
    const siblingState = siblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: (element as HTMLElement).inert,
    }));

    document.body.style.overflow = "hidden";
    siblings.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      (element as HTMLElement).inert = true;
    });
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      siblingState.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        (element as HTMLElement).inert = inert;
      });
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [confirmation, onClose]);

  if (!confirmation || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-booking-confirmation-overlay="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[3px]"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(24px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        aria-describedby="booking-success-status"
        className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-[14px] border border-black/[0.08] bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.24)] backdrop-blur-xl sm:rounded-[16px]"
        style={{ maxHeight: "calc(100dvh - 48px)" }}
      >
        <div className="min-h-0 overflow-y-auto px-5 pb-4 pt-5 sm:px-5 sm:pb-5 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#EAF8EF] ring-1 ring-[#CDEBD8]">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 8" stroke="#16803C" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close booking confirmation"
              className="grid h-10 w-10 flex-none place-items-center rounded-full text-[21px] leading-none text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0B1628]"
            >
              &times;
            </button>
          </div>

          <h2 id="booking-success-title" className="mt-3 text-[21px] font-extrabold tracking-[-0.025em] text-[#0B1628] sm:text-[23px]">
            Visit booked
          </h2>
          {confirmation.isFreeVisit ? (
            <p className="mt-1.5 text-[15px] font-semibold text-[#306EEC]">
              Your first visit is on us.
            </p>
          ) : null}
          {confirmation.dateLabel ? (
            <p className="mt-2 text-[15px] font-semibold leading-6 text-[#334155]">
              {confirmation.dateLabel}
            </p>
          ) : null}
          {confirmation.address ? (
            <p className="mt-1.5 break-words text-[13px] leading-5 text-[#64748B]">
              {confirmation.address}
            </p>
          ) : null}
          {confirmation.bookingReference ? (
            <p className="mt-1.5 text-[11px] font-semibold text-[#94A3B8]">
              Reference {confirmation.bookingReference}
            </p>
          ) : null}
          <p id="booking-success-status" className="mt-3 text-[14px] leading-5 text-[#64748B]">
            We&rsquo;ll notify you when your visit is confirmed.
          </p>

          <div className="mt-4 border-t border-black/[0.07] pt-4">
            <h3 className="text-[13px] font-bold text-[#0B1628]">Before your visit</h3>
            {confirmation.isFreeVisit ? (
              <p className="mt-1.5 text-[13px] leading-5 text-[#64748B]">
                Have the items you&rsquo;d like us to look at ready. If there is anything we
                should know before the visit, let us know.
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] leading-5 text-[#64748B]">
                  Please have any materials you already purchased ready for your Fixter.
                </p>
                <p className="mt-1.5 text-[13px] leading-5 text-[#64748B]">
                  Need us to bring materials or special tools? Add a note to your visit as early as possible so we can prepare.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-black/[0.06] px-5 pb-5 pt-4 sm:px-5 sm:pb-6">
          <button
            type="button"
            onClick={onViewVisit}
            className="h-12 w-full rounded-[14px] bg-[#306EEC] text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(48,110,236,0.24)] transition hover:bg-[#2558c9] active:scale-[0.99]"
          >
            View My Visit
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-full rounded-[12px] text-[13px] font-semibold text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0B1628]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
