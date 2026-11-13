"use client";

/**
 * Email campaign: compose, check, confirm, then watch it go out.
 *
 * SENDING (audit U-8 / X-03, backend BE-DOCS section C)
 * - One idempotency key per campaign attempt, created when the confirmation
 *   opens and reused by every retry of that same attempt. A request that timed
 *   out but reached the server therefore returns the campaign it already
 *   created instead of sending it twice. Editing the campaign makes a new key.
 * - The confirmation states the segment and the recipient count; the button
 *   repeats the verb. The button is busy (and ignores taps) until the server
 *   answers, and a ref guard stops a second request even from a double tap.
 * - The server answers within about 20 seconds; a large send carries on in
 *   the background. The progress view polls GET /api/admin/campaigns/:id while
 *   the page is visible, offers Resume when the server says rows are still
 *   pending and nobody holds the lease, and says plainly when nothing was sent.
 * - The campaign being watched is remembered for this browser tab, so leaving
 *   and coming back shows its progress again.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCampaignRecipients,
  getCampaignVariables,
  getSegmentCounts,
  previewCampaign,
  sendCampaignTest,
  type CampaignPreview,
  type CampaignRecipient,
  type CampaignRecipientsResponse,
  type CampaignRequest,
  type CampaignVariableGroup,
  type SegmentCounts,
} from "@/lib/admin-service";
import {
  arr,
  getCampaignProgress,
  listCampaigns,
  newIdempotencyKey,
  resumeCampaign,
  sendQueuedCampaign,
  str,
  type CampaignListItem,
  type CampaignProgress,
} from "@/lib/admin/sections-api";
import { errorMessage as queryError, useAdminQuery } from "@/lib/admin/query";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { Button, Chip, ConfirmSheet, EmptyState, Field, SearchField, Section, TextInput, Textarea, cx, useToast } from "@/app/components/admin/ui";

const SEGMENTS = [
  { id: "all", label: "All Customers" },
  { id: "subscribed", label: "Subscribed" },
  { id: "not_subscribed", label: "Not Subscribed" },
  { id: "basic", label: "Basic" },
  { id: "plus", label: "Plus" },
  { id: "premium", label: "Premium" },
  { id: "elite", label: "Elite" },
] as const;

const ADMIN_COPY_TO = "getfixter@gmail.com";
const ACTIVE_KEY = "pfa:campaign:active";
const POLL_MS = 3000;

const segmentLabel = (id: string) => SEGMENTS.find((s) => s.id === id)?.label ?? id;

function errorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  if (data?.message) return data.message;
  if ((error as { code?: string })?.code === "ECONNABORTED") return "The server did not answer in time. Your campaign may still be sending: press Send again to check. It will not be sent twice.";
  return error instanceof Error ? error.message : "Request failed";
}

function readActive(): string {
  try {
    return window.sessionStorage.getItem(ACTIVE_KEY) || "";
  } catch {
    return "";
  }
}
function writeActive(id: string) {
  try {
    if (id) window.sessionStorage.setItem(ACTIVE_KEY, id);
    else window.sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage blocked */
  }
}

/* ------------------------------------------------------------------ */
/* recent campaigns (GET /api/admin/campaigns)                         */
/* ------------------------------------------------------------------ */

/**
 * Campaigns started anywhere (another device, another admin), newest first,
 * so their progress can be opened from here and not only from the tab that
 * sent them.
 */
