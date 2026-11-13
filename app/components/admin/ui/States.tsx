"use client";

import { ExclamationTriangleIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, cx } from "./Button";

/** A grey block that stands in for content while it loads. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("adm-skel block", className)} />;
}

/**
 * Skeleton rows shaped like the real list rows (J.5 loading): the first load
 * of a list shows these, never a full-screen spinner.
 *
 *   {query.isLoading ? <SkeletonRows count={6} /> : <ul>{rows}</ul>}
 */
export function SkeletonRows({ count = 6, leading = true, label = "Loading" }: { count?: number; leading?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-[64px] items-center gap-3 border-b border-adm-line px-4 py-3 last:border-b-0">
          {leading && <Skeleton className="h-9 w-12" />}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/**
 * One line plus at most one action (J.5): "No jobs tomorrow · New visit".
 *
 *   <EmptyState message="No jobs tomorrow" action={<Button>New visit</Button>} />
 */
export function EmptyState({ message, detail, action, className }: { message: ReactNode; detail?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center gap-3 rounded-adm-md border border-dashed border-adm-line-2 bg-adm-surface px-4 py-8 text-center", className)}>
      <p className="text-[15px] font-semibold text-adm-ink">{message}</p>
      {detail && <p className="max-w-md text-[13px] text-adm-text-2">{detail}</p>}
      {action}
    </div>
  );
}

/**
 * A failed load: what happened, what to do, and Retry. Shown in place of the
 * content that failed, never as a toast.
 *
 *   {query.error && <ErrorState message="Jobs could not be loaded." onRetry={query.refetch} />}
 */
export function ErrorState({
  title = "This could not be loaded",
  message,
  onRetry,
  className,
}: {
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => unknown;
  className?: string;
}) {
  return (
    <div role="alert" className={cx("flex flex-col items-start gap-3 rounded-adm-md border border-adm-line bg-adm-surface p-4", className)}>
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-adm-problem" aria-hidden="true" />
        <div>
          <p className="text-[15px] font-semibold text-adm-ink">{title}</p>
          {message && <p className="mt-0.5 text-[14px] text-adm-text-2">{message}</p>}
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Shown when this person may not open a screen (the server would refuse too).
 *
 *   if (!canOpen(user, "projects")) return <PermissionState section="Projects" />;
 */
export function PermissionState({ section, message }: { section?: string; message?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-adm-md border border-adm-line bg-adm-surface px-4 py-10 text-center" data-permission-state="">
      <LockClosedIcon className="h-7 w-7 text-adm-text-3" aria-hidden="true" />
      <p className="text-[15px] font-semibold text-adm-ink">{section ? `You don't have access to ${section}` : "You don't have access to this"}</p>
      <p className="max-w-sm text-[13px] text-adm-text-2">{message || "Ask the owner to switch this section on for your account."}</p>
    </div>
  );
}

type BoundaryProps = { children: ReactNode; label?: string; resetKey?: string };

/**
 * One section failing (a malformed response, audit F18) must not take the
 * whole admin down. Wrap each section; Retry remounts it.
 */
export class ErrorBoundary extends Component<BoundaryProps, { error: Error | null; attempt: number; resetKey?: string }> {
  state = { error: null as Error | null, attempt: 0, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: { error: Error | null; attempt: number; resetKey?: string }) {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Admin section crashed${this.props.label ? ` (${this.props.label})` : ""}:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title={`${this.props.label || "This section"} hit a problem`}
          message="Nothing was changed. Try again; if it keeps happening, reload the page."
          onRetry={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
        />
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
