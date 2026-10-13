"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { money0 } from "./ui";

export type PriceApi = (designs: unknown[], projectType: string) => Promise<{ totals: (number | null)[] }>;
export type Candidate = { key: string; design: any };

/**
 * Price differences for the options on screen. Each candidate is the WHOLE
 * design with that option (after the engine's own compatibility fixes), priced
 * by the server's pricing engine together with the current design - never one
 * product's price minus another's. Results are cached per design.
 */
export function usePriceDeltas(design: any, candidates: Candidate[], projectType: string, priceApi: PriceApi) {
  const [totals, setTotals] = useState<Map<string, number | null>>(new Map());
  const [base, setBase] = useState<number | null | undefined>(undefined);
  const cache = useRef(new Map<string, number | null>());
  const reqKey = useMemo(() => JSON.stringify({ design, projectType, keys: candidates.map((c) => c.key) }), [design, projectType, candidates]);
  useEffect(() => {
    if (!design || !candidates.length) return;
    let live = true;
    const keyOf = (x: any) => `${projectType}|${JSON.stringify(x)}`;
    const designs = [design, ...candidates.map((c) => c.design)];
    const keys = designs.map(keyOf);
    const publish = () => {
      if (!live) return;
      setBase(cache.current.has(keys[0]) ? cache.current.get(keys[0]) : undefined);
      setTotals(new Map(candidates.map((c, i) => [c.key, cache.current.has(keys[i + 1]) ? cache.current.get(keys[i + 1])! : (undefined as any)])));
    };
    publish(); // whatever is cached already shows at once
    const t = window.setTimeout(async () => {
      const missing = keys.map((k, i) => (cache.current.has(k) ? -1 : i)).filter((i) => i >= 0);
      try {
        for (let i = 0; i < missing.length; i += 40) {
          const part = missing.slice(i, i + 40);
          const r = await priceApi(part.map((j) => designs[j]), projectType);
          part.forEach((j, n) => cache.current.set(keys[j], r.totals[n] ?? null));
        }
      } catch { /* cards keep "…"; the running total still comes from the main quote */ }
      publish();
    }, 160);
    return () => { live = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  return (key: string): number | null | undefined => {
    if (!totals.has(key) || base === undefined) return undefined;
    const t = totals.get(key);
    if (t === undefined) return undefined;
    if (t === null || base === null) return null;
    return t - base;
  };
}

/** "+$350", "−$200", "Same price", "Price on review", or "…" while loading. */
export function deltaText(d: number | null | undefined) {
  if (d === undefined) return "…";
  if (d === null) return "Price on review";
  if (Math.abs(d) < 50) return "Same price";
  return d > 0 ? `+${money0(d)}` : `−${money0(-d)}`;
}
