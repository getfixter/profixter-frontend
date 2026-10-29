"use client";

/**
 * Claiming a gift.
 *
 * The screen with the most states, and the one where wording matters most.
 *
 * THE DISTINCTION THIS FILE EXISTS TO GET RIGHT: an expired LINK is not an
 * expired GIFT. The money was paid, the gift is intact, and a fresh invitation
 * can be issued. Telling somebody their gift expired when it has not would be
 * both false and upsetting, so that case has its own state and its own copy.
 *
 * Authentication preserves the token. Signing in or registering carries
 * ?next=/gift/claim/<token>, which both auth pages already honour through
 * safeReturnPath — so the link survives the round trip and nobody has to find
 * the email again.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import DigitalGiftHero from "@/app/components/gift/DigitalGiftHero";
import { useAuth } from "@/lib/useAuth";
import {
  GiftError,
  claimGift,
  formatGiftDate,
  getClaimDetails,
  getClaimPreview,
  monthsLabel,
  planLabel,
  type ClaimDetails,
  type ClaimPreview,
} from "@/lib/gift-service";
import "../../gift.css";

type Address = {
  _id: string;
  label?: string;
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type Claimed = {
  plan: string;
  durationMonths: number;
  from: string;
  startAt: string;
  endAt: string;
  activeThrough: string;
  queued: boolean;
};

type Phase =
  | { kind: "loading" }
  | { kind: "preview"; gift: ClaimPreview & { hasAccount: boolean } }
  | { kind: "claimed"; result: Claimed }
  | { kind: "error"; code: string; title: string; body: string; showSignOut?: boolean };

/** One consistent way to describe a failure, so no raw API text ever shows. */
function errorPhase(error: unknown): Phase {
  const giftError = error instanceof GiftError ? error : null;
  const code = giftError?.code || "UNKNOWN";

  const copy: Record<string, { title: string; body: string; showSignOut?: boolean }> = {
    /*
     * The important one. The LINK expired; the gift did not. Nothing about
     * this message may suggest the purchaser lost their money.
     */
    LINK_EXPIRED: {
      title: "This invitation link has expired",
      body:
        "Links expire after a while for security — but your gift has not. It is still here, and " +
        "we can send you a fresh invitation. Get in touch and we will sort it out.",
    },
    LINK_SUPERSEDED: {
      title: "There is a newer invitation",
      body:
        "A more recent invitation was sent for this gift. Please open the most recent email from " +
        "ProFixter and use the link in that one.",
    },
    ALREADY_CLAIMED: {
      title: "This gift has already been claimed",
      body:
        "It is already on an account. If that was you, you will find it under your membership. " +
        "If you think this is a mistake, get in touch.",
    },
    RECIPIENT_MISMATCH: {
      title: "This gift was sent to a different account",
      body:
        "The invitation was sent to another email address. Sign out and sign back in with the " +
        "address the invitation was sent to, then open the link again.",
      showSignOut: true,
    },
    CANCELLED: {
      title: "This gift is no longer available",
      body: "It has been cancelled. If you were expecting it, please get in touch and we will help.",
    },
    INVALID: {
      title: "This gift link is not valid",
      body:
        "The link may have been copied incompletely. Try opening it directly from the email, or " +
        "get in touch and we will send a new one.",
    },
    FEATURE_OFF: {
      title: "Gift memberships are not available",
      body: "Gift memberships are not live just yet. Please get in touch and we will help.",
    },
    NETWORK: {
      title: "We could not reach ProFixter",
      body: "Check your connection and try again.",
    },
    UNKNOWN: {
      title: "Something went wrong",
      body: "We could not load this gift. Please try again, or get in touch and we will help.",
    },
  };

  const chosen = copy[code] || copy.UNKNOWN;
  return { kind: "error", code, ...chosen };
}

