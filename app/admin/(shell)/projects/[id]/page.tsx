"use client";

import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/app/components/admin/ui";
import { ProjectDetail } from "@/app/components/admin/projects/ProjectDetail";

/* /admin/projects/:id (email links land here); the tab is ?tab=, an invoice ?invoice= or ?invoiceId=. */
export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id || ""));
  return (
    <ErrorBoundary label="Project" resetKey={id}>
      <ProjectDetail key={id} id={id} />
    </ErrorBoundary>
  );
}
