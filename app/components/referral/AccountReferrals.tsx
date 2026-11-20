"use client";

import { useCallback, useEffect, useState } from "react";
import "./referral.css";
import ReferralPopup from "./ReferralPopup";
import { getMyReferrals, money, savePayee, type MyReferrals, type PayeeInput, type ReferralReward } from "@/lib/referral";
import { readApiError, startReauth, verifyReauth } from "@/lib/auth2";

/**
 * The account's referral card: the way into the referral popup, and the
 * rewards the customer's link has earned (Pending, Ready, Approved, Check
 * mailed), with the one thing they may need to do - say where to mail the
 * check. Saving that needs a fresh "confirm it's you" code, like changing a
 * verified email or phone (BackEnd routes/referrals.js).
 *
 * The popup also opens by itself once in a while on the account overview
 * (AUTO_KEY): a customer who never scrolls this far still hears about it.
 * Any signed-in customer, member or not.
 */

const AUTO_KEY = "pf_referral_popup_at";
const AUTO_EVERY_MS = 30 * 24 * 60 * 60 * 1000;
const AUTO_DELAY_MS = 1200;

const PILL: Record<string, string> = { pending: "rf-pill--pending", eligible: "rf-pill--ready", approved: "rf-pill--ready", mailed: "rf-pill--done" };

