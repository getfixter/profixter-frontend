"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/auth-service";
import type { Navigation, SectionId } from "@/lib/admin/sections";
import type { NeedsActionCounts } from "@/lib/admin/needs-action";

export type AdminContextValue = {
  /** The signed-in person, as /api/auth/me returned it (permissions computed on the server). */
  user: User;
  nav: Navigation;
  /** canOpen(user, id) for this person. */
  canOpen: (id: SectionId) => boolean;
  /** Re-read /api/auth/me (after the owner changes someone's access, for example). */
  refreshUser: () => Promise<unknown>;
  badges: NeedsActionCounts | null;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

/** The admin shell's context. Every screen under app/admin/(shell) has it. */
export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside the admin shell");
  return value;
}
