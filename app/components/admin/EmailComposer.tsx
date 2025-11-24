'use client';

import React, { useEffect, useState } from 'react';
import { getSegmentCounts, sendCampaign } from '@/lib/admin-service';
import type { SegmentCounts } from '@/lib/admin-service';

export default function EmailComposer() {
  const [segmentCounts, setSegmentCounts] = useState<SegmentCounts | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [segment, setSegment] = useState('not_subscribed');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [ctaText, setCtaText] = useState('View Plans');
  const [ctaUrl, setCtaUrl] = useState('https://profixter.com/subscription');
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => {
    loadCounts();
  }, []);

  async function loadCounts() {
    try {
      setLoading(true);
      const data = await getSegmentCounts();
      setSegmentCounts(data);
    } catch (error) {
      console.error('Failed to load segments:', error);
    } finally {
      setLoading(false);
    }
  }

  const recipientCount = segmentCounts
    ? segment === 'all'
      ? segmentCounts.all
      : segment === 'subscribed'
      ? (segmentCounts.basic || 0) +
        (segmentCounts.plus || 0) +
        (segmentCounts.premium || 0) +
        (segmentCounts.elite || 0)
      : segmentCounts[segment as keyof SegmentCounts] || 0
    : '...';

  async function send(testOnly: boolean) {
    if (!subject || !body) {
      setLog('Subject and message are required.');
      return;
    }

    try {
      setSending(true);
      setLog(testOnly ? 'Sending test...' : 'Sending...');

      const data = await sendCampaign({
        testOnly,
        segment,
        subject,
        body,
        useTemplate,
        ctaText,
        ctaUrl,
      });

      setLog(
        testOnly
          ? '✅ Test sent.'
          : `✅ Sent ${data.sent}/${data.total} emails.`
      );
    } catch (error: any) {
      setLog(`❌ ${error.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-2xl">
          ✉️
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Email Composer</h3>
          <p className="text-sm text-gray-600">Send targeted email campaigns</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="font-medium">Segment:</label>
        <select
          className="px-3 py-2 border border-[#e5e7eb] rounded-lg"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
        >
          <option value="not_subscribed">Not Subscribed</option>
          <option value="subscribed">All Subscribed</option>
          <option value="basic">Basic</option>
          <option value="plus">Plus</option>
          <option value="premium">Premium</option>
          <option value="elite">Elite</option>
          <option value="all">All</option>
        </select>

        <button
          className="px-4 py-2 bg-white border border-[#e5e7eb] rounded-full font-bold hover:shadow-md transition-all"
          onClick={loadCounts}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh counts'}
        </button>

        <span className="px-2.5 py-1 rounded-full bg-[#eef2ff] text-[#1e40af] border border-[#c7d2fe] font-bold text-xs">
          Recipients: {recipientCount}
        </span>
      </div>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={useTemplate}
          onChange={(e) => setUseTemplate(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="font-medium">Use default template</span>
      </label>

      <input
        className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg mb-4"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <textarea
        className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg mb-4"
        rows={10}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message (supports {{name}}, {{userId}}, {{plan}})"
      />

      {useTemplate && (
        <div className="flex gap-3 mb-4">
          <input
            className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-lg"
            placeholder="CTA text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
          />
          <input
            className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-lg"
            placeholder="CTA URL"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <button
          className="px-4 py-2 bg-white border border-[#e5e7eb] rounded-full font-bold hover:shadow-md transition-all"
          onClick={() => send(true)}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Send test to me'}
        </button>
        <button
          className="px-4 py-2 bg-[#306EEC] text-white border border-[#306EEC] rounded-full font-bold hover:shadow-md transition-all"
          onClick={() => send(false)}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Send to segment'}
        </button>
      </div>

      {log && (
        <div
          className={`text-sm ${
            log.startsWith('❌') ? 'text-[#b00020]' : 'text-[#0B5CAB]'
          }`}
        >
          {log}
        </div>
      )}

      <div className="text-sm text-[#64748b] mt-4">
        Use {'{{name}}'} {'{{userId}}'} {'{{plan}}'} for personalization
      </div>
    </div>
  );
}
