import type { MembershipPlan } from "@/lib/public-membership-map";

/**
 * The four membership markers.
 *
 * GOOD → BETTER → PREMIUM → SPECIAL, and Basic is not the loser.
 *
 * The hierarchy escalates through three things at once - size, ring structure,
 * and the material the dot is made of - rather than by making the lower tiers
 * duller. Basic is full-strength ProFixter blue with a crisp white collar. Most
 * pins on the map are Basic, and a map of apologetic dots would sell nothing.
 *
 * WHAT V2 CHANGED, AND WHY
 *
 * V1 was too loud at real map scale. Elite carried a glow three times the width
 * of its own dot, which on a phone fused neighbouring gold pins into a single
 * bright smear; Premium's rings and halo made it read as a button rather than a
 * marker; and Plus was so close to Basic that the second tier was invisible.
 *
 * So every marker is roughly a third smaller, the decorative radii are pulled
 * in much harder than the dots themselves, and the glows are dimmed. Elite is
 * now a luxury badge - gold, quietly lit, with a fine faceted collar - instead
 * of a light source. The tier order is still readable at a glance, but the
 * island underneath is the thing you see first.
 *
 * EVERY TIER CARRIES A DARK OUTER EDGE. Same-ZIP members sit close enough to
 * overlap on a phone, and the seam is what keeps two overlapping pins reading
 * as two memberships instead of one blob. It is load-bearing, not decoration.
 *
 * NO TIER USES A COLOUR OUTSIDE THE BRAND'S RANGE. Blue, blue, platinum, gold -
 * rankable at a glance, and never weather radar.
 */

/**
 * Base radius in viewBox units. ~163 metres per unit at this scale.
 *
 * V1 was 6.2 / 7.6 / 8.6 / 9.8. The ladder came down about a quarter, and the
 * gap between the top tiers narrowed, because Premium and Elite were winning on
 * bulk rather than on craft. The decorative radii around them came down much
 * further - see each marker below - which is what actually removed the glare.
 *
 * Sized so a Basic dot draws about 11px across on a desktop card. The scale
 * curve in the section holds phones and tablets near 8.4px, so raising this
 * raised the roomy end without inflating the crowded one.
 */
export const MARKER_RADIUS: Record<MembershipPlan, number> = {
  basic: 4.65,
  plus: 5.4,
  premium: 6.05,
  elite: 6.75,
};

/** Order for the legend and for paint order: rarer tiers last, so on top. */
export const PLAN_ORDER: readonly MembershipPlan[] = ["basic", "plus", "premium", "elite"];

export const PLAN_LABEL: Record<MembershipPlan, string> = {
  basic: "Basic",
  plus: "Plus",
  premium: "Premium",
  elite: "Elite",
};

/**
 * Gradients and glows, defined once for the whole page.
 *
 * Rendered in one <defs> and referenced by every marker, so forty pins cost one
 * gradient each rather than forty. Ids are prefixed because this SVG shares a
 * document with the rest of the homepage.
 */
