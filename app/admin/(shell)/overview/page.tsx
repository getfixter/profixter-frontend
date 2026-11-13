"use client";

import OverviewModule from "@/app/components/admin/overview/OverviewModule";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="overview">
      <OverviewModule />
    </MountedSection>
  );
}
