"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@/lib/api";
import { isAdminUser } from "@/lib/auth-routing";
import { arr, num, obj, str } from "@/lib/admin/sections-api";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  Field,
  SearchField,
  SkeletonRows,
  Tabs,
  TextInput,
  Textarea,
  cx,
} from "@/app/components/admin/ui";
import EmailComposer from "./EmailComposer";
import EmailHistory from "./EmailHistory";
import SmsLog from "./SmsLog";
import { getReviewSummary, type ReviewSummary } from "./customer-profile-api";

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
 * The template editors cannot send a message. Preview renders through the same
 * server path a real send uses and returns a string. Sending lives only in the
 * Campaign tab, behind a confirmation that names the segment and the count.
 *
 * MALFORMED DATA (audit C.1): every template row is normalised on arrival, so
 * a missing preview, label or variable list shows as blank instead of
 * crashing, and each tab has its own error boundary.
 */

type Channel = "sms" | "email";

interface Measurement {
  characters: number;
  encoding: string;
  segments: number;
  multiSegment: boolean;
  maxLength: number;
}

interface SmsTemplate {
  channel: Channel;
  templateKey: string;
  label: string;
  description: string;
  channelClass: string;
  reserved: boolean;
  editable: boolean;
  body: string;
  hasOverride: boolean;
  updatedAt: string | null;
  updatedByName: string;
  variables: string[];
  preview: { body: string } & Measurement;
}

interface EmailTemplate {
  channel: Channel;
  templateKey: string;
  label: string;
  channelClass: string;
  editable: boolean;
  subject: string;
  body: string;
  hasOverride: boolean;
  updatedAt: string | null;
  updatedByName: string;
  variables: string[];
  protectedTokens: string[];
  /** "editable" | "visible" | "generated" (utils/communications/emailCatalogue). */
  disposition: string;
  audience: string;
  trigger: string;
  source: string;
  protectedNote: string;
}

interface ProtectedItem {
  id: string;
  applies: string;
  text: string;
  enforcement: string;
}

type SettingsInfo = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* normalisers (the crash guard)                                       */
/* ------------------------------------------------------------------ */

function readMeasurement(raw: unknown): Measurement {
  const o = obj(raw);
  return {
    characters: num(o.characters),
    encoding: str(o.encoding) || "GSM-7",
    segments: num(o.segments),
    multiSegment: Boolean(o.multiSegment),
    maxLength: num(o.maxLength),
  };
}

function readSms(raw: unknown): SmsTemplate {
  const o = obj(raw);
  const preview = obj(o.preview);
  return {
    channel: "sms",
    templateKey: str(o.templateKey),
    label: str(o.label) || str(o.templateKey) || "Untitled message",
    description: str(o.description),
    channelClass: str(o.channelClass),
    reserved: Boolean(o.reserved),
    editable: o.editable !== false,
    body: str(o.body),
    hasOverride: Boolean(o.hasOverride),
    updatedAt: str(o.updatedAt) || null,
    updatedByName: str(o.updatedByName),
    variables: arr(o.variables).map(str).filter(Boolean),
    preview: { body: str(preview.body), ...readMeasurement(o.preview ?? o) },
  };
}

function readEmail(raw: unknown): EmailTemplate {
  const o = obj(raw);
  return {
    channel: "email",
    templateKey: str(o.templateKey),
    label: str(o.label) || str(o.templateKey) || "Untitled email",
    channelClass: str(o.channelClass),
    editable: Boolean(o.editable),
    subject: str(o.subject),
    body: str(o.body),
    hasOverride: Boolean(o.hasOverride),
    updatedAt: str(o.updatedAt) || null,
    updatedByName: str(o.updatedByName),
    variables: arr(o.variables).map(str).filter(Boolean),
    protectedTokens: arr(o.protectedTokens).map(str),
    disposition: str(o.disposition),
    audience: str(o.audience),
    trigger: str(o.trigger),
    source: str(o.source),
    protectedNote: str(o.protectedNote),
  };
}