function RecentCampaigns({ onOpen }: { onOpen: (c: CampaignListItem) => Promise<void> }) {
  const q = useAdminQuery(["campaigns", "list"], (signal) => listCampaigns(1, signal), { staleTime: 30_000 });
  const [opening, setOpening] = useState("");
  const [openError, setOpenError] = useState("");
  const items = q.data?.items || [];
  return (
    <details className="rounded-adm-md border border-adm-line bg-adm-surface" data-recent-campaigns="">
      <summary className="flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2">
        <span className="text-[14px] font-semibold text-adm-ink">Recent campaigns{q.data ? ` · ${q.data.total}` : ""}</span>
        <span className="text-[13px] text-adm-text-2">Open one to see how its sending went, from any device.</span>
      </summary>
      <div className="border-t border-adm-line">
        {q.error && !q.data ? (
          <p className="px-4 py-3 text-[14px] text-adm-problem" role="alert">
            {queryError(q.error, "Recent campaigns could not be loaded.")}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void q.refetch()}>
              Retry
            </button>
          </p>
        ) : q.isLoading ? (
          <p className="px-4 py-3 text-[14px] text-adm-text-2">Loading…</p>
        ) : !items.length ? (
          <p className="px-4 py-3 text-[14px] text-adm-text-2">No campaigns yet.</p>
        ) : (
          <ul role="list">
            {items.map((c) => (
              <li key={c.id} className="border-b border-adm-line last:border-b-0">
                <button
                  type="button"
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-adm-bg disabled:opacity-60"
                  disabled={Boolean(opening)}
                  onClick={async () => {
                    setOpening(c.id);
                    setOpenError("");
                    try {
                      await onOpen(c);
                    } catch (error) {
                      setOpenError(queryError(error, "This campaign could not be opened."));
                    } finally {
                      setOpening("");
                    }
                  }}
                  data-campaign-row={c.campaignNumber || c.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-adm-ink">{c.subject || "(no subject)"}</span>
                    <span className="block truncate text-[13px] text-adm-text-2">
                      {[c.campaignNumber, segmentLabel(c.segment), c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "", c.createdBy].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex-none text-right text-[13px]">
                    <span className="block font-semibold text-adm-ink">{opening === c.id ? "Opening…" : STATUS_TEXT[c.status] || c.status}</span>
                    <span className="adm-num block text-adm-text-2">
                      {c.totals.sent}/{c.totals.total} sent{c.totals.failed ? ` · ${c.totals.failed} failed` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {openError && (
          <p className="px-4 py-2 text-[13px] text-adm-problem" role="alert">
            {openError}
          </p>
        )}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* progress                                                            */
/* ------------------------------------------------------------------ */

const STATUS_TEXT: Record<string, string> = {
  queued: "Queued",
  sending: "Sending",
  completed: "Sent",
  completed_with_errors: "Sent with failures",
  failed: "Failed",
};

function CampaignProgressView({ initial, onNew }: { initial: CampaignProgress; onNew: () => void }) {
  const [c, setC] = useState(initial);
  const [pollError, setPollError] = useState("");
  const [asking, setAsking] = useState(false);
  const [tick, setTick] = useState(0);
  const ref = c.id || c.campaignNumber;

  useEffect(() => {
    if (!ref || (c.finished && tick === 0)) return undefined;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(run, POLL_MS);
        return;
      }
      try {
        const next = await getCampaignProgress(ref, controller.signal);
        setC((prev) => ({ ...next, duplicate: prev.duplicate, code: prev.code, message: prev.message }));
        setPollError("");
        if (!next.finished) timer = setTimeout(run, POLL_MS);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPollError(errorMessage(err));
        timer = setTimeout(run, POLL_MS * 3);
      }
    };
    timer = setTimeout(run, c.finished ? 0 : POLL_MS);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
    // Re-arm only when the campaign changes state (resume) or on manual refresh.
     
  }, [ref, c.finished, tick]);

  const total = Math.max(c.total, c.sent + c.failed + c.pending);
  const done = c.sent + c.failed;
  const pct = total ? Math.round((done / total) * 100) : c.finished ? 100 : 0;
  const nothingSent = c.status === "failed" && !c.adminCopySent;
  const tone = nothingSent || c.status === "failed" ? "problem" : c.failed ? "attn" : c.finished ? "ok" : "info";

  return (
    <Section title="Campaign progress" action={c.campaignNumber ? <span className="adm-num text-[13px] text-adm-text-2">{c.campaignNumber}</span> : undefined}>
      <div className="space-y-4 p-4" data-campaign-progress data-status={c.status}>
        {c.duplicate || c.code === "CAMPAIGN_ALREADY_SENDING" ? (
          <p role="status" className="rounded-adm-sm bg-adm-info-bg px-3 py-2 text-[14px] text-adm-info" data-duplicate>
            {c.message || "This campaign was already created. Showing its progress; nothing was sent twice."}
          </p>
        ) : null}
        <div>
          <p className="text-[15px] font-semibold text-adm-ink">{c.subject || "Email campaign"}</p>
          <p className="text-[13px] text-adm-text-2">
            {segmentLabel(c.segment)}
            {c.actorName ? ` · started by ${c.actorName}` : ""}
          </p>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={cx(
                "text-[14px] font-semibold",
                tone === "problem" ? "text-adm-problem" : tone === "attn" ? "text-adm-attn" : tone === "ok" ? "text-adm-ok" : "text-adm-info"
              )}
              data-status-text
            >
              {STATUS_TEXT[c.status] || c.status}
            </span>
            <span className="adm-num text-[14px] text-adm-ink" data-progress-count>
              {c.sent} of {total} sent
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-adm-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Sending progress">
            <div className={cx("h-full transition-[width] motion-reduce:transition-none", tone === "problem" ? "bg-adm-problem" : "bg-adm-accent")} style={{ width: `${pct}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
            {(
              [
                ["Sent", c.sent],
                ["Failed", c.failed],
                ["Still to send", c.pending],
                ["Excluded", c.excluded],
              ] as Array<[string, number]>
            ).map(([label, value]) => (
              <div key={label} className="rounded-adm-sm bg-adm-sunk px-3 py-2">
                <dt className="text-adm-text-2">{label}</dt>
                <dd className="adm-num text-[17px] font-semibold text-adm-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[13px] text-adm-text-2">Admin copy: {c.adminCopySent ? "sent" : "not sent"}.</p>
        </div>

        {nothingSent ? (
          <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem" data-nothing-sent>
            Nothing was sent to customers: the admin copy could not be sent, so the campaign stopped before the first customer. Check the email settings, then send it again.
          </p>
        ) : c.status === "failed" ? (
          <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
            The campaign stopped. {c.sent} {c.sent === 1 ? "email was" : "emails were"} sent and none of them will be sent again.
            {c.canResume ? " You can resume the rest." : ""}
          </p>
        ) : !c.finished ? (
          <p className="text-[13px] text-adm-text-2">Sending continues on the server even if you close this page. Each person gets it once.</p>
        ) : null}

        {pollError ? (
          <p role="alert" className="flex flex-wrap items-center gap-2 rounded-adm-sm bg-adm-attn-bg px-3 py-2 text-[14px] text-adm-attn">
            Could not refresh progress: {pollError}
            <Button variant="tertiary" onClick={() => setTick((t) => t + 1)}>
              Retry
            </Button>
          </p>
        ) : null}

        {c.failures.length ? (
          <details className="rounded-adm-sm border border-adm-line">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[14px] font-semibold text-adm-ink">Failed addresses ({c.failures.length})</summary>
            <ul className="divide-y divide-adm-line">
              {c.failures.map((f, i) => (
                <li key={`${f.email}-${i}`} className="px-3 py-2 text-[13px]">
                  <span className="block break-all text-adm-ink">{f.email || "(no address)"}</span>
                  <span className="block break-words text-adm-problem">{f.error || "Failed"}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {c.canResume ? (
            <Button onClick={() => setAsking(true)} data-resume>
              Resume sending
            </Button>
          ) : null}
          {c.finished ? (
            <Button variant={c.canResume ? "secondary" : "primary"} onClick={onNew} data-new-campaign>
              New campaign
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setTick((t) => t + 1)}>
              Refresh
            </Button>
          )}
        </div>
      </div>
      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        title="Resume this campaign?"
        consequence={`The ${c.pending} ${c.pending === 1 ? "person who has" : "people who have"} not been emailed yet will get it now. Anyone already sent, failed or interrupted is never emailed again.`}
        confirmLabel={`Resume sending to ${c.pending}`}
        onConfirm={async () => {
          const next = await resumeCampaign(ref);
          setC(next);
          setTick((t) => t + 1);
        }}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* composer                                                            */
/* ------------------------------------------------------------------ */

export default function EmailComposer() {
  const toast = useToast();
  const [active, setActive] = useState<CampaignProgress | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [counts, setCounts] = useState<SegmentCounts | null>(null);
  const [segment, setSegment] = useState("not_subscribed");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("View Plans");
  const [ctaUrl, setCtaUrl] = useState("https://profixter.com/subscription");
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [busy, setBusy] = useState<"preview" | "test" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "problem"; text: string } | null>(null);
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [variableGroups, setVariableGroups] = useState<CampaignVariableGroup[]>([]);
  const [recipients, setRecipients] = useState<CampaignRecipientsResponse | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const keyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const sendingRef = useRef(false);

  const excludedUserIdList = useMemo(() => Array.from(excludedUserIds), [excludedUserIds]);
  const segmentCount = counts ? Number(counts[segment as keyof SegmentCounts]) || 0 : 0;
  const selectedCount = recipients?.includedCount ?? segmentCount;
  const excludedCount = recipients?.excludedCount ?? Math.max(0, segmentCount - selectedCount);
  const payload = useMemo<CampaignRequest>(
    () => ({ segment, subject, body, ctaText, ctaUrl, excludedUserIds: excludedUserIdList }),
    [body, ctaText, ctaUrl, excludedUserIdList, segment, subject]
  );
  const fingerprint = JSON.stringify(payload);

  /* A campaign this tab was watching: show its progress again. */
  useEffect(() => {
    const id = readActive();
    if (!id) {
       
      setRestoring(false);
      return;
    }
    getCampaignProgress(id)
      .then((c) => setActive(c))
      .catch(() => writeActive(""))
      .finally(() => setRestoring(false));
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      setLoadingCounts(true);
      setCounts(await getSegmentCounts());
    } catch (error) {
      setNotice({ tone: "problem", text: errorMessage(error) });
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
     
    void loadCounts();
    void getCampaignVariables()
      .then((groups) => setVariableGroups(arr<CampaignVariableGroup>(groups)))
      .catch((error) => setNotice({ tone: "problem", text: errorMessage(error) }));
  }, [loadCounts]);

  useEffect(() => {
    let cancelled = false;
     
    setLoadingRecipients(true);
    getCampaignRecipients(segment, excludedUserIdList)
      .then((next) => !cancelled && setRecipients(next))
      .catch((error) => !cancelled && setNotice({ tone: "problem", text: errorMessage(error) }))
      .finally(() => !cancelled && setLoadingRecipients(false));
    return () => {
      cancelled = true;
    };
  }, [excludedUserIdList, segment]);

  const allRecipients = useMemo(() => [...arr<CampaignRecipient>(recipients?.recipients), ...arr<CampaignRecipient>(recipients?.excludedRecipients)], [recipients]);
  const visibleRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return allRecipients;
    return allRecipients.filter((r) =>
      [r.name, r.email, r.userId, arr(r.plans).join(", "), arr(r.subscriptionStatuses).join(", ")].some((v) => str(v).toLowerCase().includes(q))
    );
  }, [allRecipients, recipientSearch]);

  const validate = () => {
    if (!subject.trim() || !body.trim()) {
      setNotice({ tone: "problem", text: "Subject and message are required." });
      return false;
    }
    return true;
  };

  const handlePreview = async () => {
    if (!validate()) return;
    try {
      setBusy("preview");
      setNotice(null);
      setPreview(await previewCampaign(payload));
    } catch (error) {
      setNotice({ tone: "problem", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    if (!validate()) return;
    try {
      setBusy("test");
      const result = await sendCampaignTest(payload);
      setNotice({
        tone: "ok",
        text: `Test sent only to ${result.recipient}. Estimated audience: ${result.estimatedRecipientCount}; excluded ${result.excludedRecipientCount || 0}.`,
      });
    } catch (error) {
      setNotice({ tone: "problem", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const askToSend = () => {
    if (!validate()) return;
    // Same content as the last attempt: keep its key, so a retry can never send twice.
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) keyRef.current = { key: newIdempotencyKey("campaign"), fingerprint };
    setConfirming(true);
  };

  const send = async () => {
    if (sendingRef.current || !keyRef.current) return;
    sendingRef.current = true;
    try {
      const result = await sendQueuedCampaign(payload, keyRef.current.key);
      writeActive(result.id || result.campaignNumber);
      setActive(result);
      setNotice(null);
      toast.show(result.duplicate ? "Already sent; showing its progress" : result.finished ? "Campaign sent" : "Campaign is sending");
      void loadCounts();
    } finally {
      sendingRef.current = false;
    }
  };

  const startNew = () => {
    writeActive("");
    setActive(null);
    keyRef.current = null;
    setSubject("");
    setBody("");
    setPreview(null);
    setExcludedUserIds(new Set());
  };

  if (restoring) return <p className="text-[14px] text-adm-text-2">Loading…</p>;
  if (active) return <CampaignProgressView key={active.id || active.campaignNumber} initial={active} onNew={startNew} />;

  const canSend = !!counts && !loadingRecipients && selectedCount > 0;

  return (
    <div className="space-y-4" data-campaign-composer>
      <RecentCampaigns
        onOpen={async (c) => {
          const progress = await getCampaignProgress(c.id);
          writeActive(progress.id || progress.campaignNumber || c.id);
          setActive(progress);
        }}
      />
      <p className="text-[14px] text-adm-text-2">Audiences use current subscription access, account status, blacklist and email suppression records.</p>

      <details className="rounded-adm-md border border-adm-line bg-adm-surface">
        <summary className="flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2">
          <span className="text-[14px] font-semibold text-adm-ink">Variables and help</span>
          <span className="text-[13px] text-adm-text-2">Personalize the subject, message, button text and button URL.</span>
        </summary>
        <div className="border-t border-adm-line px-4 py-3">
          <p className="mb-3 text-[14px] text-adm-text-2">Copy a variable and paste it where the customer value should appear. Missing and unknown values become blank and never stop a campaign.</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {variableGroups.map((group) => (
              <div key={group.id} className="rounded-adm-sm border border-adm-line p-3">
                <h3 className="mb-1 text-[13px] font-semibold text-adm-text-2">{group.label}</h3>
                <ul className="divide-y divide-adm-line">
                  {arr<{ key: string; tag: string; description: string }>(group.variables).map((v) => (
                    <li key={v.key} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <code className="break-all text-[13px] font-semibold text-adm-accent-ink">{v.tag}</code>
                        <span className="mt-0.5 block text-[13px] text-adm-text-2">{v.description}</span>
                      </span>
                      <Button variant="secondary" onClick={() => writeToClipboard(v.tag).then((ok) => toast.show(ok ? `Copied ${v.tag}` : "Could not copy"))}>
                        Copy
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </details>

      <Section
        title="Audience"
        action={
          <Button variant="tertiary" onClick={loadCounts} disabled={loadingCounts}>
            {loadingCounts ? "Refreshing…" : "Refresh counts"}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2 p-3" role="group" aria-label="Segment">
          {SEGMENTS.map((item) => (
            <Chip
              key={item.id}
              selected={segment === item.id}
              count={counts ? Number(counts[item.id]) || 0 : undefined}
              onClick={() => {
                setSegment(item.id);
                setExcludedUserIds(new Set());
                setRecipientSearch("");
              }}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Recipients" count={selectedCount}>
        <div className="space-y-3 p-3">
          <p className="text-[13px] text-adm-text-2" data-recipient-summary>
            {loadingRecipients ? "Loading recipients…" : `${selectedCount} included · ${excludedCount} excluded`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <SearchField label="Search recipients" placeholder="Search name or email" value={recipientSearch} onChange={setRecipientSearch} className="min-w-0 flex-1" />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setExcludedUserIds(new Set())} disabled={!excludedUserIds.size}>
                Include all
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setExcludedUserIds((current) => {
                    const next = new Set(current);
                    for (const r of visibleRecipients) next.add(r.id);
                    return next;
                  })
                }
                disabled={!visibleRecipients.length}
              >
                Exclude visible
              </Button>
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto rounded-adm-sm border border-adm-line">
            {loadingRecipients && !recipients ? (
              <p className="px-4 py-5 text-center text-[14px] text-adm-text-2">Loading recipient list…</p>
            ) : !visibleRecipients.length ? (
              <EmptyState message="No recipients match this search." />
            ) : (
              <ul role="list" className="divide-y divide-adm-line">
                {visibleRecipients.map((r) => {
                  const included = !excludedUserIds.has(r.id);
                  const plans = arr(r.plans);
                  const statuses = arr(r.subscriptionStatuses);
                  return (
                    <li key={r.id}>
                      <label className={cx("flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2.5", !included && "bg-adm-problem-bg")}>
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() =>
                            setExcludedUserIds((current) => {
                              const next = new Set(current);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                          className="mt-0.5 h-5 w-5 accent-adm-accent"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-adm-ink">{r.name || "Unnamed customer"}</span>
                          <span className="block break-all text-[13px] text-adm-text-2">{r.email}</span>
                          <span className="block text-[12px] text-adm-text-3">
                            {plans.length ? plans.join(", ") : "not subscribed"} · {statuses.length ? statuses.join(", ") : "no active plan"}
                          </span>
                        </span>
                        <span className={cx("shrink-0 text-[12px] font-semibold", included ? "text-adm-ok" : "text-adm-problem")}>{included ? "Included" : "Excluded"}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section title="Message">
        <div className="grid gap-4 p-4">
          <Field label="Subject">
            <TextInput value={subject} maxLength={180} onChange={(e) => setSubject(e.target.value)} placeholder="A clear, useful subject" />
          </Field>
          <Field label="Message">
            <Textarea
              value={body}
              maxLength={30000}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Example: Hello {{firstName}}, thank you for being a {{planName}} member."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field label="Button text">
              <TextInput value={ctaText} maxLength={80} onChange={(e) => setCtaText(e.target.value)} />
            </Field>
            <Field label="Button URL">
              <TextInput type="url" inputMode="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://profixter.com/..." />
            </Field>
          </div>
          <div className="flex flex-col gap-2 border-t border-adm-line pt-4 sm:flex-row">
            <Button variant="secondary" onClick={handlePreview} busy={busy === "preview"} disabled={busy !== null}>
              Preview
            </Button>
            <Button variant="secondary" onClick={handleTest} busy={busy === "test"} disabled={busy !== null}>
              Send test to admin only
            </Button>
            <Button onClick={askToSend} disabled={busy !== null || !canSend} className="sm:ml-auto" data-send-campaign>
              {`Send to ${selectedCount} recipient${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </div>
          {notice ? (
            <p role={notice.tone === "problem" ? "alert" : "status"} className={cx("rounded-adm-sm px-3 py-2 text-[14px]", notice.tone === "ok" ? "bg-adm-ok-bg text-adm-ok" : "bg-adm-problem-bg text-adm-problem")}>
              {notice.text}
            </p>
          ) : null}
        </div>
      </Section>

      {preview ? (
        <Section
          title="Customer preview"
          action={
            <Button variant="tertiary" onClick={() => setPreview(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3 p-4">
            <p className="text-[13px] text-adm-text-2">Representative rendering · {preview.recipientCount} recipients</p>
            <div className="grid gap-x-6 gap-y-1 rounded-adm-sm bg-adm-sunk p-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(preview.sampleValues || {}).map(([key, value]) => (
                <div key={key} className="min-w-0 break-words">
                  <span className="text-adm-text-2">{`{{${key}}}`}</span> <span className="font-medium text-adm-ink">{value || "(blank)"}</span>
                </div>
              ))}
            </div>
            <iframe title="Campaign email preview" srcDoc={preview.html} sandbox="" className="h-[640px] w-full rounded-adm-sm border border-adm-line bg-adm-surface" />
          </div>
        </Section>
      ) : null}

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send this campaign?"
        consequence={
          <>
            <span data-confirm-count>
              {selectedCount} {selectedCount === 1 ? "person" : "people"} in <strong>{segmentLabel(segment)}</strong>
            </span>{" "}
            will get “{subject.trim()}”. {excludedCount} excluded. An admin copy goes to {ADMIN_COPY_TO} first; if it fails, no customer is emailed.
          </>
        }
        confirmLabel={`Send to ${selectedCount} ${selectedCount === 1 ? "person" : "people"}`}
        onConfirm={send}
        errorText={errorMessage}
      >
        <p className="text-[13px] text-adm-text-2">Large campaigns keep sending in the background. Pressing Send again never sends it twice.</p>
      </ConfirmSheet>
    </div>
  );
}
