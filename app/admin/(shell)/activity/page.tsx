"use client";

import AdminActivityLog from "@/app/components/admin/AdminActivityLog";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="activity">
      <AdminActivityLog />
    </MountedSection>
  );
}
