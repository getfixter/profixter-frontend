"use client";

import { ReferralRewards } from "@/app/components/admin/referrals/ReferralRewards";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function Page() {
  return (
    <RequireSection id="referrals">
      <ReferralRewards />
    </RequireSection>
  );
}