function readAuto(): number {
  try {
    return Number(window.localStorage.getItem(AUTO_KEY) || 0);
  } catch {
    return Date.now(); // storage blocked: never auto-open (it would open on every visit)
  }
}
function markAuto() {
  try {
    window.localStorage.setItem(AUTO_KEY, String(Date.now()));
  } catch {
    /* not remembered */
  }
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function AccountReferrals({
  defaultName = "",
  defaultAddress = null,
  autoOpen = true,
}: {
  defaultName?: string;
  defaultAddress?: { line1?: string; unit?: string; city?: string; state?: string; zip?: string } | null;
  autoOpen?: boolean;
}) {
  const [data, setData] = useState<MyReferrals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getMyReferrals());
    } catch {
      setError("Your link couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // From an email ("Confirm where to mail it"): straight to this card.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("referrals") === "1") {
      window.setTimeout(() => document.getElementById("acct-referrals")?.scrollIntoView({ block: "start" }), 300);
    }
  }, []);

  useEffect(() => {
    if (!autoOpen || !data?.eligible || !data.url) return;
    if (new URLSearchParams(window.location.search).get("referrals") === "1") return;
    if (Date.now() - readAuto() < AUTO_EVERY_MS) return;
    const t = window.setTimeout(() => {
      // Never on top of another OPEN dialog (Manage plan, the phone gate); the closed menu sheet stays in the page, hidden.
      const shown = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].some((d) => {
        const r = d.getBoundingClientRect();
        const cs = getComputedStyle(d);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05 && d.closest("[inert], [aria-hidden='true']") === null;
      });
      if (shown) return;
      markAuto();
      setOpen(true);
    }, AUTO_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [autoOpen, data]);

  const close = useCallback(() => {
    markAuto();
    setOpen(false);
  }, []);

  if (data && !data.eligible) return null;

  const rewards = data?.rewards || [];
  const replace = (r: ReferralReward) => setData((d) => (d ? { ...d, rewards: d.rewards.map((x) => (x.id === r.id ? r : x)) } : d));

  return (
    <section className="acct-card" aria-labelledby="acct-referrals" data-account-referrals="">
      <h2 id="acct-referrals" className="acct-card__title">
        Refer a friend
      </h2>
      <p className="acct-card__text">
        Get up to <b className="rf-card__amount">$149</b> per referral. The Basic plan qualifies, too.
      </p>
      <div className="acct-card__actions">
        <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => setOpen(true)} data-open-referral="">
          Share my link
        </button>
      </div>

      {rewards.length ? (
        <ul className="rf-list" data-referral-rewards="">
          {rewards.map((r) => (
            <li key={r.id} className="rf-item" data-referral-reward={r.status}>
              <div className="rf-item__top">
                <span className="rf-item__name">{r.friend}</span>
                {r.amountCents > 0 ? <span className="rf-item__amount">{money(r.amountCents)}</span> : null}
              </div>
              <div className="rf-item__meta">
                <span className={`rf-pill ${PILL[r.status] || ""}`}>{r.statusLabel}</span>
                {r.plan ? `${r.plan} membership` : ""}
                {r.status === "mailed" && r.mailedAt ? ` · mailed ${date(r.mailedAt)}` : ""}
              </div>
              {r.note ? <p className="rf-item__meta">{r.note}</p> : null}
              {r.payee.confirmed ? (
                <p className="rf-item__meta" data-referral-payee="">
                  Check to {r.payee.name}, {r.payee.address}.{" "}
                  {r.canEditPayee && editing !== r.id ? (
                    <button type="button" className="ui-link" onClick={() => setEditing(r.id)}>
                      Change
                    </button>
                  ) : null}
                </p>
              ) : r.needsPayee && editing !== r.id ? (
                <div className="mt-2">
                  <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => setEditing(r.id)} data-referral-payee-open="">
                    Confirm where to mail it
                  </button>
                </div>
              ) : null}
              {editing === r.id ? (
                <PayeeForm
                  reward={r}
                  defaultName={defaultName}
                  defaultAddress={defaultAddress}
                  onCancel={() => setEditing("")}
                  onSaved={(next) => {
                    replace(next);
                    setEditing("");
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <ReferralPopup open={open} onClose={close} data={data} loading={loading} error={error} onRetry={load} />
    </section>
  );
}

function PayeeForm({
  reward,
  defaultName,
  defaultAddress,
  onCancel,
  onSaved,
}: {
  reward: ReferralReward;
  defaultName: string;
  defaultAddress: { line1?: string; unit?: string; city?: string; state?: string; zip?: string } | null;
  onCancel: () => void;
  onSaved: (r: ReferralReward) => void;
}) {
  const [f, setF] = useState<PayeeInput>({
    name: reward.payee.confirmed ? reward.payee.name : defaultName,
    line1: defaultAddress?.line1 || "",
    line2: defaultAddress?.unit || "",
    city: defaultAddress?.city || "",
    state: defaultAddress?.state || "NY",
    zip: defaultAddress?.zip || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "code">("form");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const set = (k: keyof PayeeInput) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (token?: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await savePayee(reward.id, f, token);
      onSaved(res.reward);
    } catch (err) {
      const e = readApiError(err);
      if (e.code === "REAUTH_REQUIRED") setStep("confirm");
      else setError(e.message || "That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (ch: "sms" | "email") => {
    setBusy(true);
    setError("");
    try {
      const res = await startReauth(ch);
      setChannel(ch);
      setDestination(res.destination || "");
      setStep("code");
    } catch (err) {
      const e = readApiError(err);
      setError(
        e.code === "REAUTH_UNAVAILABLE"
          ? ch === "sms"
            ? "There's no confirmed mobile number on your account. Try email, or call us at (631) 599-1363."
            : "There's no confirmed email on your account. Try a text, or call us at (631) 599-1363."
          : e.message || "The code couldn't be sent. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await verifyReauth(channel, code.trim());
      await save(res.reauthToken);
    } catch (err) {
      setError(readApiError(err).message || "That code didn't work. Please try again.");
      setBusy(false);
    }
  };

  if (step === "confirm" || step === "code") {
    return (
      <div className="rf-form" data-referral-reauth="">
        <p className="rf-item__meta">To keep your check safe, confirm it&rsquo;s you first.</p>
        {step === "confirm" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={busy} onClick={() => sendCode("sms")}>
              Text me a code
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" disabled={busy} onClick={() => sendCode("email")}>
              Email me a code
            </button>
          </div>
        ) : (
          <>
            <label>
              Code sent to {destination || (channel === "sms" ? "your phone" : "your email")}
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={busy || code.trim().length < 4} onClick={confirm}>
                Confirm and save
              </button>
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={busy} onClick={() => setStep("confirm")}>
                Send another code
              </button>
            </div>
          </>
        )}
        {error ? <p className="acct-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <form
      className="rf-form"
      data-referral-payee-form=""
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="rf-item__meta">Who should the check be made out to, and where should we mail it?</p>
      <label>
        Name on the check
        <input value={f.name} onChange={set("name")} autoComplete="name" required maxLength={100} />
      </label>
      <label>
        Street address
        <input value={f.line1} onChange={set("line1")} autoComplete="address-line1" required maxLength={120} />
      </label>
      <label>
        Apt, suite (optional)
        <input value={f.line2} onChange={set("line2")} autoComplete="address-line2" maxLength={80} />
      </label>
      <div className="rf-form__row">
        <label>
          City
          <input value={f.city} onChange={set("city")} autoComplete="address-level2" required maxLength={60} />
        </label>
        <label>
          State
          <input value={f.state} onChange={set("state")} autoComplete="address-level1" required maxLength={2} />
        </label>
        <label>
          ZIP
          <input value={f.zip} onChange={set("zip")} autoComplete="postal-code" inputMode="numeric" required maxLength={10} />
        </label>
      </div>
      {error ? <p className="acct-error" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" disabled={busy}>
          Save mailing details
        </button>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
