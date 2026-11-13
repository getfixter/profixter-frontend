"use client";

import FixtersModule from "@/app/components/admin/FixtersModule";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="team">
      <FixtersModule />
    </MountedSection>
  );
}
