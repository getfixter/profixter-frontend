import { CheckIcon, ClockIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/16/solid";
import type { ReactNode } from "react";
import { cx } from "./Button";

export type StatusTone = "attention" | "info" | "success" | "neutral" | "problem";

const TONE_CLASS: Record<StatusTone, string> = {
  attention: "bg-adm-attn-bg text-adm-attn",
  info: "bg-adm-info-bg text-adm-info",
  success: "bg-adm-ok-bg text-adm-ok",
  neutral: "bg-adm-neutral-bg text-adm-neutral",
  problem: "bg-adm-problem-bg text-adm-problem",
};

function DoubleCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M1.5 8.5 4.5 11.5 10.5 4.5" />
      <path d="M7.5 11.5 8 12 14.5 4.5" />
    </svg>
  );
}

const TONE_ICON: Record<StatusTone, (p: { className?: string }) => ReactNode> = {
  attention: (p) => <ClockIcon {...p} aria-hidden="true" />,
  info: (p) => <CheckIcon {...p} aria-hidden="true" />,
  success: (p) => <DoubleCheck {...p} />,
  neutral: (p) => <XMarkIcon {...p} aria-hidden="true" />,
  problem: (p) => <ExclamationTriangleIcon {...p} aria-hidden="true" />,
};

/** A booking status word to its tone and label. Unknown statuses read as neutral with their own word. */
export function bookingStatusTone(status: string | null | undefined): { tone: StatusTone; label: string } {
  const s = String(status || "pending").trim().toLowerCase();
  if (s === "pending" || s === "pending confirmation") return { tone: "attention", label: s === "pending" ? "Needs review" : "Awaiting approval" };
  if (s === "confirmed") return { tone: "info", label: "Confirmed" };
  if (s === "completed") return { tone: "success", label: "Completed" };
  if (s === "canceled" || s === "cancelled") return { tone: "neutral", label: "Canceled" };
  return { tone: "neutral", label: s ? s[0].toUpperCase() + s.slice(1) : "Unknown" };
}

export type StatusBadgeProps =
  | { status: string | null | undefined; tone?: never; children?: never; className?: string }
  | { tone: StatusTone; children: ReactNode; status?: never; className?: string };

/**
 * Icon plus word, 12/600, radius 6, J.2 colours. Meaning never rests on
 * colour alone: every tone has its own icon.
 *
 *   <StatusBadge status={booking.status} />
 *   <StatusBadge tone="problem">Payment failed</StatusBadge>
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { tone, label } = props.tone ? { tone: props.tone, label: props.children } : bookingStatusTone(props.status);
  return (
    <span className={cx("inline-flex h-6 flex-none items-center gap-1 rounded-adm-xs px-1.5 text-[12px] font-semibold leading-none", TONE_CLASS[tone], props.className)}>
      {TONE_ICON[tone]({ className: "h-3.5 w-3.5" })}
      <span>{label}</span>
    </span>
  );
}

export type JobType = "member" | "free" | "fullday" | "onetime";

const TYPE_LABEL: Record<JobType, string> = { member: "Member", free: "Free visit", fullday: "Full Day", onetime: "One-time" };
const TYPE_CLASS: Record<JobType, string> = {
  member: "bg-adm-member-bg text-adm-member",
  free: "bg-adm-free-bg text-adm-free",
  fullday: "bg-adm-fullday-bg text-adm-fullday",
  onetime: "bg-adm-surface text-adm-ink border border-adm-line-2",
};

/**
 * What kind of visit a booking is. A paid Full Day carries accessType
 * "one_time", so bookingType is checked first (project memory: Full Day brief).
 */
export function jobTypeOf(booking: { bookingType?: string | null; accessType?: string | null; service?: string | null; freeVisitChannel?: string | null }): JobType {
  const type = String(booking.bookingType || "").toLowerCase();
  if (type.includes("full_day") || type.includes("fullday")) return "fullday";
  if (type.includes("free") || booking.freeVisitChannel) return "free";
  if (type === "one_time_handyman_visit" || String(booking.accessType || "").toLowerCase() === "one_time") return "onetime";
  return "member";
}

/** The visit type as a text label on its J.2 colour. */
export function TypeBadge({ type, children, className }: { type: JobType; children?: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 flex-none items-center rounded-adm-xs px-1.5 text-[12px] font-semibold leading-none", TYPE_CLASS[type], className)}>
      {children || TYPE_LABEL[type]}
    </span>
  );
}
