"use client";

/**
 * SMS log, failures and opt-outs (owner only, read-only).
 *
 * Reads BackEnd routes/adminSms.js. There is no send button and no edit here
 * on purpose: texts are produced by domain events, and the owner needs to see
 * what went out, what failed and who said STOP, not a second way to text.
 * Phone numbers are shown masked except the last four digits; names and
 * numbers are never put in a URL (only the status filter and page are).
 */

import { useState } from "react";
import { useAdminQuery, errorMessage, errorStatus } from "@/lib/admin/query";
import { getSmsConfig, getSmsFailures, getSmsMessages, getSmsOptOuts, type SmsMessageRow } from "@/lib/admin/sections-api";
import { Button, Chip, EmptyState, ErrorState, FilterBar, PermissionState, SkeletonRows, StatusBadge, type StatusTone } from "@/app/components/admin/ui";

type View = "messages" | "failures" | "opt-outs";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "undelivered", label: "Undelivered" },
  { value: "suppressed", label: "Suppressed" },
];

const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : phone ? "••••" : "-";
};

const when = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function toneFor(status: string): StatusTone {
  if (status === "delivered") return "success";
  if (status === "sent" || status === "queued" || status === "sending") return "info";
  if (status === "failed" || status === "undelivered") return "problem";
  if (status === "retry_scheduled") return "attention";
  return "neutral";
}

function MessageRows({ items }: { items: SmsMessageRow[] }) {
  if (!items.length) return <EmptyState message="No text messages here." />;
  return (
    <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
      {items.map((m) => (
        <li key={m.id} className="min-w-0 border-b border-adm-line px-4 py-3 last:border-b-0" data-sms-row>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-adm-ink">{m.notificationType || "Text message"}</p>
              <p className="truncate text-[13px] text-adm-text-2">
                {m.recipientName || "Unknown"} · {maskPhone(m.toPhone)}
                {m.bookingNumber ? ` · #${m.bookingNumber}` : ""}
              </p>
            </div>
            <StatusBadge tone={toneFor(m.status)}>{m.status ? m.status.replace(/_/g, " ") : "unknown"}</StatusBadge>
          </div>
          {m.body ? <p className="mt-1 line-clamp-2 break-words text-[13px] text-adm-text-2">{m.body}</p> : null}
          <p className="mt-1 text-[12px] text-adm-text-3">
            {when(m.createdAt)}
            {m.channelClass ? ` · ${m.channelClass}` : ""}
            {m.segments ? ` · ${m.segments} segment${m.segments === 1 ? "" : "s"}` : ""}
          </p>
          {m.error ? <p className="mt-1 break-words text-[13px] text-adm-problem">{m.error}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Messages() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useAdminQuery(["sms", "messages", status, page], (signal) => getSmsMessages({ page, status }, signal));
  return (
    <div className="space-y-3">
      <FilterBar label="Message status" sticky={false}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.value}
            selected={status === f.value}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
          >
            {f.label}
          </Chip>
        ))}
      </FilterBar>
      {q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error, "Could not load the SMS log.")} onRetry={q.refetch} />
      ) : q.isLoading ? (
        <SkeletonRows count={5} leading={false} />
      ) : (
        <>
          <MessageRows items={q.data?.items || []} />
          <div className="flex items-center justify-between gap-2 text-[14px] text-adm-text-2">
            <span className="adm-num">
              {q.data?.total ?? 0} messages · page {q.data?.page ?? page} of {q.data?.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Button>
              <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= (q.data?.totalPages ?? 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Failures() {
  const [hours, setHours] = useState(24);
  const q = useAdminQuery(["sms", "failures", hours], (signal) => getSmsFailures(hours, signal));
  return (
    <div className="space-y-3">
      <FilterBar label="Failure window" sticky={false}>
        {[24, 72, 168, 720].map((h) => (
          <Chip key={h} selected={hours === h} onClick={() => setHours(h)}>
            {h < 168 ? `${h} hours` : h === 168 ? "7 days" : "30 days"}
          </Chip>
        ))}
      </FilterBar>
      {q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error, "Could not load SMS failures.")} onRetry={q.refetch} />
      ) : q.isLoading ? (
        <SkeletonRows count={4} leading={false} />
      ) : (
        <>
          {q.data?.byReason.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Failures by reason">
              {q.data.byReason.map((r) => (
                <li key={r.reason} className="rounded-adm-sm bg-adm-problem-bg px-3 py-1.5 text-[13px] text-adm-problem">
                  {r.reason} · <span className="adm-num font-semibold">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <MessageRows items={q.data?.items || []} />
        </>
      )}
    </div>
  );
}

function OptOuts() {
  const [page, setPage] = useState(1);
  const q = useAdminQuery(["sms", "opt-outs", page], (signal) => getSmsOptOuts(page, signal));
  if (q.error && !q.data) return <ErrorState message={errorMessage(q.error, "Could not load opt-outs.")} onRetry={q.refetch} />;
  if (q.isLoading) return <SkeletonRows count={4} leading={false} />;
  const items = q.data?.items || [];
  return (
    <div className="space-y-3">
      {!items.length ? (
        <EmptyState message="Nobody has opted out." />
      ) : (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
          {items.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 border-b border-adm-line px-4 py-3 last:border-b-0" data-optout-row>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-adm-ink">{maskPhone(o.phone)}</p>
                <p className="text-[13px] text-adm-text-2">
                  {[o.scope && `${o.scope} texts`, o.source, o.keyword && `“${o.keyword}”`].filter(Boolean).join(" · ") || "Opted out"}
                </p>
              </div>
              <span className="shrink-0 text-right text-[12px] text-adm-text-3">
                {when(o.optedOutAt)}
                {o.optedInAt ? <span className="block text-adm-ok">Opted back in {when(o.optedInAt)}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={items.length < 25}>
          Next
        </Button>
      </div>
    </div>
  );
}

export default function SmsLog() {
  const [view, setView] = useState<View>("messages");
  const config = useAdminQuery(["sms", "config"], (signal) => getSmsConfig(signal), { staleTime: 60_000 });
  const status = errorStatus(config.error);
  if (status === 403) return <PermissionState section="SMS log" message="Only the owner can see the SMS log." />;
  if (status === 404) return <EmptyState message="The SMS log is not available on this server yet." />;
  const c = config.data;
  return (
    <div className="space-y-4" data-sms-log>
      <p className="text-[14px] text-adm-text-2">What the system texted, what failed and who opted out. Read-only: texts are only sent by bookings, reminders and other events.</p>
      {c ? (
        <dl className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4" data-sms-config>
          {(
            [
              ["Texting", c.smsEnabled ? "On" : "Off"],
              ["Marketing texts", c.smsMarketingEnabled ? "On" : "Off"],
              ["Opted out", String(c.optOuts)],
              ["Undeliverable numbers", String(c.undeliverable)],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <div key={label} className="rounded-adm-sm border border-adm-line bg-adm-surface px-3 py-2">
              <dt className="text-adm-text-2">{label}</dt>
              <dd className="adm-num text-[16px] font-semibold text-adm-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <FilterBar label="SMS views" sticky={false}>
        {(
          [
            ["messages", "Messages"],
            ["failures", "Failures"],
            ["opt-outs", "Opt-outs"],
          ] as Array<[View, string]>
        ).map(([id, label]) => (
          <Chip key={id} selected={view === id} onClick={() => setView(id)}>
            {label}
          </Chip>
        ))}
      </FilterBar>
      {view === "messages" ? <Messages /> : view === "failures" ? <Failures /> : <OptOuts />}
    </div>
  );
}
