/**
 * One way to print an address in Admin: the client twin of the backend's
 * utils/formatAddress.js (same rules, same output), so a copied address and
 * the one on screen always match what the server formats for emails and
 * lists.
 *
 * THE UNIT AND line1. The unit is folded into line1 when an address is saved
 * (every address key, and so free-visit eligibility, is built from line1),
 * and from this release it is also kept on its own (`unit`). The new admin
 * DTOs return line1 as the street with the unit removed when it is known;
 * older addresses keep the unit only inside line1 and have unit "". These
 * functions never print the unit twice either way.
 */

const UNIT_PREFIX = /^(apt|apartment|unit|ste|suite|#|fl|floor|bldg|building|rm|room|no\.?|num)\b/i;

function clean(value: unknown, max = 200): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** "2" -> "Unit 2"; "Apt 2", "#2", "Suite 100" are kept as written. */
export function unitLabel(unit: unknown): string {
  const text = clean(unit, 40);
  if (!text) return "";
  if (UNIT_PREFIX.test(text) || text.startsWith("#")) return text;
  return `Unit ${text}`;
}

/** { street, unit }: line1 without a trailing copy of the unit, and the unit itself. */
export function splitUnit({ line1, unit }: { line1?: string | null; unit?: string | null } = {}): { street: string; unit: string } {
  const street = clean(line1);
  const u = clean(unit, 40);
  if (!u) return { street, unit: "" };
  const lowerStreet = street.toLowerCase();
  const lowerUnit = u.toLowerCase();
  if (lowerStreet.endsWith(lowerUnit) && lowerStreet.length > lowerUnit.length) {
    const head = street.slice(0, street.length - u.length).replace(/[\s,]+$/, "");
    if (head) return { street: head, unit: u };
  }
  return { street, unit: u };
}

export type AddressParts = {
  line1?: string | null;
  address?: string | null;
  unit?: string | null;
  /** The new DTOs call the city "town". */
  city?: string | null;
  town?: string | null;
  state?: string | null;
  zip?: string | null;
};

/** "12 Oak St, Apt 2, Massapequa, NY 11758". Missing parts are skipped. */
export function formatAddressLine(address: AddressParts | null | undefined): string {
  if (!address) return "";
  const { street, unit } = splitUnit({ line1: address.line1 ?? address.address, unit: address.unit });
  const stateZip = [clean(address.state, 10), clean(address.zip, 10)].filter(Boolean).join(" ");
  return [street, unitLabel(unit), clean(address.city ?? address.town, 80), stateZip].filter(Boolean).join(", ");
}
