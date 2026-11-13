"use client";

/**
 * The admin's data layer: a small typed query/mutation cache.
 *
 * WHY NOT TANSTACK QUERY (which the audit, M.1, suggested)
 * node_modules in every worktree is a junction to one shared install, and the
 * redesign is under a zero-new-dependency rule, so adding a package is not an
 * option today. The admin needs a handful of the library's ideas, not the
 * library: one cache entry per key, request de-duplication, cancellation,
 * a guard against an older response overwriting a newer one, refresh on focus
 * and while visible, and writing a saved record into the cache instead of
 * reloading the screen. That is this file (about 300 lines, no React context,
 * built on useSyncExternalStore). If the dependency rule is ever lifted the
 * hook signatures map one-to-one onto useQuery/useMutation.
 *
 * RULES
 * - A key names exactly one request: ["bookings", scope] or "assignees".
 *   Keys are compared by their JSON, so arrays of strings/numbers are fine.
 * - The fetcher receives an AbortSignal; pass it to axios (`{ signal }`).
 *   When the last screen using a key unmounts (or switches key) while the
 *   request is in flight, it is aborted.
 * - Data stays on screen while it refreshes (`isFetching` without
 *   `isLoading`): never swap content for a spinner on a background refresh.
 * - After a mutation, either write the server's answer with setQueryData
 *   (preferred; nothing reloads) or invalidate the keys it changed.
 * - Search text is never part of a URL; if a query needs it, put it in the
 *   key and send it in a POST body.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/* Refs updated before any effect reads them, without the server warning. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type QueryKey = string | readonly (string | number | boolean | null | undefined)[];
export type Fetcher<T> = (signal: AbortSignal) => Promise<T>;

type Entry = {
  data: unknown;
  error: unknown;
  hasData: boolean;
  updatedAt: number;
  /** Bumped by every fetch start; only the latest fetch may write. */
  seq: number;
  /** Bumped by every local write; a fetch that started before it is stale. */
  writeSeq: number;
  inflight: Promise<unknown> | null;
  controller: AbortController | null;
  subscribers: Set<() => void>;
  gcTimer: ReturnType<typeof setTimeout> | null;
  snapshot: QuerySnapshot<unknown>;
  invalid: boolean;
};

export type QueryStatus = "loading" | "success" | "error";

export type QuerySnapshot<T> = {
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  /** No data yet and a request is running: show skeletons. */
  isLoading: boolean;
  /** Any request running, including a background refresh: show the 2px bar at most. */
  isFetching: boolean;
  updatedAt: number;
};

const CACHE = new Map<string, Entry>();
const GC_MS = 5 * 60 * 1000;
const FETCHING = new Set<string>();
const fetchingListeners = new Set<() => void>();

export function hashKey(key: QueryKey): string {
  return typeof key === "string" ? key : JSON.stringify(key);
}

function entryFor(hash: string): Entry {
  let entry = CACHE.get(hash);
  if (!entry) {
    entry = {
      data: undefined,
      error: undefined,
      hasData: false,
      updatedAt: 0,
      seq: 0,
      writeSeq: 0,
      inflight: null,
      controller: null,
      subscribers: new Set(),
      gcTimer: null,
      snapshot: { data: undefined, error: undefined, status: "loading", isLoading: true, isFetching: false, updatedAt: 0 },
      invalid: false,
    };
    CACHE.set(hash, entry);
  }
  return entry;
}

function publish(hash: string, entry: Entry) {
  const fetching = Boolean(entry.inflight);
  entry.snapshot = {
    data: entry.data,
    error: entry.error,
    status: entry.hasData ? "success" : entry.error !== undefined ? "error" : "loading",
    isLoading: !entry.hasData && entry.error === undefined,
    isFetching: fetching,
    updatedAt: entry.updatedAt,
  };
  const before = FETCHING.has(hash);
  if (fetching) FETCHING.add(hash);
  else FETCHING.delete(hash);
  entry.subscribers.forEach((notify) => notify());
  if (before !== fetching) fetchingListeners.forEach((notify) => notify());
}

function isAbort(error: unknown) {
  const e = error as { name?: string; code?: string } | null;
  return e?.name === "AbortError" || e?.name === "CanceledError" || e?.code === "ERR_CANCELED";
}

