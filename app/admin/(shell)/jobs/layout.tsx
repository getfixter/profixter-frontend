"use client";

import { JobsBoard } from "@/app/components/admin/sections/JobsBoard";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/* The list stays mounted while /admin/jobs/[id] opens over it, so its scroll and filters survive. */
export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSection id="jobs">
      <JobsBoard />
      {children}
    </RequireSection>
  );
}
