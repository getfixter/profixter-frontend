"use client";

import { SalesLeads } from "@/app/components/admin/sales/Workspace";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/* The list stays mounted while /admin/sales-leads/[id] opens a lead over it. */
export default function SalesLeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSection id="sales-leads">
      <SalesLeads />
      {children}
    </RequireSection>
  );
}
