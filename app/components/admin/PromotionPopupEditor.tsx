"use client";

import { useEffect, useState } from "react";
import PromotionPopupCard from "@/app/components/promotion/PromotionPopupCard";
import {
  EMPTY_PROMOTION_POPUP,
  getPromotionPopup,
  savePromotionPopup,
  type PromotionPopup,
} from "@/lib/promotion-popup";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

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

export default function PromotionPopupEditor() {
  const [popup, setPopup] = useState<PromotionPopup>(EMPTY_PROMOTION_POPUP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void getPromotionPopup()
      .then((data) => setPopup(data))
      .catch(() => setError("Failed to load promotion popup settings."))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof PromotionPopup>(
    key: K,
    value: PromotionPopup[K]
  ) => {
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
      setPopup(saved);
      setMessage("Promotion popup settings saved.");
    } catch (saveError) {
      const responseMessage =
        typeof saveError === "object" &&
        saveError !== null &&
        "response" in saveError
          ? (
              saveError as {
                response?: { data?: { message?: string } };
              }
            ).response?.data?.message
          : undefined;
      setError(responseMessage || "Failed to save promotion popup.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading popup settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Promotion Popup</h2>
          <p className="mt-1 text-sm text-slate-500">
            Control the visitor popup without changing customer account flows.
          </p>
          {popup.updatedAt ? (
            <p className="mt-2 text-xs text-slate-400">
              Last updated{" "}
              {new Date(popup.updatedAt).toLocaleString("en-US", {
                timeZone: "America/New_York",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>
        <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={popup.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
            className="h-5 w-5 accent-blue-600"
          />
          <span className="text-sm font-bold text-slate-800">
            Popup enabled
          </span>
        </label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Eyebrow text
              </span>
              <input
                className={inputClass}
                value={popup.eyebrow}
                onChange={(event) => update("eyebrow", event.target.value)}
                placeholder="Profixter update"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Title
              </span>
              <input
                className={inputClass}
                value={popup.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="A helpful offer for your home"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Message
              </span>
              <textarea
                className={`${inputClass} min-h-24 resize-y py-3`}
                value={popup.message}
                onChange={(event) => update("message", event.target.value)}
                placeholder="Keep the message concise and useful."
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Promo code
              </span>
              <input
                className={inputClass}
                value={popup.promoCode}
                onChange={(event) =>
                  update("promoCode", event.target.value.toUpperCase())
                }
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Target pages
              </span>
              <select
                className={inputClass}
                value={popup.target}
                onChange={(event) =>
                  update(
                    "target",
                    event.target.value as PromotionPopup["target"]
                  )
                }
              >
                <option value="homepage">Homepage only</option>
                <option value="all_public">All public visitor pages</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Primary button text
              </span>
              <input
                className={inputClass}
                value={popup.ctaText}
                onChange={(event) => update("ctaText", event.target.value)}
                placeholder="View offer"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Primary button URL
              </span>
              <input
                className={inputClass}
                value={popup.ctaUrl}
                onChange={(event) => update("ctaUrl", event.target.value)}
                placeholder="/membership or https://..."
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Secondary button text
              </span>
              <input
                className={inputClass}
                value={popup.secondaryText}
                onChange={(event) =>
                  update("secondaryText", event.target.value)
                }
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Secondary button URL
              </span>
              <input
                className={inputClass}
                value={popup.secondaryUrl}
                onChange={(event) =>
                  update("secondaryUrl", event.target.value)
                }
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Start date
              </span>
              <input
                type="datetime-local"
                className={inputClass}
                value={toLocalDateTime(popup.startAt)}
                onChange={(event) =>
                  update("startAt", toIso(event.target.value))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                End date
              </span>
              <input
                type="datetime-local"
                className={inputClass}
                value={toLocalDateTime(popup.endAt)}
                onChange={(event) =>
                  update("endAt", toIso(event.target.value))
                }
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Internal admin note
              </span>
              <input
                className={inputClass}
                value={popup.internalNote || ""}
                onChange={(event) =>
                  update("internalNote", event.target.value)
                }
                placeholder="Optional note; never shown publicly"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-12 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save popup"}
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(
                  "profixter_promotion_popup_dismissed_date"
                );
                setMessage("Visitor dismissal reset on this browser.");
              }}
              className="h-12 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Reset visitor dismissal
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-inner sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Exact preview
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Preview works even when the popup is disabled.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                popup.enabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {popup.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex min-h-[540px] items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#dbeafe,#e2e8f0_55%,#cbd5e1)] p-3 sm:p-6">
            <PromotionPopupCard popup={popup} preview />
          </div>
        </div>
      </div>
    </div>
  );
}
