"use client";

import { usePathname } from "next/navigation";
import { ScheduleBoard } from "@/app/components/admin/sections/ScheduleBoard";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/*
 * Schedule: the day/week board stays mounted while /admin/schedule/jobs/[id]
 * opens a job over it. Availability (/admin/schedule/availability) is its own
 * page and does not show the board.
 */
export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/admin/schedule/availability")) return <>{children}</>;
  return (
    <RequireSection id="schedule">
      <ScheduleBoard />
      {children}
    </RequireSection>
  );
}
