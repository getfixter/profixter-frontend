"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import "../components/account/account.css";

import { ActiveTab, AccountFormData } from "../components/account/types";
import { initialAccountFormData } from "../data/account";

import Header from "../components/sections/Header";
import Footer from "../components/sections/Footer";
import { PersonalInfoForm } from "../components/account/PersonalInfoForm";
import { PlanSection } from "../components/account/PlanSection";
import { PasswordForm } from "../components/account/PasswordForm";
import AccountOverview from "../components/account/AccountOverview";

import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath } from "@/lib/auth-routing";

function TabSync({ onTab }: { onTab: (tab: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) onTab(tab);
  }, [searchParams, onTab]);

  return null;
}

const TAB_TITLES: Partial<Record<ActiveTab, string>> = {
  personal: "Personal information",
  password: "Password & security",
};

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  /* Set on Log out, so the signed-out redirect below does not add ?next=. */
  const loggingOut = useRef(false);
  const applyTab = useCallback((tab: string) => {
    if (tab === "overview") setActiveTab("overview");
    else if (tab === "bookings") setActiveTab("bookings");
    else if (tab === "plan") setActiveTab("plan");
    else if (tab === "password") setActiveTab("password");
    else if (tab === "personal") setActiveTab("personal");
    else setActiveTab("overview");
  }, []);

  const selectTab = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);
      router.replace(`/account?tab=${tab}`, { scroll: false });
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    },
    [router],
  );

  /*
   * ?tab=bookings is kept for old links, emails and bookmarks, but it no longer
   * has anything of its own to show: visits moved to Book, and what was left
   * here was a page explaining where they went. Anyone arriving on it is sent
   * straight to the visit list instead of being asked to tap through a
   * signpost. replace(), not push(), so Back does not bounce them into it.
   */
  useEffect(() => {
    if (activeTab === "bookings") {
      router.replace("/book#your-visits");
    }
  }, [activeTab, router]);

  /*
   * Signed out: to sign-in, and BACK here afterwards. Without ?next= a
   * non-member who opened a link to their account (an email, a bookmark, the
   * tab bar after a session expired) signed in and was dropped somewhere else.
   * The tab they asked for comes along.
   */
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !loggingOut.current) {
      const back = `${window.location.pathname}${window.location.search}`;
      router.push(`/signin?next=${encodeURIComponent(back || "/account")}`);
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const landingPath = getRoleLandingPath(user);
    if (landingPath !== "/account") {
      router.replace(landingPath);
    }
  }, [isAuthenticated, isLoading, router, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyHash = () => {
      if (window.location.hash === "#my-bookings") selectTab("bookings");
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [selectTab]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      refreshUser().catch(() => {});
    }
  }, [isLoading, isAuthenticated, refreshUser]);

  const formData = useMemo<AccountFormData>(() => {
    if (!user) return initialAccountFormData;

    return {
      userId: user.userId || user.id || "",
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      zip: user.zip || "",
      county: user.county || "",
      addresses: user.addresses || [],
      defaultAddressId: user.defaultAddressId || null,
    };
  }, [user]);

  const handleLogout = () => {
    loggingOut.current = true;
    logout();
    router.replace("/signin");
  };

  if (isLoading) {
    return (
      <div className="acct flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-[color:var(--ui-ink)] border-t-transparent" />
          <p className="ui-small">Loading your account…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (user && getRoleLandingPath(user) !== "/account") return null;

  return (
    <>
      {/*
        The site header, not a header of its own. Account used to draw a
        second one (logo chip, nav, account menu), so the signed-in half of
        the site looked like a different product. The shell header already
        knows a signed-in customer and a member, and carries Log out.
      */}
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <Suspense fallback={null}>
        <TabSync onTab={applyTab} />
      </Suspense>

      <div className="acct">
        <main className="acct-main ui-container">
          {/*
            ONE WAY IN, ONE WAY BACK.

            The overview's Account list is the way into every sub-page, and
            this link is the way back - a control centre should not ask which
            of its menus you meant.
          */}
          {activeTab !== "overview" ? (
            <button type="button" onClick={() => selectTab("overview")} className="acct-back">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              My Account
            </button>
          ) : null}

          {TAB_TITLES[activeTab] ? <h1 className="acct-page-title">{TAB_TITLES[activeTab]}</h1> : null}
          {/* PlanSection draws its own visible "My plan" heading (it is shared with /membership). */}
          {activeTab === "plan" ? <h1 className="sr-only">Membership details</h1> : null}

          {activeTab === "overview" && (
            <AccountOverview formData={formData} onSwitchTab={selectTab} onLogout={handleLogout} />
          )}
          {activeTab === "personal" && (
            <div className="max-w-[760px]">
              <PersonalInfoForm formData={formData} />
            </div>
          )}
          {activeTab === "plan" && <PlanSection />}
          {/* The redirect above is already running; this is what shows for
              the instant before it lands. */}
          {activeTab === "bookings" && (
            <div id="my-bookings" className="acct-card">
              <p className="ui-small">Opening your visits...</p>
            </div>
          )}
          {activeTab === "password" && (
            <div className="max-w-[560px]">
              <PasswordForm />
            </div>
          )}
        </main>
      </div>

      <Footer compact />
    </>
  );
}
