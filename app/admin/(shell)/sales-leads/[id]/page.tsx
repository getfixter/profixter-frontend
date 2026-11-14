"use client";

import { useParams } from "next/navigation";
import { SalesLeadSheet } from "@/app/components/admin/sales/LeadDetail";

export default function SalesLeadPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id || ""));
  return <SalesLeadSheet key={id} id={id} />;
}
