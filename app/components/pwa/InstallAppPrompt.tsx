"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const INSTALLED_KEY = "profixter:pwa-installed";
const DISMISSED_KEY = "profixter:pwa-install-dismissed";

const ALLOWED_PATH_PREFIXES = [
  "/account",
  "/membership",
  "/membership-info",
  "/confirmationpage",
  "/book/confirmation",
];

const BLOCKED_PATH_PREFIXES = [
  "/admin",
  "/signin",
  "/signup",
  "/forgot-password",
  "/register",
  "/checkout",
  "/payment",
  "/api",
];

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function isLikelyIphoneSafari() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const isiOS =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari =
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opios|mercury/i.test(userAgent);
  return isiOS && isSafari;
}

function storageFlag(storage: Storage | undefined, key: string) {
  if (!storage) return false;
  try {
    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setStorageFlag(storage: Storage | undefined, key: string) {
  if (!storage) return;
  try {
    storage.setItem(key, "true");
  } catch {
    // Ignore storage failures; the prompt remains dismissible for this render.
  }
}

function routeAllowsPrompt(pathname: string | null) {
  const path = pathname || "/";
  if (BLOCKED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default function InstallAppPrompt() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIphoneSafari, setIsIphoneSafari] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [ready, setReady] = useState(false);
  const [engagedPath, setEngagedPath] = useState<string | null>(null);

  useEffect(() => {
    const updateEnvironment = () => {
      setIsInstalled(
        isStandaloneMode() ||
          storageFlag(window.localStorage, INSTALLED_KEY)
      );
      setIsDismissed(storageFlag(window.sessionStorage, DISMISSED_KEY));
      setIsMobile(isMobileViewport());
      setIsIphoneSafari(isLikelyIphoneSafari());
      setReady(true);
    };

    updateEnvironment();
    window.addEventListener("resize", updateEnvironment);
    window.addEventListener("orientationchange", updateEnvironment);

    const handleAppInstalled = () => {
      setStorageFlag(window.localStorage, INSTALLED_KEY);
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("resize", updateEnvironment);
      window.removeEventListener("orientationchange", updateEnvironment);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  useEffect(() => {
    const reveal = () => setEngagedPath(pathname);
    const timer = window.setTimeout(reveal, 10000);
    const handleScroll = () => {
      if (window.scrollY >= 480) reveal();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  const promptMode = useMemo<"android" | "ios" | null>(() => {
    if (deferredPrompt) return "android";
    if (isIphoneSafari) return "ios";
    return null;
  }, [deferredPrompt, isIphoneSafari]);

  const canShow =
    ready &&
    isMobile &&
    !isInstalled &&
    !isDismissed &&
    engagedPath === pathname &&
    routeAllowsPrompt(pathname) &&
    !!promptMode;

  const dismissForSession = () => {
    setStorageFlag(window.sessionStorage, DISMISSED_KEY);
    setIsDismissed(true);
    setShowSteps(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);

      if (choice.outcome === "accepted") {
        setStorageFlag(window.localStorage, INSTALLED_KEY);
        setIsInstalled(true);
      } else {
        dismissForSession();
      }
    } catch {
      dismissForSession();
    }
  };

  // Don't ask a first-time visitor to install an app before they have used the
  // service - it stacks a third fixed bar over the acquisition CTA and the
  // bottom nav. Signed-in customers have a reason to install it.
  if (!isAuthenticated) return null;
  if (!canShow) return null;

  const isAccountArea = pathname?.startsWith("/account");
  const isMembershipArea = pathname?.startsWith("/membership");
  const title =
    promptMode === "ios"
      ? "Add Profixter to your iPhone"
      : "Use Profixter like an app";
  const body =
    promptMode === "ios"
      ? "Tap Share, then Add to Home Screen, then Add."
      : "Add Profixter to your phone for faster booking, membership access, and appointment updates.";

  return (
    <>
      <aside
        aria-label="Install Profixter app"
        className={`fixed left-3 right-3 z-[60] mx-auto max-w-[400px] rounded-[20px] border border-white/70 bg-white/95 p-3 text-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl ${
          isAccountArea
            ? "bottom-[calc(96px+env(safe-area-inset-bottom,0px))]"
            : isMembershipArea
              ? "bottom-[calc(160px+env(safe-area-inset-bottom,0px))]"
              : "bottom-[calc(84px+env(safe-area-inset-bottom,0px))]"
        }`}
      >
        <div className="flex gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0B1628] text-[14px] font-black text-white shadow-inner">
            P
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold leading-tight tracking-[-0.01em]">
                  {title}
                </p>
                <p className="mt-1 max-w-[280px] text-[12px] leading-[1.4] text-slate-600">
                  {body}
                </p>
              </div>

              <button
                type="button"
                aria-label="Dismiss install prompt"
                onClick={dismissForSession}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[18px] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                x
              </button>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={
                  promptMode === "ios" ? () => setShowSteps(true) : handleInstall
                }
                className="rounded-full bg-[#0B1628] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition active:scale-[0.98]"
              >
                {promptMode === "ios" ? "Show Steps" : "Install App"}
              </button>
              <button
                type="button"
                onClick={dismissForSession}
                className="rounded-full px-3 py-2 text-[12px] font-semibold text-slate-500 transition hover:text-slate-800"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </aside>

      {showSteps && promptMode === "ios" ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-slate-950/30 px-3 pb-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-steps-title"
        >
          <div className="mx-auto w-full max-w-[420px] rounded-[28px] bg-white p-5 text-slate-950 shadow-[0_22px_80px_rgba(15,23,42,0.26)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  id="install-steps-title"
                  className="text-[17px] font-semibold tracking-[-0.01em]"
                >
                  Add Profixter to your iPhone
                </p>
                <p className="mt-1 text-[13px] text-slate-600">
                  This only takes a few seconds.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close install steps"
                onClick={() => setShowSteps(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-[19px] leading-none text-slate-500"
              >
                x
              </button>
            </div>

            <ol className="mt-5 grid gap-3">
              {[
                "Tap the Share button.",
                "Tap Add to Home Screen.",
                "Tap Add.",
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0B1628] text-[12px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-[14px] font-medium text-slate-800">
                    {step}
                  </span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={() => setShowSteps(false)}
              className="mt-5 w-full rounded-full bg-[#0B1628] px-4 py-3 text-[14px] font-semibold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
