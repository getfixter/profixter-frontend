"use client";

import { ChatBubbleLeftIcon, DocumentDuplicateIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { useRef, useState, useSyncExternalStore } from "react";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { extractUSNationalPhoneDigits } from "@/lib/phone";
import { Button, cx } from "./Button";
import { Menu, type MenuItem } from "./Menu";
import { useToast } from "./Toast";

/** (631) 599-1363 from anything a customer typed; the raw value when it is not a US number. */
export function formatPhone(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const digits = extractUSNationalPhoneDigits(raw);
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function telHref(value: string): string {
  const digits = extractUSNationalPhoneDigits(value);
  return digits.length === 10 ? `+1${digits}` : value.replace(/[^\d+]/g, "");
}

/* ---- the remembered maps app (this device only) ---- */

export type MapsApp = "google" | "apple";
const MAPS_KEY = "pfa:pref:maps";
const mapsListeners = new Set<() => void>();

export function getMapsApp(): MapsApp | null {
  try {
    const v = window.localStorage.getItem(MAPS_KEY);
    return v === "google" || v === "apple" ? v : null;
  } catch {
    return null;
  }
}

export function setMapsApp(app: MapsApp | null): void {
  try {
    if (app) window.localStorage.setItem(MAPS_KEY, app);
    else window.localStorage.removeItem(MAPS_KEY);
  } catch {
    /* storage blocked: the choice is asked again next time */
  }
  mapsListeners.forEach((notify) => notify());
}

export function useMapsApp(): MapsApp | null {
  return useSyncExternalStore(
    (notify) => {
      mapsListeners.add(notify);
      return () => mapsListeners.delete(notify);
    },
    getMapsApp,
    () => null
  );
}

export function directionsUrl(address: string, app: MapsApp): string {
  const q = encodeURIComponent(address);
  return app === "apple" ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export type ContactActionsProps = {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  /** Show the formatted number as text (tapping it offers Call / Text / Copy). Default true. */
  showPhone?: boolean;
  /** Text messages are not allowed for this person (no consent / STOP): the Text button is hidden. */
  canText?: boolean;
  className?: string;
};

/**
 * The contact row of a job or customer (F.2, E.5): Call, Text, Directions,
 * Copy. Directions opens the maps app this device chose (asked once,
 * remembered; changeable from the account menu). Copy confirms with a
 * "Copied" toast and falls back for insecure origins (lib/utils/clipboard).
 *
 *   <ContactActions phone={booking.phone} address={fullAddress} email={booking.email} />
 */
export function ContactActions({ phone, email, address, showPhone = true, canText = true, className }: ContactActionsProps) {
  const toast = useToast();
  const maps = useMapsApp();
  const [menu, setMenu] = useState<null | "phone" | "maps" | "copy">(null);
  const phoneRef = useRef<HTMLButtonElement>(null);
  const mapsRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const tel = phone ? telHref(phone) : "";

  const copy = async (text: string, what: string) => {
    const ok = await writeToClipboard(text);
    toast.show(ok ? `${what} copied` : `Could not copy the ${what.toLowerCase()}. Select it and copy it by hand.`);
  };

  const openMaps = (app: MapsApp) => {
    if (!address) return;
    window.open(directionsUrl(address, app), "_blank", "noopener,noreferrer");
  };

  const copyItems: MenuItem[] = [
    phone ? { label: `Copy phone · ${formatPhone(phone)}`, icon: <PhoneIcon />, onSelect: () => void copy(formatPhone(phone), "Phone") } : null,
    address ? { label: "Copy address", hint: address, icon: <MapPinIcon />, onSelect: () => void copy(address, "Address") } : null,
    email ? { label: "Copy email", hint: email, icon: <DocumentDuplicateIcon />, onSelect: () => void copy(email, "Email") } : null,
  ].filter(Boolean) as MenuItem[];

  if (!phone && !address && !email) return null;

  return (
    <div className={cx("flex flex-col gap-2", className)} data-contact-actions="">
      {showPhone && phone && (
        <button ref={phoneRef} type="button" onClick={() => setMenu("phone")} className="adm-num min-h-[44px] self-start text-left text-[15px] font-semibold text-adm-accent-ink underline-offset-4 hover:underline">
          {formatPhone(phone)}
        </button>
      )}
      <div className="grid grid-cols-4 gap-2">
        {phone ? (
          <a href={`tel:${tel}`} className="adm-btn adm-btn--secondary !px-2" aria-label={`Call ${formatPhone(phone)}`}>
            <PhoneIcon className="h-5 w-5" aria-hidden="true" />
            <span className="max-[359px]:sr-only">Call</span>
          </a>
        ) : (
          <span />
        )}
        {phone && canText ? (
          <a href={`sms:${tel}`} className="adm-btn adm-btn--secondary !px-2" aria-label={`Text ${formatPhone(phone)}`}>
            <ChatBubbleLeftIcon className="h-5 w-5" aria-hidden="true" />
            <span className="max-[359px]:sr-only">Text</span>
          </a>
        ) : (
          <span />
        )}
        {address ? (
          <Button
            ref={mapsRef}
            variant="secondary"
            className="!px-2"
            aria-label="Directions"
            onClick={() => (maps ? openMaps(maps) : setMenu("maps"))}
            icon={<MapPinIcon className="h-5 w-5" aria-hidden="true" />}
          >
            <span className="max-[359px]:sr-only">Map</span>
          </Button>
        ) : (
          <span />
        )}
        {copyItems.length ? (
          <Button ref={copyRef} variant="secondary" className="!px-2" aria-label="Copy" onClick={() => setMenu("copy")} icon={<DocumentDuplicateIcon className="h-5 w-5" aria-hidden="true" />}>
            <span className="max-[359px]:sr-only">Copy</span>
          </Button>
        ) : (
          <span />
        )}
      </div>

      <Menu
        open={menu === "phone"}
        onClose={() => setMenu(null)}
        anchorRef={phoneRef}
        title={phone ? formatPhone(phone) : "Phone"}
        items={[
          { label: "Call", icon: <PhoneIcon />, href: `tel:${tel}` },
          ...(canText ? [{ label: "Text", icon: <ChatBubbleLeftIcon />, href: `sms:${tel}` }] : []),
          { label: "Copy number", icon: <DocumentDuplicateIcon />, onSelect: () => void copy(formatPhone(phone), "Phone") },
        ]}
      />
      <Menu
        open={menu === "maps"}
        onClose={() => setMenu(null)}
        anchorRef={mapsRef}
        title="Open directions in"
        items={[
          { label: "Google Maps", hint: "Remembered on this device", icon: <MapPinIcon />, onSelect: () => (setMapsApp("google"), openMaps("google")) },
          { label: "Apple Maps", hint: "Remembered on this device", icon: <MapPinIcon />, onSelect: () => (setMapsApp("apple"), openMaps("apple")) },
        ]}
      />
      <Menu open={menu === "copy"} onClose={() => setMenu(null)} anchorRef={copyRef} title="Copy" items={copyItems} />
    </div>
  );
}
