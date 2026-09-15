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

/**
 * Past this, the thing counts as mended.
 *
 * The homepage experiment lets ordinary DOM react to a repair — a checklist row
 * ticks itself when its job is done — and DOM is not free to update sixty times
 * a second. So alongside the continuous value there is a boolean, and listeners
 * hear only about the crossing: twice per job rather than once per frame.
 */
const SETTLED_AT = 0.55;

const settled: Record<string, boolean> = {};
const listeners = new Set<() => void>();
let settledVersion = 0;

function publishSettled() {
  settledVersion += 1;
  for (const listener of listeners) listener();
}

export function setObjectFix(id: string, value: number) {
  fixedness[id] = value;
  const isSettled = value >= SETTLED_AT;
  if (settled[id] !== isSettled) {
    settled[id] = isSettled;
    publishSettled();
  }
}

export function getObjectFix(id: string) {
  return fixedness[id] ?? 0;
}

export function isObjectSettled(id: string) {
  return settled[id] ?? false;
}

/** Changes only when some object crosses the line, so DOM can subscribe. */
export function getSettledVersion() {
  return settledVersion;
}

export function subscribeObjectSettled(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called when a tour restarts, so nothing starts the loop already mended. */
export function resetObjectFix() {
  for (const key of Object.keys(fixedness)) delete fixedness[key];
  for (const key of Object.keys(settled)) delete settled[key];
  publishSettled();
}
