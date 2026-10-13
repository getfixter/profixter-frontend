"use client";

import { useEffect } from "react";

/** Close a dialog with the Escape key while it is open. */
export function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
}
