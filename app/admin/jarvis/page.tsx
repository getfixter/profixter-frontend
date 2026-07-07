"use client";

import { useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AdminHeader from "@/app/components/admin/AdminHeader";
import AdminTabs from "@/app/components/admin/AdminTabs";
import BottomNav from "@/app/components/admin/BottomNav";
import JarvisModule from "@/app/components/admin/JarvisModule";
import { tabsForUser } from "@/app/components/admin/admin-tabs-config";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function JarvisPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const isAdmin =
    user?.role === "admin" ||
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const allowedTabs = useMemo(() => tabsForUser("admin"), []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/signin");
      return;
    }

    if (!isAdmin) {
      router.push("/admin");
    }
  }, [authLoading, isAdmin, router, user]);

  const handleAdminTabChange = useCallback(
    (tab: string) => {
      if (tab === "jarvis") return;
      router.push(`/admin?tab=${encodeURIComponent(tab)}`);
    },
    [router]
  );

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Access Denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="px-3 py-3 md:px-8 md:py-4">
          <AdminTabs active="jarvis" onChange={handleAdminTabChange} tabs={allowedTabs} />
          <BottomNav active="jarvis" onChange={handleAdminTabChange} tabs={allowedTabs} />
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-3 pb-8 pt-3 md:px-8 md:py-6">
        <JarvisModule />
      </main>
    </div>
  );
}
