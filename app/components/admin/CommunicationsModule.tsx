"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import EmailComposer from "./EmailComposer";

/**
 * Communications: every system message, in one place.
 *
 * WHAT IS EDITABLE AND WHAT IS NOT, AND WHY THE DIFFERENCE IS VISIBLE.
 *
 * SMS bodies are plain text, so they are fully editable here and a save takes
 * effect on the next send with no deployment. Email bodies are not, and the
 * screen says so in plain language rather than hiding the tab or greying a
 * button with no explanation: the email defaults are JavaScript functions that
 * build styled HTML through shared helpers, and making them editable means
 * authoring a safe token form for each one. Storing executable code or raw HTML
 * template logic would be the fast way and the wrong one.
 *
 * Nothing on this screen can send a message. Preview renders a string from
 * sample data; there is deliberately no "send test" button, because the one
 * place you do not want a send button is the screen full of unproven copy.
 */

type Channel = "sms" | "email";

interface Measurement {
  characters: number;
  encoding: string;
  segments: number;
  multiSegment: boolean;
  maxLength: number;
}

interface SmsTemplate extends Partial<Measurement> {
  channel: Channel;
  templateKey: string;
  label: string;
  description?: string;
  channelClass: string;
  reserved?: boolean;
  editable: boolean;
  defaultBody: string;
  body: string;
  hasOverride: boolean;
  updatedAt: string | null;
  updatedByName?: string;
  revisionCount?: number;
  variables: string[];
  preview: { body: string } & Measurement;
}

interface EmailTemplate {
  channel: Channel;
  templateKey: string;
  label: string;
  channelClass: string;
  editable: boolean;
  editableNote: string;
  subject: string;
}

interface ProtectedItem {
  id: string;
  applies: string;
  text: string;
  enforcement: string;
}

type SettingsInfo = Record<string, unknown>;

const CARD = "rounded-[10px] border border-[#E0E6F5] bg-white";
const BTN =
  "inline-flex min-h-[38px] items-center justify-center rounded-[8px] px-4 text-[13px] font-semibold transition disabled:opacity-40";

function SegmentBadge({ m }: { m: Measurement }) {
  const bad = m.multiSegment || m.encoding !== "GSM-7";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="rounded-[6px] bg-[#EEF2FF] px-2 py-1 font-semibold text-[#313234]">
        {m.characters} / {m.maxLength} chars
      </span>
      <span
        className={`rounded-[6px] px-2 py-1 font-semibold ${
          m.encoding === "GSM-7" ? "bg-[#E9F7EF] text-[#1B6B3A]" : "bg-[#FFF6E9] text-[#8A5A1B]"
        }`}
      >
        {m.encoding}
      </span>
      <span
        className={`rounded-[6px] px-2 py-1 font-semibold ${
          m.multiSegment ? "bg-[#FFF6E9] text-[#8A5A1B]" : "bg-[#E9F7EF] text-[#1B6B3A]"
        }`}
      >
        {m.segments} segment{m.segments === 1 ? "" : "s"}
      </span>
      {bad ? (
        <span className="text-[12px] font-semibold text-[#8A5A1B]">
          {m.multiSegment
            ? "This message will be billed as more than one SMS."
            : "Non-GSM-7 characters cut a segment from 160 to 70 characters."}
        </span>
      ) : null}
    </div>
  );
}