export default function GiftClaimClient({ token }: { token: string }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [chosenAddressId, setChosenAddressId] = useState<string>("");
  const [claimError, setClaimError] = useState<string | null>(null);

  /*
   * The address hint is not in the public payload — it is somebody's home,
   * and the claim link is readable by anyone it reaches. Fetched separately
   * once the viewer is signed in and the server has checked they are the
   * intended recipient.
   */
  const [details, setDetails] = useState<ClaimDetails | null>(null);

  const [claiming, setClaiming] = useState(false);
  const claimLock = useRef(false);

  const returnTo = `/gift/claim/${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const gift = await getClaimPreview(token);
        if (!cancelled) setPhase({ kind: "preview", gift });
      } catch (error) {
        if (!cancelled) setPhase(errorPhase(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /*
   * The address hint, once the viewer is signed in.
   *
   * A separate authenticated request on purpose: the server only releases it
   * after checking that this account is the intended recipient, so a
   * forwarded link in the wrong hands never sees somebody's home address.
   * Failure is silent — the claim works without the hint, it just cannot say
   * which property the purchaser had in mind.
   */
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      const found = await getClaimDetails(token);
      if (!cancelled && found) setDetails(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated]);

  /*
   * The recipient's own saved properties.
   *
   * A membership is scoped to one home, and the address must live on THEIR
   * account — the purchaser could not create it for them. So the choice is
   * made from what they already have, and adding one uses the existing account
   * address flow rather than a second address form built here.
   *
   * Derived rather than copied into state by an effect: this is a pure
   * function of the signed-in user, and mirroring it would mean a render where
   * the two disagree.
   */
  const addresses = useMemo<Address[]>(() => {
    if (!isAuthenticated || !user) return [];
    const list = (user as { addresses?: Address[] }).addresses;
    return Array.isArray(list) ? list : [];
  }, [isAuthenticated, user]);

  /*
   * Which property is pre-selected.
   *
   * The one whose street matches what the purchaser typed, so the common case
   * is a single tap and nobody has to work out which of their homes was meant.
   * Falls back to the first.
   */
  const defaultAddressId = useMemo(() => {
    if (!addresses.length) return "";
    const snapshot = details?.addressSnapshot || null;
    const wanted = String(snapshot?.line1 || "").trim().toLowerCase();
    const match = wanted
      ? addresses.find((a) => String(a.line1 || "").trim().toLowerCase() === wanted)
      : null;
    return String((match || addresses[0])._id);
    /*
     * Keyed on the details, not the phase. The address hint arrives from a
     * second request after the preview has rendered, so keying on the phase
     * left the match unused and always fell back to the first property.
     */
  }, [addresses, details]);

  /* The customer's own choice wins once they make one. */
  const addressId = chosenAddressId || defaultAddressId;

  const handleClaim = useCallback(async () => {
    if (claimLock.current) return;
    if (!addressId) {
      setClaimError("Choose which property this membership is for.");
      return;
    }

    claimLock.current = true;
    setClaiming(true);
    setClaimError(null);

    try {
      const result = await claimGift(token, addressId);
      setPhase({ kind: "claimed", result: result.gift });
    } catch (error) {
      const giftError = error instanceof GiftError ? error : null;
      // A wrong account, an already-claimed gift or a dead link are not
      // inline validation problems — they replace the screen.
      if (
        giftError &&
        ["RECIPIENT_MISMATCH", "ALREADY_CLAIMED", "LINK_EXPIRED", "LINK_SUPERSEDED", "CANCELLED", "INVALID"].includes(
          giftError.code
        )
      ) {
        setPhase(errorPhase(giftError));
      } else {
        setClaimError(giftError?.message || "We could not claim this gift. Please try again.");
      }
      claimLock.current = false;
      setClaiming(false);
    }
  }, [token, addressId]);

  /* ---------------------------------------------------------------------- */

  if (phase.kind === "loading" || authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <div className="gf-spinner" role="status" aria-label="Loading your gift" />
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
        <div className="ui-card text-center sm:p-8">
          <h1 className="ui-h2">
            {phase.title}
          </h1>
          <p className="ui-body mx-auto mt-3 max-w-sm text-[color:var(--ui-text-2)]">
            {phase.body}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {phase.showSignOut ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push(`/signin?next=${encodeURIComponent(returnTo)}`);
                }}
                className="ui-btn ui-btn--primary min-h-[48px]"
              >
                Sign out and use a different account
              </button>
            ) : null}
            <Link
              href="/"
              className="ui-btn ui-btn--secondary min-h-[48px]"
            >
              Go to ProFixter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- Claimed ------------------------------- */
  if (phase.kind === "claimed") {
    const { result } = phase;
    return (
      <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
        <div className="text-center">
          <div className="gf-check mx-auto" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/*
            Queued and active are genuinely different outcomes and are never
            conflated. Telling somebody their membership is active when it does
            not start for three weeks would be a lie they discover at the worst
            possible moment — when they try to book.
          */}
          <h1 className="ui-h2 mt-5">
            {result.queued ? "Your gift is ready" : "Your gift membership is active"}
          </h1>
        </div>

        <div className="ui-card mt-6 text-center">
          <p className="ui-h3">
            {planLabel(result.plan)}
            <span className="ml-2 text-[15px] font-normal text-[color:var(--ui-text-3)]">
              &middot; {monthsLabel(result.durationMonths)}
            </span>
          </p>

          {result.queued ? (
            <p className="ui-body mt-3 text-[color:var(--ui-text-2)]">
              It starts on{" "}
              <span className="font-medium text-[color:var(--ui-ink)]">{formatGiftDate(result.startAt)}</span>,
              when your current membership ends, and runs through{" "}
              <span className="font-medium text-[color:var(--ui-ink)]">{formatGiftDate(result.endAt)}</span>.
              None of the gifted time overlaps with what you are already paying for.
            </p>
          ) : (
            <p className="ui-body mt-3 text-[color:var(--ui-text-2)]">
              Active through{" "}
              <span className="font-medium text-[color:var(--ui-ink)]">
                {result.activeThrough || formatGiftDate(result.endAt)}
              </span>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {result.queued ? (
            <Link
              href="/account?tab=plan"
              className="ui-btn ui-btn--primary min-h-[48px]"
            >
              View your membership
            </Link>
          ) : (
            <Link
              href="/book?visit=membership"
              className="ui-btn ui-btn--primary min-h-[48px]"
            >
              Book your Fixter
            </Link>
          )}
          <Link
            href="/account?tab=plan"
            className="ui-btn ui-btn--secondary min-h-[48px]"
          >
            Go to your account
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------- Preview ------------------------------- */
  /*
   * The recipient sees the GIFT first, then the mechanics.
   *
   * The old screen opened on a heading and a form, which is how you tell
   * somebody they have received a document. The reveal below is the whole
   * point of the feature: the card, who it is from, what they wrote, and one
   * way forward. Everything needed to actually claim it lives under #claim,
   * one tap away and reachable by keyboard.
   */
  const { gift } = phase;

  return (
    <div className="bg-[#070D18]">
      <DigitalGiftHero
        occasion={gift.occasion}
        plan={gift.plan}
        durationMonths={gift.durationMonths}
        recipientFirstName={gift.recipientFirstName}
        from={gift.from}
        personalMessage={gift.personalMessage}
        actionNote={`Your ${monthsLabel(gift.durationMonths).toLowerCase()} start when you claim.`}
        action={
          <a
            href="#claim"
            className="gift-cta inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] px-8 text-[15px] font-semibold tracking-[0.02em] text-[#1A1206] sm:w-auto sm:text-[16px]"
          >
            Claim your gift
            <span aria-hidden="true">&rarr;</span>
          </a>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* Claiming. Unchanged behaviour, on a surface that can be read.     */}
      {/* ---------------------------------------------------------------- */}
      <section id="claim" className="ui-section ui-section--soft scroll-mt-20 px-[var(--ui-gutter)]">
        <div className="mx-auto w-full max-w-[560px]">
          {!isAuthenticated ? (
            <div className="ui-card ui-card--raised sm:p-7">
              <h2 className="ui-h3">Claim your gift</h2>
              <p className="ui-body mt-2 text-[color:var(--ui-text-2)]">
                The invitation was sent to{" "}
                <span className="break-words font-medium text-[color:var(--ui-ink)]">
                  {gift.recipientEmailHint}
                </span>
                , so use that address.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                {/* The token rides along in ?next=, so the link survives sign-in. */}
                <Link
                  href={
                    gift.hasAccount
                      ? `/signin?next=${encodeURIComponent(returnTo)}`
                      : `/signup?next=${encodeURIComponent(returnTo)}`
                  }
                  className="ui-btn ui-btn--primary min-h-[48px]"
                >
                  {gift.hasAccount ? "Sign in to claim" : "Create an account to claim"}
                </Link>
                <Link
                  href={
                    gift.hasAccount
                      ? `/signup?next=${encodeURIComponent(returnTo)}`
                      : `/signin?next=${encodeURIComponent(returnTo)}`
                  }
                  className="ui-btn ui-btn--secondary min-h-[48px]"
                >
                  {gift.hasAccount ? "I need an account" : "I already have an account"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="ui-card ui-card--raised sm:p-7">
              <h2 className="ui-h3">Which property is it for?</h2>
              <p className="ui-small mt-1.5">
                A membership covers one home.
                {details?.addressSnapshot?.line1 ? (
                  <>
                    {" "}
                    The person who sent it had{" "}
                    <span className="font-medium text-[color:var(--ui-ink)]">
                      {details.addressSnapshot.line1}
                    </span>{" "}
                    in mind.
                  </>
                ) : null}
              </p>

              {addresses.length ? (
                <fieldset className="mt-4 space-y-2">
                  <legend className="sr-only">Choose a property</legend>
                  {addresses.map((address) => (
                    <label
                      key={address._id}
                      className={[
                        "flex min-h-[56px] cursor-pointer items-start gap-3 rounded-[var(--ui-r-sm)] border p-3.5 transition",
                        addressId === String(address._id)
                          ? "border-[color:var(--ui-ink)] bg-[#fbfbfa] shadow-[inset_0_0_0_1px_var(--ui-ink)]"
                          : "border-[color:var(--ui-line-2)] bg-white hover:border-[#b9c1cd]",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="addressId"
                        value={String(address._id)}
                        checked={addressId === String(address._id)}
                        onChange={() => setChosenAddressId(String(address._id))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B1628]"
                      />
                      <span className="min-w-0 text-[15px] leading-snug text-[color:var(--ui-ink)]">
                        <span className="block break-words font-medium">{address.line1}</span>
                        <span className="block break-words text-[14px] text-[color:var(--ui-text-3)]">
                          {address.city}, {address.state} {address.zip}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                /*
                 * No saved property. Sent to the existing account address flow
                 * rather than given a second address form here — the recipient
                 * owns the address, and there should be one place it is created.
                 */
                <div className="mt-4 rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-soft)] p-4">
                  <p className="ui-small text-[color:var(--ui-text-2)]">
                    You do not have a property saved yet. Add one to your account, then come back
                    to this link to claim your gift.
                  </p>
                  <Link
                    href={`/account?tab=personal&next=${encodeURIComponent(returnTo)}`}
                    className="ui-btn ui-btn--primary mt-3 min-h-[44px]"
                  >
                    Add your property
                  </Link>
                </div>
              )}

              {claimError ? (
                <p role="alert" className="gf-alert mt-4">
                  {claimError}
                </p>
              ) : null}

              {addresses.length ? (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  aria-busy={claiming}
                  className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block mt-5 min-h-[52px]"
                >
                  {claiming ? (
                    <>
                      <span className="gf-spinner gf-spinner--sm" aria-hidden />
                      Claiming&hellip;
                    </>
                  ) : (
                    "Claim your gift"
                  )}
                </button>
              ) : null}

              <p className="ui-small mt-3 text-center">
                Your {monthsLabel(gift.durationMonths).toLowerCase()} start when you claim.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
