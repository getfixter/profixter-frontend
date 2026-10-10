"use client";

/**
 * The three growth agents: are they on, what did they last do, what did it
 * cost, and what did they find. Findings include the weekly owner report and
 * publish-ready content drafts. Running an agent now and closing a finding
 * are owner-only (here and on the server).
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getAgents,
  getFindings,
  runAgentNow,
  setFindingStatus,
  type AgentFindingView,
  type AgentsStatus,
} from "@/lib/admin-growth";

function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-[22px] border border-slate-200/70 bg-white p-5 md:p-6">{children}</section>;
}

const STATUS_TEXT: Record<string, string> = {
  succeeded: "Done",
  failed: "Failed",
  budget_stopped: "Stopped at budget",
  skipped: "Skipped",
  running: "Running",
};

const SKIP_TEXT: Record<string, string> = {
  agents_disabled: "agents are switched off",
  no_api_key: "no Claude API key configured",
  already_running: "another run was in progress",
};

const SEVERITY_TONE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-800",
  low: "bg-slate-100 text-slate-700",
  info: "bg-slate-100 text-slate-600",
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function ReportBody({ body }: { body: string }) {
  let sections: Array<{ heading: string; lines: string[] }> = [];
  try {
    sections = JSON.parse(body);
  } catch {
    return <p className="whitespace-pre-wrap text-[13px] text-slate-600">{body}</p>;
  }
  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div key={s.heading}>
          <div className="text-[13px] font-semibold text-slate-800">{s.heading}</div>
          <ul className="list-disc pl-5 text-[13px] text-slate-600">
            {s.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AgentsPanel({ owner }: { owner: boolean }) {
  const [status, setStatus] = useState<AgentsStatus | null>(null);
  const [findings, setFindings] = useState<AgentFindingView[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([getAgents(), getFindings("open")]);
      setStatus(s);
      setFindings(f);
    } catch {
      setError("Agent status could not load.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "That did not go through.");
    } finally {
      setBusy(null);
      load();
    }
  };

  if (!status) {
    return error ? <Card><p className="text-[14px] text-rose-700">{error}</p></Card> : null;
  }

  const report = findings.find((f) => f.kind === "report");
  const drafts = findings.filter((f) => f.kind === "content_draft");
  const others = findings.filter((f) => f.kind !== "report" && f.kind !== "content_draft");

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">Agents</h2>
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${status.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {status.enabled ? "Running on schedule" : status.keyConfigured ? "Off (AGENTS_ENABLED)" : "Waiting for the Claude API key"}
          </span>
        </div>
        <div className="mb-4 text-[13px] text-slate-600">
          Spent {money(status.spentTodayCents)} today (cap {money(status.dailyBudgetCents)}) and {money(status.spentThisMonthCents)} this month (cap{" "}
          {money(status.monthlyBudgetCents)}). <span className="text-slate-400">{status.costNote}</span>
          {status.secrets?.error ? <span className="block text-amber-700">Secret store: {status.secrets.error}</span> : null}
        </div>
        {error ? <p className="mb-3 text-[13px] text-rose-700">{error}</p> : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {status.agents.map((a) => {
            const last = a.runs[0];
            return (
              <div key={a.name} className="rounded-[16px] bg-slate-50 p-4">
                <div className="text-[15px] font-semibold text-slate-900">{a.label}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">{a.schedule}</div>
                <div className="mt-1 text-[12px] text-slate-600">
                  Last success: {a.lastSuccessAt ? when(a.lastSuccessAt) : "none yet"} · Next: {a.nextRunAt ? when(a.nextRunAt) : "-"}
                </div>
                <div className="mt-2 text-[12px] text-slate-600">
                  This month: {a.monthRuns} run{a.monthRuns === 1 ? "" : "s"}, {money(a.monthCostCents)} · up to {money(a.budgetCents)} a run
                </div>
                <div className="mt-2 text-[13px] text-slate-700">
                  {last ? (
                    <>
                      <span className="font-semibold">{STATUS_TEXT[last.status] || last.status}</span> {when(last.startedAt)}
                      {last.skipReason ? ` - ${SKIP_TEXT[last.skipReason] || last.skipReason}` : ""}
                      {last.status !== "skipped" ? ` · ${last.findings} finding(s), ${last.actions} proposal(s), ${money(last.costCents)}` : ""}
                      {last.summary ? <p className="mt-1 line-clamp-4 text-[12px] text-slate-500">{last.summary}</p> : null}
                      {last.error ? <p className="mt-1 text-[12px] text-rose-700">{last.error}</p> : null}
                    </>
                  ) : (
                    <span className="text-slate-500">No runs yet.</span>
                  )}
                </div>
                {owner && status.enabled ? (
                  <button
                    type="button"
                    disabled={busy === a.name}
                    onClick={() => act(a.name, () => runAgentNow(a.name, a.name === "growth_intelligence" ? "weekly" : "daily"))}
                    className="mt-3 h-8 rounded-[9px] bg-white px-3 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50"
                  >
                    Run now
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      {report ? (
        <Card>
          <h2 className="mb-1 text-[18px] font-bold text-slate-900">This week&rsquo;s report</h2>
          <p className="mb-3 text-[14px] text-slate-700">{report.title}</p>
          <ReportBody body={report.body} />
        </Card>
      ) : null}

      {others.length || drafts.length ? (
        <Card>
          <h2 className="mb-3 text-[18px] font-bold text-slate-900">Findings and drafts</h2>
          <ul className="divide-y divide-slate-100">
            {[...others, ...drafts].map((f) => (
              <li key={f.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button type="button" onClick={() => setOpen(open === f.id ? null : f.id)} className="min-w-0 text-left">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_TONE[f.severity] || SEVERITY_TONE.info}`}>
                      {f.kind === "content_draft" ? "Draft" : f.kind.replace("_", " ")}
                    </span>
                    <span className="text-[14px] font-semibold text-slate-900">{f.title}</span>
                    <span className="ml-2 text-[12px] text-slate-400">
                      {f.agent.replace("_", " ")} · {when(f.updatedAt)}
                      {f.seenCount > 1 ? ` · seen ${f.seenCount}×` : ""}
                    </span>
                  </button>
                  {owner ? (
                    <div className="flex gap-1.5">
                      <button type="button" disabled={busy === f.id} onClick={() => act(f.id, () => setFindingStatus(f.id, "acknowledged"))} className="h-7 rounded-[8px] bg-slate-900 px-2.5 text-[12px] font-semibold text-white disabled:opacity-50">
                        Got it
                      </button>
                      <button type="button" disabled={busy === f.id} onClick={() => act(f.id, () => setFindingStatus(f.id, "dismissed"))} className="h-7 rounded-[8px] bg-slate-100 px-2.5 text-[12px] font-semibold text-slate-700 disabled:opacity-50">
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
                {open === f.id ? (
                  <div className="mt-2 space-y-2 text-[13px] text-slate-600">
                    {f.target ? <div><span className="font-semibold">Target:</span> {f.target}</div> : null}
                    {f.detail ? <p className="whitespace-pre-wrap">{f.detail}</p> : null}
                    {f.expectedImpact ? <p><span className="font-semibold">Expected impact:</span> {f.expectedImpact}</p> : null}
                    {typeof f.evidence === "string" && f.evidence ? <p className="text-slate-500"><span className="font-semibold">Evidence:</span> {f.evidence}</p> : null}
                    {f.body && f.kind === "content_draft" ? (
                      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-slate-50 p-3 text-[12px] text-slate-700">{f.body}</pre>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
