"use client";

import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/app/components/admin/ui";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";
import { ProjectsBoard } from "@/app/components/admin/projects/ProjectsBoard";

/*
 * Projects. The list stays mounted (hidden) while /admin/projects/[id] shows
 * a project, so its search, stage filter and loaded pages survive Back.
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const open = Boolean(params?.id);
  return (
    <RequireSection id="projects">
      <ErrorBoundary label="Projects">
        <ProjectsBoard hidden={open} />
        {children}
      </ErrorBoundary>
    </RequireSection>
  );
}
