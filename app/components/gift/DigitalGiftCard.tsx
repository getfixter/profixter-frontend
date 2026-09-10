import Image from "next/image";

import {
  monthsLabel,
  occasionCopy,
  planLabel,
  recipientDisplayName,
  type GiftOccasion,
} from "./giftPresentation";

/**
 * The Digital Gift, as an object.
 *
 * PRESENTATION ONLY. It takes strings and numbers and returns a card. It
 * fetches nothing, knows nothing about payment or claiming, and calls no
 * action of its own — the CTA is passed in. That is what lets the same
 * component be the thing the purchaser previews before paying and the thing
 * the recipient opens, with no chance of the two disagreeing.
 *
 * HOW THE "PHYSICAL" FEELING IS BUILT, all in CSS, no images and no library:
 *
 *   - Two shadows, not one. A tight dark contact shadow directly under the
 *     card plus a wide soft ambient one. A single shadow reads as a drawing;
 *     two read as an object resting on something.
 *   - A 1px inset highlight along the top edge and a shade along the bottom.
 *     That is light landing on a real edge, and it is most of why the card
 *     looks thick rather than flat.
 *   - A gilt edge rather than a band across the face, and a thin one: two
 *     pixels, one on the compact card. A wide band reads as a gold pipe once
 *     the card is only 358px across, and even at four pixels the satin
 *     highlight made it glow. Gold on an opened card is a detail, not a
 *     feature — the ribbon lives on the closed sleeve.
 *
 * Every colour is a real ProFixter token: #0B1628 navy, #306EEC blue,
 * #D4A574 warm gold, #EEF2FF logo near-white.
 */

export type DigitalGiftCardProps = {
  occasion: GiftOccasion | string;
  plan: string;
  durationMonths: number;
  recipientFirstName?: string | null;
  recipientLastName?: string | null;
  /** The purchaser's display name, as they gave it. */
  from?: string | null;
  personalMessage?: string | null;
  /**
   * The claim control, rendered on the card's cream face.
   *
   * On the card rather than beside it because a phone opened from a text
   * message shows the card and very little else — a CTA in a neighbouring
   * column is a CTA below the fold.
   */
  action?: React.ReactNode;
  /** "full" for the hero, "compact" for confirmation and history rows. */
  size?: "full" | "compact";
  /** Marks a preview as illustrative, for the purchase flow. */
  previewNote?: string;
  /**
   * Which heading the occasion line is.
   *
   * On the recipient's page the occasion IS the subject of the page, so it is
   * the h1. In the purchase preview and on the confirmation the card is one
   * element inside a page about something else, so it stays an h2 and the
   * document keeps a sensible outline.
   */
  headingLevel?: "h1" | "h2";
  className?: string;
};

const GOLD = "#D4A574";

/**
 * The gilt edge, deliberately quiet.
 *
 * The satin recipe used elsewhere runs through a near-white highlight, which
 * is what makes a ribbon look like fabric. On a 2px edge against navy that
 * same highlight reads as a glowing bar rather than a gilded edge, and on a
 * 358px card it competed with the gift itself.
 *
 * So this one has no white in it: three stops of warm metal, darker at the
 * extremes, and no shadow bloom. At two pixels it is a material detail you
 * notice second, which is the correct order — the ribbon belongs to the
 * closed sleeve, and an opened card should read as premium stationery.
 */
const GILT =
  "linear-gradient(180deg," +
  " rgba(150,106,58,0.85) 0%," +
  " #C79C68 30%," +
  " #D4A574 50%," +
  " #C79C68 70%," +
  " rgba(150,106,58,0.85) 100%)";

