"use client";

import { useEffect, useRef } from "react";
import type { SectionId } from "./sections";
import { HANDOFF_EVENT, takeQuery } from "./handoff";

/**
 * Receive a search query handed to this section (an old ?q= link, the global
 * search): on mount, and whenever one arrives while the section is open.
 *
 *   const [q, setQ] = useState("");
 *   useHandoffQuery("customers", setQ);
 */
export function useHandoffQuery(section: SectionId, apply: (query: string) => void): void {
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    const read = () => {
      const q = takeQuery(section);
      if (q) applyRef.current(q);
    };
    read();
    const onEvent = (event: Event) => {
      if ((event as CustomEvent).detail === section) read();
    };
    window.addEventListener(HANDOFF_EVENT, onEvent);
    return () => window.removeEventListener(HANDOFF_EVENT, onEvent);
  }, [section]);
}
