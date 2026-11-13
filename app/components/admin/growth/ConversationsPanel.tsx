"use client";

/**
 * Homeowners who wrote to Profixter by text or email, as the reply responder
 * sees them: escalations first (a person should answer), then replies waiting
 * for approval (approve them under "Needs you"), then the rest. Replies only
 * explain and link to the website - nothing here books a visit.
 */

import { useEffect, useState } from "react";
import { getConversations, type ConversationView } from "@/lib/admin-growth";

const STATUS: Record<ConversationView["status"], { text: string; cls: string }> = {
  escalated: { text: "Needs a person", cls: "bg-adm-problem-bg text-adm-problem" },
  reply_proposed: { text: "Reply waiting for approval", cls: "bg-adm-attn-bg text-adm-attn" },
  needs_reply: { text: "Not answered yet", cls: "bg-adm-attn-bg text-adm-attn" },
  replied: { text: "Answered", cls: "bg-adm-ok-bg text-adm-ok" },
  closed: { text: "No reply needed", cls: "bg-adm-sunk text-adm-text-3" },
  opted_out: { text: "Opted out", cls: "bg-adm-sunk text-adm-text-3" },
};

function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export default function ConversationsPanel() {
  const [data, setData] = useState<{ threads: ConversationView[]; enabled: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getConversations()
      .then((next) => alive && setData(next))
      .catch(() => alive && setError("Conversations could not load."));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-adm-lg border border-adm-line bg-adm-surface p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-adm-ink md:text-[20px]">Conversations</h2>
        {data ? (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${data.enabled ? "bg-adm-ok-bg text-adm-ok" : "bg-adm-sunk text-adm-text-2"}`}>
            {data.enabled ? "Reading replies" : "Off - not reading or answering yet"}
          </span>
        ) : null}
      </div>
      {error ? <div className="mb-3 rounded-adm-md bg-adm-problem-bg px-3 py-2 text-[13px] text-adm-problem">{error}</div> : null}
      {!data ? (
        <div className="h-20 animate-pulse rounded-adm-md bg-adm-sunk" />
      ) : data.threads.length === 0 ? (
        <p className="text-[14px] text-adm-text-3">No conversations yet.</p>
      ) : (
        <ul className="divide-y divide-adm-line">
          {data.threads.map((t) => (
            <li key={t.id} className="py-3">
              <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                <span className="min-w-0">
                  <span className="text-[15px] font-semibold text-adm-ink">
                    {t.firstName || "Homeowner"}
                    {t.town ? `, ${t.town}` : ""}
                  </span>
                  <span className="ml-2 text-[13px] text-adm-text-3">
                    {t.summary || t.intent || ""} · {when(t.lastInboundAt)}
                  </span>
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].text}</span>
              </button>
              {t.escalationReason ? <p className="mt-1 text-[13px] text-adm-problem">{t.escalationReason}</p> : null}
              {open === t.id ? (
                <div className="mt-3 space-y-2">
                  {t.messages.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-[85%] whitespace-pre-wrap rounded-adm-md px-3 py-2 text-[13px] ${
                        m.direction === "inbound" ? "bg-adm-sunk text-adm-ink" : "ml-auto bg-adm-info-bg text-adm-accent-ink"
                      }`}
                    >
                      {m.body}
                      <div className="mt-1 text-[12px] opacity-60">
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
