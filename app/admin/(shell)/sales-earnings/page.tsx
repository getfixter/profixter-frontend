"use client";

import { SalesEarnings } from "@/app/components/admin/sales/Workspace";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function Page() {
  return (
    <RequireSection id="sales-earnings">
      <SalesEarnings />
    </RequireSection>
  );
}
