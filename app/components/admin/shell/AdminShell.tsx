"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { getCurrentUser, type User } from "@/lib/auth-service";
import { getRoleLandingPath } from "@/lib/auth-routing";
import { canOpen as canOpenFor, hasWorkspace, navigationFor, SECTIONS, sectionForPath, type SectionId } from "@/lib/admin/sections";
import { fetchNeedsActionCounts } from "@/lib/admin/needs-action";
import { takeToast } from "@/lib/admin/handoff";
import { useAdminQuery, useIsFetchingAny } from "@/lib/admin/query";
import { ErrorBoundary, ToastProvider, useToast } from "@/app/components/admin/ui";
import { AdminContext, type AdminContextValue } from "./AdminContext";
import { AccountMenu } from "./AccountMenu";
import { AdminScroll } from "./AdminScroll";
import { BrandedLoader, HAMMER_MARK } from "./BrandedLoader";
import { GlobalSearch } from "./GlobalSearch";
import { BottomNav, Sidebar } from "./ShellNav";

/* The parts of a user that decide what Admin shows (unchanged from the old page). */
function accessKey(u: User | null | undefined) {
  if (!u) return "";
  return JSON.stringify([u.role, u.isActive !== false, [...(u.permissions || [])].sort(), u.employeePosition || null]);
}

/** The header title for a path: the section, or a named sub-screen. */
function titleFor(pathname: string): string {
  if (pathname.startsWith("/admin/schedule/availability")) return "Availability";
  const id = sectionForPath(pathname);
  return id ? SECTIONS[id].label : "Admin";
}

/**
 * The admin shell (audit K.1, M.1): header (52px + safe-area-top) with the
 * Profixter hammer, the section title, search and the account menu; a phone
 * bottom bar or a desktop sidebar; the toast host; the permission context.
 *
 * What this person may see comes from the server (/api/auth/me). The shell
 * re-reads it on focus and every minute and refreshes only when access really
 * changed, exactly as the old single page did; every API behind a section
 * checks the same permission, so hiding is never the protection.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/admin";

  const workspace = hasWorkspace(user);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!workspace) router.replace(getRoleLandingPath(user));
  }, [isLoading, user, workspace, router, pathname]);

  // Access changes while signed in (the owner switches a section off).
  const accessKeyRef = useRef("");
  useEffect(() => {
    accessKeyRef.current = accessKey(user);
  }, [user]);
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const fresh = await getCurrentUser();
        if (accessKey(fresh) !== accessKeyRef.current) await refreshUser();
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) await refreshUser();
      }
    };
    const timer = window.setInterval(recheck, 60000);
    window.addEventListener("focus", recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", recheck);
    };
  }, [signedIn, refreshUser]);

  if (isLoading || !user || !workspace) return <BrandedLoader />;
  return <SignedInShell user={user} refreshUser={refreshUser}>{children}</SignedInShell>;
}

function SignedInShell({ user, refreshUser, children }: { user: User; refreshUser: () => Promise<unknown>; children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const nav = useMemo(() => navigationFor(user), [user]);
  const canOpen = useCallback((id: SectionId) => canOpenFor(user, id), [user]);
  const wantsBadges = canOpen("jobs") || canOpen("customers") || canOpen("projects");
  const badges = useAdminQuery(["needs-action", "counts"], fetchNeedsActionCounts, { enabled: wantsBadges, pollMs: 60_000, staleTime: 30_000 });

  const value: AdminContextValue = useMemo(
    () => ({ user, nav, canOpen, refreshUser, badges: badges.data ?? null }),
    [user, nav, canOpen, refreshUser, badges.data]
  );
  const section = sectionForPath(pathname);

  if (!nav.primary.length) {
    return (
      <div className="adm-shell flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-[420px] rounded-adm-lg border border-adm-line bg-adm-surface p-6 text-center">
          <h1 className="text-[20px] font-semibold text-adm-ink">No Admin sections yet</h1>
          <p className="mt-2 text-[14px] leading-6 text-adm-text-2">
            Your account is set up, but no sections have been switched on for it. Ask the owner to give you access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={value}>
      <ToastProvider>
        <div className="adm-shell adm-with-sidebar" data-adm-shell="">
          <Sidebar />
          <ShellHeader title={titleFor(pathname)} />
          <main id="adm-main" className="adm-main" tabIndex={-1}>
            <ErrorBoundary label={section ? SECTIONS[section].label : "This section"} resetKey={section || ""}>
              {children}
            </ErrorBoundary>
          </main>
          <BottomNav />
          <AdminScroll />
          <ReturnToast />
        </div>
      </ToastProvider>
    </AdminContext.Provider>
  );
}

function ShellHeader({ title }: { title: string }) {
  const fetching = useIsFetchingAny();
  return (
    <header className="adm-header" data-adm-header="">
      <a href="#adm-main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-adm-sm focus:bg-adm-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Link href="/admin" aria-label="Profixter Admin home" className="adm-brand-compact flex h-11 w-9 flex-none items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- small local mark */}
        <img src={HAMMER_MARK} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
      </Link>
      <p className="adm-header-title" aria-live="polite">
        {title}
      </p>
      <GlobalSearch />
      <AccountMenu />
      {fetching && <span className="adm-progress" aria-hidden="true" data-adm-progress="" />}
    </header>
  );
}

/** A message handed over by the old-link redirect (a Stripe return). */
function ReturnToast() {
  const toast = useToast();
  const pathname = usePathname();
  useEffect(() => {
    const message = takeToast();
    if (message) toast.show(message);
  }, [pathname, toast]);
  return null;
}
