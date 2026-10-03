"use client";

/**
 * "Choose from Profixter Library": the no-photo-right-now option that sits
 * under every booking form's Take Photo / Choose Photos buttons.
 *
 * Real photos stay first and best. This lets a customer who is not at home
 * (at an event, at work) pick the closest generic example and still book; they
 * can add real photos to the booking later from their account.
 *
 * A chosen example and real photos may coexist on purpose: the example then
 * reads as the job type. Both are always visible in the form, with their own
 * remove controls, so nothing stale is submitted unseen.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "@/lib/analytics";
import { BOOKING_LIBRARY, libraryImage, libraryItem } from "@/lib/booking-library";

type Props = {
  value: string;
  onChange: (key: string) => void;
  /** Where the choice was made, for analytics only. */
  context: "member" | "free_visit" | "one_time" | "full_day";
};

export default function PhotoLibraryPicker({ value, onChange, context }: Props) {
  const [open, setOpen] = useState(false);
  const selected = libraryItem(value);

  const choose = (key: string) => {
    onChange(key);
    trackEvent("booking_library_reference_selected", { reference: key, context });
    window.setTimeout(() => setOpen(false), 140);
  };

  return (
    <>
      {selected ? (
        <div className="mt-2.5 flex items-center gap-3 rounded-[8px] border border-[#306EEC]/35 bg-[#F3F7FF] p-2 pr-2.5">
          <LibraryThumb itemKey={selected.key} label={selected.label} className="h-14 w-14 flex-none rounded-[6px]" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#306EEC]">Profixter example</div>
            <div className="truncate text-[14px] font-semibold text-[#0B1628]">{selected.label}</div>
            <div className="text-[11px] leading-4 text-[#64748B]">You can add real photos later.</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[40px] flex-none rounded-[6px] px-2.5 text-[12px] font-semibold text-[#306EEC] hover:bg-white"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove the Profixter example"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[18px] leading-none text-[#64748B] hover:bg-white hover:text-[#0B1628]"
          >
            &times;
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-[6px] border border-dashed border-[#AFC3EE] bg-white px-3 py-2 text-left transition hover:border-[#306EEC] hover:bg-[#F8FAFF] active:scale-[0.995]"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[6px] bg-[#EEF3FF] text-[#306EEC]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-[#0B1628]">Choose from Profixter Library</span>
            <span className="block text-[11px] leading-4 text-[#64748B]">
              No photo right now? Pick the closest example.
            </span>
          </span>
        </button>
      )}

      {open ? <LibrarySheet value={value} onChoose={choose} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** One example image, with a calm fallback if the asset cannot load. */
export function LibraryThumb({
  itemKey,
  label,
  className = "",
  large = false,
}: {
  itemKey: string;
  label: string;
  className?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-[#EEF3FF] text-[#306EEC] ${className}`} aria-label={label}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={libraryImage(itemKey, large ? 2 : 1)}
      srcSet={large ? undefined : `${libraryImage(itemKey, 1)} 1x, ${libraryImage(itemKey, 2)} 2x`}
      alt={label}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      // Inline: globals.css has an unlayered `img { height: auto }` that beats utility heights.
      style={{ aspectRatio: "1 / 1" }}
    />
  );
}

function LibrarySheet({
  value,
  onChoose,
  onClose,
}: {
  value: string;
  onChoose: (key: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // The parent passes a fresh closure each render; read it through a ref so the
  // scroll lock below is set once per opening, not on every re-render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // The sheet renders into <body>, which only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-[#0B1628]/55 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profixter-library-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-white shadow-2xl sm:max-w-[880px] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EEF1F7] px-5 pb-4 pt-5 sm:px-7">
          <div>
            <h2 id="profixter-library-title" className="text-[19px] font-bold leading-tight text-[#0B1628] sm:text-[21px]">
              Choose the closest example
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[#64748B]">
              No photo right now? That&rsquo;s fine. You can add real photos later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#F1F4FA] text-[20px] leading-none text-[#475569] hover:bg-[#E5EAF4]"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-7">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {BOOKING_LIBRARY.map((item) => {
              const active = item.key === value;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChoose(item.key)}
                  aria-pressed={active}
                  className={`group relative overflow-hidden rounded-[12px] border bg-white text-left transition active:scale-[0.98] ${
                    active
                      ? "border-[#306EEC] ring-2 ring-[#306EEC]"
                      : "border-[#E2E7F0] hover:border-[#306EEC]/60 hover:shadow-[0_8px_24px_rgba(11,22,40,0.08)]"
                  }`}
                >
                  <LibraryThumb itemKey={item.key} label={item.label} className="block w-full" />
                  <div className="flex min-h-[44px] items-center px-3 py-2 text-[13px] font-semibold leading-tight text-[#0B1628] sm:text-[14px]">
                    {item.label}
                  </div>
                  {active ? (
                    <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#306EEC] text-white shadow">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[12px] leading-5 text-[#94A3B8]">
            Examples from Profixter, not photos of your home. Your description tells us the rest.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
