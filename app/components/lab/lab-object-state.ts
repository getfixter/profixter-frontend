/**
 * How repaired each object is, 0 to 1.
 *
 * A one-way channel from the choreography runner to the props, deliberately
 * outside React. The value changes every frame while the Fixter is working, and
 * routing it through state or props would re-render six components sixty times
 * a second to animate a handful of quaternions — and would trip React's
 * immutability rules on the way, since it is by nature a shared mutable.
 *
 * The same shape as lab-telemetry, for the same reason.
 */

const fixedness: Record<string, number> = {};

export function setObjectFix(id: string, value: number) {
  fixedness[id] = value;
}

export function getObjectFix(id: string) {
  return fixedness[id] ?? 0;
}

/** Called when a tour restarts, so nothing starts the loop already mended. */
export function resetObjectFix() {
  for (const key of Object.keys(fixedness)) delete fixedness[key];
}