function readProtected(raw: unknown): ProtectedItem {
  const o = obj(raw);
  return { id: str(o.id) || str(o.text), applies: str(o.applies), text: str(o.text), enforcement: str(o.enforcement) };
}

const responseErrors = (err: unknown, fallback: string): string[] => {
  const data = (err as { response?: { data?: { errors?: unknown; message?: string } } })?.response?.data;
  const list = arr(data?.errors).map(str).filter(Boolean);
  return list.length ? list : [data?.message || fallback];
};

const when = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

function Tag({ tone = "neutral", children }: { tone?: "neutral" | "info" | "attention"; children: string }) {
  const tones = { neutral: "bg-adm-neutral-bg text-adm-neutral", info: "bg-adm-info-bg text-adm-info", attention: "bg-adm-attn-bg text-adm-attn" };
  return <span className={cx("inline-flex h-6 items-center rounded-adm-xs px-1.5 text-[12px] font-semibold", tones[tone])}>{children}</span>;
}

function SegmentBadge({ m }: { m: Measurement }) {
  const gsm = m.encoding === "GSM-7";
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]" data-segments>
      <span className="adm-num rounded-adm-xs bg-adm-sunk px-2 py-1 font-semibold text-adm-ink">
        {m.characters} / {m.maxLength || "-"} chars
      </span>
      <span className={cx("rounded-adm-xs px-2 py-1 font-semibold", gsm ? "bg-adm-ok-bg text-adm-ok" : "bg-adm-attn-bg text-adm-attn")}>{m.encoding}</span>
      <span className={cx("adm-num rounded-adm-xs px-2 py-1 font-semibold", m.multiSegment ? "bg-adm-attn-bg text-adm-attn" : "bg-adm-ok-bg text-adm-ok")}>
        {m.segments} segment{m.segments === 1 ? "" : "s"}
      </span>
      {m.multiSegment || !gsm ? (
        <span className="basis-full text-[13px] font-medium text-adm-attn">
          {m.multiSegment ? "This message will be billed as more than one SMS." : "Non-GSM-7 characters cut a segment from 160 to 70 characters."}
        </span>
      ) : null}
    </div>
  );
}

function DefinitionList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-0.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
          <dt className="text-[13px] font-semibold text-adm-text-2">{label}</dt>
          <dd className="break-words text-[14px] leading-relaxed text-adm-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* The settings are informational. GoHighLevel no longer sends to customers, so
   its old "overlap" field is not shown at all (Q-6). */
function SettingsPanel({ settings }: { settings: SettingsInfo }) {
  const rows = (
    [
      ["Trigger", settings.trigger],
      ["Fires from", settings.event],
      ["Applies to", settings.appliesTo],
      ["Schedule", settings.schedule],
      ["Earliest send", settings.earliest],
      ["Recovery window", settings.recovery],
      ["Eligibility", settings.eligibility],
      ["Class", settings.channelClass],
      ["Consent / STOP", settings.consent],
      ["Feature flags", settings.flags],
      ["Notes", settings.notes],
    ] as Array<[string, unknown]>
  )
    .map(([label, value]): [string, string] => [label, str(value)])
    .filter((row) => Boolean(row[1]));
  return (
    <div className="mt-3 rounded-adm-sm bg-adm-sunk p-3" data-settings-panel>
      <p className="mb-2 text-[13px] font-semibold text-adm-text-2">How it is sent (informational; not editable here)</p>
      {rows.length ? <DefinitionList rows={rows} /> : <p className="text-[14px] text-adm-text-2">No settings recorded.</p>}
    </div>
  );
}

function Errors({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <ul role="alert" className="mt-3 space-y-1 rounded-adm-sm bg-adm-problem-bg p-3">
      {list.map((e) => (
        <li key={e} className="text-[13px] font-semibold text-adm-problem">
          {e}
        </li>
      ))}
    </ul>
  );
}

