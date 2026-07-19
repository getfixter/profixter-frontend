'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  getCampaignRecipients,
  getCampaignVariables,
  getSegmentCounts,
  previewCampaign,
  sendCampaign,
  sendCampaignTest,
} from '@/lib/admin-service';
import EmailHistory from './EmailHistory';
import type {
  CampaignPreview,
  CampaignRecipient,
  CampaignRequest,
  CampaignRecipientsResponse,
  CampaignVariableGroup,
  SegmentCounts,
} from '@/lib/admin-service';

const SEGMENTS = [
  { id: 'all', label: 'All Customers' },
  { id: 'subscribed', label: 'Subscribed' },
  { id: 'not_subscribed', label: 'Not Subscribed' },
  { id: 'basic', label: 'Basic' },
  { id: 'plus', label: 'Plus' },
  { id: 'premium', label: 'Premium' },
  { id: 'elite', label: 'Elite' },
] as const;

function errorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Request failed';
}

export default function EmailComposer() {
  const [section, setSection] = useState<'compose' | 'history'>('compose');
  const [counts, setCounts] = useState<SegmentCounts | null>(null);
  const [segment, setSegment] = useState('not_subscribed');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ctaText, setCtaText] = useState('View Plans');
  const [ctaUrl, setCtaUrl] = useState('https://profixter.com/subscription');
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'test' | 'send' | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'success' | 'error' | 'info'>('info');
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [variableGroups, setVariableGroups] = useState<CampaignVariableGroup[]>([]);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [copiedTag, setCopiedTag] = useState('');
  const [recipients, setRecipients] = useState<CampaignRecipientsResponse | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(new Set());

  const excludedUserIdList = useMemo(() => Array.from(excludedUserIds), [excludedUserIds]);
  const selectedCount =
    recipients?.includedCount ?? counts?.[segment as keyof SegmentCounts] ?? 0;
  const excludedCount =
    recipients?.excludedCount ??
    Math.max(0, (counts?.[segment as keyof SegmentCounts] ?? 0) - selectedCount);
  const payload = useMemo<CampaignRequest>(
    () => ({
      segment,
      subject,
      body,
      ctaText,
      ctaUrl,
      excludedUserIds: excludedUserIdList,
    }),
    [body, ctaText, ctaUrl, excludedUserIdList, segment, subject]
  );

  const allDisplayedRecipients = useMemo(
    () => [
      ...(recipients?.recipients || []),
      ...(recipients?.excludedRecipients || []),
    ],
    [recipients]
  );

  const visibleRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    const list = allDisplayedRecipients;
    if (!query) return list;
    return list.filter((recipient) =>
      [
        recipient.name,
        recipient.email,
        recipient.userId,
        recipient.plans.join(', '),
        recipient.subscriptionStatuses.join(', '),
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(query))
    );
  }, [allDisplayedRecipients, recipientSearch]);

  async function loadCounts() {
    try {
      setLoadingCounts(true);
      setCounts(await getSegmentCounts());
    } catch (error) {
      setNoticeType('error');
      setNotice(errorMessage(error));
    } finally {
      setLoadingCounts(false);
    }
  }

  useEffect(() => {
    void loadCounts();
    void getCampaignVariables()
      .then(setVariableGroups)
      .catch((error) => {
        setNoticeType('error');
        setNotice(errorMessage(error));
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRecipients() {
      try {
        setLoadingRecipients(true);
        setRecipients(
          await getCampaignRecipients(segment, excludedUserIdList)
        );
      } catch (error) {
        if (!cancelled) {
          setNoticeType('error');
          setNotice(errorMessage(error));
        }
      } finally {
        if (!cancelled) setLoadingRecipients(false);
      }
    }
    void loadRecipients();
    return () => {
      cancelled = true;
    };
  }, [excludedUserIdList, segment]);

  async function copyVariable(tag: string) {
    try {
      await navigator.clipboard.writeText(tag);
    } catch {
      const input = document.createElement('textarea');
      input.value = tag;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopiedTag(tag);
    window.setTimeout(() => setCopiedTag(''), 1400);
  }

  function validate() {
    if (!subject.trim() || !body.trim()) {
      setNoticeType('error');
      setNotice('Subject and message are required.');
      return false;
    }
    return true;
  }

  async function handlePreview() {
    if (!validate()) return;
    try {
      setBusy('preview');
      setNotice('');
      setPreview(await previewCampaign(payload));
    } catch (error) {
      setNoticeType('error');
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    if (!validate()) return;
    try {
      setBusy('test');
      const result = await sendCampaignTest(payload);
      setNoticeType('success');
      setNotice(
        `Test sent only to ${result.recipient}. Estimated audience: ${result.estimatedRecipientCount}; excluded ${result.excludedRecipientCount || 0}.`
      );
    } catch (error) {
      setNoticeType('error');
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!validate()) return;
    const confirmed = window.confirm(
      `Send this campaign to ${selectedCount} ${SEGMENTS.find((item) => item.id === segment)?.label ?? segment} recipient(s)? ${excludedCount} excluded. An admin copy will also be sent to getfixter@gmail.com.`
    );
    if (!confirmed) return;

    try {
      setBusy('send');
      const result = await sendCampaign(payload);
      setNoticeType(result.failed || !result.adminCopySent ? 'error' : 'success');
      setNotice(
        `${result.campaignId}: sent ${result.sent}/${result.total}; failed ${result.failed}; admin copy ${
          result.adminCopySent ? 'sent' : 'failed'
        }; excluded ${result.excluded || result.skipped || 0}.`
      );
      await loadCounts();
    } catch (error) {
      setNoticeType('error');
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function toggleRecipient(recipient: CampaignRecipient) {
    setExcludedUserIds((current) => {
      const next = new Set(current);
      if (next.has(recipient.id)) next.delete(recipient.id);
      else next.add(recipient.id);
      return next;
    });
  }

  function includeAll() {
    setExcludedUserIds(new Set());
  }

  function excludeVisible() {
    setExcludedUserIds((current) => {
      const next = new Set(current);
      for (const recipient of visibleRecipients) next.add(recipient.id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row">
        {[
          ['compose', 'Compose Campaign'],
          ['history', 'Email History'],
        ].map(([id, label]) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id as 'compose' | 'history')}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                active
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {section === 'history' ? (
        <EmailHistory />
      ) : (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Customer communications
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Email campaign</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-300">
          Audiences use current subscription access, account status, blacklist,
          and email suppression records.
        </p>
      </header>

      <div className="space-y-6 p-4 md:p-7">
        <div className="rounded-xl border border-blue-200 bg-blue-50">
          <button
            type="button"
            onClick={() => setVariablesOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={variablesOpen}
          >
            <span>
              <span className="block text-sm font-semibold text-blue-950">
                Variables and help
              </span>
              <span className="block text-xs text-blue-700">
                Personalize the subject, message, button text, and button URL.
              </span>
            </span>
            <span className="text-sm font-semibold text-blue-800">
              {variablesOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {variablesOpen && (
            <div className="border-t border-blue-200 px-4 py-4">
              <p className="mb-4 text-sm leading-6 text-slate-700">
                Copy a variable and paste it wherever you want the customer value
                to appear. Missing and unknown values become blank and never stop
                a campaign.
              </p>
              <div className="grid gap-4 lg:grid-cols-3">
                {variableGroups.map((group) => (
                  <section
                    key={group.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {group.label}
                    </h3>
                    <div className="divide-y divide-slate-100">
                      {group.variables.map((variable) => (
                        <div
                          key={variable.key}
                          className="flex items-start justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <code className="break-all text-sm font-semibold text-blue-700">
                              {variable.tag}
                            </code>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {variable.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyVariable(variable.tag)}
                            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {copiedTag === variable.tag ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-slate-900">Audience</label>
            <button
              type="button"
              onClick={() => void loadCounts()}
              disabled={loadingCounts || busy !== null}
              className="text-sm font-semibold text-blue-700 disabled:opacity-50"
            >
              {loadingCounts ? 'Refreshing…' : 'Refresh counts'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {SEGMENTS.map((item) => {
              const active = segment === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSegment(item.id);
                    setExcludedUserIds(new Set());
                    setRecipientSearch('');
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <span className="block text-xs font-medium text-slate-500">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xl font-semibold text-slate-950">
                    {counts ? counts[item.id] : '-'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-950">Recipients included</h3>
              <p className="mt-1 text-xs text-slate-500">
                {loadingRecipients
                  ? 'Loading recipients...'
                  : `${selectedCount} included · ${excludedCount} excluded`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search name or email"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={includeAll}
                disabled={!excludedUserIds.size}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Include all
              </button>
              <button
                type="button"
                onClick={excludeVisible}
                disabled={!visibleRecipients.length}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Exclude visible
              </button>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-3">
            {loadingRecipients && !recipients ? (
              <div className="rounded-xl bg-white px-4 py-5 text-center text-sm text-slate-500">
                Loading recipient list...
              </div>
            ) : visibleRecipients.length === 0 ? (
              <div className="rounded-xl bg-white px-4 py-5 text-center text-sm text-slate-500">
                No recipients match this search.
              </div>
            ) : (
              <div className="grid gap-2">
                {visibleRecipients.map((recipient) => {
                  const included = !excludedUserIds.has(recipient.id);
                  const planText = recipient.plans.length
                    ? recipient.plans.join(', ')
                    : 'not subscribed';
                  const statusText = recipient.subscriptionStatuses.length
                    ? recipient.subscriptionStatuses.join(', ')
                    : 'no active plan';
                  return (
                    <label
                      key={recipient.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition ${
                        included
                          ? 'border-slate-200 hover:border-blue-300'
                          : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggleRecipient(recipient)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-950">
                          {recipient.name || 'Unnamed customer'}
                        </span>
                        <span className="block break-all text-xs text-slate-500">
                          {recipient.email}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {planText} · {statusText}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                          included
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {included ? 'Included' : 'Excluded'}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">Subject</span>
            <input
              value={subject}
              maxLength={180}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="A clear, useful subject"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">Message</span>
            <textarea
              value={body}
              maxLength={30000}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              placeholder="Example: Hello {{firstName}}, thank you for being a {{planName}} member."
              className="resize-y rounded-xl border border-slate-300 px-4 py-3 leading-7 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-900">Button text</span>
              <input
                value={ctaText}
                maxLength={80}
                onChange={(event) => setCtaText(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-900">Button URL</span>
              <input
                value={ctaUrl}
                onChange={(event) => setCtaUrl(event.target.value)}
                placeholder="https://profixter.com/..."
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={busy !== null}
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 disabled:opacity-50"
          >
            {busy === 'preview' ? 'Building preview…' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={busy !== null}
            className="rounded-xl border border-slate-900 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy === 'test' ? 'Sending test…' : 'Send test to admin only'}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={busy !== null || !counts}
            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white shadow-sm disabled:opacity-50 sm:ml-auto"
          >
            {busy === 'send'
              ? 'Sending campaign…'
              : `Send to ${selectedCount} recipient${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>

        {notice && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              noticeType === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : noticeType === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {notice}
          </div>
        )}

        {preview && (
          <div className="space-y-3 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">Customer preview</h3>
                <p className="text-sm text-slate-500">
                  Representative rendering · {preview.recipientCount} recipients
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Sample values used
              </p>
              <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(preview.sampleValues).map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <span className="text-slate-500">{`{{${key}}}`}</span>
                    <span className="ml-2 break-words font-medium text-slate-900">
                      {value || '(blank)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <iframe
              title="Campaign email preview"
              srcDoc={preview.html}
              sandbox=""
              className="h-[640px] w-full rounded-xl border border-slate-300 bg-white"
            />
          </div>
        )}
      </div>
    </section>
      )}
    </div>
  );
}
