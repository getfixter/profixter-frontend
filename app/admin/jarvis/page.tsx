"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";
import JarvisModule from "@/app/components/admin/JarvisModule";

export default function JarvisPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const isAdmin = isAdminUser(user);

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

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B14] text-white">
        <div className="text-lg font-bold">Opening Jarvis...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B14] text-white">
        <div className="text-lg font-bold">Access Denied</div>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/admin"
        className="fixed left-3 top-3 z-[80] inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-black text-white/85 shadow-[0_14px_40px_rgba(0,0,0,0.20)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.14] hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300/70 sm:left-5 sm:top-5"
      >
        ← Back to Admin
      </Link>
      <JarvisModule />
    </>
  );
}