/** Start (or join) the request for a key. Resolves with the data or rejects with the error. */
export function fetchQuery<T>(key: QueryKey, fetcher: Fetcher<T>, { force = false }: { force?: boolean } = {}): Promise<T> {
  const hash = hashKey(key);
  const entry = entryFor(hash);
  if (entry.inflight && !force) return entry.inflight as Promise<T>;
  if (entry.inflight && force) entry.controller?.abort();

  const controller = new AbortController();
  const seq = ++entry.seq;
  const writeSeqAtStart = entry.writeSeq;
  entry.controller = controller;
  const promise = fetcher(controller.signal).then(
    (data) => {
      // Stale-response guard: a newer request, or a local write, superseded this one.
      if (seq === entry.seq && writeSeqAtStart === entry.writeSeq && !controller.signal.aborted) {
        entry.data = data;
        entry.hasData = true;
        entry.error = undefined;
        entry.updatedAt = Date.now();
        entry.invalid = false;
      }
      return data;
    },
    (error) => {
      if (seq === entry.seq && !isAbort(error)) entry.error = error;
      throw error;
    }
  );
  entry.inflight = promise;
  const settle = () => {
    if (entry.inflight === promise) {
      entry.inflight = null;
      entry.controller = null;
    }
    publish(hash, entry);
  };
  promise.then(settle, settle);
  publish(hash, entry);
  return promise;
}

export function getQueryData<T>(key: QueryKey): T | undefined {
  return CACHE.get(hashKey(key))?.data as T | undefined;
}

/**
 * Write data for a key (a saved record, an optimistic change). Any request
 * already running for the key is treated as stale and will not overwrite it.
 */
export function setQueryData<T>(key: QueryKey, updater: T | ((current: T | undefined) => T)): void {
  const hash = hashKey(key);
  const entry = entryFor(hash);
  const next = typeof updater === "function" ? (updater as (current: T | undefined) => T)(entry.data as T | undefined) : updater;
  entry.data = next;
  entry.hasData = true;
  entry.error = undefined;
  entry.updatedAt = Date.now();
  entry.writeSeq += 1;
  publish(hash, entry);
}

function matches(hash: string, prefix: QueryKey) {
  if (typeof prefix === "string") return hash === prefix || hash === JSON.stringify([prefix]) || hash.startsWith(`["${prefix}",`) || hash.startsWith(`[${JSON.stringify(prefix)},`);
  const head = JSON.stringify(prefix);
  return hash === head || hash.startsWith(head.slice(0, -1) + ",");
}

const invalidateListeners = new Set<(hash: string) => void>();

/**
 * Mark keys stale and refetch the ones on screen. A string matches that key
 * and every array key starting with it; an array matches by prefix.
 */
export function invalidateQueries(prefix: QueryKey): void {
  for (const [hash, entry] of CACHE) {
    if (!matches(hash, prefix)) continue;
    entry.invalid = true;
    if (entry.subscribers.size) invalidateListeners.forEach((listener) => listener(hash));
  }
}

/** Sign-out: forget everything, abort everything. */
export function clearQueryCache(): void {
  for (const entry of CACHE.values()) {
    entry.controller?.abort();
    if (entry.gcTimer) clearTimeout(entry.gcTimer);
  }
  CACHE.clear();
  FETCHING.clear();
  fetchingListeners.forEach((notify) => notify());
}

/** True while any admin request is running: drives the header's progress bar. */
export function useIsFetchingAny(): boolean {
  return useSyncExternalStore(
    (notify) => {
      fetchingListeners.add(notify);
      return () => fetchingListeners.delete(notify);
    },
    () => FETCHING.size > 0,
    () => false
  );
}

export type QueryOptions = {
  /** Data younger than this is shown without refetching on mount. Default 30s. */
  staleTime?: number;
  /** Refetch when the tab regains focus, if stale. Default true. */
  refetchOnFocus?: boolean;
  /** Refetch on this interval while the page is visible. */
  pollMs?: number;
  /** False: do nothing (permission missing, id not known yet). Default true. */
  enabled?: boolean;
};

export type QueryResult<T> = QuerySnapshot<T> & {
  /** Fetch again now. Resolves when done; never throws (the error lands in `error`). */
  refetch: () => Promise<void>;
  /** setQueryData for this key. */
  setData: (updater: T | ((current: T | undefined) => T)) => void;
};

const EMPTY: QuerySnapshot<never> = { data: undefined, error: undefined, status: "loading", isLoading: true, isFetching: false, updatedAt: 0 };
const DISABLED: QuerySnapshot<never> = { data: undefined, error: undefined, status: "success", isLoading: false, isFetching: false, updatedAt: 0 };