function VariableButtons({ variables, required = [], onInsert }: { variables: string[]; required?: string[]; onInsert: (tag: string) => void }) {
  if (!variables.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[13px] font-semibold text-adm-text-2">Insert a variable</p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => {
          const req = required.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onInsert(`{{${v}}}`)}
              title={req ? "Required: carries this email's secure action" : undefined}
              className={cx(
                "min-h-11 rounded-adm-xs border px-2.5 font-mono text-[12px] transition hover:border-adm-accent sm:min-h-9",
                req ? "border-adm-attn-bg bg-adm-attn-bg text-adm-attn" : "border-adm-line bg-adm-sunk text-adm-ink"
              )}
            >
              {`{{${v}}}`}
              {req ? " *" : ""}
            </button>
          );
        })}
      </div>
      {required.length ? (
        <p className="mt-2 text-[13px] text-adm-attn">* Required. This variable carries the email&apos;s secure action (a code or a claim link) and cannot be removed from the body.</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SMS                                                                 */
/* ------------------------------------------------------------------ */

function SmsEditor({ item, onSaved }: { item: SmsTemplate; onSaved: () => void }) {
  const [body, setBody] = useState(item.body);
  const [preview, setPreview] = useState(item.preview);
  const [errors, setErrors] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [asking, setAsking] = useState(false);

  const dirty = body !== item.body;

  /* Preview is server-side so the segment maths is the same code that validates. */
  const runPreview = useCallback(
    async (candidate: string) => {
      try {
        const { data } = await API.post("/api/admin/communications/preview", { channel: "sms", templateKey: item.templateKey, body: candidate });
        const d = obj(data);
        setPreview({ body: str(d.body), ...readMeasurement(d) });
        setErrors(arr(obj(d.validation).errors).map(str));
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
      const { data } = await API.get(`/api/admin/communications/templates/sms/${item.templateKey}`);
      setSettings(obj(obj(data).settings));
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
    } catch (err) {
      setErrors(responseErrors(err, "Save failed."));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const { data } = await API.post(`/api/admin/communications/templates/sms/${item.templateKey}/reset`);
    setBody(str(obj(data).body));
    setSaved("Reset to default.");
    setErrors([]);
    onSaved();
  };

  return (
    <div className="border-t border-adm-line px-4 py-4">
      <Field label="Message body">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} spellCheck className="font-mono text-[14px]" />
      </Field>
      <VariableButtons variables={item.variables} onInsert={(tag) => setBody((b) => `${b}${tag}`)} />
      <div className="mt-4 rounded-adm-sm bg-adm-sunk p-3">
        <p className="mb-1.5 text-[13px] font-semibold text-adm-text-2">Preview (sample data, never sent)</p>
        <p className="mb-2 break-words text-[14px] leading-relaxed text-adm-ink">{preview.body || "No preview yet."}</p>
        <SegmentBadge m={preview} />
      </div>
      <Errors list={errors} />
      {saved ? (
        <p role="status" className="mt-3 text-[13px] font-semibold text-adm-ok">
          {saved}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} busy={busy} disabled={!dirty || errors.length > 0}>
          Save
        </Button>
        <Button variant="secondary" onClick={() => setAsking(true)} disabled={busy || !item.hasOverride}>
          Reset to default
        </Button>
        <Button variant="tertiary" onClick={loadSettings}>
          {showSettings ? "Hide settings" : "Settings"}
        </Button>
      </div>
      {showSettings && settings ? <SettingsPanel settings={settings} /> : null}
      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        title={`Reset "${item.label}"?`}
        consequence="The saved version is removed and future sends use the tested default wording."
        confirmLabel="Reset to default"
        onConfirm={reset}
        errorText={() => "Reset failed. Nothing was changed."}
      />
    </div>
  );
}

function TemplateRow({
  title,
  tags,
  keyText,
  summary,
  updated,
  open,
  onToggle,
  actionLabel,
  children,
}: {
  title: string;
  tags: React.ReactNode;
  keyText: string;
  summary: string;
  updated: string;
  open: boolean;
  onToggle: () => void;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <li className="min-w-0 border-b border-adm-line last:border-b-0" data-template={keyText}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-adm-sunk">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold text-adm-ink">{title}</span>
            {tags}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[12px] text-adm-text-3">{keyText}</span>
          {summary ? <span className="mt-1 block truncate text-[13px] text-adm-text-2">{summary}</span> : null}
          {updated ? <span className="mt-0.5 block text-[12px] text-adm-text-3">{updated}</span> : null}
        </span>
        <span className="shrink-0 pt-0.5 text-[13px] font-semibold text-adm-accent-ink">{open ? "Close" : actionLabel}</span>
      </button>
      {open ? children : null}
    </li>
  );
}

function SmsList({ items, reload }: { items: SmsTemplate[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return <EmptyState message="No text messages match." />;
  return (
    <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label="Text messages">
      {items.map((item) => (
        <TemplateRow
          key={item.templateKey || item.label}
          title={item.label}
          keyText={item.templateKey}
          summary={item.preview.body}
          updated={item.updatedAt ? `Last updated ${when(item.updatedAt)}${item.updatedByName ? ` by ${item.updatedByName}` : ""}` : ""}
          open={open === item.templateKey}
          onToggle={() => setOpen(open === item.templateKey ? null : item.templateKey)}
          actionLabel="Edit"
          tags={
            <>
              {item.hasOverride ? <Tag tone="info">Edited</Tag> : null}
              {item.reserved ? <Tag>Reserved</Tag> : null}
              {item.channelClass === "marketing" ? <Tag tone="attention">Marketing</Tag> : null}
            </>
          }
        >
          <SmsEditor item={item} onSaved={reload} />
        </TemplateRow>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

/**
 * The email editor. A registered template has a token form and is edited here
 * like an SMS. A sendRaw key (an internal alert, a campaign, a generated
 * contract) is shown with its trigger and the reason its body is not editable,
 * because the one thing this list must never do is imply an email does not exist.
 */
function EmailEditor({ item, onSaved }: { item: EmailTemplate; onSaved: () => void }) {
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [revisions, setRevisions] = useState<Array<{ subject: string; updatedAt: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [asking, setAsking] = useState<null | { kind: "reset" } | { kind: "restore"; index: number }>(null);

  const editing = body.trim().length > 0;
  const dirty = subject !== item.subject || body !== item.body;

  /* Preview goes through the server: same renderer, tokens and frame as a real send. */
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload: Record<string, unknown> = { channel: "email", templateKey: item.templateKey };
      if (editing) {
        payload.subject = subject;
        payload.body = body;
      }
      API.post("/api/admin/communications/preview", payload)
        .then(({ data }) => {
          const d = obj(data);
          setPreview({ subject: str(d.subject), html: str(d.html) });
          setErrors(arr(obj(d.validation).errors).map(str));
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
        const d = obj(data);
        setSettings(obj(d.settings));
        setRevisions(arr(d.revisions).map((r) => ({ subject: str(obj(r).subject), updatedAt: str(obj(r).updatedAt) })));
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
      .catch((err) => setErrors(responseErrors(err, "Save failed.")))
      .finally(() => setBusy(false));
  };

  const confirmAsked = async () => {
    if (!asking) return;
    if (asking.kind === "reset") {
      const { data } = await API.post(`/api/admin/communications/templates/email/${item.templateKey}/reset`);
      setSubject(str(obj(data).subject));
      setBody("");
      setSaved("Reset to default.");
    } else {
      const { data } = await API.post(`/api/admin/communications/templates/email/${item.templateKey}/restore/${asking.index}`);
      setSubject(str(obj(data).subject));
      setBody(str(obj(data).body));
      setSaved("Restored.");
    }
    setErrors([]);
    onSaved();
  };

  return (
    <div className="border-t border-adm-line px-4 py-4">
      <Field label="Subject">
        <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field
        label="Body"
        className="mt-4"
        help="# heading · **bold** · - list item · [label](https://…) link · blank line = new paragraph. HTML is not allowed; the Profixter frame, header and footer are added automatically."
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          spellCheck
          placeholder={item.hasOverride ? "" : "Empty means the built-in default is used. Start typing to override it."}
          className="font-mono text-[14px]"
        />
      </Field>
      <VariableButtons variables={item.variables} required={item.protectedTokens} onInsert={(tag) => setBody((b) => `${b}${tag}`)} />
      <div className="mt-4">
        <p className="mb-1 text-[13px] font-semibold text-adm-text-2">Preview (sample data, never sent)</p>
        <p className="mb-2 break-words text-[14px] font-semibold text-adm-ink">{preview?.subject ?? "Loading…"}</p>
        <iframe title={`Preview of ${item.templateKey}`} sandbox="" srcDoc={preview?.html ?? ""} className="h-[420px] w-full rounded-adm-sm border border-adm-line bg-adm-surface" />
      </div>
      <Errors list={errors} />
      {saved ? (
        <p role="status" className="mt-3 text-[13px] font-semibold text-adm-ok">
          {saved}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} busy={busy} disabled={!dirty || !editing || errors.length > 0}>
          Save
        </Button>
        <Button variant="secondary" onClick={() => setAsking({ kind: "reset" })} disabled={busy || !item.hasOverride}>
          Reset to default
        </Button>
        <Button variant="tertiary" onClick={loadSettings}>
          {showSettings ? "Hide settings" : "Settings"}
        </Button>
      </div>
      {showSettings && revisions.length ? (
        <div className="mt-3 rounded-adm-sm border border-adm-line p-3">
          <p className="mb-1 text-[13px] font-semibold text-adm-text-2">Earlier versions</p>
          <ul className="divide-y divide-adm-line">
            {revisions.map((rev, i) => (
              <li key={`${rev.updatedAt}-${i}`} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-adm-ink">
                  {rev.subject || "(no subject)"} <span className="text-adm-text-3">· {when(rev.updatedAt)}</span>
                </span>
                <Button variant="tertiary" onClick={() => setAsking({ kind: "restore", index: revisions.length - 1 - i })}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {showSettings && settings ? <SettingsPanel settings={settings} /> : null}
      <ConfirmSheet
        open={!!asking}
        onClose={() => setAsking(null)}
        title={asking?.kind === "restore" ? "Restore this earlier version?" : `Reset "${item.label}"?`}
        consequence={
          asking?.kind === "restore"
            ? "The current wording is kept as a revision, and future sends use the restored version."
            : "The saved version is removed and future sends use the tested default email."
        }
        confirmLabel={asking?.kind === "restore" ? "Restore version" : "Reset to default"}
        onConfirm={confirmAsked}
        errorText={() => (asking?.kind === "restore" ? "Restore failed. Nothing was changed." : "Reset failed. Nothing was changed.")}
      />
    </div>
  );
}

/** A sendRaw key: shown, explained, and honestly not editable. */
function EmailInfoPanel({ item }: { item: EmailTemplate }) {
  const rows = (
    [
      ["Trigger", item.trigger],
      ["Recipients", item.audience],
      ["Class", item.channelClass],
      ["Sent from", item.source],
      ["Why not editable", item.protectedNote],
    ] as Array<[string, string]>
  ).filter((row) => Boolean(row[1]));
  return (
    <div className="border-t border-adm-line px-4 py-4">
      <div className="rounded-adm-sm bg-adm-sunk p-3">
        <p className="mb-2 text-[13px] font-semibold text-adm-text-2">
          {item.disposition === "generated" ? "Generated content: the body is a document, not a template" : "Assembled where it is sent: there is no template to edit"}
        </p>
        {rows.length ? <DefinitionList rows={rows} /> : null}
      </div>
    </div>
  );
}

function EmailList({ items, total, reload }: { items: EmailTemplate[]; total: EmailTemplate[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const editableCount = total.filter((i) => i.editable).length;
  return (
    <div className="space-y-3">
      <p className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-3 text-[14px] leading-relaxed text-adm-text-2">
        <span className="font-semibold text-adm-ink">
          {editableCount} of {total.length} email types are editable.
        </span>{" "}
        The rest are internal alerts, campaigns whose copy lives in the campaign editor, or generated documents such as contracts and invoices. They are listed with their trigger so nothing the system sends is invisible here.
      </p>
      {!items.length ? (
        <EmptyState message="No emails match." />
      ) : (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label="Emails">
          {items.map((item) => (
            <TemplateRow
              key={item.templateKey || item.label}
              title={item.label}
              keyText={item.templateKey}
              summary={item.subject || item.trigger}
              updated={item.updatedAt ? `Last updated ${when(item.updatedAt)}${item.updatedByName ? ` by ${item.updatedByName}` : ""}` : ""}
              open={open === item.templateKey}
              onToggle={() => setOpen(open === item.templateKey ? null : item.templateKey)}
              actionLabel={item.editable ? "Edit" : "Details"}
              tags={
                <>
                  {item.hasOverride ? <Tag tone="info">Edited</Tag> : null}
                  {item.disposition === "generated" ? <Tag tone="attention">Generated</Tag> : null}
                  {!item.editable && item.disposition !== "generated" ? <Tag>Not editable</Tag> : null}
                  {item.channelClass === "marketing" ? <Tag tone="attention">Marketing</Tag> : null}
                  {item.channelClass === "internal" ? <Tag>Internal</Tag> : null}
                </>
              }
            >
              {item.editable ? <EmailEditor item={item} onSaved={reload} /> : <EmailInfoPanel item={item} />}
            </TemplateRow>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review requests summary                                             */
/* ------------------------------------------------------------------ */

const sumValues = (record: unknown) => Object.values(obj(record)).reduce<number>((a, b) => a + num(b), 0);

/*
 * The post-visit review email at a glance, last 30 days: how many went out,
 * how many were held back and why, and how often the Google link was opened.
 * An open is someone reaching Google's review form, never proof that a review
 * was posted. Hidden for anyone the server does not show it to.
 */
function ReviewRequestsSummary() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    let alive = true;
    getReviewSummary(30)
      .then((next) => alive && setSummary(next && typeof next === "object" ? next : null))
      .catch(() => alive && setSummary(null));
    return () => {
      alive = false;
    };
  }, []);
  if (!summary) return null;
  const skipped = obj(summary.skipped);
  const opens = obj(summary.linkOpens);
  const held = sumValues(skipped);
  const openCount = sumValues(opens);
  const reasons = [
    num(skipped.customer_cooldown) ? `${num(skipped.customer_cooldown)} asked in the last 90 days` : "",
    num(skipped.reviewed_us) ? `${num(skipped.reviewed_us)} marked Reviewed us` : "",
    num(skipped.too_old) ? `${num(skipped.too_old)} visit too old` : "",
  ].filter(Boolean);
  const via = [
    num(opens.email) ? `${num(opens.email)} from the email` : "",
    num(opens.account) ? `${num(opens.account)} from visit history` : "",
    num(opens.home) ? `${num(opens.home)} from the homepage` : "",
    num(opens.other) ? `${num(opens.other)} other` : "",
  ].filter(Boolean);
  const reviewed = num(summary.reviewedCustomers);
  return (
    <div className="mb-4 rounded-adm-md border border-adm-line bg-adm-surface px-4 py-3" data-review-summary>
      <p className="text-[14px] font-semibold text-adm-ink">Review requests · last {num(summary.days) || 30} days</p>
      <p className="mt-1 text-[14px] text-adm-text-2">
        <span className="adm-num">{num(summary.sent)}</span> sent · <span className="adm-num">{held}</span> held back{reasons.length ? ` (${reasons.join(", ")})` : ""} · Google review link opened{" "}
        <span className="adm-num">{openCount}</span> {openCount === 1 ? "time" : "times"}
        {via.length ? ` (${via.join(", ")})` : ""}. {reviewed} {reviewed === 1 ? "customer is" : "customers are"} marked Reviewed us.
      </p>
      <p className="mt-1 text-[12px] text-adm-text-3">An open means someone reached Google&apos;s review form, not that a review was posted.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the module                                                          */
/* ------------------------------------------------------------------ */

type Tab = "sms" | "emails" | "campaign" | "history" | "sms-log";

export default function CommunicationsModule() {
  const { user } = useAdmin();
  const owner = isAdminUser(user);
  const [tab, setTab] = useState<Tab>("sms");
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
      const d = obj(data);
      setSms(arr(d.sms).map(readSms));
      setEmail(arr(d.email).map(readEmail));
      setProtectedContent(arr(d.protectedContent).map(readProtected));
      setError("");
    } catch {
      setError("Could not load communication templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filteredSms = useMemo(
    () => (q ? sms.filter((r) => [r.label, r.templateKey, r.preview.body].some((v) => v.toLowerCase().includes(q))) : sms),
    [sms, q]
  );
  const filteredEmail = useMemo(
    () => (q ? email.filter((r) => [r.label, r.templateKey, r.subject].some((v) => v.toLowerCase().includes(q))) : email),
    [email, q]
  );

  const tabs = [
    { id: "sms", label: "Texts", count: loading ? undefined : sms.length },
    { id: "emails", label: "Emails", count: loading ? undefined : email.length },
    { id: "campaign", label: "Campaign" },
    { id: "history", label: "Send history" },
    ...(owner ? [{ id: "sms-log", label: "SMS log" }] : []),
  ];

  const templates = tab === "sms" || tab === "emails";

  return (
    <div data-communications>
      <p className="mb-4 text-[14px] text-adm-text-2">
        Every system email and text message. Editing a message changes future sends only; what a customer was already told stays exactly as it was sent.
      </p>

      <ErrorBoundary label="Review requests">
        <ReviewRequestsSummary />
      </ErrorBoundary>

      <Tabs items={tabs} value={tab} onChange={(id) => setTab(id as Tab)} label="Communications" className="mb-4" />

      {templates ? (
        <SearchField label="Search messages" placeholder="Search by name, key or content" value={query} onChange={setQuery} className="mb-4 sm:max-w-md" />
      ) : null}

      <ErrorBoundary label={tabs.find((t) => t.id === tab)?.label || "Communications"} resetKey={tab}>
        {templates && error ? (
          <ErrorState message={error} onRetry={load} />
        ) : templates && loading ? (
          <SkeletonRows count={5} leading={false} />
        ) : tab === "sms" ? (
          <>
            <SmsList items={filteredSms} reload={load} />
            {protectedContent.length ? (
              <div className="mt-5 rounded-adm-md border border-adm-line bg-adm-surface p-4">
                <p className="mb-2 text-[13px] font-semibold text-adm-text-2">System-managed content (cannot be removed by editing a body)</p>
                <ul className="space-y-2">
                  {protectedContent.map((p) => (
                    <li key={p.id} className="text-[14px] leading-relaxed text-adm-ink">
                      <span className="font-semibold">{p.text}</span> <span className="text-adm-text-2">({p.applies})</span> · {p.enforcement}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : tab === "emails" ? (
          <EmailList items={filteredEmail} total={email} reload={load} />
        ) : tab === "campaign" ? (
          <EmailComposer />
        ) : tab === "history" ? (
          <EmailHistory />
        ) : (
          <SmsLog />
        )}
      </ErrorBoundary>
    </div>
  );
}
