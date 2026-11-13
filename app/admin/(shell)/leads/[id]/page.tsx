"use client";

import { useParams } from "next/navigation";
import { LeadDetailSheet } from "@/app/components/admin/sections/LeadsBoard";

export default function LeadPage() {
  const params = useParams<{ id: string }>();
  return <LeadDetailSheet id={decodeURIComponent(String(params?.id || ""))} />;
}
