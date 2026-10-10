"use client";

/**
 * Homeowners who wrote to Profixter by text or email, as the reply responder
 * sees them: escalations first (a person should answer), then replies waiting
 * for approval (approve them under "Needs you"), then the rest. Replies only
 * explain and link to the website - nothing here books a visit.
 */

import { useCallback, useEffect, useState } from "react";
import { getConversations, type ConversationView } from "@/lib/admin-growth";

const STATUS: Record<ConversationView["status"], { text: string; cls: string }> = {
  escalated: { text: "Needs a person", cls: "bg-rose-50 text-rose-700" },
  reply_proposed: { text: "Reply waiting for approval", cls: "bg-amber-50 text-amber-800" },
  needs_reply: { text: "Not answered yet", cls: "bg-amber-50 text-amber-800" },
  replied: { text: "Answered", cls: "bg-emerald-50 text-emerald-700" },
  closed: { text: "No reply needed", cls: "bg-slate-100 text-slate-500" },
  opted_out: { text: "Opted out", cls: "bg-slate-100 text-slate-500" },
};

function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export default function ConversationsPanel() {
  const [data, setData] = useState<{ threads: ConversationView[]; enabled: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getConversations());
    } catch {
      setError("Conversations could not load.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-[22px] border border-slate-200/70 bg-white p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">Conversations</h2>
        {data ? (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${data.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
            {data.enabled ? "Reading replies" : "Off - not reading or answering yet"}
          </span>
        ) : null}
      </div>
      {error ? <div className="mb-3 rounded-[12px] bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</div> : null}
      {!data ? (
        <div className="h-20 animate-pulse rounded-[14px] bg-slate-100" />
      ) : data.threads.length === 0 ? (
        <p className="text-[14px] text-slate-500">No conversations yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.threads.map((t) => (
            <li key={t.id} className="py-3">
              <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                <span className="min-w-0">
                  <span className="text-[15px] font-semibold text-slate-900">
                    {t.firstName || "Homeowner"}
                    {t.town ? `, ${t.town}` : ""}
                  </span>
                  <span className="ml-2 text-[13px] text-slate-500">
                    {t.summary || t.intent || ""} · {when(t.lastInboundAt)}
                  </span>
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].text}</span>
              </button>
              {t.escalationReason ? <p className="mt-1 text-[13px] text-rose-700">{t.escalationReason}</p> : null}
              {open === t.id ? (
                <div className="mt-3 space-y-2">
                  {t.messages.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-[85%] whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[13px] ${
                        m.direction === "inbound" ? "bg-slate-100 text-slate-800" : "ml-auto bg-blue-50 text-blue-900"
                      }`}
                    >
                      {m.body}
                      <div className="mt-1 text-[11px] opacity-60">
                        {m.direction === "inbound" ? "homeowner" : m.by} · {when(m.at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
