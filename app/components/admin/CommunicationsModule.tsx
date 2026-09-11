"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import EmailComposer from "./EmailComposer";

/**
 * Communications: every system message, in one place.
 *
 * WHAT IS EDITABLE AND WHAT IS NOT, AND WHY THE DIFFERENCE IS VISIBLE.
 *
 * Every SMS type and every registered email template is editable here, and a
 * save takes effect on the next send with no deployment. What is not editable
 * is listed anyway, with its trigger and the reason: an internal alert built
 * from a booking, a campaign whose copy lives in the campaign editor, or a
 * generated contract or invoice. Hiding those would let somebody conclude the
 * system does not send them, which is the one wrong answer this screen can give.
 *
 * Email bodies are written in a small block syntax, never HTML. The branded
 * frame, header and footer are added by the server, so an edit changes the
 * words and cannot damage the design or emit markup of its own.
 *
 * Nothing on this screen can send a message. Preview renders through the same
 * server path a real send uses and returns a string; there is deliberately no
 * "send test" button, because the one place you do not want a send button is
 * the screen full of unproven copy.
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
  editableNote?: string;
  subject: string;
  codeSubject?: string;
  body?: string;
  hasOverride: boolean;
  updatedAt?: string | null;
  updatedByName?: string;
  revisionCount?: number;
  variables: string[];
  protectedTokens?: string[];
  /** "editable" | "visible" | "generated" — see utils/communications/emailCatalogue. */
  disposition?: string;
  category?: string;
  audience?: string;
  trigger?: string;
  source?: string;
  protectedNote?: string;
  dynamic?: boolean;
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

/**
 * The email editor.
 *
 * Two kinds of row live in this list and they behave differently on purpose.
 * A registered template has a token form and is edited here like an SMS. A
 * sendRaw key - an internal alert, a campaign, a generated contract - is shown
 * with its trigger and the reason its body is not editable, because the one
 * thing this list must never do is imply an email does not exist.
 */
