"use client";

import { MyDayBoard } from "@/app/components/admin/sections/MyDayBoard";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/* My day stays mounted while /admin/my-day/[id] opens a job over it. */
export default function MyDayLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSection id="my-day">
      <MyDayBoard />
      {children}
    </RequireSection>
  );
}
