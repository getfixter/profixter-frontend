"use client";

import AdminCalendarSettings from "@/app/components/admin/AdminCalendarSettings";
import { isAdminUser } from "@/lib/auth-routing";
import { canOpenAvailability } from "@/lib/admin/sections";
import { ErrorBoundary, PageHeader, PermissionState, Tabs } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/* Schedule › Availability: the existing capacity settings, unchanged in behaviour (K.3). */
export default function Page() {
  const { user } = useAdmin();
  return (
    <RequireSection id="schedule">
      <PageHeader title="Availability" description="Working days, hours and capacity" />
      <Tabs
        label="Schedule"
        value="availability"
        className="mb-4"
        items={[
          { id: "calendar", label: "Calendar", href: "/admin/schedule" },
          { id: "availability", label: "Availability", href: "/admin/schedule/availability" },
        ]}
      />
      {canOpenAvailability(user) ? (
        <ErrorBoundary label="Availability">
          <AdminCalendarSettings isAdmin={isAdminUser(user)} />
        </ErrorBoundary>
      ) : (
        <PermissionState section="Availability" />
      )}
    </RequireSection>
  );
}
