"use client";

import { useEffect, useState } from "react";
import PromotionPopupCard from "@/app/components/promotion/PromotionPopupCard";
import {
  EMPTY_PROMOTION_POPUP,
  getPromotionPopup,
  savePromotionPopup,
  type PromotionPopup,
} from "@/lib/promotion-popup";
import { Button, ErrorState, Field, Select, SkeletonRows, StatusBadge, TextInput, Textarea } from "@/app/components/admin/ui";

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

const TARGETS = [
  { value: "homepage", label: "Homepage only" },
  { value: "all_public", label: "All public visitor pages" },
];

export default function PromotionPopupEditor() {
  const [popup, setPopup] = useState<PromotionPopup>(EMPTY_PROMOTION_POPUP);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError("");
    return getPromotionPopup()
      .then((data) => setPopup(data && typeof data === "object" ? { ...EMPTY_PROMOTION_POPUP, ...data } : EMPTY_PROMOTION_POPUP))
      .catch(() => setLoadError("Failed to load promotion popup settings."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
  }, []);

  const update = <K extends keyof PromotionPopup>(key: K, value: PromotionPopup[K]) => {
    setPopup((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await savePromotionPopup(popup);
      setPopup(saved && typeof saved === "object" ? { ...EMPTY_PROMOTION_POPUP, ...saved } : popup);
      setMessage("Promotion popup settings saved.");
    } catch (saveError) {
      const responseMessage = (saveError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(responseMessage || "Failed to save promotion popup.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonRows count={6} leading={false} label="Loading popup settings" />;
  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return (
    <div className="space-y-4" data-promotion-editor>
      <div className="flex flex-col gap-3 rounded-adm-md border border-adm-line bg-adm-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[14px] text-adm-text-2">Control the visitor popup without changing customer account flows.</p>
          {popup.updatedAt ? (
            <p className="mt-1 text-[12px] text-adm-text-3">
              Last updated{" "}
              {new Date(popup.updatedAt).toLocaleString("en-US", {
                timeZone: "America/New_York",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 rounded-adm-sm border border-adm-line bg-adm-sunk px-4">
          <input
            type="checkbox"
            checked={popup.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
            className="h-5 w-5 accent-adm-accent"
          />
          <span className="text-[14px] font-semibold text-adm-ink">Popup enabled</span>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-adm-md border border-adm-line bg-adm-surface p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow text" className="sm:col-span-2">
              <TextInput value={popup.eyebrow} onChange={(event) => update("eyebrow", event.target.value)} placeholder="Profixter update" />
            </Field>
            <Field label="Title" className="sm:col-span-2">
              <TextInput value={popup.title} onChange={(event) => update("title", event.target.value)} placeholder="A helpful offer for your home" />
            </Field>
            <Field label="Message" className="sm:col-span-2">
              <Textarea value={popup.message} onChange={(event) => update("message", event.target.value)} rows={4} placeholder="Keep the message concise and useful." />
            </Field>
            <Field label="Promo code">
              <TextInput value={popup.promoCode} onChange={(event) => update("promoCode", event.target.value.toUpperCase())} placeholder="Optional" autoCapitalize="characters" />
            </Field>
            <Field label="Target pages">
              <Select
                value={popup.target}
                onChange={(event) => update("target", event.target.value as PromotionPopup["target"])}
                options={TARGETS}
              />
            </Field>
            <Field label="Primary button text">
              <TextInput value={popup.ctaText} onChange={(event) => update("ctaText", event.target.value)} placeholder="View offer" />
            </Field>
            <Field label="Primary button URL">
              <TextInput value={popup.ctaUrl} onChange={(event) => update("ctaUrl", event.target.value)} placeholder="/membership or https://..." inputMode="url" />
            </Field>
            <Field label="Secondary button text">
              <TextInput value={popup.secondaryText} onChange={(event) => update("secondaryText", event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Secondary button URL">
              <TextInput value={popup.secondaryUrl} onChange={(event) => update("secondaryUrl", event.target.value)} placeholder="Optional" inputMode="url" />
            </Field>
            <Field label="Start date">
              <TextInput type="datetime-local" value={toLocalDateTime(popup.startAt)} onChange={(event) => update("startAt", toIso(event.target.value))} />
            </Field>
            <Field label="End date">
              <TextInput type="datetime-local" value={toLocalDateTime(popup.endAt)} onChange={(event) => update("endAt", toIso(event.target.value))} />
            </Field>
            <Field label="Internal admin note" className="sm:col-span-2">
              <TextInput value={popup.internalNote || ""} onChange={(event) => update("internalNote", event.target.value)} placeholder="Optional note; never shown publicly" />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] font-medium text-adm-problem">
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="mt-4 rounded-adm-sm bg-adm-ok-bg px-3 py-2 text-[14px] font-medium text-adm-ok">
              {message}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button large onClick={save} busy={saving}>
              Save popup
            </Button>
            <Button
              variant="secondary"
              large
              onClick={() => {
                try {
                  localStorage.removeItem("profixter_promotion_popup_dismissed_date");
                } catch {
                  /* storage blocked: nothing to reset */
                }
                setMessage("Visitor dismissal reset on this browser.");
              }}
            >
              Reset visitor dismissal
            </Button>
          </div>
        </div>

        <div className="rounded-adm-md border border-adm-line bg-adm-sunk p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-adm-text-2">Exact preview</div>
              <p className="mt-0.5 text-[12px] text-adm-text-3">Preview works even when the popup is disabled.</p>
            </div>
            <StatusBadge tone={popup.enabled ? "success" : "neutral"}>{popup.enabled ? "Enabled" : "Disabled"}</StatusBadge>
          </div>
          <div className="flex min-h-[480px] items-center justify-center overflow-hidden rounded-adm-sm bg-adm-surface p-3 sm:p-6">
            <PromotionPopupCard popup={popup} preview />
          </div>
        </div>
      </div>
    </div>
  );
}
