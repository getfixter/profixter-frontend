"use client";

import TipsModule from "@/app/components/admin/TipsModule";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="tips">
      <TipsModule />
    </MountedSection>
  );
}
