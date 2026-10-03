import { redirect } from "next/navigation";

/**
 * The event display moved to the public kiosk at /event (2026-10-02). There is
 * one display, so an admin sees exactly what visitors see; managing photos is
 * /admin/event-display/review, which stays admin-only.
 */
export default function EventDisplayPage() {
  redirect("/event");
}
