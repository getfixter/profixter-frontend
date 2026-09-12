/**
 * The ProFixter membership marker.
 *
 * ONE MARKER. THE MAP MAKES ONE CLAIM.
 *
 * V2 drew four - Basic, Plus, Premium and Elite, escalating through size, ring
 * structure and material - and it worked as a status ladder. It was removed
 * because the ladder answered a question the public map should not be asking.
 * A visitor needs to know that real homeowners across Long Island keep a
 * Fixter; which tier each of them pays for is between ProFixter and that
 * customer, and publishing it would have let anyone with devtools rank the
 * customer base by spend.
 *
 * So the tier is gone from the payload as well as the picture - see the server
 * module - and this file draws one thing.
 *
 * WHAT THE ONE MARKER HAS TO DO
 *
 * Read as deliberate rather than as a default dot, hold up against a dark
 * island, and stay countable when it overlaps its neighbours. That last one is
 * why the dark outer edge is here: same-ZIP members sit close enough to touch
 * at Long Island scale, and the seam is what keeps two overlapping pins reading
 * as two memberships. It is load-bearing, not decoration.
 *
 * Sizing is unchanged from V2 - about 11px across on a desktop card, 8.4px on a
 * phone. Losing the tier styles is not a reason to grow.
 */

/**
 * Radius in viewBox units. ~163 metres per unit at this scale.
 *
 * The V2 Basic figure, kept exactly. The scale curve in the section is what
 * turns it into roughly 11px on a desktop card and 8.4px on a phone.
 */
export const MARKER_RADIUS = 4.65;

/**
 * The gradient, defined once for the whole page.
 *
 * One <defs> referenced by every marker, so forty pins cost one gradient rather
 * than forty. The id is prefixed because this SVG shares a document with the
 * rest of the homepage.
 */
export function MarkerDefs() {
  return (
    <defs>
      {/*
        Lit from the upper left, so the dot reads as a small dimensional object
        rather than a flat circle. The deep edge is what gives it weight against
        the island without needing a glow.
      */}
      <radialGradient id="pfm-marker" cx="34%" cy="28%">
        <stop offset="0%" stopColor="#8FBAFF" />
        <stop offset="42%" stopColor="#4A87FF" />
        <stop offset="100%" stopColor="#1B4FBE" />
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
export function Marker({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const r = MARKER_RADIUS * scale;

  return (
    <g aria-hidden="true">
      {/*
        The seat: a dark ring just outside the collar. Separates the marker from
        the island beneath it, and - the reason it is here - keeps overlapping
        pins countable by drawing a seam between them.
      */}
      <circle
        cx={x}
        cy={y}
        r={r * 1.16}
        fill="none"
        stroke="#06101E"
        strokeOpacity="0.5"
        strokeWidth={r * 0.2}
      />
      <circle cx={x} cy={y} r={r} fill="url(#pfm-marker)" />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.95"
        strokeWidth={r * 0.26}
      />
      {/*
        A short specular arc rather than a glow. It is what makes the marker look
        finished at eleven pixels, and unlike a halo it costs no space and cannot
        bleed into the pin next door.
      */}
      <path
        d={`M ${x - r * 0.52} ${y - r * 0.34} A ${r * 0.62} ${r * 0.62} 0 0 1 ${x + r * 0.08} ${y - r * 0.6}`}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.75"
        strokeWidth={r * 0.16}
        strokeLinecap="round"
      />
    </g>
  );
}