export function useAdminQuery<T>(key: QueryKey, fetcher: Fetcher<T>, options: QueryOptions = {}): QueryResult<T> {
  const { staleTime = 30_000, refetchOnFocus = true, pollMs, enabled = true } = options;
  const hash = hashKey(key);
  const keyRef = useRef(key);
  const fetcherRef = useRef(fetcher);
  useIsoLayoutEffect(() => {
    keyRef.current = key;
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!enabled) return () => {};
      const entry = entryFor(hash);
      if (entry.gcTimer) {
        clearTimeout(entry.gcTimer);
        entry.gcTimer = null;
      }
      entry.subscribers.add(notify);
      return () => {
        entry.subscribers.delete(notify);
        if (entry.subscribers.size) return;
        // Nobody is looking any more: abort the request and forget the entry later.
        if (entry.inflight) {
          entry.controller?.abort();
          entry.seq += 1;
          entry.inflight = null;
          entry.controller = null;
          publish(hash, entry);
        }
        entry.gcTimer = setTimeout(() => {
          if (!entry.subscribers.size) CACHE.delete(hash);
        }, GC_MS);
      };
    },
    [hash, enabled]
  );

  const snapshot = useSyncExternalStore(
    subscribe,
    () => (enabled ? (CACHE.get(hash)?.snapshot as QuerySnapshot<T> | undefined) || EMPTY : DISABLED),
    () => (enabled ? EMPTY : DISABLED)
  );

  const run = useCallback(
    async (force: boolean) => {
      try {
        await fetchQuery(keyRef.current, fetcherRef.current, { force });
      } catch {
        /* the error is in the snapshot */
      }
    },
    []
  );

  // Mount / key change: fetch unless fresh data is cached.
  useEffect(() => {
    if (!enabled) return;
    const entry = entryFor(hash);
    const fresh = entry.hasData && !entry.invalid && Date.now() - entry.updatedAt < staleTime;
    if (!fresh && !entry.inflight) void run(false);
  }, [hash, enabled, staleTime, run]);

  // Invalidation of a key this screen shows.
  useEffect(() => {
    if (!enabled) return;
    const listener = (h: string) => {
      if (h === hash) void run(true);
    };
    invalidateListeners.add(listener);
    return () => {
      invalidateListeners.delete(listener);
    };
  }, [hash, enabled, run]);

  // Focus and visibility.
  useEffect(() => {
    if (!enabled || !refetchOnFocus) return;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const entry = CACHE.get(hash);
      if (!entry || entry.inflight) return;
      if (Date.now() - entry.updatedAt >= staleTime || entry.invalid) void run(false);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [hash, enabled, refetchOnFocus, staleTime, run]);

  // Polling, only while the page is visible.
  useEffect(() => {
    if (!enabled || !pollMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !CACHE.get(hash)?.inflight) void run(false);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [hash, enabled, pollMs, run]);

  const refetch = useCallback(() => run(true), [run]);
  const setData = useCallback((updater: T | ((current: T | undefined) => T)) => setQueryData<T>(keyRef.current, updater), []);

  return { ...snapshot, refetch, setData };
}

export type MutationState<TResult> = {
  busy: boolean;
  error: unknown;
  data: TResult | undefined;
};

/**
 * A mutation with a busy flag for the pressed button. Concurrent calls are
 * refused while one is running (a double tap never sends twice).
 *
 *   const save = useAdminMutation((patch) => updateBooking(id, patch), {
 *     onSuccess: (saved) => setQueryData(["booking", id], saved),
 *   });
 *   <Button busy={save.busy} onClick={() => save.mutate(patch)}>Save</Button>
 */
export function useAdminMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  options: {
    onSuccess?: (result: TResult, vars: TVars) => void;
    onError?: (error: unknown, vars: TVars) => void;
    /** Keys to invalidate after success. */
    invalidates?: QueryKey[];
  } = {}
) {
  const [state, setState] = useState<MutationState<TResult>>({ busy: false, error: undefined, data: undefined });
  const busyRef = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(async (vars: TVars): Promise<TResult | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setState((s) => ({ ...s, busy: true, error: undefined }));
    try {
      const result = await fnRef.current(vars);
      optionsRef.current.onSuccess?.(result, vars);
      optionsRef.current.invalidates?.forEach((key) => invalidateQueries(key));
      if (mounted.current) setState({ busy: false, error: undefined, data: result });
      return result;
    } catch (error) {
      optionsRef.current.onError?.(error, vars);
      if (mounted.current) setState({ busy: false, error, data: undefined });
      return undefined;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ busy: false, error: undefined, data: undefined }), []);
  return { ...state, mutate, reset };
}

/** The message a failed request should show: the server's `message`, or a plain fallback. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  const e = error as { response?: { data?: { message?: string } }; message?: string } | null;
  return e?.response?.data?.message || (e?.message && !/^Request failed with status code/.test(e.message) ? e.message : "") || fallback;
}

/** The server's `code` (STALE, INVALID_TRANSITION, FORBIDDEN_RECORD ...), if any. */
export function errorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code;
}

export function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}
