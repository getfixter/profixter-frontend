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
  draft: "bg-adm-attn-bg text-adm-attn",
  approved: "bg-adm-ok-bg text-adm-ok",
  retired: "bg-adm-sunk text-adm-text-3",
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
    <section className="rounded-adm-lg border border-adm-line bg-adm-surface p-5 md:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-adm-ink md:text-[20px]">Follow-up emails</h2>
        <span className="text-[12px] text-adm-text-3">Written by the agents · approved by you · sent one person at a time</span>
      </div>
      <p className="mb-4 text-[13px] text-adm-text-3">
        Approving a playbook approves its wording. Sending then follows the &ldquo;Approved follow-up email&rdquo; automation and the
        trust level shown for it below.
      </p>
      {error ? <p className="mb-3 text-[13px] text-adm-problem">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-[14px] text-adm-text-3">No playbooks yet. The Conversion &amp; Customer Growth agent drafts them on its scheduled runs.</p>
      ) : (
        <ul className="divide-y divide-adm-line">
          {rows.map((p) => (
            <li key={p.key} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" onClick={() => open(p.key)} className="min-w-0 text-left">
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[12px] font-semibold ${STATUS_STYLE[p.status]}`}>
                    {p.status === "approved" && p.approvedVersion !== p.version ? "changed - needs approval" : p.status}
                  </span>
                  <span className="text-[14px] font-semibold text-adm-ink">{p.name}</span>
                  <span className="mt-0.5 block text-[12px] text-adm-text-3">
                    To: {p.segmentLabel} · Subject: &ldquo;{p.subject}&rdquo; · v{p.version}
                  </span>
                  {Object.keys(p.sends || {}).length ? (
                    <span className="mt-0.5 block text-[12px] text-adm-text-3">
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
                        className="min-h-[44px] rounded-adm-sm bg-adm-ink px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                      >
                        Approve wording
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === p.key}
                      onClick={() => decide(p.key, "retire")}
                      className="min-h-[44px] rounded-adm-sm bg-adm-sunk px-3 text-[12px] font-semibold text-adm-text-2 disabled:opacity-40"
                    >
                      Retire
                    </button>
                  </div>
                ) : null}
              </div>
              {preview?.key === p.key ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[13px] text-adm-text-2">
                    <span className="font-semibold">Why:</span> {p.purpose}
                    <br />
                    <span className="font-semibold">Measured by:</span> {p.measure}
                  </p>
                  {p.copyProblems.length ? <p className="text-[13px] text-adm-problem">Cannot be approved: {p.copyProblems.join(" ")}</p> : null}
                  <iframe
                    title={`Preview: ${p.name}`}
                    sandbox=""
                    srcDoc={preview.html}
                    className="h-[520px] w-full rounded-adm-md border border-adm-line bg-adm-surface"
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
