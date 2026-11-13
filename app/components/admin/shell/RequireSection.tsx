"use client";

import type { ReactNode } from "react";
import { SECTIONS, type SectionId } from "@/lib/admin/sections";
import { PermissionState } from "@/app/components/admin/ui";
import { useAdmin } from "./AdminContext";

/**
 * Renders a section only for people who may open it; everyone else sees why
 * not. The server refuses the section's APIs either way.
 */
export function RequireSection({ id, children, allowed }: { id: SectionId; children: ReactNode; allowed?: boolean }) {
  const { canOpen } = useAdmin();
  if (allowed === false || !canOpen(id)) return <PermissionState section={SECTIONS[id].label} />;
  return <>{children}</>;
}
