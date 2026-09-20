"use client";

/**
 * Google Places, wrapped so the rest of the app never sees it.
 *
 * WHY THE NEW API AND NOT THE FAMILIAR ONE. Every tutorial still shows
 * `AutocompleteService` and `PlacesService.getDetails`. Those belong to the
 * legacy Places API, which Google closed to new customers in March 2025: a key
 * created today returns REQUEST_DENIED for them no matter how the billing is
 * set up. This uses Places API (New) — `AutocompleteSuggestion` and `Place` —
 * which is the only thing a fresh project can call.
 *
 * WHY NOT THE DROP-IN WIDGET. `PlaceAutocompleteElement` would be less code,
 * but it renders its own input and its own dropdown, and the whole point of
 * this screen is one field that looks like the rest of ProFixter. Fetching the
 * suggestions ourselves keeps the markup ours.
 *
 * SESSION TOKENS ARE NOT OPTIONAL. Autocomplete is billed per keystroke-request
 * unless the requests are grouped into a session that ends with one details
 * fetch, in which case the whole session bills once. `beginSession` mints a
 * token, every keystroke passes it, and resolving the chosen place spends it.
 * Forgetting this does not break anything visible — it just multiplies the bill
 * by the length of the average address.
 *
 * Nothing here throws for a missing key. Without one the loader reports
 * unavailable and the address field falls back to typing the address by hand,
 * so the page works before the key exists and keeps working if it is ever
 * revoked.
 */

export type VerifiedAddress = {
  line1: string;
  /**
   * The unit, when Google already knew about one.
   *
   * Kept out of line1 so it lands in the Apt/Unit field the customer can see
   * and correct, rather than being welded into the street line where editing it
   * would mean re-typing the address.
   */
  unit: string;
  city: string;
  state: string;
  zip: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
  formatted: string;
};

export type Suggestion = {
  id: string;
  primary: string;
  secondary: string;
  /** Opaque handle back to the Google prediction this row came from. */
  raw: unknown;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/**
 * Where to look first.
 *
 * A bias, not a restriction. Restricting would stop an out-of-area homeowner
 * from finding their own address, and out-of-area accounts are welcome — the
 * service area gates the free first visit, not registration. So this only
 * decides what "125 Main St" offers first, and a Montana address is still
 * reachable by typing enough of it.
 *
 * A RECTANGLE, NOT A CIRCLE, and that is not a style choice. Google rejects any
 * bias circle with a radius over 50,000m — the whole request fails with
 * "Invalid circle.radius", so the field returns nothing at all rather than
 * degrading. Long Island does not fit in 50km: Babylon to Montauk is about
 * 120km, so a circle centred on the office either fails outright or abandons
 * the entire East End. Bounds have no such limit.
 *
 * The box runs from the Queens line to Montauk Point, and from the south shore
 * barrier beaches to the top of the North Fork. It includes Brooklyn and Queens,
 * which is correct for a ranking hint and irrelevant to eligibility — that is
 * the ZIP allowlist's job, on the server.
 */
const LONG_ISLAND_BOUNDS = {
  north: 41.17,  // Orient Point
  south: 40.53,  // Fire Island / south shore beaches
  east: -71.85,  // Montauk Point
  west: -74.05,  // western edge of the island
};

let loadPromise: Promise<boolean> | null = null;

export function placesConfigured() {
  return Boolean(API_KEY);
}

/**
 * Load the Maps JS bootstrap once per page, whoever asks first.
 *
 * Resolves false rather than rejecting when there is no key or the script fails
 * to load — a blocked CDN, an offline phone, an exhausted quota. The caller's
 * job is then to offer manual entry, not to show an error about JavaScript.
 */
export function loadPlaces(): Promise<boolean> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    if (!API_KEY || typeof window === "undefined") {
      resolve(false);
      return;
    }

    const w = window as any;
    if (w.google?.maps?.importLibrary) {
      resolve(true);
      return;
    }

    const existing = document.getElementById("pf-google-maps") as HTMLScriptElement | null;
    const script = existing || document.createElement("script");

    if (!existing) {
      script.id = "pf-google-maps";
      const params = new URLSearchParams({
        key: API_KEY,
        v: "weekly",
        libraries: "places",
        loading: "async",
        callback: "__pfMapsReady",
      });
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
    }

    // `loading=async` requires a global callback; the script will not resolve
    // any other way, and a promise that never settles would hang the field.
    w.__pfMapsReady = () => resolve(true);
    script.addEventListener("error", () => resolve(false));

    // A key with the wrong referrer restriction loads the script and then fails
    // silently, so the promise gets a deadline of its own.
    window.setTimeout(() => resolve(Boolean(w.google?.maps?.importLibrary)), 10000);

    if (!existing) document.head.appendChild(script);
  });

  return loadPromise;
}

