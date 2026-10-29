"use client";

import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import Sheet from "@/app/components/ui/Sheet";
import AddressField, { type AddressValue } from "@/app/components/address/AddressField";
import { addHome, readApiError, type NewHomeResult } from "@/lib/auth2";
import { useAuth } from "@/lib/useAuth";

/**
 * "Add your home" - the address, asked for only when it is needed.
 *
 * Registration no longer asks for an address, so every place that needs one
 * (the account page, booking, the free visit, a plan) opens this sheet inline
 * instead of sending the customer off to /account and losing their place.
 *
 * Saves through the shared API client (POST /api/users/me/addresses) and then
 * refreshes the user in the auth context, so every component that reads
 * user.addresses sees the new home immediately.
 */
export default function AddHomeSheet({
  open,
  onClose,
  onSaved,
  title = "Add your home",
  intro = "So we know where to send your Fixter.",
  submitLabel = "Save home",
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (result: NewHomeResult) => void;
  title?: string;
  intro?: string;
  submitLabel?: string;
}) {
  const { refreshUser } = useAuth();
  const [address, setAddress] = useState<AddressValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [outside, setOutside] = useState<NewHomeResult | null>(null);

  const reset = () => {
    setAddress(null);
    setError("");
    setOutside(null);
    setSaving(false);
  };

  const close = () => {
    if (saving) return;
    if (outside) onSaved(outside);
    reset();
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!address?.verified) {
      setError("Choose your address from the list, or enter it by hand.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await addHome({
        /* The unit rides in the street line: that is how the backend keys a home. */
        line1: [address.line1, address.unit.trim()].filter(Boolean).join(" "),
        city: address.city,
        state: address.state,
        zip: address.zip,
        ...(address.placeId ? { placeId: address.placeId } : {}),
        ...(address.lat != null && address.lng != null ? { lat: address.lat, lng: address.lng } : {}),
        label: "Home",
      });
      await refreshUser().catch(() => null);
      if (result?.serviceArea && result.serviceArea.inArea === false) {
        setOutside(result);
        setSaving(false);
        return;
      }
      reset();
      onSaved(result);
    } catch (err) {
      const parsed = readApiError(err);
      setError(
        parsed.code === "NETWORK"
          ? "We couldn't reach Profixter. Check your connection and try again."
          : parsed.message || "We couldn't save this address. Please check it and try again."
      );
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} title={outside ? "Home saved" : title}>
      {outside ? (
        <div className="mt-3">
          <p className="text-[15px] leading-6 text-[#3f4a5c]" role="status">
            We saved your home, but Profixter doesn&apos;t serve this area yet. We currently serve Nassau and
            Suffolk counties on Long Island.
          </p>
          <button type="button" className="auth-submit" onClick={close}>
            OK
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-2">
          <p className="mb-4 text-[14.5px] text-[#5b6577]">{intro}</p>
          <AddressField value={address} onChange={(next) => { setAddress(next); if (error) setError(""); }} />
          <div aria-live="polite">
            {error ? (
              <p className="auth-error auth-error--form" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <button type="submit" className="auth-submit" disabled={saving}>
            {saving ? <span className="auth-spinner" aria-hidden="true" /> : null}
            {saving ? "Saving" : submitLabel}
          </button>
        </form>
      )}
    </Sheet>
  );
}

/**
 * The sheet as a promise: `const home = await requestHome()` resolves with the
 * saved home, or null if the customer closed the sheet. Render `homeSheet`.
 */
export function useAddHome(options?: { title?: string; intro?: string; submitLabel?: string }): {
  requestHome: () => Promise<NewHomeResult | null>;
  homeSheet: ReactNode;
  openHome: () => void;
} {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: NewHomeResult | null) => void) | null>(null);

  const requestHome = useCallback(() => {
    resolver.current?.(null);
    setOpen(true);
    return new Promise<NewHomeResult | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const openHome = useCallback(() => {
    void requestHome();
  }, [requestHome]);

  const homeSheet = (
    <AddHomeSheet
      open={open}
      title={options?.title}
      intro={options?.intro}
      submitLabel={options?.submitLabel}
      onClose={() => {
        setOpen(false);
        resolver.current?.(null);
        resolver.current = null;
      }}
      onSaved={(result) => {
        setOpen(false);
        resolver.current?.(result);
        resolver.current = null;
      }}
    />
  );

  return { requestHome, homeSheet, openHome };
}
