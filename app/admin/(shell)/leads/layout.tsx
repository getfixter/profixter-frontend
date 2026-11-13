"use client";

import { LeadsBoard } from "@/app/components/admin/sections/LeadsBoard";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSection id="leads">
      <LeadsBoard />
      {children}
    </RequireSection>
  );
}
