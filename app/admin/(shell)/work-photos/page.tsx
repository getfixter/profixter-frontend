"use client";

import FixterWorkPhotos from "@/app/components/admin/FixterWorkPhotos";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="work-photos">
      <FixterWorkPhotos />
    </MountedSection>
  );
}
