"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

import DigitalGiftCard, { type DigitalGiftCardProps } from "./DigitalGiftCard";
import DigitalGiftReveal, { giftFingerprint, planGiftReveal } from "./DigitalGiftReveal";
import { GIFT_BENEFITS } from "./giftPresentation";

/**
 * The stage the gift is opened on.
 *
 * The background is /images/pass-bg.webp — the approved photograph the sign-in
 * pages already use. Very dark, a ring of warm light, no people in frame.
 *
 * WHERE THE LIGHT ACTUALLY IS
 *
 * Measured, not assumed. Scoring the image by warmth (R minus B, weighted by
 * brightness) puts the ring's centre near 50% across, with a second warm patch
 * at the extreme right edge — the lamp. Scoring by raw brightness is
 * misleading: the small bright lamp outweighs the large soft ring and drags
 * the centroid out to 78%.
 *
 * The first version of this layout put the card at 32% across, which is
 * precisely where the photograph has no light. The card sat in flat darkness
 * looking pasted on, while the ring haloed the text column beside it — the
 * supporting copy got the drama and the gift got none.
 *
 * SO THE CARD IS CENTRED.
 *
 * Not as a fallback, but because the photograph is a centred composition and
 * the card belongs in the middle of it. The ring becomes the light the card
 * stands in, which is the entire effect: an object in a pool of warmth rather
 * than a rectangle on a dark background.
 *
 * WHY THE STAGE IS EXACTLY ONE SCREEN
 *
 * Also measured. At every desktop aspect the container is TALLER than the
 * photograph's 1.674, so object-fit: cover scales it to match height and
 * crops the sides — which means objectPosition's vertical value does nothing
 * at all here. Probing five values from 42% to 74% moved the light zero
 * pixels. The only way to put the card in the light is to move the CARD.
 *
 * So the photographic stage is one screen tall on desktop and holds nothing
 * but the card. The light lands at 51% of that screen and the card centres at
 * 50%, which is the whole point: the gift is standing in the pool of warmth
 * instead of floating above it. The supporting line and the benefits moved to
 * their own section below, on the same ground colour — if they shared the
 * stage they would drag the card back up out of the light, which is exactly
 * what the previous version did.
 *
 * DESKTOP IS NOT THE PHONE LAYOUT STRETCHED
 *
 * A phone gets one narrow column, a card sized to the viewport width, and a
 * 2x2 benefit grid; the stage is only as tall as the card, because a forced
 * full screen there would push the card itself out of the first view.
 * Desktop gets a full-bleed cinematic frame, a 700px card centred in the
 * light, and the benefits as one quiet four-across row.
 */

export type DigitalGiftHeroProps = Omit<DigitalGiftCardProps, "size" | "action"> & {
  /** The claim control. Passed in — the hero never decides what claiming is. */
  action?: React.ReactNode;
  /** Sits under the card, e.g. when the term begins. */
  actionNote?: string;
  /** Shows the benefit row. Off for the purchase preview. */
  showBenefits?: boolean;
  /** Turns off the entrance animation, for a preview that re-renders on typing. */
  animate?: boolean;
};

