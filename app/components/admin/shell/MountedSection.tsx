"use client";

import type { ReactNode } from "react";
import { SECTIONS, type SectionId } from "@/lib/admin/sections";
import { ErrorBoundary, PageHeader } from "@/app/components/admin/ui";
import { RequireSection } from "./RequireSection";

/**
 * An existing section component, mounted whole in the new shell with a
 * kit page header and its own error boundary, until its own redesign.
 */
export function MountedSection({ id, children, actions, description, allowed }: { id: SectionId; children: ReactNode; actions?: ReactNode; description?: ReactNode; allowed?: boolean }) {
  const section = SECTIONS[id];
  return (
    <RequireSection id={id} allowed={allowed}>
      <div data-section={id}>
        <PageHeader title={section.label} description={description ?? section.description} actions={actions} />
        <ErrorBoundary label={section.label}>{children}</ErrorBoundary>
      </div>
    </RequireSection>
  );
}
