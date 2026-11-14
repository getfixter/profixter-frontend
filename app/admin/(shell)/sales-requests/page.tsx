"use client";

import { SalesRequests } from "@/app/components/admin/sales/Workspace";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function Page() {
  return (
    <RequireSection id="sales-requests">
      <SalesRequests />
    </RequireSection>
  );
}