export default function DigitalGiftHero({
  action,
  actionNote,
  showBenefits = true,
  animate = true,
  ...card
}: DigitalGiftHeroProps) {
  const step = animate ? "gift-reveal-step" : "";

  /*
   * The reveal decision is made ONCE, here, in a lazy initializer.
   *
   * Not in an effect inside the reveal: deciding there means first rendering
   * the open card and then hiding it, which flashes the gift a frame before
   * closing it. Deciding here means the very first paint is already correct.
   *
   * Presentation only. Whatever this returns, the card is in the DOM and the
   * claim path is identical.
   */
  const fingerprint = giftFingerprint([
    card.occasion,
    card.plan,
    card.durationMonths,
    card.recipientFirstName,
    card.from,
  ]);
  const [revealMode] = useState<"play" | "skip">(() =>
    animate ? planGiftReveal(fingerprint) : "skip"
  );

  const [opened, setOpened] = useState(revealMode === "skip");
  const [replayToken, setReplayToken] = useState(0);

  const handleOpened = useCallback(() => setOpened(true), []);
  const handleReplay = useCallback(() => {
    setOpened(false);
    setReplayToken((n) => n + 1);
  }, []);

  /* Replay is only meaningful to somebody who saw the reveal in the first place. */
  const canReplay = revealMode === "play" && opened;

  const stage = (
    <section className="gift-stage relative isolate overflow-hidden bg-[#070D18]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/*
          The photograph is the ROOM, not the light on the card.

          Its ring measures about 420px across at desktop while the card is
          700px, so aligning the two perfectly just means the card covers the
          ring completely — which is what the previous attempt did. Zooming
          the photograph until the ring were bigger than the card would need
          roughly 2.2x and would throw away the panelling and the lamp that
          make it read as a room at all.

          So the photograph keeps its natural framing and provides depth and
          context, and the light ON the card is the layer below.
        */}
        <Image
          src="/images/pass-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="gift-photo object-cover object-center"
        />

        {/*
          A vignette, not a flat scrim. Darkening the edges while leaving the
          middle open keeps the photograph a room rather than a grey rectangle.
        */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 80% at 50% 50%, rgba(7,13,24,0.06) 0%," +
              " rgba(7,13,24,0.58) 52%, rgba(7,13,24,0.94) 100%)",
          }}
        />
        {/*
          The backlight.

          Deliberately LARGER than the card — about 900x700 against a 700x544
          card — so what is visible is the rim of warmth spilling out from
          behind it. A glow smaller than the object it lights is hidden by
          that object and does nothing, which is the trap the first two
          versions fell into. This is composition, not decoration: it is the
          only reason the card reads as standing in light rather than pasted
          onto a dark photograph.
        */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(62% 78% at 50% 50%, rgba(245,219,186,0.26) 0%," +
              " rgba(233,199,155,0.15) 34%, rgba(212,165,116,0.06) 58%," +
              " rgba(212,165,116,0) 78%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{ background: "linear-gradient(180deg, rgba(7,13,24,0) 0%, #070D18 100%)" }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* ------------------------------------------------------------ */}
        {/* The gift, centred in the light                                */}
        {/* ------------------------------------------------------------ */}
        {/*
          The container entrance is only for viewers who will NOT see the
          sleeve. When the reveal plays, the sleeve's own arrival is the
          entrance — running both meant the "closed gift" spent its entire
          hold semi-transparent, with the room visible through it.
        */}
        <div
          className={`relative w-full max-w-[560px] lg:max-w-[640px] xl:max-w-[700px] 2xl:max-w-[760px] ${
            animate && revealMode === "skip" ? "gift-reveal" : ""
          }`}
        >
          {/* One slow pass of light, once, after the card lands. */}
          {animate && opened ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[18px]"
            >
              <div
                className="gift-sheen absolute inset-y-[-40%] left-0 w-[42%]"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0) 100%)",
                  filter: "blur(6px)",
                }}
              />
            </div>
          ) : null}

          {animate ? (
            <DigitalGiftReveal
              occasion={card.occasion}
              from={card.from}
              mode={revealMode}
              fingerprint={fingerprint}
              replayToken={replayToken}
              onOpened={handleOpened}
            >
              <DigitalGiftCard {...card} size="full" action={action} headingLevel="h1" />
            </DigitalGiftReveal>
          ) : (
            <DigitalGiftCard {...card} size="full" action={action} headingLevel="h1" />
          )}
        </div>
      </div>
    </section>
  );

  const words = (
    <section className="bg-[#070D18] px-4 pb-14 pt-10 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20 lg:pt-16">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center">
        {/* ------------------------------------------------------------ */}
        {/* One line beneath the gift. Never beside it.                   */}
        {/* ------------------------------------------------------------ */}
        <div
          className={`w-full max-w-[620px] text-center ${step}`}
          style={animate ? { animationDelay: "260ms" } : undefined}
        >
          <p
            className="text-[22px] font-light leading-[1.3] text-[#F4F7FF] sm:text-[27px] lg:text-[31px]"
            style={{ fontFamily: "var(--font-gift-display), Georgia, serif" }}
          >
            Someone wanted your home{" "}
            <span className="italic text-[#E8CFAE]">looked after.</span>
          </p>
          <p className="mx-auto mt-3 max-w-[48ch] text-[14px] leading-[1.65] text-[#AFC0DC] sm:text-[15px]">
            A real ProFixter membership, already paid for. Nothing to buy, no card to add.
          </p>
          {actionNote ? <p className="mt-2.5 text-[13px] text-[#8093B5]">{actionNote}</p> : null}

          {canReplay ? (
            <button
              type="button"
              onClick={handleReplay}
              className="mt-5 inline-flex min-h-[36px] items-center gap-2 rounded-full border border-white/12 px-4 text-[12px] font-medium tracking-[0.08em] text-[#8FA4C6] transition hover:border-white/25 hover:text-[#D6E1F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8CFAE]"
            >
              <span aria-hidden="true">&#8634;</span>
              Replay
            </button>
          ) : null}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Benefits: 2x2 on a phone, one quiet row across on desktop     */}
        {/* ------------------------------------------------------------ */}
        {showBenefits ? (
          <ul
            className={`mt-10 grid w-full max-w-[440px] grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-8 text-left sm:mt-12 lg:max-w-[1000px] lg:grid-cols-4 lg:gap-x-12 lg:text-center ${step}`}
            style={animate ? { animationDelay: "380ms" } : undefined}
          >
            {GIFT_BENEFITS.map((benefit) => (
              <li key={benefit.title}>
                <p className="text-[13px] font-semibold text-[#EEF2FF] sm:text-[14px]">
                  {benefit.title}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-[#8FA4C6] sm:text-[13px]">
                  {benefit.detail}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );

  return (
    <>
      {stage}
      {words}
    </>
  );
}
