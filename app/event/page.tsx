import type { Metadata, Viewport } from "next";
import EventKiosk from "./EventKiosk";

/**
 * The public event kiosk: real Profixter booking photos on an iPad at a booth,
 * and one way in, "Get My First Visit Free".
 *
 * Public on purpose, and kept out of search: it is a booth screen, not a page
 * of the website. Photo management is /admin/event-display/review.
 */
export const metadata: Metadata = {
  title: "Real homes. Real things to fix.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#030406",
};

export default function EventPage() {
  return <EventKiosk />;
}