export default function DigitalGiftCard({
  occasion,
  plan,
  durationMonths,
  recipientFirstName,
  recipientLastName,
  from,
  personalMessage,
  action,
  size = "full",
  previewNote,
  headingLevel = "h2",
  className = "",
}: DigitalGiftCardProps) {
  const Heading = headingLevel;
  const copy = occasionCopy(occasion);
  const to = recipientDisplayName(recipientFirstName, recipientLastName);
  const months = monthsLabel(durationMonths);
  const plainFrom = String(from || "").trim();
  const message = String(personalMessage || "").trim();
  const compact = size === "compact";

  return (
    <article
      className={`gift-card relative w-full overflow-hidden rounded-[18px] ${className}`}
      aria-label={`${copy.title}. ${months} of ProFixter ${planLabel(plan)}.`}
    >
      {/*
        THE GOLD, AFTER REVIEW.

        This was a 21px satin band running the full height of the card, inset
        from the right. At desktop it read as a ribbon; on a 390px phone the
        same band is a fifth of the card's width and cuts straight through the
        To/From row and the message — a gold pipe rather than a gift detail.
        It also forced a 17% gutter on every line of content, which is what
        made the phone layout stack To above From.

        What replaced it: a gilt edge. Four pixels of foil flush to the card's
        outer edge, the way a good piece of stationery is gilded. It reads as
        an expensive material at any width, it never crosses content, and the
        gutters are gone.

        The RIBBON did not disappear — it moved to where a ribbon belongs. It
        is now on the closed sleeve, and taking it off is the opening gesture
        (see DigitalGiftReveal). The gilt edge is what it leaves behind.
      */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 z-20 ${
          compact ? "w-px" : "w-[2px]"
        }`}
        style={{ background: GILT }}
      />

      {/* ---------------------------------------------------------------- */}
      {/* The navy face                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div
        className={`relative overflow-hidden ${
          compact ? "px-5 pb-6 pt-5 sm:px-6" : "px-6 pb-9 pt-7 sm:px-9 sm:pb-11 sm:pt-9"
        }`}
        style={{
          background: "linear-gradient(158deg, #17283F 0%, #0B1628 44%, #081120 100%)",
        }}
      >
        {/* Warmth from the upper left, brand blue from the upper right. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 84% at 10% -12%, rgba(212,165,116,0.20) 0%, rgba(212,165,116,0) 56%)," +
              "radial-gradient(86% 70% at 104% 4%, rgba(48,110,236,0.22) 0%, rgba(48,110,236,0) 58%)",
          }}
        />

        {/* Content stops before the ribbon rather than running under it. */}
        <div className="relative">
          <Image
            src="/images/logo-footer.svg"
            alt="ProFixter"
            width={113}
            height={24}
            className={compact ? "gift-card-logo-compact" : "gift-card-logo"}
          />

          <p
            className={`mt-5 font-medium uppercase tracking-[0.24em] text-[#A8BEE2] ${
              compact ? "text-[10px]" : "text-[12px]"
            }`}
          >
            {copy.kicker}
          </p>

          {/*
           * The occasion line, in the display face with a warm gradient fill.
           * background-clip on text is the closest CSS gets to stamped foil,
           * and it degrades to solid warm gold where that is unsupported
           * because the colour is declared before the gradient.
           */}
          <Heading
            className={`gift-foil mt-1.5 font-light leading-[1.06] ${
              compact ? "text-[24px]" : "text-[32px] sm:text-[42px] lg:text-[46px]"
            }`}
            style={{ fontFamily: "var(--font-gift-display), Georgia, serif" }}
          >
            {copy.title}
          </Heading>

          <div className={compact ? "mt-5" : "mt-7"}>
            <p
              className={`font-semibold uppercase leading-snug tracking-[0.1em] text-[#EEF2FF] ${
                compact ? "text-[12px]" : "text-[14px] sm:text-[17px]"
              }`}
            >
              {months} of ProFixter {planLabel(plan)}
            </p>
            <p
              className={`mt-1.5 uppercase tracking-[0.2em] text-[#8AA2CC] ${
                compact ? "text-[9px]" : "text-[12px]"
              }`}
            >
              Handyman Membership
            </p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* The cream face                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div
        className={`relative ${compact ? "px-5 py-5 sm:px-6" : "px-6 py-7 sm:px-9 sm:py-8"}`}
        style={{ background: "linear-gradient(180deg, #FDFCFA 0%, #F5F2EC 100%)" }}
      >
        {/* The fold: a hairline of gold where the two faces meet. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, rgba(212,165,116,0) 0%, ${GOLD} 28%, ${GOLD} 72%, rgba(212,165,116,0) 100%)`,
          }}
        />

        <div>
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="min-w-0">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#756654]">
                To
              </dt>
              <dd
                className={`mt-1 break-words font-medium text-[#1A1B1D] ${
                  compact ? "text-[15px]" : "text-[18px] sm:text-[21px]"
                }`}
              >
                {to}
              </dd>
            </div>
            {plainFrom ? (
              <div className="min-w-0">
                <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#756654]">
                  From
                </dt>
                <dd
                  className={`mt-1 break-words font-medium text-[#1A1B1D] ${
                    compact ? "text-[15px]" : "text-[18px] sm:text-[21px]"
                  }`}
                >
                  {plainFrom}
                </dd>
              </div>
            ) : null}
          </dl>

          {/*
           * The personal message.
           *
           * Rendered as TEXT through JSX, never as HTML — React escapes it,
           * and the server already removed angle brackets and control
           * characters before storing it. whitespace-pre-line honours the
           * line breaks the purchaser typed, which is what makes it read like
           * a note rather than a field.
           */}
          {message ? (
            <blockquote
              className={`mt-5 border-l-2 pl-4 ${compact ? "text-[14px]" : "text-[17px] sm:text-[19px]"}`}
              style={{
                borderColor: GOLD,
                fontFamily: "var(--font-gift-display), Georgia, serif",
              }}
            >
              <p className="whitespace-pre-line italic leading-[1.5] text-[#4A4438]">{message}</p>
            </blockquote>
          ) : null}
        </div>

        {action ? (
          <div className={compact ? "mt-5" : "mt-7"}>
            {action}
          </div>
        ) : null}

        {previewNote ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[#756654]">{previewNote}</p>
        ) : null}
      </div>
    </article>
  );
}
