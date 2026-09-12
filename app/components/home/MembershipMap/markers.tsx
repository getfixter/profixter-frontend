import type { MembershipPlan } from "@/lib/public-membership-map";

/**
 * The four membership markers.
 *
 * GOOD → BETTER → PREMIUM → SPECIAL, and Basic is not the loser.
 *
 * The hierarchy is built from three things that escalate together - size, the
 * number of rings around the dot, and the material the dot is made of - rather
 * than from making the lower tiers duller. Basic is full-strength ProFixter
 * blue with a crisp white collar: on its own it looks like a considered brand
 * mark, which matters because most pins on the map are Basic and a map of
 * apologetic dots would sell nothing.
 *
 * What changes going up is presence, not quality. Plus gains a halo. Premium
 * changes material to brushed platinum and gains a second ring. Elite is gold,
 * carries a soft glow and a faceted collar, and is the only marker that reads
 * as lit from within.
 *
 * NO TIER USES A COLOUR OUTSIDE THE BRAND'S RANGE. Blue, blue, platinum, gold -
 * a progression a visitor can rank at a glance without a legend, and which
 * never turns the map into weather radar.
 */

/** Base radius in viewBox units. ~165 metres per unit at this scale. */
export const MARKER_RADIUS: Record<MembershipPlan, number> = {
  basic: 6.2,
  plus: 7.6,
  premium: 8.6,
  elite: 9.8,
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
 * Gradients, glows and the sparkle, defined once for the whole map.
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
        <stop offset="0%" stopColor="#9CC6FF" />
        <stop offset="50%" stopColor="#4A87FF" />
        <stop offset="100%" stopColor="#1B54CC" />
      </radialGradient>

      {/* Brushed platinum: a cool light-to-steel sweep with a bright shoulder. */}
      <linearGradient id="pfm-premium" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="28%" stopColor="#E2E9F2" />
        <stop offset="58%" stopColor="#A9B7C9" />
        <stop offset="100%" stopColor="#75869B" />
      </linearGradient>

      {/* Gold, warm at the top and deep at the base so it reads as metal. */}
      <linearGradient id="pfm-elite" x1="22%" y1="0%" x2="78%" y2="100%">
        <stop offset="0%" stopColor="#FFF3C4" />
        <stop offset="30%" stopColor="#F5CE5B" />
        <stop offset="65%" stopColor="#D9A017" />
        <stop offset="100%" stopColor="#A9740A" />
      </linearGradient>

      <radialGradient id="pfm-elite-glow">
        <stop offset="0%" stopColor="#F5CE5B" stopOpacity="0.55" />
        <stop offset="60%" stopColor="#F5CE5B" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#F5CE5B" stopOpacity="0" />
      </radialGradient>

      <radialGradient id="pfm-premium-glow">
        <stop offset="0%" stopColor="#DCE6F2" stopOpacity="0.42" />
        <stop offset="65%" stopColor="#DCE6F2" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#DCE6F2" stopOpacity="0" />
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
 * Deliberately inert: no id, no title, no data attribute, no pointer handler
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
          strokeOpacity="0.92"
          strokeWidth={r * 0.22}
        />
        {/* Seats the pin against the land instead of floating on it. */}
        <circle
          cx={x}
          cy={y}
          r={r * 1.12}
          fill="none"
          stroke="#0B1628"
          strokeOpacity="0.28"
          strokeWidth={r * 0.12}
        />
      </g>
    );
  }

  if (plan === "plus") {
    /*
     * The detached outer ring is what separates Plus from Basic at a glance.
     *
     * An earlier version differed only by a faint halo and a fraction of a
     * pixel, which read as the same marker twice - the two tiers were
     * indistinguishable on the map and nearly so in the legend. A clear ring
     * with a gap of dark between it and the dot is legible at every size the
     * map is rendered at, and still unmistakably the same family as Basic.
     */
    return (
      <g aria-hidden="true">
        <circle cx={x} cy={y} r={r * 1.78} fill="#4A87FF" fillOpacity="0.18" />
        <circle
          cx={x}
          cy={y}
          r={r * 1.46}
          fill="none"
          stroke="#8CBAFF"
          strokeOpacity="0.92"
          strokeWidth={r * 0.17}
        />
        <circle cx={x} cy={y} r={r} fill="url(#pfm-plus)" />
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.96"
          strokeWidth={r * 0.26}
        />
      </g>
    );
  }

  if (plan === "premium") {
    return (
      <g aria-hidden="true">
        <circle cx={x} cy={y} r={r * 2.1} fill="url(#pfm-premium-glow)" />
        <circle
          cx={x}
          cy={y}
          r={r * 1.52}
          fill="none"
          stroke="#E8EEF7"
          strokeOpacity="0.5"
          strokeWidth={r * 0.1}
        />
        <circle
          cx={x}
          cy={y}
          r={r * 1.26}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.82"
          strokeWidth={r * 0.16}
        />
        <circle cx={x} cy={y} r={r} fill="url(#pfm-premium)" />
        {/* The bright shoulder that makes a flat disc read as brushed metal. */}
        <path
          d={`M ${x - r * 0.62} ${y - r * 0.28} A ${r * 0.72} ${r * 0.72} 0 0 1 ${x + r * 0.12} ${y - r * 0.7}`}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.85"
          strokeWidth={r * 0.2}
          strokeLinecap="round"
        />
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="none"
          stroke="#5E7186"
          strokeOpacity="0.55"
          strokeWidth={r * 0.1}
        />
      </g>
    );
  }

  /* Elite. The only marker that is lit rather than filled. */
  const facets = 8;
  const collar = Array.from({ length: facets }, (_, i) => {
    const angle = (i / facets) * Math.PI * 2 - Math.PI / 2;
    return {
      cx: x + Math.cos(angle) * r * 1.46,
      cy: y + Math.sin(angle) * r * 1.46,
    };
  });

  return (
    <g aria-hidden="true">
      <circle cx={x} cy={y} r={r * 3.1} fill="url(#pfm-elite-glow)" />
      {/* A faceted collar rather than a crown: prestige without costume. */}
      {collar.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={r * 0.17} fill="#F5CE5B" fillOpacity="0.75" />
      ))}
      <circle
        cx={x}
        cy={y}
        r={r * 1.46}
        fill="none"
        stroke="#F5CE5B"
        strokeOpacity="0.62"
        strokeWidth={r * 0.1}
      />
      <circle
        cx={x}
        cy={y}
        r={r * 1.2}
        fill="none"
        stroke="#FFF6D8"
        strokeOpacity="0.9"
        strokeWidth={r * 0.18}
      />
      <circle cx={x} cy={y} r={r} fill="url(#pfm-elite)" />
      <path
        d={`M ${x - r * 0.6} ${y - r * 0.3} A ${r * 0.7} ${r * 0.7} 0 0 1 ${x + r * 0.1} ${y - r * 0.68}`}
        fill="none"
        stroke="#FFFBEA"
        strokeOpacity="0.95"
        strokeWidth={r * 0.22}
        strokeLinecap="round"
      />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke="#8A5E08"
        strokeOpacity="0.5"
        strokeWidth={r * 0.1}
      />
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
 * section; repeating them here would put four duplicate ids in the document and
 * leave which gradient wins up to document order.
 *
 * Elite is scaled down relative to the others because its glow and collar reach
 * much further than its dot; matched on the dot they would not fit the swatch.
 */
export function LegendMarker({ plan }: { plan: MembershipPlan }) {
  const box = 34;
  const swatchScale: Record<MembershipPlan, number> = {
    basic: 1.5,
    plus: 1.25,
    premium: 1.05,
    elite: 0.92,
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
