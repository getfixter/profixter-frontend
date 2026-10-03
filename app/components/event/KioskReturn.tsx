"use client";

/**
 * "Back to event": the way an iPad at a booth gets back to the kiosk after a
 * visitor has registered (and maybe booked their First Visit Free).
 *
 * Renders nothing unless this tab came from the /event call to action (see
 * lib/event-kiosk). It never acts on its own: a tap asks first, then signs the
 * visitor out with the site's normal logout, so the next person cannot open
 * their account, and returns to /event. On every other device and tab this
 * component is inert.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { KIOSK_PATH, KIOSK_RETURN_KEY, clearKioskCarryOver, isKioskSession } from "@/lib/event-kiosk";

export default function KioskReturn() {
  const pathname = usePathname() || "";
  const { logout } = useAuth();
  const [active, setActive] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // sessionStorage is only readable after mount; re-read on every route change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(isKioskSession() && !pathname.startsWith(KIOSK_PATH));
    setConfirming(false);
  }, [pathname]);

  if (!active) return null;

  const backToEvent = () => {
    logout();
    clearKioskCarryOver();
    try {
      window.sessionStorage.removeItem(KIOSK_RETURN_KEY);
    } catch {}
    window.location.assign(KIOSK_PATH);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="fixed left-3 z-[90] inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#0B1628]/90 px-4 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(11,22,40,0.35)] backdrop-blur"
        style={{ bottom: "max(84px, calc(env(safe-area-inset-bottom) + 84px))" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to event
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Return to the event screen"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl bg-white p-5 text-[#0B1628] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-bold">All done?</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
              This signs you out of this iPad and returns to the event screen for the next person.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-[48px] flex-1 rounded-xl bg-slate-100 text-[14px] font-semibold text-slate-700"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={backToEvent}
                className="min-h-[48px] flex-1 rounded-xl bg-[#306EEC] text-[14px] font-semibold text-white"
              >
                Sign out &amp; return
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
