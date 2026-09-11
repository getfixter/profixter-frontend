"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";

/**
 * What we actually said to this person, or about this booking.
 *
 * ONE QUESTION THIS ANSWERS: "did they get the message?"
 *
 * So the status is the loudest thing on each row, and it is never flattered.
 * An email we handed to the mail provider says "sent", not "delivered",
 * because nothing tells us it arrived. An SMS says "delivered" only when
 * Twilio's callback confirmed a handset received it. The gap between accepted
 * and delivered is exactly where carrier filtering hides, and a screen that
 * blurred the two would be worse than no screen - it would answer the question
 * confidently and wrongly.
 *
 * Rows expand to the exact stored snapshot rather than a re-render of today's
 * template, which is the whole point of storing it.
 */

interface Record_ {
  id: string;
  channel: "sms" | "email";
  at: string;
  type: string;
  status: string;
  statusDetail: string;
  destination: string;
  bookingNumber: string;
  providerMessageId: string;
  subject: string;
  body: string;
  bodyIsHtml: boolean;
  hasSnapshot: boolean;
  snapshotNote: string;
  failureReason: string;
  errorCode: string;
  segments?: number;
  deliveredAt?: string | null;
}

/** Green only for an outcome a provider actually confirmed. */
const TONE: Record<string, string> = {
  delivered: "bg-[#E9F7EF] text-[#1B6B3A]",
  sent: "bg-[#EEF2FF] text-[#306EEC]",
  pending: "bg-[#F2F3F5] text-[#6A6D71]",
  sending: "bg-[#F2F3F5] text-[#6A6D71]",
  retry_scheduled: "bg-[#FFF6E9] text-[#8A5A1B]",
  simulated: "bg-[#F2F3F5] text-[#6A6D71]",
  suppressed: "bg-[#FFF6E9] text-[#8A5A1B]",
  undelivered: "bg-[#FDECEA] text-[#B4342B]",
  failed: "bg-[#FDECEA] text-[#B4342B]",
};

function Row({ record }: { record: Record_ }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[record.status] || "bg-[#F2F3F5] text-[#6A6D71]";

  return (
    <div className="rounded-[8px] border border-[#E0E6F5] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                record.channel === "sms"
                  ? "bg-[#EDE9FE] text-[#5B21B6]"
                  : "bg-[#E0F2FE] text-[#075985]"
              }`}
            >
              {record.channel}
            </span>
            <span className={`rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold uppercase ${tone}`}>
              {record.status.replace(/_/g, " ")}
            </span>
            <span className="font-mono text-[11.5px] text-[#6A6D71]">{record.type}</span>
            {record.bookingNumber ? (
              <span className="text-[11.5px] text-[#6A6D71]">#{record.bookingNumber}</span>
            ) : null}
          </span>
          <span className="mt-1 block text-[12px] text-[#6A6D71]">
            {new Date(record.at).toLocaleString()} · {record.destination}
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-[#313234]">
            {record.statusDetail}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-[#6A6D71]">
          {open ? "Hide" : "View"}
        </span>
      </button>

      {open ? (
        <div className="border-t border-[#EEF2FF] px-3.5 py-3">
          {record.subject ? (
            <>
              <p className="text-[11.5px] font-semibold text-[#6A6D71]">Subject</p>
              <p className="mb-2 text-[13px] font-semibold text-[#313234]">{record.subject}</p>
            </>
          ) : null}

          <p className="text-[11.5px] font-semibold text-[#6A6D71]">
            Exactly what was sent
          </p>
          {record.hasSnapshot ? (
            record.bodyIsHtml ? (
              /* Sandboxed: this is stored content being replayed inside Admin. */
              <iframe
                title={`Message ${record.id}`}
                sandbox=""
                srcDoc={record.body}
                className="mt-1 h-[320px] w-full rounded-[6px] border border-[#E0E6F5] bg-white"
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap rounded-[6px] bg-[#F7F9FF] p-2.5 text-[13px] leading-relaxed text-[#313234]">
                {record.body}
              </p>
            )
          ) : (
            <p className="mt-1 rounded-[6px] bg-[#FFF6E9] p-2.5 text-[12px] leading-relaxed text-[#8A5A1B]">
              {record.snapshotNote || "No content snapshot stored for this message."}
            </p>
          )}

          <dl className="mt-2.5 space-y-1 text-[11.5px] text-[#6A6D71]">
            {record.providerMessageId ? (
              <div>
                Provider ID: <span className="font-mono">{record.providerMessageId}</span>
              </div>
            ) : null}
            {record.errorCode ? (
              <div>
                Provider error code: <span className="font-mono">{record.errorCode}</span>
              </div>
            ) : null}
            {record.failureReason ? <div>Reason: {record.failureReason}</div> : null}
            {record.deliveredAt ? (
              <div>Delivered at: {new Date(record.deliveredAt).toLocaleString()}</div>
            ) : null}
            {typeof record.segments === "number" && record.segments > 0 ? (
              <div>Segments: {record.segments}</div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export default function CommunicationHistory({
  userId,
  bookingNumber,
}: {
  userId?: string;
  bookingNumber?: string;
}) {
  const [records, setRecords] = useState<Record_[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "sms" | "email">("all");

  /*
   * Subscribe-and-settle rather than an await in the effect body: the state is
   * only ever set from the promise callback, and a cancelled flag stops a slow
   * response from writing into a component the admin has already closed.
   */
  useEffect(() => {
    if (!userId && !bookingNumber) return undefined;
    let cancelled = false;
    const path = bookingNumber
      ? `/api/admin/communications/bookings/${encodeURIComponent(bookingNumber)}/history`
      : `/api/admin/communications/customers/${encodeURIComponent(String(userId))}/history`;

    API.get(path)
      .then(({ data }) => {
        if (cancelled) return;
        setRecords(data.records || []);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load communication history.");
        setRecords([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, bookingNumber]);

  const shown = (records || []).filter((r) => filter === "all" || r.channel === filter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="text-[14px] font-bold text-[#313234]">Communications</h4>
        {(["all", "sms", "email"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-semibold transition ${
              filter === f
                ? "bg-[#313234] text-white"
                : "border border-[#D7DEE9] bg-white text-[#313234] hover:bg-[#F7F9FF]"
            }`}
          >
            {f === "all" ? "All" : f.toUpperCase()}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-[8px] bg-[#FDECEA] p-2.5 text-[12px] font-semibold text-[#B4342B]">
          {error}
        </p>
      ) : records === null ? (
        <p className="text-[13px] text-[#6A6D71]">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-[8px] bg-[#F7F9FF] p-3 text-[13px] text-[#6A6D71]">
          Nothing has been sent{bookingNumber ? " for this booking" : ""} yet.
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <Row key={`${r.channel}-${r.id}`} record={r} />
          ))}
        </div>
      )}
    </div>
  );
}
