"use client";

/**
 * Email send history, newest first. Full email bodies are not stored.
 * Rows on phones, a dense grid on wide screens; a row opens its details in
 * the kit Sheet.
 *
 * Note: /api/admin/email-logs is a GET endpoint, so the free-text search goes
 * in its query string (reported to the backend as a gap: search text belongs
 * in a POST body).
 */

import { useEffect, useMemo, useState } from "react";
import { getEmailLogs, type EmailLogItem, type EmailLogResponse } from "@/lib/admin-service";
import { arr, num, str } from "@/lib/admin/sections-api";
import { Button, EmptyState, ErrorState, Field, SearchField, Select, Sheet, SkeletonRows, StatusBadge, TextInput, cx } from "@/app/components/admin/ui";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];
const TYPE_OPTIONS = ["", "transactional", "reminder", "review", "billing", "security", "admin", "campaign", "marketing"].map((v) => ({
  value: v,
  label: v ? v[0].toUpperCase() + v.slice(1) : "All",
}));

function errorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || (error instanceof Error ? error.message : "Request failed");
}

function formatTime(value?: string | null, full = false) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(
    "en-US",
    full
      ? { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
  );
}

function who(name?: string, email?: string) {
  const n = str(name).trim();
  const e = str(email).trim();
  if (n && e) return `${n} <${e}>`;
  return n || e || "-";
}

function Status({ status }: { status: string }) {
  return status === "sent" ? <StatusBadge tone="success">Sent</StatusBadge> : <StatusBadge tone="problem">Failed</StatusBadge>;
}

export default function EmailHistory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [emailType, setEmailType] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState({ search: "", templateKey: "" });
  const [data, setData] = useState<EmailLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<EmailLogItem | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ search: search.trim(), templateKey: templateKey.trim() }), 300);
    return () => clearTimeout(t);
  }, [search, templateKey]);

  const filters = useMemo(
    () => ({
      page,
      limit: 25,
      search: debounced.search || undefined,
      status: status || undefined,
      emailType: emailType || undefined,
      templateKey: debounced.templateKey || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, emailType, page, debounced, status]
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the request below
    setLoading(true);
    setError("");
    getEmailLogs(filters)
      .then((result) => !cancelled && setData(result && typeof result === "object" ? result : null))
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, attempt]);

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setEmailType("");
    setTemplateKey("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const items = arr<EmailLogItem>(data?.items);
  const totalPages = Math.max(1, num(data?.totalPages));
  const filtered = !!(search || status || emailType || templateKey || dateFrom || dateTo);

  return (
    <div className="space-y-4" data-email-history>
      <p className="text-[14px] text-adm-text-2">Newest first. Transactional, reminder, campaign, billing, security and admin emails. Full email bodies are not stored.</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SearchField
          label="Search emails"
          placeholder="Booking #, customer, recipient, subject"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          className="md:col-span-2"
        />
        <Field label="Status">
          <Select
            value={status}
            options={STATUS_OPTIONS}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Type">
          <Select
            value={emailType}
            options={TYPE_OPTIONS}
            onChange={(e) => {
              setEmailType(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Template">
          <TextInput
            value={templateKey}
            placeholder="booking_reminder_24h"
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => {
              setTemplateKey(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="From">
          <TextInput
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="To">
          <TextInput
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" block onClick={resetFilters} disabled={!filtered}>
            Reset filters
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      ) : loading && !items.length ? (
        <SkeletonRows count={6} leading={false} />
      ) : !items.length ? (
        <EmptyState message={filtered ? "No emails match these filters." : "No emails sent yet."} />
      ) : (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label="Email history">
          {items.map((item) => (
            <li key={item._id} className="border-b border-adm-line last:border-b-0">
              <button
                type="button"
                onClick={() => setSelected(item)}
                className={cx(
                  "grid w-full min-w-0 gap-x-3 gap-y-0.5 px-4 py-3 text-left hover:bg-adm-sunk",
                  "grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[120px_80px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-center",
                  item.status === "failed" && "bg-adm-problem-bg/40"
                )}
              >
                <span className="adm-num order-1 text-[13px] text-adm-text-2 xl:order-none">{formatTime(item.sentAt || item.failedAt || item.createdAt)}</span>
                <span className="order-2 justify-self-end xl:order-none xl:justify-self-start">
                  <Status status={item.status} />
                </span>
                <span className="order-3 col-span-2 min-w-0 truncate text-[14px] font-semibold text-adm-ink xl:order-none xl:col-span-1">{item.subject || item.templateKey || "Email"}</span>
                <span className="order-4 col-span-2 min-w-0 truncate text-[13px] text-adm-text-2 xl:order-none xl:col-span-1">{who(item.recipientName, item.recipientEmail)}</span>
                <span className="order-5 col-span-2 min-w-0 truncate font-mono text-[12px] text-adm-text-3 xl:order-none xl:col-span-1">
                  {[item.templateKey, item.emailType, item.bookingNumber].filter(Boolean).join(" · ") || "-"}
                </span>
                <span className="order-6 col-span-2 min-w-0 truncate text-[13px] text-adm-problem xl:order-none xl:col-span-1">{item.errorMessage || item.errorCode || ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 text-[14px] text-adm-text-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="adm-num">{data ? `${num(data.total)} result${num(data.total) === 1 ? "" : "s"} · Page ${num(data.page) || page} of ${totalPages}` : ""}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={!data || page <= 1 || loading}>
            Previous
          </Button>
          <Button variant="secondary" onClick={() => setPage((v) => v + 1)} disabled={!data || page >= totalPages || loading}>
            Next
          </Button>
        </div>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.templateKey || "Email detail"} description={formatTime(selected?.sentAt || selected?.failedAt || selected?.createdAt, true)}>
        {selected ? (
          <div className="space-y-3">
            <Status status={selected.status} />
            <dl className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["Subject", selected.subject],
                  ["Type", selected.emailType],
                  ["Source", selected.source],
                  ["Recipient", who(selected.recipientName, selected.recipientEmail)],
                  ["Customer", who(selected.customerName, selected.customerEmail)],
                  ["Booking #", selected.bookingNumber],
                  ["Campaign #", selected.campaignNumber],
                  ["Provider message ID", selected.providerMessageId],
                  ["Error", selected.errorMessage || selected.errorCode || "-"],
                  ["Response code", selected.responseCode],
                ] as Array<[string, unknown]>
              ).map(([label, value]) => (
                <div key={label} className="rounded-adm-sm bg-adm-sunk px-3 py-2">
                  <dt className="text-[12px] font-semibold text-adm-text-2">{label}</dt>
                  <dd className="mt-0.5 break-words text-[14px] text-adm-ink">{str(value) || "-"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
