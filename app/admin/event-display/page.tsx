import type { Metadata } from "next";
import EventDisplay from "./EventDisplay";

/**
 * The booth display: real customer photos of real things to fix, on a tablet.
 *
 * Admin only. The page guards itself on the client like the Lab does, and the
 * only data it can get comes from /api/admin/event-display, which refuses
 * anyone who is not an admin and returns photo URLs only: every eligible
 * booking photo that an admin has not hidden.
 */
export const metadata: Metadata = {
  title: "Event Display",
  robots: { index: false, follow: false },
};

export default function EventDisplayPage() {
  return <EventDisplay />;
}
