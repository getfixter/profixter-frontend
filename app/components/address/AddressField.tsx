"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import API from "@/lib/api";
import {
  beginSession,
  fetchSuggestions,
  loadPlaces,
  placesConfigured,
  resolveSuggestion,
  type Suggestion,
  type VerifiedAddress,
} from "@/lib/places";

export type AddressValue = VerifiedAddress & {
  unit: string;
  /** True only when this came from a lookup the customer picked out of the list. */
  verified: boolean;
};

type Props = {
  value: AddressValue | null;
  onChange: (value: AddressValue | null) => void;
  /** Told the service-area answer whenever it changes, for copy elsewhere. */
  onServiceArea?: (state: ServiceAreaState) => void;
};

export type ServiceAreaState = "unknown" | "checking" | "inside" | "outside";

/*
 * Long enough that a suggestion list is not flickering under somebody's thumb
 * while they type a house number, short enough that it never feels laggy. Every
 * request is billed, so this is a cost decision as much as a feel one.
 */
const DEBOUNCE_MS = 260;

export default function AddressField({ value, onChange, onServiceArea }: Props) {
  const [query, setQuery] = useState(value?.formatted || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [resolving, setResolving] = useState(false);
  /*
   * Whether there is a key at all is known before the first render - it is a
   * build-time constant - so it is the initial state rather than something an
   * effect discovers and corrects. Without a key the field is the manual form
   * from the first paint, with no flash of a search box that can never answer.
   */
  const [manual, setManual] = useState(() => !placesConfigured());
  const [lookupDown, setLookupDown] = useState(() => !placesConfigured());
  const [showUnit, setShowUnit] = useState(false);
  const [areaState, setAreaState] = useState<ServiceAreaState>("unknown");
  const [manualFields, setManualFields] = useState({ line1: "", city: "", state: "NY", zip: "" });

  const listId = useId();
  const sessionToken = useRef<unknown>(null);
  const debounce = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /* Guards against a slow response for "125 Mai" landing after "125 Main St". */
  const requestSeq = useRef(0);

  const report = useCallback(
    (next: ServiceAreaState) => {
      setAreaState(next);
      onServiceArea?.(next);
    },
    [onServiceArea]
  );

  useEffect(() => {
    if (!placesConfigured()) return;
    let cancelled = false;
    loadPlaces().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setLookupDown(true);
        setManual(true);
      } else {
        sessionToken.current = beginSession();
      }
    });
    return () => { cancelled = true; };
  }, []);

  // A click anywhere else is a dismissal, not a selection.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /** Ask the server whether we serve this ZIP. The allowlist never leaves it. */
  const checkServiceArea = useCallback(
    async (zip: string) => {
      if (!zip) return report("unknown");
      report("checking");
      try {
        const res = await API.get(`/api/service-area/check?zip=${encodeURIComponent(zip)}`);
        report(res.data?.serviceable ? "inside" : "outside");
      } catch {
        /*
         * Unknown, not outside. This endpoint decides what message to show, not
         * whether anyone may register, so a failed check must never turn into
         * "we're not in your area" for somebody who lives two towns over.
         */
        report("unknown");
      }
    },
    [report]
  );

  const runSearch = useCallback((text: string) => {
    const seq = ++requestSeq.current;
    fetchSuggestions(text, sessionToken.current).then((next) => {
      if (seq !== requestSeq.current) return;
      setSuggestions(next);
      setOpen(next.length > 0);
      setActive(-1);
    });
  }, []);

  const handleType = (text: string) => {
    setQuery(text);
    /*
     * THE STATE MACHINE, AND THE WHOLE POINT OF THIS FIELD.
     *
     * Editing the box after picking an address un-verifies it. Without this,
     * somebody selects "125 Main St, Babylon", changes the number to 127, and
     * we store a verified-looking address at a house nobody checked exists.
     */
    if (value?.verified) {
      onChange(null);
      setShowUnit(false);
      report("unknown");
    }
    if (debounce.current) window.clearTimeout(debounce.current);
    if (manual) return;
    debounce.current = window.setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const choose = async (suggestion: Suggestion) => {
    setOpen(false);
    setResolving(true);
    const resolved = await resolveSuggestion(suggestion);
    setResolving(false);

    if (!resolved) {
      // Google knows the place but not as a deliverable street address.
      setLookupDown(true);
      return;
    }

    setQuery(resolved.formatted);
    /*
     * resolved.unit, not "". Google returns a subpremise for an address entered
     * with one - "apt 2" - and blanking it here threw away something the
     * customer had already told us and would have to type again.
     */
    onChange({ ...resolved, verified: true });
    setShowUnit(true);
    void checkServiceArea(resolved.zip);
    // The session ended with that details fetch; the next search starts a new one.
    sessionToken.current = beginSession();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const commitManual = (next: typeof manualFields) => {
    setManualFields(next);
    const zip = next.zip.replace(/\D/g, "").slice(0, 5);
    const complete = Boolean(next.line1.trim() && next.city.trim() && next.state.trim() && zip.length === 5);
    if (!complete) {
      onChange(null);
      report("unknown");
      return;
    }
    /*
     * Manual entry is marked verified so Continue can proceed, but it carries no
     * placeId and no coordinates, which is exactly how the server tells the two
     * apart. It is not a way around the service area: the ZIP still decides
     * eligibility, and it is still the server that decides, when the free visit
     * is actually booked.
     */
    onChange({
      line1: next.line1.trim(), city: next.city.trim(), state: next.state.trim().toUpperCase(),
      zip, placeId: "", lat: null, lng: null, unit: value?.unit || "",
      formatted: `${next.line1.trim()}, ${next.city.trim()}, ${next.state.trim()} ${zip}`,
      verified: true,
    });
    void checkServiceArea(zip);
  };

  /* The shared auth input. See the auth block in globals.css. */
  const inputBase = "auth-input";

  return (
    <div ref={boxRef} className="w-full">
      {!manual ? (
        <>
          <label htmlFor="pf-address" className="sr-only">Home address</label>
          <div className="relative">
            <input
              id="pf-address"
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              autoComplete="off"
              value={query}
              onChange={(e) => handleType(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Start typing your address..."
              /*
                Room for the tick, and an ellipsis rather than a collision. A
                verified address is a full formatted line - "1 Congress Ave,
                Austin, TX 78701, USA" - and on a 390px phone it ran straight
                under the checkmark.
              */
              className={`${inputBase} ${value?.verified || resolving ? "auth-input--trailing" : ""}`}
            />
            {value?.verified ? (
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#1FA463]" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10.5l4 4 8-8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : null}
            {resolving ? (
              <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#C3CDDF] border-t-transparent" aria-hidden="true" />
            ) : null}

          {/*
            AN OVERLAY, BECAUSE AN IN-FLOW LIST EATS THE CONTINUE TAP.

            The first build put this in normal flow, reasoning that a floating
            dropdown can be clipped on a phone. Against live Google that turned
            out to be actively broken: with five suggestions showing, pressing
            Continue fired the outside-click dismissal on mousedown, the list
            collapsed, the button jumped 144px up the screen, and mouseup landed
            on nothing. The tap was silently swallowed.

            Absolute positioning means dismissing the list moves nothing. The
            clipping worry does not apply on this route anyway - the fixed bottom
            tab bar lists /signup in its own hiddenPathPrefixes, so there is
            nothing layered over this page to be hidden behind.
          */}
          {open && suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Address suggestions"
              className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(280px,42svh)] overflow-y-auto overscroll-contain rounded-[12px] border border-[#DDE4F0] bg-white shadow-[0_18px_44px_rgba(11,22,40,0.14)]"
            >
              {suggestions.map((s, i) => (
                <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => void choose(s)}
                    className={`flex min-h-[52px] w-full flex-col justify-center gap-0.5 px-4 py-2.5 text-left transition ${
                      i === active ? "bg-[#EEF4FF]" : "hover:bg-[#F4F7FC]"
                    }`}
                  >
                    <span className="text-[15px] font-semibold leading-tight text-[#0B1628]">{s.primary}</span>
                    {s.secondary ? (
                      <span className="text-[13px] leading-tight text-[#6B7688]">{s.secondary}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          {lookupDown ? (
            <p className="text-[13px] font-medium text-[#6B7688]">Enter your address.</p>
          ) : null}
          <input
            aria-label="Street address" value={manualFields.line1}
            onChange={(e) => commitManual({ ...manualFields, line1: e.target.value })}
            placeholder="Street address" autoComplete="street-address" className={inputBase}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              aria-label="City" value={manualFields.city}
              onChange={(e) => commitManual({ ...manualFields, city: e.target.value })}
              placeholder="City" autoComplete="address-level2" className={inputBase}
            />
            <input
              aria-label="ZIP code" value={manualFields.zip} inputMode="numeric" maxLength={5}
              onChange={(e) => commitManual({ ...manualFields, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              placeholder="ZIP" autoComplete="postal-code" className={inputBase}
            />
          </div>
        </div>
      )}

      {/* Revealed only once there is an address to put a unit on. */}
      {showUnit && value?.verified ? (
        <input
          aria-label="Apartment or unit, optional"
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value })}
          placeholder="Apt / Unit (optional)"
          className={`${inputBase} mt-2.5`}
        />
      ) : null}

      {areaState === "outside" ? (
        <p className="mt-3 text-[13px] font-medium leading-5 text-[#5B6577]">
          <span className="font-bold text-[#0B1628]">We&rsquo;re not in your area yet.</span>{" "}
          Profixter currently serves Long Island.
        </p>
      ) : null}

      {/*
        The manual fallback, rendered into the slot below the primary button.

        It used to sit between the address field and Continue - a rare escape
        hatch placed in the middle of the path almost everybody takes, offered
        before they had typed anything to fail at.
      */}
      {/*
        Shown only once somebody is actually struggling: they have typed enough
        for a real search and still have no verified address. On a pristine
        screen it is noise, and it was sitting between the field and the button
        offering an escape from something nobody had attempted yet.
      */}
      {!manual && !lookupDown && query.trim().length >= 3 && !value?.verified ? (
        <button
          type="button"
          onClick={() => { setManual(true); setOpen(false); }}
          className="auth-fallback"
          data-auth-fallback=""
        >
          Can&rsquo;t find your address?
        </button>
      ) : null}
    </div>
  );
}
