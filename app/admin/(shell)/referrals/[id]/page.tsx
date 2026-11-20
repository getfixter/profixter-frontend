"use client";

import { useParams } from "next/navigation";
import { ReferralRewardDetail } from "@/app/components/admin/referrals/ReferralRewards";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <RequireSection id="referrals">
      <ReferralRewardDetail id={decodeURIComponent(String(params?.id || ""))} />
    </RequireSection>
  );
}
