"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";

function RegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/signup");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-6 text-[#0B1628]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#306EEC] border-t-transparent" />
        <p className="text-sm font-semibold text-[#526078]">Opening sign up...</p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <RoleEntryGate loadingLabel="Checking your session..." redirectLabel="Opening Your Home...">
      <RegisterRedirect />
    </RoleEntryGate>
  );
}
