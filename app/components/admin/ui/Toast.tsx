"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastOptions = {
  /** Offer Undo for a reversible change. The toast stays 6s instead of 4s. */
  undo?: () => void;
  undoLabel?: string;
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; message: string };

type ToastApi = {
  /** "Saved", "Copied", "Payment received ..." — never an error that needs action (use ErrorState or an inline error). */
  show: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * One toast system (E.4): bottom, above the navigation, 4s, optional Undo,
 * announced politely to screen readers. The admin shell mounts the provider;
 * screens call useToast().
 *
 *   const toast = useToast();
 *   toast.show("Customer updated");
 *   toast.show("Job archived", { undo: () => restore(id) });
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback(() => setItems([]), []);
  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++seq.current;
    // One at a time: a new message replaces the old one rather than stacking up.
    setItems([{ id, message, ...options }]);
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDone={() => setItems((list) => list.filter((t) => t.id !== item.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => doneRef.current(), item.duration ?? (item.undo ? 6000 : 4000));
    return () => window.clearTimeout(timer);
  }, [item.duration, item.undo]);
  return (
    <div className="adm-toast" data-toast="">
      <span className="min-w-0 flex-1">{item.message}</span>
      {item.undo && (
        <button
          type="button"
          onClick={() => {
            item.undo?.();
            onDone();
          }}
        >
          {item.undoLabel || "Undo"}
        </button>
      )}
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    // Outside the shell (a stray render in a test): degrade to nothing rather than crash.
    return { show: () => {}, dismiss: () => {} };
  }
  return api;
}
