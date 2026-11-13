"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, cx } from "./Button";
import { Field, TextInput } from "./Field";

/* ------------------------------------------------------------------ */
/* Shared plumbing: which sheet is on top, the scroll lock               */
/* ------------------------------------------------------------------ */

const stack: string[] = [];
let lockCount = 0;
let savedOverflow = "";

function lockScroll() {
  if (lockCount++ === 0) {
    const root = document.documentElement;
    savedOverflow = root.style.overflow;
    root.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.documentElement.style.overflow = savedOverflow;
  }
}

const noop = () => () => {};
/** True on the client after hydration; sheets render into document.body. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

export type DismissSource = "close" | "escape" | "backdrop" | "swipe";

export type SheetProps = {
  open: boolean;
  /** Called to close. The sheet asks first when `dirty`. */
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Sticky footer, usually the primary action. Rides on top of the keyboard. */
  footer?: ReactNode;
  /** Unsaved changes: backdrop and swipe do nothing; Close and Escape ask before discarding. */
  dirty?: boolean;
  /** Something is saving: nothing closes the sheet until it finishes. */
  busy?: boolean;
  /** "sheet": bottom sheet on phones, 480px side panel on desktop. "dialog": centred on desktop. */
  variant?: "sheet" | "dialog";
  /** "full": the sheet takes the whole height on phones (long forms, details). */
  size?: "auto" | "full";
  /** Desktop side panel width. */
  width?: "default" | "wide";
  /** Focus this on open instead of the sheet itself (avoid inputs on phones: it opens the keyboard). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Icon buttons beside the close button. */
  headerActions?: ReactNode;
  /** Text under the title, read as the dialog's description. */
  description?: ReactNode;
  /** Wording of the discard question. */
  discardMessage?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** data-testid style hook for tests. */
  "data-sheet"?: string;
};

/**
 * THE admin dialog (J.5): one implementation for every sheet, side panel and
 * confirmation. role="dialog", aria-modal, labelled by its title; focus moves
 * in and is trapped, Escape closes, focus returns to what opened it; the
 * close button is always visible in a 44px slot; swipe-down (on the handle
 * or header) and backdrop taps close only when nothing is unsaved; the body
 * scrolls and the footer stays on top of the keyboard
 * (max-height: calc(100dvh - var(--kb-inset) - safe areas)).
 *
 * Never open a sheet from inside a sheet. Swap the sheet's content for a
 * confirmation step instead (or close it and open a ConfirmSheet).
 *
 *   <Sheet open={open} onClose={close} title="Edit customer" dirty={changed}
 *          footer={<Button onClick={save} large>Save changes</Button>}>
 *     <Field label="Name"><TextInput ... /></Field>
 *   </Sheet>
 */
export function Sheet(props: SheetProps) {
  const isClient = useIsClient();
  if (!props.open || !isClient) return null;
  return createPortal(<SheetPanel {...props} />, document.body);
}