export function beginSession(): unknown {
  const w = window as any;
  const Token = w.google?.maps?.places?.AutocompleteSessionToken;
  return Token ? new Token() : null;
}

/**
 * Address suggestions for what has been typed so far.
 *
 * Returns [] for anything too short to be worth a billed request, and for any
 * failure at all. A dropdown that does not appear is a bad moment; an error
 * banner about a Google API is a worse one, and the manual fallback below the
 * field is already the answer to both.
 */
export async function fetchSuggestions(input: string, sessionToken: unknown): Promise<Suggestion[]> {
  const query = input.trim();
  if (query.length < 3) return [];

  try {
    const w = window as any;
    const { AutocompleteSuggestion } = await w.google.maps.importLibrary("places");

    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query,
      sessionToken,
      includedRegionCodes: ["us"],
      /*
       * Street addresses and buildings only. Without this the list fills with
       * towns, roads and businesses, and picking one of those produces an
       * address with no house number that reads as verified and is not.
       */
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      locationBias: LONG_ISLAND_BOUNDS,
    });

    return (suggestions || [])
      .map((item: any) => {
        const p = item?.placePrediction;
        if (!p) return null;
        return {
          id: String(p.placeId || p.text?.text || Math.random()),
          primary: String(p.mainText?.text || p.text?.text || ""),
          secondary: String(p.secondaryText?.text || ""),
          raw: p,
        };
      })
      .filter(Boolean) as Suggestion[];
  } catch {
    return [];
  }
}

/**
 * Present a Google subpremise the way a person writes it.
 *
 * On US addresses Google returns the label with the number — "apt 2", "unit 5",
 * "ste 300" — so the obvious `#${unit}` produces "#apt 2". Anything already
 * carrying a word gets its first letter raised and nothing else; a bare number
 * or a short designator like 4B gets the hash it actually needs.
 */
function formatUnit(raw: string): string {
  const unit = String(raw || "").trim();
  if (!unit) return "";
  if (/[a-z]{2,}/i.test(unit)) return unit.charAt(0).toUpperCase() + unit.slice(1);
  return `#${unit}`;
}

/** First component whose `types` contains any of `wanted`. */
function pick(components: any[], wanted: string[], short = false): string {
  for (const want of wanted) {
    const hit = components.find((c) => (c?.types || []).includes(want));
    if (hit) return String((short ? hit.shortText : hit.longText) || "");
  }
  return "";
}

/**
 * Turn the chosen suggestion into the structured address the backend stores.
 *
 * Returns null when Google cannot give us a house number and a ZIP, which is
 * the one case that must not be allowed through: an address without those is
 * not somewhere a Fixter can be sent, however confident the text looks.
 */
export async function resolveSuggestion(suggestion: Suggestion): Promise<VerifiedAddress | null> {
  try {
    const prediction = suggestion.raw as any;
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ["addressComponents", "location", "formattedAddress", "id"],
    });

    const components: any[] = place.addressComponents || [];
    const streetNumber = pick(components, ["street_number"]);
    const route = pick(components, ["route"]);
    const unit = pick(components, ["subpremise"]);
    const zip = pick(components, ["postal_code"]);

    /*
     * Long Island addresses do not agree on which component is the town.
     * Incorporated villages use `locality`; the unincorporated hamlets that
     * make up most of Suffolk arrive as `sublocality` or, in a few cases, only
     * as `neighborhood`. Trying them in order is what stops half the island
     * registering with a blank city.
     */
    const city = pick(components, [
      "locality",
      "postal_town",
      "sublocality_level_1",
      "sublocality",
      "neighborhood",
      "administrative_area_level_3",
    ]);
    const state = pick(components, ["administrative_area_level_1"], true);

    if (!streetNumber || !route || !zip || !city) return null;

    const loc = place.location;
    const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat ?? null;
    const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng ?? null;

    return {
      line1: `${streetNumber} ${route}`.trim(),
      unit: formatUnit(unit),
      city,
      state: state || "NY",
      zip: zip.split("-")[0],
      placeId: String(place.id || ""),
      lat: Number.isFinite(lat) ? Number(lat) : null,
      lng: Number.isFinite(lng) ? Number(lng) : null,
      formatted: String(
        place.formattedAddress || `${streetNumber} ${route}, ${city}, ${state} ${zip}`
      ),
    };
  } catch {
    return null;
  }
}
