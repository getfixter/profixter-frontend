"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAutomaticEntryPath } from "@/lib/auth-routing";
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
  const automaticTarget = isAuthenticated && user ? getAutomaticEntryPath(user) : null;
  const targetPathname = automaticTarget?.split("?")[0] || null;
  const target = targetPathname && targetPathname !== pathname ? automaticTarget : null;

  useEffect(() => {
    if (!isLoading && target) {
      router.replace(target);
    }
  }, [isLoading, router, target]);

  if (isLoading) return <EntryLoading label={loadingLabel} />;
  if (target) return <EntryLoading label={redirectLabel} />;

  return <>{children}</>;
}
