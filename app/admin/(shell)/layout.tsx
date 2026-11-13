import { Suspense } from "react";
import { AdminShell } from "@/app/components/admin/shell/AdminShell";
import { BrandedLoader } from "@/app/components/admin/shell/BrandedLoader";
import "../admin.css";

/*
 * Every admin section shares this shell (header, navigation, toasts,
 * permission context). /admin itself (the old-link redirect), /admin/lab and
 * /admin/event-display live outside the group and keep their own layouts.
 */
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<BrandedLoader />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
