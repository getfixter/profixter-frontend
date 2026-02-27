"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ActiveTab, AccountFormData } from "../components/account/types";
import { initialAccountFormData } from "../data/account";

import { AccountHeader } from "../components/account/AccountHeader";
import { AccountSidebar } from "../components/account/AccountSidebar";
import { PersonalInfoForm } from "../components/account/PersonalInfoForm";
import { PlanSection } from "../components/account/PlanSection";
import { PasswordForm } from "../components/account/PasswordForm";
import BookingsSection from "../components/account/BookingsSection";

import { useAuth } from "@/lib/useAuth";

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("personal");
  const [formData, setFormData] = useState<AccountFormData>(initialAccountFormData);

  const router = useRouter();
const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();
const searchParams = useSearchParams();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
  const tab = searchParams.get("tab");
  if (!tab) return;

  if (tab === "bookings") setActiveTab("bookings");
  else if (tab === "plan") setActiveTab("plan");
  else if (tab === "password") setActiveTab("password");
  else if (tab === "personal") setActiveTab("personal");
}, [searchParams]);

  

  // Ensure we always have fresh user data (addresses/defaultAddressId)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      refreshUser().catch(() => {});
    }
  }, [isLoading, isAuthenticated, refreshUser]);

  // Load user data when authenticated
  useEffect(() => {
    if (!user) return;

    setFormData({
      userId: user.userId || user.id || "",
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",

      // Legacy address
      address: user.address || "",
      city: user.city || "",
      state: user.state || "",
      zip: user.zip || "",
      county: user.county || "",

      // New multi-address support
      addresses: user.addresses || [],

      // ✅ Needed for picking day / booking pages
      defaultAddressId: user.defaultAddressId || null,
    });
  }, [user]);

  const handleLogout = () => {
    logout();
    router.replace("/signin");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-[#313234] text-xl">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // will redirect
  }

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      <AccountHeader userName={formData.name} />

      <main className="max-w-[1240px] mx-auto px-[20px] py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <AccountSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            userName={formData.name}
            onLogout={handleLogout}
          />

          <div
            className="flex-1 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[11px] p-6 sm:p-8 lg:p-12"
            style={{ boxShadow: "0px 0px 200px 0px rgba(0, 0, 0, 0.1)" }}
          >
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
    </div>
  );
}
