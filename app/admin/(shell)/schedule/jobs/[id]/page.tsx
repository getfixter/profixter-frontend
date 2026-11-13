"use client";

import { useParams } from "next/navigation";
import { JobDetailSheet } from "@/app/components/admin/sections/JobDetailSheet";

export default function ScheduleJobPage() {
  const params = useParams<{ id: string }>();
  return <JobDetailSheet id={decodeURIComponent(String(params?.id || ""))} backHref="/admin/schedule" />;
}