function SheetPanel({
  onClose,
  title,
  children,
  footer,
  dirty = false,
  busy = false,
  variant = "sheet",
  size = "auto",
  width = "default",
  initialFocusRef,
  headerActions,
  description,
  discardMessage = "Discard your changes?",
  className,
  bodyClassName,
  "data-sheet": dataSheet,
}: SheetProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;
  const panelRef = useRef<HTMLDivElement>(null);
  // The opener, read during the first render: before any autoFocus inside the sheet moves focus.
  const [opener] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  const returnTo = useRef<HTMLElement | null>(opener);
  const [asking, setAsking] = useState(false);
  const [shake, setShake] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ y: number; pointer: number } | null>(null);
  const stateRef = useRef({ dirty, busy, onClose });
  stateRef.current = { dirty, busy, onClose };

  const nudge = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 300);
  }, []);

  const attemptDismiss = useCallback(
    (source: DismissSource) => {
      const { dirty: isDirty, busy: isBusy, onClose: close } = stateRef.current;
      if (isBusy) return nudge();
      if (isDirty) {
        // A stray tap or swipe never throws work away: the sheet only nudges.
        if (source === "backdrop" || source === "swipe") return nudge();
        setAsking(true);
        return;
      }
      close();
    },
    [nudge]
  );

  // Open: remember the opener, lock scroll, focus inside. Close: give focus back.
  useEffect(() => {
    stack.push(id);
    lockScroll();
    // Something inside already took focus (an autoFocus field): leave it there.
    if (!panelRef.current?.contains(document.activeElement)) {
      const target = initialFocusRef?.current || panelRef.current;
      target?.focus({ preventScroll: true });
    }
    return () => {
      const at = stack.lastIndexOf(id);
      if (at >= 0) stack.splice(at, 1);
      unlockScroll();
      const back = returnTo.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/close only
  }, []);

  // Escape (only the top sheet) and the focus trap.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (asking) setAsking(false);
        else attemptDismiss("escape");
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = focusables(panelRef.current);
      if (!items.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active && panelRef.current.contains(active);
      if (event.shiftKey && (active === first || !inside || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [id, asking, attemptDismiss]);

  // Swipe down on the handle or header (phones). Buttons in the header are excluded.
  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as Element).closest("button, a, input, select, textarea")) return;
    if (window.matchMedia("(min-width: 1024px) and (min-height: 501px)").matches) return;
    dragStart.current = { y: event.clientY, pointer: event.pointerId };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragStart.current || dragStart.current.pointer !== event.pointerId) return;
    setDrag(Math.max(0, event.clientY - dragStart.current.y));
  };
  const onPointerUp = (event: React.PointerEvent) => {
    if (!dragStart.current || dragStart.current.pointer !== event.pointerId) return;
    const distance = event.clientY - dragStart.current.y;
    dragStart.current = null;
    setDrag(0);
    if (distance > 90) attemptDismiss("swipe");
  };

  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };

  return (
    <>
      <div className="adm-scrim" aria-hidden="true" onClick={() => attemptDismiss("backdrop")} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        data-variant={variant}
        data-size={size}
        data-width={width}
        data-dragging={drag ? "true" : undefined}
        data-shake={shake ? "true" : undefined}
        data-sheet={dataSheet}
        className={cx("adm-sheet", className)}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div className="adm-sheet-handle" aria-hidden="true" {...dragHandlers} />
        <div className="adm-sheet-head" {...dragHandlers}>
          <h2 id={titleId} className="adm-sheet-title">
            {title}
          </h2>
          {headerActions}
          <button type="button" className="adm-icon-btn" aria-label="Close" onClick={() => attemptDismiss("close")} data-sheet-close="">
            <XMarkIcon aria-hidden="true" />
          </button>
        </div>
        <div className={cx("adm-sheet-body", bodyClassName)}>
          {description && (
            <p id={descId} className="mb-3 text-[14px] text-adm-text-2">
              {description}
            </p>
          )}
          {children}
        </div>
        {asking ? (
          <div className="adm-sheet-footer items-center" data-adm-footer="" role="alertdialog" aria-label="Unsaved changes">
            <p className="mr-auto basis-full text-[14px] font-medium text-adm-ink sm:basis-auto">{discardMessage}</p>
            <Button variant="secondary" large onClick={() => setAsking(false)} autoFocus>
              Keep editing
            </Button>
            <Button variant="danger" large onClick={() => stateRef.current.onClose()}>
              Discard
            </Button>
          </div>
        ) : footer ? (
          <div className="adm-sheet-footer" data-adm-footer="">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* ConfirmSheet                                                        */
/* ------------------------------------------------------------------ */

export type ConfirmSheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One sentence saying what will happen: "Stripe will charge $12.40 now." */
  consequence: ReactNode;
  /** The verb, repeated on the button: "Charge $12.40 and upgrade". */
  confirmLabel: string;
  /** May return a promise; the sheet stays open with the error if it rejects. */
  onConfirm: () => unknown;
  /** "danger" fills the button red (irreversible or money-moving). */
  tone?: "primary" | "danger";
  cancelLabel?: string;
  /** Irreversible actions: the person types this exact text first. */
  typedConfirmation?: string;
  typedLabel?: ReactNode;
  /** Extra content between the sentence and the buttons (a reason field, an option). */
  children?: ReactNode;
  /** Close after a successful confirm (default true). */
  closeOnSuccess?: boolean;
  /** Message for a failed confirm; default reads the server's `message`. */
  errorText?: (error: unknown) => string;
};

/**
 * A confirmation (J.5): the consequence in one sentence and a button whose
 * label repeats the verb. Optional typed confirmation for irreversible
 * actions. Busy and errors are handled here; the sheet never closes on a
 * failure, so nothing typed is lost.
 *
 *   <ConfirmSheet open={asking} onClose={() => setAsking(false)} title="Mark job done?"
 *     consequence="The customer gets the completion email, a text and the tip link."
 *     confirmLabel="Mark done and notify" onConfirm={() => complete(id)} />
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  consequence,
  confirmLabel,
  onConfirm,
  tone = "primary",
  cancelLabel = "Cancel",
  typedConfirmation,
  typedLabel,
  children,
  closeOnSuccess = true,
  errorText,
}: ConfirmSheetProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const typedOk = !typedConfirmation || typed.trim() === typedConfirmation;

  const close = () => {
    if (busy) return;
    setTyped("");
    setError("");
    onClose();
  };

  const confirm = async () => {
    if (!typedOk || busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setBusy(false);
      if (closeOnSuccess) {
        setTyped("");
        onClose();
      }
    } catch (err) {
      setBusy(false);
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(errorText ? errorText(err) : e?.response?.data?.message || e?.message || "That did not work. Nothing was changed. Try again.");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      variant="dialog"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" large onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} large busy={busy} disabled={!typedOk} onClick={confirm} data-confirm="">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-adm-ink">{consequence}</p>
      {children && <div className="mt-4">{children}</div>}
      {typedConfirmation && (
        <Field label={typedLabel || <>Type <span className="font-mono">{typedConfirmation}</span> to confirm</>} className="mt-4">
          <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" />
        </Field>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] font-medium text-adm-problem">
          {error}
        </p>
      )}
    </Sheet>
  );
}
