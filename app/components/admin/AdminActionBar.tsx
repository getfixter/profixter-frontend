"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Contextual bottom action bar for Admin document sections on phones and
 * tablets.
 *
 * On a phone the actions that matter - generate, email, send for signature,
 * record a payment - live at the far end of a long form. This keeps the three
 * or four that apply RIGHT NOW within thumb reach, and puts the rest one tap
 * away, without changing what any of them do.
 *
 * WHAT IT DELIBERATELY AVOIDS
 *
 *   Occlusion.  A fixed bar hides whatever is underneath it. The component
 *     renders a spacer in normal flow as well as the fixed bar, so the page
 *     always scrolls clear of it. The spacer height never changes, so nothing
 *     jumps when the bar hides.
 *
 *   The keyboard.  A bar pinned to the bottom either sits on top of the
 *     keyboard or covers the field being typed into. It hides while a form
 *     field has focus, detected two ways: visualViewport shrinking (accurate
 *     where supported) and focus on a field (works everywhere else).
 *
 *   Modals and the signing ceremony.  The caller passes `hidden` while a modal
 *     or the full-screen in-person ceremony is open. The bar must never compete
 *     with a signature pad or a customer's sticky signing controls.
 *
 *   Desktop.  Hidden from 1280px up. Below that covers phones, both iPad
 *     orientations including 1024 landscape, and small tablets - where the
 *     scrolling problem actually exists.
 */

export type AdminActionTone = "primary" | "default" | "success" | "danger";

export type AdminAction = {
  /** Stable identity for React and for tests. */
  key: string;
  /** Short label for the bar. Keep it to one or two words. */
  label: string;
  /** Longer label used in the More sheet, where there is room. */
  longLabel?: string;
  onClick?: () => void;
  /** An upload action renders a file picker instead of a button. */
  file?: { accept: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void };
  tone?: AdminActionTone;
  disabled?: boolean;
};

/** Buttons shown directly in the bar. Beyond this, the rest go to More. */
const INLINE_SLOTS = 3;

const TONE_CLASS: Record<AdminActionTone, string> = {
  primary: "bg-blue-600 text-white active:bg-blue-700 disabled:bg-blue-300",
  success: "bg-emerald-600 text-white active:bg-emerald-700 disabled:bg-emerald-300",
  danger: "bg-white text-rose-700 border border-rose-200 active:bg-rose-50",
  default: "bg-white text-slate-800 border border-slate-200 active:bg-slate-50",
};

function isFormField(node: EventTarget | null) {
  const el = node as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

export default function AdminActionBar({
  actions,
  hidden = false,
  label = "Document actions",
}: {
  actions: AdminAction[];
  hidden?: boolean;
  label?: string;
}) {
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const baselineHeight = useRef(0);

  /*
   * The keyboard has no event of its own. Where visualViewport exists, it
   * shrinking well below the window height is the reliable signal; the 160px
   * floor keeps browser chrome collapsing on scroll from being mistaken for it.
   */
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    baselineHeight.current = Math.max(baselineHeight.current, viewport.height);
    const onResize = () => {
      baselineHeight.current = Math.max(baselineHeight.current, viewport.height);
      setKeyboardOpen(baselineHeight.current - viewport.height > 160);
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  /** Fallback, and correct even where the viewport does not resize. */
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => setFieldFocused(isFormField(event.target));
    const onFocusOut = () => setFieldFocused(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // No effect needed to close the sheet when hidden: both the backdrop and the
  // sheet render only while !suppressed, so hiding the bar hides them with it.
  const usable = actions.filter(Boolean);
  const suppressed = hidden || keyboardOpen || fieldFocused || usable.length === 0;

  const inline = usable.length <= INLINE_SLOTS + 1 ? usable : usable.slice(0, INLINE_SLOTS);
  const overflow = usable.length <= INLINE_SLOTS + 1 ? [] : usable.slice(INLINE_SLOTS);

  const buttonClass = (action: AdminAction) =>
    `flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-2 text-[13px] font-bold leading-tight transition ${
      TONE_CLASS[action.tone || "default"]
    } ${action.disabled ? "opacity-40" : ""}`;

  const renderAction = (action: AdminAction) => {
    if (action.file) {
      return (
        <label
          key={action.key}
          data-action={action.key}
          className={`${buttonClass(action)} ${action.disabled ? "" : "cursor-pointer"}`}
        >
          <span className="truncate">{action.label}</span>
          <input
            type="file"
            accept={action.file.accept}
            disabled={action.disabled}
            onChange={action.file.onChange}
            className="hidden"
          />
        </label>
      );
    }
    return (
      <button
        key={action.key}
        type="button"
        data-action={action.key}
        disabled={action.disabled}
        onClick={action.onClick}
        className={buttonClass(action)}
      >
        <span className="truncate">{action.label}</span>
      </button>
    );
  };

  return (
    <>
      {/*
        Reserves the bar's space in normal flow so the last real control on the
        page can always be scrolled above it. Height is fixed whether or not the
        bar is currently visible, so hiding it never shifts the layout.
      */}
      <div
        aria-hidden="true"
        className="xl:hidden"
        style={{ height: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }}
      />

      {showMore && !suppressed && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/40 xl:hidden"
          onClick={() => setShowMore(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-[61] xl:hidden ${suppressed ? "hidden" : ""}`}
        data-testid="admin-action-bar"
      >
        {showMore && (
          <div className="mx-auto max-w-3xl px-3">
            <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)]">
              {overflow.map((action) => (
                <div key={action.key} className="border-b border-slate-100 last:border-b-0">
                  {action.file ? (
                    <label
                      data-action={action.key}
                      className={`flex min-h-[52px] items-center px-4 text-sm font-bold ${
                        action.disabled ? "opacity-40" : "cursor-pointer active:bg-slate-50"
                      } ${action.tone === "danger" ? "text-rose-700" : "text-slate-800"}`}
                    >
                      {action.longLabel || action.label}
                      <input
                        type="file"
                        accept={action.file.accept}
                        disabled={action.disabled}
                        onChange={(event) => {
                          setShowMore(false);
                          action.file?.onChange(event);
                        }}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      data-action={action.key}
                      disabled={action.disabled}
                      onClick={() => {
                        setShowMore(false);
                        action.onClick?.();
                      }}
                      className={`flex min-h-[52px] w-full items-center px-4 text-left text-sm font-bold active:bg-slate-50 ${
                        action.disabled ? "opacity-40" : ""
                      } ${action.tone === "danger" ? "text-rose-700" : "text-slate-800"}`}
                    >
                      {action.longLabel || action.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <nav
          aria-label={label}
          className="border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto flex max-w-3xl items-stretch gap-2 px-3 pt-2">
            {inline.map(renderAction)}
            {overflow.length > 0 && (
              <button
                type="button"
                data-action="more"
                aria-expanded={showMore}
                onClick={() => setShowMore((open) => !open)}
                className="flex min-h-[44px] w-[68px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 active:bg-slate-50"
              >
                {showMore ? "Close" : "More"}
              </button>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
