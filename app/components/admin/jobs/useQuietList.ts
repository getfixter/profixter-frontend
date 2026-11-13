"use client";

import { useCallback, useState } from "react";
import type { JobRow } from "@/lib/admin/jobs";

type State = { key: string; ids: string[]; known: Record<string, JobRow>; live: JobRow[] | undefined; auto: boolean };

/**
 * A list that refreshes quietly (F.1 "Freshness"): background refetches update
 * the rows already on screen in place, but never add or remove rows by
 * themselves, so nothing jumps under a finger. New rows raise "N new"; rows
 * that left the view raise "List changed". apply() shows the server's list.
 *
 * Changing the view (key) shows the new list at once. requestApply() makes
 * the next refresh apply itself (after the person's own create or action).
 */
export function useQuietList(key: string, live: JobRow[] | undefined) {
  const [state, setState] = useState<State>({ key: "", ids: [], known: {}, live: undefined, auto: false });

  // Adjust during render (no effect): a new view, the first data, or a refresh.
  if (live && (state.key !== key || state.live !== live)) {
    const known = { ...(state.key === key ? state.known : {}) };
    for (const row of live) known[row.id] = row;
    const reset = state.key !== key || state.auto || state.live === undefined;
    setState({ key, ids: reset ? live.map((r) => r.id) : state.ids, known, live, auto: false });
  }

  const liveIds = live ? new Set(live.map((r) => r.id)) : new Set<string>();
  const shown = state.key === key ? state.ids : [];
  const shownSet = new Set(shown);
  const added = live ? live.filter((r) => !shownSet.has(r.id)).length : 0;
  const removed = live ? shown.filter((id) => !liveIds.has(id)).length : 0;
  const liveById = new Map((live || []).map((r) => [r.id, r]));
  const rows = shown.map((id) => liveById.get(id) || state.known[id]).filter(Boolean) as JobRow[];

  const apply = useCallback(() => {
    setState((s) => (s.live ? { ...s, ids: s.live.map((r) => r.id) } : s));
  }, []);
  const requestApply = useCallback(() => setState((s) => ({ ...s, auto: true })), []);

  return { rows: state.key === key ? rows : live || [], added, removed, apply, requestApply };
}