function SettingsPanel({ settings }: { settings: SettingsInfo }) {
  const rows: Array<[string, string]> = [
    ["Trigger", String(settings.trigger || "")],
    ["Fires from", String(settings.event || "")],
    ["Applies to", String(settings.appliesTo || "")],
    ["Schedule", String(settings.schedule || "")],
    ["Earliest send", String(settings.earliest || "")],
    ["Recovery window", String(settings.recovery || "")],
    ["Eligibility", String(settings.eligibility || "")],
    ["Class", String(settings.channelClass || "")],
    ["Consent / STOP", String(settings.consent || "")],
    ["Feature flags", String(settings.flags || "")],
    ["GHL overlap", String(settings.ghlOverlap || "")],
    ["Notes", String(settings.notes || "")],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <div className="mt-3 rounded-[8px] bg-[#F7F9FF] p-4">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#6A6D71]">
        Settings — informational only. Trigger logic is not editable here.
      </p>
      <dl className="space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[150px_1fr] sm:gap-3">
            <dt className="text-[12px] font-semibold text-[#6A6D71]">{label}</dt>
            <dd className="text-[13px] leading-relaxed text-[#313234]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SmsEditor({
  item,
  onSaved,
}: {
  item: SmsTemplate;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(item.body);
  const [preview, setPreview] = useState(item.preview);
  const [errors, setErrors] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const dirty = body !== item.body;

  /* Preview is server-side so the segment maths is the same code that validates. */
  const runPreview = useCallback(
    async (candidate: string) => {
      try {
        const { data } = await API.post("/api/admin/communications/preview", {
          channel: "sms",
          templateKey: item.templateKey,
          body: candidate,
        });
        setPreview({ body: data.body, ...data });
        setErrors(data.validation?.errors || []);
      } catch {
        setErrors(["Could not render a preview."]);
      }
    },
    [item.templateKey]
  );

  useEffect(() => {
    const t = setTimeout(() => runPreview(body), 350);
    return () => clearTimeout(t);
  }, [body, runPreview]);

  const loadSettings = async () => {
    if (settings) return setShowSettings((v) => !v);
    try {
      const { data } = await API.get(
        `/api/admin/communications/templates/sms/${item.templateKey}`
      );
      setSettings(data.settings);
      setShowSettings(true);
    } catch {
      setErrors(["Could not load settings."]);
    }
  };

  const save = async () => {
    setBusy(true);
    setSaved("");
    try {
      await API.put(`/api/admin/communications/templates/sms/${item.templateKey}`, { body });
      setSaved("Saved. Future sends use this wording.");
      setErrors([]);
      onSaved();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response
        ?.data;
      setErrors(data?.errors || [data?.message || "Save failed."]);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        `Reset "${item.label}" to the built-in default?\n\nThe saved version is removed and future sends use the tested default wording.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { data } = await API.post(
        `/api/admin/communications/templates/sms/${item.templateKey}/reset`
      );
      setBody(data.body);
      setSaved("Reset to default.");
      setErrors([]);
      onSaved();
    } catch {
      setErrors(["Reset failed."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-[#EEF2FF] px-4 py-4 sm:px-5">
      <label className="mb-2 block text-[12px] font-semibold text-[#6A6D71]">Message body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        spellCheck
        className="w-full rounded-[8px] border border-[#C5CBD8] bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#313234] focus:border-[#306EEC] focus:outline-none"
      />

      <div className="mt-3">
        <p className="mb-1.5 text-[12px] font-semibold text-[#6A6D71]">Available variables</p>
        <div className="flex flex-wrap gap-1.5">
          {item.variables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBody((b) => `${b}{{${v}}}`)}
              className="rounded-[6px] border border-[#D7DEE9] bg-[#F7F9FF] px-2 py-1 font-mono text-[11.5px] text-[#313234] transition hover:border-[#306EEC]"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[8px] bg-[#F7F9FF] p-3">
        <p className="mb-1.5 text-[12px] font-semibold text-[#6A6D71]">
          Preview — sample data, never sent
        </p>
        <p className="mb-2 text-[13px] leading-relaxed text-[#313234]">{preview.body}</p>
        <SegmentBadge m={preview} />
      </div>

      {errors.length ? (
        <ul className="mt-3 space-y-1 rounded-[8px] bg-[#FDECEA] p-3">
          {errors.map((e) => (
            <li key={e} className="text-[12px] font-semibold text-[#B4342B]">
              {e}
            </li>
          ))}
        </ul>
      ) : null}

      {saved ? <p className="mt-3 text-[12px] font-semibold text-[#1B6B3A]">{saved}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || errors.length > 0}
          className={`${BTN} bg-[#306EEC] text-white hover:bg-[#2559c4]`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy || !item.hasOverride}
          className={`${BTN} border border-[#D7DEE9] bg-white text-[#313234] hover:bg-[#F7F9FF]`}
        >
          Reset to Default
        </button>
        <button
          type="button"
          onClick={loadSettings}
          className={`${BTN} border border-[#D7DEE9] bg-white text-[#313234] hover:bg-[#F7F9FF]`}
        >
          {showSettings ? "Hide Settings" : "Settings"}
        </button>
      </div>

      {showSettings && settings ? <SettingsPanel settings={settings} /> : null}
    </div>
  );
}

function SmsList({ items, reload }: { items: SmsTemplate[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.templateKey} className={CARD}>
          <button
            type="button"
            onClick={() => setOpen(open === item.templateKey ? null : item.templateKey)}
            className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-[#313234]">{item.label}</span>
                {item.hasOverride ? (
                  <span className="rounded-[5px] bg-[#EEF2FF] px-1.5 py-0.5 text-[11px] font-bold text-[#306EEC]">
                    EDITED
                  </span>
                ) : null}
                {item.reserved ? (
                  <span className="rounded-[5px] bg-[#F2F3F5] px-1.5 py-0.5 text-[11px] font-bold text-[#6A6D71]">
                    RESERVED
                  </span>
                ) : null}
                {item.channelClass === "marketing" ? (
                  <span className="rounded-[5px] bg-[#FFF6E9] px-1.5 py-0.5 text-[11px] font-bold text-[#8A5A1B]">
                    MARKETING
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block font-mono text-[11.5px] text-[#6A6D71]">
                {item.templateKey}
              </span>
              <span className="mt-1.5 block truncate text-[13px] text-[#6A6D71]">
                {item.preview.body}
              </span>
              {item.updatedAt ? (
                <span className="mt-1 block text-[11.5px] text-[#6A6D71]">
                  Last updated {new Date(item.updatedAt).toLocaleString()}
                  {item.updatedByName ? ` by ${item.updatedByName}` : ""}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-[#6A6D71]">
              {open === item.templateKey ? "Close" : "Edit"}
            </span>
          </button>

          {open === item.templateKey ? <SmsEditor item={item} onSaved={reload} /> : null}
        </div>
      ))}
    </div>
  );
}

function EmailList({ items }: { items: EmailTemplate[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);

  const openOne = async (key: string) => {
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    setPreview(null);
    setSettings(null);
    try {
      const [p, s] = await Promise.all([
        API.post("/api/admin/communications/preview", { channel: "email", templateKey: key }),
        API.get(`/api/admin/communications/templates/email/${key}`),
      ]);
      setPreview({ subject: p.data.subject, html: p.data.html });
      setSettings(s.data.settings);
    } catch {
      setPreview(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="rounded-[10px] border border-[#FFE0B2] bg-[#FFF6E9] px-4 py-3 text-[13px] leading-relaxed text-[#8A5A1B]">
        <span className="font-bold">Email bodies are not editable yet.</span> The defaults are
        rendering functions that build styled HTML through shared helpers, so making them editable
        means authoring a safe variable form for each one first. Storing executable code or raw HTML
        template logic would be the wrong way to solve that, so it is deferred rather than bodged.
        Preview and Settings work today; SMS is fully editable on the other tab.
      </div>

      {items.map((item) => (
        <div key={item.templateKey} className={CARD}>
          <button
            type="button"
            onClick={() => openOne(item.templateKey)}
            className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-[#313234]">{item.label}</span>
                <span className="rounded-[5px] bg-[#F2F3F5] px-1.5 py-0.5 text-[11px] font-bold text-[#6A6D71]">
                  NOT YET EDITABLE
                </span>
              </span>
              <span className="mt-1 block font-mono text-[11.5px] text-[#6A6D71]">
                {item.templateKey}
              </span>
              <span className="mt-1.5 block truncate text-[13px] text-[#6A6D71]">
                {item.subject}
              </span>
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-[#6A6D71]">
              {open === item.templateKey ? "Close" : "Preview"}
            </span>
          </button>

          {open === item.templateKey ? (
            <div className="border-t border-[#EEF2FF] px-4 py-4 sm:px-5">
              <p className="mb-1 text-[12px] font-semibold text-[#6A6D71]">Rendered subject</p>
              <p className="mb-3 text-[14px] font-semibold text-[#313234]">
                {preview?.subject ?? "Loading…"}
              </p>
              <p className="mb-1 text-[12px] font-semibold text-[#6A6D71]">
                Rendered body — sample data, never sent
              </p>
              {/*
                * Rendered in a sandboxed iframe rather than with dangerouslySetInnerHTML.
                * These bodies are our own templates, but an email preview is exactly the
                * surface where injected markup would execute with admin privileges, and a
                * sandbox costs nothing.
                */}
              <iframe
                title={`Preview of ${item.templateKey}`}
                sandbox=""
                srcDoc={preview?.html ?? ""}
                className="h-[420px] w-full rounded-[8px] border border-[#E0E6F5] bg-white"
              />
              {settings ? <SettingsPanel settings={settings} /> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function CommunicationsModule() {
  const [tab, setTab] = useState<"emails" | "sms" | "history">("sms");
  const [sms, setSms] = useState<SmsTemplate[]>([]);
  const [email, setEmail] = useState<EmailTemplate[]>([]);
  const [protectedContent, setProtectedContent] = useState<ProtectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/api/admin/communications/templates");
      setSms(data.sms || []);
      setEmail(data.email || []);
      setProtectedContent(data.protectedContent || []);
      setError("");
    } catch {
      setError("Could not load communication templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sms;
    return sms.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.templateKey.toLowerCase().includes(q) ||
        r.preview.body.toLowerCase().includes(q)
    );
  }, [sms, query]);

  const filteredEmail = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return email;
    return email.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.templateKey.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q)
    );
  }, [email, query]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#313234] sm:text-2xl">Communications</h2>
        <p className="mt-1 text-sm text-[#6A6D71]">
          Every system email and text message. Editing a message changes future sends only — what a
          customer was already told stays exactly as it was sent.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["sms", `SMS (${sms.length})`],
            ["emails", `Emails (${email.length})`],
            ["history", "Send history"],
          ] as Array<[typeof tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`${BTN} ${
              tab === id
                ? "bg-[#313234] text-white"
                : "border border-[#D7DEE9] bg-white text-[#313234] hover:bg-[#F7F9FF]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "history" ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, key or content…"
          className="mb-4 w-full rounded-[8px] border border-[#C5CBD8] bg-white px-3.5 py-2.5 text-sm text-[#313234] focus:border-[#306EEC] focus:outline-none sm:max-w-md"
        />
      ) : null}

      {error ? (
        <p className="mb-3 rounded-[8px] bg-[#FDECEA] p-3 text-[13px] font-semibold text-[#B4342B]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#6A6D71]">Loading…</p>
      ) : tab === "sms" ? (
        <>
          <SmsList items={filteredSms} reload={load} />
          {protectedContent.length ? (
            <div className="mt-5 rounded-[10px] border border-[#E0E6F5] bg-[#F7F9FF] p-4">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6A6D71]">
                System-managed content — cannot be removed by editing a body
              </p>
              <ul className="space-y-2">
                {protectedContent.map((p) => (
                  <li key={p.id} className="text-[12.5px] leading-relaxed text-[#313234]">
                    <span className="font-semibold">{p.text}</span>{" "}
                    <span className="text-[#6A6D71]">({p.applies})</span> — {p.enforcement}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : tab === "emails" ? (
        <EmailList items={filteredEmail} />
      ) : (
        <EmailComposer />
      )}
    </div>
  );
}
