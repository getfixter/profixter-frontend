"use client";

import PromotionPopupEditor from "@/app/components/admin/PromotionPopupEditor";
import { MountedSection } from "@/app/components/admin/shell/MountedSection";

export default function Page() {
  return (
    <MountedSection id="promotion">
      <PromotionPopupEditor />
    </MountedSection>
  );
}
