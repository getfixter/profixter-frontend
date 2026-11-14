"use client";

import { SalesDesk } from "@/app/components/admin/sales/desk/SalesDesk";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function Page() {
  return (
    <RequireSection id="sales-desk">
      <SalesDesk />
    </RequireSection>
  );
}
