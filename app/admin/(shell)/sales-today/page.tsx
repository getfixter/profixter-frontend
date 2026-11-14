"use client";

import { SalesToday } from "@/app/components/admin/sales/Workspace";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function Page() {
  return (
    <RequireSection id="sales-today">
      <SalesToday />
    </RequireSection>
  );
}
