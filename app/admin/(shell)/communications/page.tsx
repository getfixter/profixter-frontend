"use client";

import CommunicationsModule from "@/app/components/admin/CommunicationsModule";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="communications">
      <CommunicationsModule />
    </MountedSection>
  );
}
