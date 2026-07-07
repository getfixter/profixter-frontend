"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import JarvisModule from "@/app/components/admin/JarvisModule";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function JarvisPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const isAdmin =
    user?.role === "admin" ||
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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
    <JarvisModule />
  );
}
