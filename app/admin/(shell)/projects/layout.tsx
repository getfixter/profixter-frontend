"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import ProjectsModule from "@/app/components/admin/ProjectsModule";
import { takeQuery } from "@/lib/admin/handoff";
import { ErrorBoundary } from "@/app/components/admin/ui";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/*
 * Projects, as they work today (the project documents: agreements, change
 * orders, invoices, estimates), with a URL per project. Restyled by the
 * Projects track later.
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const id = params?.id ? decodeURIComponent(String(params.id)) : undefined;
  const [initialQuery] = useState(() => (typeof window === "undefined" ? "" : takeQuery("projects")));
  return (
    <RequireSection id="projects">
      <ErrorBoundary label="Projects">
        <ProjectsModule
          projectId={id}
          initialCustomerQuery={initialQuery}
          onOpenProject={(projectId) => router.push(`/admin/projects/${encodeURIComponent(projectId)}`, { scroll: false })}
          onCloseProject={() => router.push("/admin/projects", { scroll: false })}
        />
      </ErrorBoundary>
      {children}
    </RequireSection>
  );
}