function EmailEditor({ item, onSaved }: { item: EmailTemplate; onSaved: () => void }) {
  const [subject, setSubject] = useState(item.subject || "");
  const [body, setBody] = useState(item.body || "");
  const [preview, setPreview] = useState<{ subject: string; html: string; text?: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [revisions, setRevisions] = useState<Array<{ subject: string; updatedAt: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const editing = body.trim().length > 0;
  const dirty = subject !== (item.subject || "") || body !== (item.body || "");

  /*
   * Preview goes through the server so it uses the same renderer, the same
   * token values and the same branded frame a real send would. A client-side
   * approximation would be a preview of something the customer never gets.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload: Record<string, unknown> = { channel: "email", templateKey: item.templateKey };
      if (editing) {
        payload.subject = subject;
        payload.body = body;
      }
      API.post("/api/admin/communications/preview", payload)
        .then(({ data }) => {
          setPreview({ subject: data.subject, html: data.html, text: data.text });
          setErrors(data.validation?.errors || []);
        })
        .catch(() => setErrors(["Could not render a preview."]));
    }, 400);
    return () => clearTimeout(timer);
  }, [item.templateKey, subject, body, editing]);

  const loadSettings = () => {
    if (settings) {
      setShowSettings((v) => !v);
      return;
    }
    API.get(`/api/admin/communications/templates/email/${item.templateKey}`)
      .then(({ data }) => {
        setSettings(data.settings);
        setRevisions(data.revisions || []);
        setShowSettings(true);
      })
      .catch(() => setErrors(["Could not load settings."]));
  };

  const save = () => {
    setBusy(true);
    setSaved("");
    API.put(`/api/admin/communications/templates/email/${item.templateKey}`, { subject, body })
      .then(() => {
        setSaved("Saved. Future sends use this version.");
        setErrors([]);
        onSaved();
      })
      .catch((err) => {
        const data = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data;
        setErrors(data?.errors || [data?.message || "Save failed."]);
      })
      .finally(() => setBusy(false));
  };

  const reset = () => {
    if (!window.confirm(`Reset "${item.label}" to the built-in default? The saved version is removed and future sends use the tested default email.`)) {
      return;
    }
    setBusy(true);
    API.post(`/api/admin/communications/templates/email/${item.templateKey}/reset`)
      .then(({ data }) => {
        setSubject(data.subject || "");
        setBody("");
        setSaved("Reset to default.");
        setErrors([]);
        onSaved();
      })
      .catch(() => setErrors(["Reset failed."]))
      .finally(() => setBusy(false));
  };

  const restore = (index: number) => {
    if (!window.confirm("Restore this earlier version? The current wording is kept as a revision.")) return;
    setBusy(true);
    API.post(`/api/admin/communications/templates/email/${item.templateKey}/restore/${index}`)
      .then(({ data }) => {
        setSubject(data.subject || "");
        setBody(data.body || "");
        setSaved("Restored.");
        onSaved();
      })
      .catch(() => setErrors(["Restore failed."]))
      .finally(() => setBusy(false));
  };

  return (
    <div className="border-t border-[#EEF2FF] px-4 py-4 sm:px-5">
      <label className="mb-2 block text-[12px] font-semibold text-[#6A6D71]">Subject</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="mb-4 w-full rounded-[8px] border border-[#C5CBD8] bg-white px-3 py-2.5 text-[13px] text-[#313234] focus:border-[#306EEC] focus:outline-none"
      />

      <label className="mb-1 block text-[12px] font-semibold text-[#6A6D71]">Body</label>
      <p className="mb-2 text-[11.5px] leading-relaxed text-[#6A6D71]">
        <span className="font-semibold">#</span> heading ·{" "}
        <span className="font-semibold">**bold**</span> ·{" "}
        <span className="font-semibold">-</span> list item ·{" "}
        <span className="font-semibold">[label](https://…)</span> link · blank line = new paragraph.
        HTML is not allowed; the ProFixter frame, header and footer are added automatically.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={9}
        spellCheck
        placeholder={
          item.hasOverride
            ? ""
            : "Empty means the built-in default is used. Start typing to override it."
        }
        className="w-full rounded-[8px] border border-[#C5CBD8] bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#313234] focus:border-[#306EEC] focus:outline-none"
      />

      <div className="mt-3">
        <p className="mb-1.5 text-[12px] font-semibold text-[#6A6D71]">Available variables</p>
        <div className="flex flex-wrap gap-1.5">
          {item.variables.map((v) => {
            const required = (item.protectedTokens || []).includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => setBody((b) => `${b}{{${v}}}`)}
                title={required ? "Required: carries this email's secure action" : undefined}
                className={`rounded-[6px] border px-2 py-1 font-mono text-[11.5px] transition hover:border-[#306EEC] ${
                  required
                    ? "border-[#FFD9A0] bg-[#FFF6E9] text-[#8A5A1B]"
                    : "border-[#D7DEE9] bg-[#F7F9FF] text-[#313234]"
                }`}
              >
                {`{{${v}}}`}
                {required ? " *" : ""}
              </button>
            );
          })}
        </div>
        {(item.protectedTokens || []).length ? (
          <p className="mt-2 text-[11.5px] text-[#8A5A1B]">
            * Required. This variable carries the email&apos;s secure action — a code or a claim
            link — and cannot be removed from the body.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-[12px] font-semibold text-[#6A6D71]">
          Preview — sample data, never sent
        </p>
        <p className="mb-2 text-[13px] font-semibold text-[#313234]">
          {preview?.subject ?? "Loading…"}
        </p>
        <iframe
          title={`Preview of ${item.templateKey}`}
          sandbox=""
          srcDoc={preview?.html ?? ""}
          className="h-[420px] w-full rounded-[8px] border border-[#E0E6F5] bg-white"
        />
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
          disabled={busy || !dirty || !editing || errors.length > 0}
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

      {showSettings && revisions.length ? (
        <div className="mt-3 rounded-[8px] border border-[#E0E6F5] bg-white p-3">
          <p className="mb-2 text-[12px] font-semibold text-[#6A6D71]">Earlier versions</p>
          <ul className="space-y-1.5">
            {revisions.map((rev, i) => (
              <li key={`${rev.updatedAt}-${i}`} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[12px] text-[#313234]">
                  {rev.subject || "(no subject)"}{" "}
                  <span className="text-[#6A6D71]">
                    — {rev.updatedAt ? new Date(rev.updatedAt).toLocaleString() : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => restore(revisions.length - 1 - i)}
                  className="shrink-0 text-[12px] font-semibold text-[#306EEC] hover:underline"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showSettings && settings ? <SettingsPanel settings={settings} /> : null}
    </div>
  );
}

/** A sendRaw key: shown, explained, and honestly not editable. */
function EmailInfoPanel({ item }: { item: EmailTemplate }) {
  const rows: Array<[string, string]> = [
    ["Trigger", item.trigger || ""],
    ["Recipients", item.audience || ""],
    ["Class", item.channelClass || ""],
    ["Sent from", item.source || ""],
    ["Why not editable", item.protectedNote || ""],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <div className="border-t border-[#EEF2FF] px-4 py-4 sm:px-5">
      <div className="rounded-[8px] bg-[#F7F9FF] p-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#6A6D71]">
          {item.disposition === "generated"
            ? "Generated content — the body is a document, not a template"
            : "Assembled where it is sent — there is no template to edit"}
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
    </div>
  );
}

function EmailList({ items, reload }: { items: EmailTemplate[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const editableCount = items.filter((i) => i.editable).length;

  return (
    <div className="space-y-2.5">
      <div className="rounded-[10px] border border-[#E0E6F5] bg-[#F7F9FF] px-4 py-3 text-[13px] leading-relaxed text-[#313234]">
        <span className="font-bold">
          {editableCount} of {items.length} email types are editable.
        </span>{" "}
        The rest are internal alerts, campaigns whose copy lives in the campaign editor, or generated
        documents such as contracts and invoices. Those are listed with their trigger so nothing the
        system sends is invisible here, but their content is produced from real data and is not
        rewritable. The ProFixter frame, header and footer are always added by the system.
      </div>

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
                {item.disposition === "generated" ? (
                  <span className="rounded-[5px] bg-[#FFF6E9] px-1.5 py-0.5 text-[11px] font-bold text-[#8A5A1B]">
                    GENERATED
                  </span>
                ) : null}
                {!item.editable && item.disposition !== "generated" ? (
                  <span className="rounded-[5px] bg-[#F2F3F5] px-1.5 py-0.5 text-[11px] font-bold text-[#6A6D71]">
                    NOT EDITABLE
                  </span>
                ) : null}
                {item.channelClass === "marketing" ? (
                  <span className="rounded-[5px] bg-[#FFF6E9] px-1.5 py-0.5 text-[11px] font-bold text-[#8A5A1B]">
                    MARKETING
                  </span>
                ) : null}
                {item.channelClass === "internal" ? (
                  <span className="rounded-[5px] bg-[#F2F3F5] px-1.5 py-0.5 text-[11px] font-bold text-[#6A6D71]">
                    INTERNAL
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block font-mono text-[11.5px] text-[#6A6D71]">
                {item.templateKey}
              </span>
              <span className="mt-1.5 block truncate text-[13px] text-[#6A6D71]">
                {item.subject || item.trigger || ""}
              </span>
              {item.updatedAt ? (
                <span className="mt-1 block text-[11.5px] text-[#6A6D71]">
                  Last updated {new Date(item.updatedAt).toLocaleString()}
                  {item.updatedByName ? ` by ${item.updatedByName}` : ""}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-[#6A6D71]">
              {open === item.templateKey ? "Close" : item.editable ? "Edit" : "Details"}
            </span>
          </button>

          {open === item.templateKey ? (
            item.editable ? (
              <EmailEditor item={item} onSaved={reload} />
            ) : (
              <EmailInfoPanel item={item} />
            )
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
        <EmailList items={filteredEmail} reload={load} />
      ) : (
        <EmailComposer />
      )}
    </div>
  );
}
