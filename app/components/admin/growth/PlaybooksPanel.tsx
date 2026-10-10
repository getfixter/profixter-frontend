"use client";

/**
 * Follow-up emails written by the agents. The owner reads one in full, exactly
 * as a customer would receive it, and approves the wording once; from then on
 * the growth engine sends it under its trust level (watch-only first, so the
 * audience can be checked). Approve and Retire are owner-only, here and on the
 * server. Nothing here can offer a discount: the server refuses such copy.
 */

import { useCallback, useEffect, useState } from "react";
import { decidePlaybook, getPlaybookPreview, getPlaybooks, type PlaybookView } from "@/lib/admin-growth";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-700",
  retired: "bg-slate-100 text-slate-500",
};

const SEND_LABEL: Record<string, string> = {
  shadow: "would send",
  awaiting_approval: "waiting for you",
  succeeded: "sent",
  skipped: "not sent",
  failed: "failed",
};

export default function PlaybooksPanel({ owner }: { owner: boolean }) {
  const [rows, setRows] = useState<PlaybookView[] | null>(null);
  const [preview, setPreview] = useState<{ key: string; subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getPlaybooks());
    } catch {
      setError("Playbooks could not load.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const open = async (key: string) => {
    if (preview?.key === key) return setPreview(null);
    try {
      setPreview({ key, ...(await getPlaybookPreview(key)) });
    } catch {
      setError("The preview could not load.");
    }
  };

  const decide = async (key: string, decision: "approve" | "retire") => {
    setBusy(key);
    try {
      await decidePlaybook(key, decision);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "That did not go through.");
    } finally {
      setBusy(null);
      load();
    }
  };

  if (!rows) return null;

  return (
    <section className="rounded-[22px] border border-slate-200/70 bg-white p-5 md:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">Follow-up emails</h2>
        <span className="text-[12px] text-slate-400">Written by the agents · approved by you · sent one person at a time</span>
      </div>
      <p className="mb-4 text-[13px] text-slate-500">
        Approving a playbook approves its wording. Sending still follows the &ldquo;Approved follow-up email&rdquo; automation&rsquo;s trust level below, starting
        with watch-only so you can see exactly who would receive it.
      </p>
      {error ? <p className="mb-3 text-[13px] text-rose-700">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-[14px] text-slate-500">No playbooks yet. The Conversion &amp; Customer Growth agent drafts them on its Monday and Thursday runs.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((p) => (
            <li key={p.key} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" onClick={() => open(p.key)} className="min-w-0 text-left">
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status]}`}>
                    {p.status === "approved" && p.approvedVersion !== p.version ? "changed - needs approval" : p.status}
                  </span>
                  <span className="text-[14px] font-semibold text-slate-900">{p.name}</span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    To: {p.segmentLabel} · Subject: &ldquo;{p.subject}&rdquo; · v{p.version}
                  </span>
                  {Object.keys(p.sends || {}).length ? (
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      {Object.entries(p.sends)
                        .map(([k, v]) => `${v} ${SEND_LABEL[k] || k}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </button>
                {owner && p.status !== "retired" ? (
                  <div className="flex gap-1.5">
                    {p.status !== "approved" || p.approvedVersion !== p.version ? (
                      <button
                        type="button"
                        disabled={busy === p.key || p.copyProblems.length > 0}
                        onClick={() => decide(p.key, "approve")}
                        className="h-8 rounded-[9px] bg-slate-900 px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                      >
                        Approve wording
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === p.key}
                      onClick={() => decide(p.key, "retire")}
                      className="h-8 rounded-[9px] bg-slate-100 px-3 text-[12px] font-semibold text-slate-700 disabled:opacity-40"
                    >
                      Retire
                    </button>
                  </div>
                ) : null}
              </div>
              {preview?.key === p.key ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[13px] text-slate-600">
                    <span className="font-semibold">Why:</span> {p.purpose}
                    <br />
                    <span className="font-semibold">Measured by:</span> {p.measure}
                  </p>
                  {p.copyProblems.length ? <p className="text-[13px] text-rose-700">Cannot be approved: {p.copyProblems.join(" ")}</p> : null}
                  <iframe
                    title={`Preview: ${p.name}`}
                    sandbox=""
                    srcDoc={preview.html}
                    className="h-[520px] w-full rounded-[12px] border border-slate-200 bg-white"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
