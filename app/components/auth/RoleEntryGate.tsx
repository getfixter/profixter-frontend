"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAutomaticEntryPath, getRoleLandingKind } from "@/lib/auth-routing";
import { useAuth } from "@/lib/useAuth";

function EntryLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-6 text-[#0B1628]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#306EEC] border-t-transparent" />
        <p className="text-sm font-semibold text-[#526078]">{label}</p>
      </div>
    </main>
  );
}

/* Hydration uses the server answer (no token), then the browser's, with no mismatch. */
const noSubscription = () => () => {};
function readStoredToken() {
  try {
    return !!window.localStorage.getItem("token");
  } catch {
    return false;
  }
}

export default function RoleEntryGate({
  children,
  loadingLabel = "Opening Profixter...",
  redirectLabel = "Opening Profixter...",
}: {
  children: ReactNode;
  loadingLabel?: string;
  redirectLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  /*
   * Staff are routed to their workspace, because for them the marketing site is
   * never the destination. Customers and members are not: pressing Home is a
   * deliberate act, and bouncing them to the membership dashboard made Home
   * look broken. Automatic post-login entry still uses getAutomaticEntryPath;
   * this gate only governs someone who has actually arrived at the homepage.
   */
  const kind = getRoleLandingKind(user);
  const routesAwayFromHome = kind === "admin" || kind === "fixter" || kind === "general_fixter";
  const automaticTarget =
    isAuthenticated && user && routesAwayFromHome ? getAutomaticEntryPath(user) : null;
  const targetPathname = automaticTarget?.split("?")[0] || null;
  const target = targetPathname && targetPathname !== pathname ? automaticTarget : null;

  useEffect(() => {
    if (!isLoading && target) {
      router.replace(target);
    }
  }, [isLoading, router, target]);

  // A visitor with no stored token is definitively anonymous, so there is
  // nothing to resolve and nothing to redirect to. Render immediately rather
  // than showing a spinner in front of the page - cold traffic should see
  // content on first paint.
  /*
   * Not read during the first render: the server cannot see localStorage,
   * so deciding it in the first render made the client's first frame differ
   * from the server HTML (React hydration error #418 for every signed-in
   * visitor). The frame before this runs is covered on the homepage by
   * AUTH_PENDING_SCRIPT (lib/surface.ts), which hides the personalised part.
   */
  const hasStoredToken = useSyncExternalStore(noSubscription, readStoredToken, () => false);

  if (isLoading && hasStoredToken) return <EntryLoading label={loadingLabel} />;
  if (target) return <EntryLoading label={redirectLabel} />;

  return <>{children}</>;
}
