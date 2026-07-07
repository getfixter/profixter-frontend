"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ActiveTab, AccountFormData } from "../components/account/types";
import { initialAccountFormData } from "../data/account";

import { AccountHeader } from "../components/account/AccountHeader";
import { AccountSidebar } from "../components/account/AccountSidebar";
import CustomerMobileNav from "../components/account/CustomerMobileNav";
import { PersonalInfoForm } from "../components/account/PersonalInfoForm";
import { PlanSection } from "../components/account/PlanSection";
import { PasswordForm } from "../components/account/PasswordForm";
import BookingsSection from "../components/account/BookingsSection";
import OverviewSection from "../components/account/OverviewSection";

import { useAuth } from "@/lib/useAuth";

function TabSync({ onTab }: { onTab: (tab: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) onTab(tab);
  }, [searchParams, onTab]);

  return null;
}

const MOBILE_TABS: { key: ActiveTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "bookings", label: "Visits" },
  { key: "plan", label: "My Plan" },
  { key: "personal", label: "Profile" },
  { key: "password", label: "Security" },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

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
    },
    [router],
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

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
    logout();
    router.replace("/signin");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF2FF]">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-[#306EEC] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6A6D71] text-[14px] font-medium">Loading your account…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div
      className={`min-h-screen bg-[#EEF2FF] ${
        isSubscribed ? "pb-[calc(86px+env(safe-area-inset-bottom,0px))] lg:pb-0" : ""
      }`}
    >
      <AccountHeader userName={formData.name} />

      <Suspense fallback={null}>
        <TabSync onTab={applyTab} />
      </Suspense>

      {/* Mobile horizontal tab bar */}
      <div className="lg:hidden bg-white border-b border-[#E0E6F5] overflow-x-auto scrollbar-none">
        <div className="flex min-w-max">
          {MOBILE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`px-5 py-3.5 text-[13px] font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === t.key
                  ? "border-[#306EEC] text-[#306EEC]"
                  : "border-transparent text-[#6A6D71] hover:text-[#313234]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1240px] mx-auto px-4 sm:px-5 py-5 sm:py-8 lg:py-10">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6">

          <AccountSidebar
            activeTab={activeTab}
            setActiveTab={selectTab}
            userName={formData.name}
            userEmail={formData.email}
            onLogout={handleLogout}
          />

          <div className="flex-1 min-w-0">
            {activeTab === "overview" && (
              <OverviewSection
                formData={formData}
                onSwitchTab={selectTab}
              />
            )}
            {activeTab === "personal" && <PersonalInfoForm formData={formData} />}
            {activeTab === "plan" && <PlanSection />}
            {activeTab === "bookings" && (
              <div id="my-bookings">
                <BookingsSection />
              </div>
            )}
            {activeTab === "password" && <PasswordForm />}
          </div>

        </div>
      </main>

      {isSubscribed && <CustomerMobileNav />}
    </div>
  );
}
