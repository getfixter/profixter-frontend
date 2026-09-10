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
  }, [addresses, phase]);

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
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E0E6F5] border-t-[#306EEC]"
          role="status"
          aria-label="Loading your gift"
        />
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
        <div className="rounded-[12px] border border-[#E0E6F5] bg-white p-6 text-center sm:p-8">
          <h1 className="text-[22px] font-semibold leading-tight text-[#313234] sm:text-[26px]">
            {phase.title}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#6A6D71]">
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
                className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
              >
                Sign out and use a different account
              </button>
            ) : null}
            <Link
              href="/"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
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
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F0E9]"
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M20 6 9 17l-5-5"
                stroke="#2A6B47"
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
          <h1 className="mt-5 text-[26px] font-semibold leading-tight text-[#313234] sm:text-[30px]">
            {result.queued ? "Your gift is ready" : "Your gift membership is active"}
          </h1>
        </div>

        <div className="mt-6 rounded-[12px] border border-[#E0E6F5] bg-white p-5 text-center sm:p-6">
          <p className="text-[20px] font-semibold text-[#313234]">
            {planLabel(result.plan)}
            <span className="ml-2 text-[15px] font-normal text-[#6A6D71]">
              &middot; {monthsLabel(result.durationMonths)}
            </span>
          </p>

          {result.queued ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[#6A6D71]">
              It starts on{" "}
              <span className="font-medium text-[#313234]">{formatGiftDate(result.startAt)}</span>,
              when your current membership ends, and runs through{" "}
              <span className="font-medium text-[#313234]">{formatGiftDate(result.endAt)}</span>.
              None of the gifted time overlaps with what you are already paying for.
            </p>
          ) : (
            <p className="mt-3 text-[15px] text-[#6A6D71]">
              Active through{" "}
              <span className="font-medium text-[#313234]">
                {result.activeThrough || formatGiftDate(result.endAt)}
              </span>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {result.queued ? (
            <Link
              href="/account?tab=plan"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
            >
              View your membership
            </Link>
          ) : (
            <Link
              href="/book?visit=membership"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
            >
              Book your Fixter
            </Link>
          )}
          <Link
            href="/account?tab=plan"
            className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
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
      <section id="claim" className="scroll-mt-6 bg-[#F4F6FB] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-[560px]">
          {!isAuthenticated ? (
            <div className="rounded-[14px] border border-[#E0E6F5] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-7">
              <h2 className="text-[19px] font-semibold text-[#313234] sm:text-[21px]">
                Claim your gift
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6A6D71]">
                The invitation was sent to{" "}
                <span className="break-words font-medium text-[#313234]">
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
                  className="inline-flex min-h-[48px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
                >
                  {gift.hasAccount ? "Sign in to claim" : "Create an account to claim"}
                </Link>
                <Link
                  href={
                    gift.hasAccount
                      ? `/signup?next=${encodeURIComponent(returnTo)}`
                      : `/signin?next=${encodeURIComponent(returnTo)}`
                  }
                  className="inline-flex min-h-[48px] items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
                >
                  {gift.hasAccount ? "I need an account" : "I already have an account"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-[14px] border border-[#E0E6F5] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-7">
              <h2 className="text-[19px] font-semibold text-[#313234] sm:text-[21px]">
                Which property is it for?
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#6A6D71]">
                A membership covers one home.
                {details?.addressSnapshot?.line1 ? (
                  <>
                    {" "}
                    The person who sent it had{" "}
                    <span className="font-medium text-[#313234]">
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
                        "flex cursor-pointer items-start gap-3 rounded-[8px] border p-3.5 transition",
                        addressId === String(address._id)
                          ? "border-[#306EEC] bg-[#F5F9FF]"
                          : "border-[#E0E6F5] bg-white hover:border-[#C5CBD8]",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="addressId"
                        value={String(address._id)}
                        checked={addressId === String(address._id)}
                        onChange={() => setChosenAddressId(String(address._id))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#306EEC]"
                      />
                      <span className="min-w-0 text-[14px] leading-snug text-[#313234]">
                        <span className="block break-words font-medium">{address.line1}</span>
                        <span className="block break-words text-[13px] text-[#6A6D71]">
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
                <div className="mt-4 rounded-[8px] border border-[#E0E6F5] bg-[#F8FAFF] p-4">
                  <p className="text-[14px] leading-relaxed text-[#6A6D71]">
                    You do not have a property saved yet. Add one to your account, then come back
                    to this link to claim your gift.
                  </p>
                  <Link
                    href={`/account?tab=personal&next=${encodeURIComponent(returnTo)}`}
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-[14px] font-semibold text-white transition hover:bg-[#2558C4]"
                  >
                    Add your property
                  </Link>
                </div>
              )}

              {claimError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-[8px] border border-[#F3C9C4] bg-[#FDF3F2] px-4 py-3 text-sm text-[#A03227]"
                >
                  {claimError}
                </p>
              ) : null}

              {addresses.length ? (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  aria-busy={claiming}
                  className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4] disabled:cursor-not-allowed disabled:bg-[#8FB3F5]"
                >
                  {claiming ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        aria-hidden
                      />
                      Claiming&hellip;
                    </>
                  ) : (
                    "Claim your gift"
                  )}
                </button>
              ) : null}

              <p className="mt-3 text-center text-[12px] text-[#9CA3AF]">
                Your {monthsLabel(gift.durationMonths).toLowerCase()} start when you claim.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