export function MarkerDefs() {
  return (
    <defs>
      <radialGradient id="pfm-basic" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#6FA3FF" />
        <stop offset="55%" stopColor="#306EEC" />
        <stop offset="100%" stopColor="#1E4FB8" />
      </radialGradient>

      <radialGradient id="pfm-plus" cx="35%" cy="28%">
        <stop offset="0%" stopColor="#A8CEFF" />
        <stop offset="50%" stopColor="#4A87FF" />
        <stop offset="100%" stopColor="#1B54CC" />
      </radialGradient>

      {/* Brushed platinum: a cool light-to-steel sweep with a bright shoulder. */}
      <linearGradient id="pfm-premium" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="30%" stopColor="#DFE7F1" />
        <stop offset="62%" stopColor="#A3B2C5" />
        <stop offset="100%" stopColor="#6E7F95" />
      </linearGradient>

      {/* Gold, warm at the top and deep at the base so it reads as metal. */}
      <linearGradient id="pfm-elite" x1="22%" y1="0%" x2="78%" y2="100%">
        <stop offset="0%" stopColor="#FFF0B8" />
        <stop offset="32%" stopColor="#F2C94F" />
        <stop offset="68%" stopColor="#D19B12" />
        <stop offset="100%" stopColor="#9E6C08" />
      </linearGradient>

      {/*
        Dimmed hard from V1. The old glow ran to 55% opacity across three times
        the dot's width, which merged adjacent Elite pins into one bright patch.
      */}
      <radialGradient id="pfm-elite-glow">
        <stop offset="0%" stopColor="#F2C94F" stopOpacity="0.3" />
        <stop offset="55%" stopColor="#F2C94F" stopOpacity="0.09" />
        <stop offset="100%" stopColor="#F2C94F" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * One marker.
 *
 * `scale` multiplies every dimension so a pin stays legible on a 390px phone
 * without becoming a blob on a 1440px desktop - the viewBox is fixed, so
 * without this a marker would shrink with the viewport until it vanished.
 *
 * Deliberately inert: no id, no title, no data attribute, no pointer handler,
 * and aria-hidden. There is nothing to click and nothing behind it to reveal,
 * because the component was never given anything to reveal.
 */
export function Marker({
  plan,
  x,
  y,
  scale = 1,
}: {
  plan: MembershipPlan;
  x: number;
  y: number;
  scale?: number;
}) {
  const r = MARKER_RADIUS[plan] * scale;

  /* The seam that keeps overlapping pins countable. */
  const edge = (radius: number, opacity = 0.42) => (
    <circle
      cx={x}
      cy={y}
      r={radius}
      fill="none"
      stroke="#06101E"
      strokeOpacity={opacity}
      strokeWidth={r * 0.16}
    />
  );

  if (plan === "basic") {
    return (
      <g aria-hidden="true">
        <circle cx={x} cy={y} r={r} fill="url(#pfm-basic)" />
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.94"
          strokeWidth={r * 0.26}
        />
        {edge(r * 1.14)}
      </g>
    );
  }

  if (plan === "plus") {
    /*
     * A detached outer ring with dark between it and the dot.
     *
     * This is the whole difference from Basic and it has to survive being drawn
     * nine pixels wide, so it is a hard ring at near-full opacity rather than
     * the soft halo V1 used - that halo disappeared at map scale and left two
     * tiers looking identical.
     */
    return (
      <g aria-hidden="true">
        <circle
          cx={x}
          cy={y}
          r={r * 1.5}
          fill="none"
          stroke="#7FB2FF"
          strokeOpacity="0.95"
          strokeWidth={r * 0.2}
        />
        {edge(r * 1.66, 0.34)}
        <circle cx={x} cy={y} r={r} fill="url(#pfm-plus)" />
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.96"
          strokeWidth={r * 0.24}
        />
      </g>
    );
  }

  if (plan === "premium") {
    /*
     * Platinum, and noticeably tighter than V1: the halo is gone entirely and
     * the rings came in from 1.52/1.26 to 1.34/1.16. Premium should read as
     * better made than Plus, not as physically bigger.
     */
    return (
      <g aria-hidden="true">
        <circle
          cx={x}
          cy={y}
          r={r * 1.34}
          fill="none"
          stroke="#D9E3F0"
          strokeOpacity="0.62"
          strokeWidth={r * 0.12}
        />
        {edge(r * 1.48, 0.34)}
        <circle
          cx={x}
          cy={y}
          r={r * 1.16}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.88"
          strokeWidth={r * 0.15}
        />
        <circle cx={x} cy={y} r={r} fill="url(#pfm-premium)" />
        {/* The bright shoulder that makes a flat disc read as brushed metal. */}
        <path
          d={`M ${x - r * 0.6} ${y - r * 0.3} A ${r * 0.7} ${r * 0.7} 0 0 1 ${x + r * 0.1} ${y - r * 0.68}`}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.9"
          strokeWidth={r * 0.19}
          strokeLinecap="round"
        />
        {edge(r, 0.5)}
      </g>
    );
  }

  /*
   * Elite. A luxury badge, not a light source.
   *
   * The glow is down from 3.1x the dot at 55% opacity to 1.85x at 30%, and the
   * faceted collar came in from 1.46x to 1.3x with smaller facets. It still
   * draws the eye first - it is the only gold on the map - but two Elite pins
   * in neighbouring towns now read as two pins.
   */
  const facets = 8;
  const collarR = r * 1.3;
  const collar = Array.from({ length: facets }, (_, i) => {
    const angle = (i / facets) * Math.PI * 2 - Math.PI / 2;
    return { cx: x + Math.cos(angle) * collarR, cy: y + Math.sin(angle) * collarR };
  });

  return (
    <g aria-hidden="true">
      <circle cx={x} cy={y} r={r * 1.85} fill="url(#pfm-elite-glow)" />
      {collar.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={r * 0.13} fill="#F2C94F" fillOpacity="0.8" />
      ))}
      <circle
        cx={x}
        cy={y}
        r={collarR}
        fill="none"
        stroke="#F2C94F"
        strokeOpacity="0.55"
        strokeWidth={r * 0.08}
      />
      {edge(r * 1.44, 0.32)}
      <circle
        cx={x}
        cy={y}
        r={r * 1.15}
        fill="none"
        stroke="#FFF6D8"
        strokeOpacity="0.92"
        strokeWidth={r * 0.16}
      />
      <circle cx={x} cy={y} r={r} fill="url(#pfm-elite)" />
      <path
        d={`M ${x - r * 0.58} ${y - r * 0.3} A ${r * 0.68} ${r * 0.68} 0 0 1 ${x + r * 0.1} ${y - r * 0.66}`}
        fill="none"
        stroke="#FFFBEA"
        strokeOpacity="0.95"
        strokeWidth={r * 0.2}
        strokeLinecap="round"
      />
      {edge(r, 0.45)}
    </g>
  );
}

/**
 * A marker on its own, for the legend.
 *
 * Renders the real component inside a tiny viewBox so the key can never drift
 * from the map - if a marker design changes, the legend changes with it.
 *
 * No <defs> of its own. The gradients are declared once per page by the
 * section; repeating them here would put duplicate ids in the document and
 * leave which gradient wins up to document order.
 *
 * Each tier is scaled so the SWATCHES match in outer size while the dots keep
 * their real proportions - otherwise Elite's collar and glow would make its
 * swatch twice the size of Basic's and the legend would exaggerate a difference
 * the map states more subtly.
 */
export function LegendMarker({ plan }: { plan: MembershipPlan }) {
  const box = 30;
  const swatchScale: Record<MembershipPlan, number> = {
    basic: 1.7,
    plus: 1.26,
    premium: 1.36,
    elite: 1.24,
  };
  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden="true"
      className="flex-shrink-0 overflow-visible"
    >
      <Marker plan={plan} x={box / 2} y={box / 2} scale={swatchScale[plan]} />
    </svg>
  );
}
