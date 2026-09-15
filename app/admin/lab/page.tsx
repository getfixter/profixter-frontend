import type { Metadata } from "next";
import LabClient from "./LabClient";

/**
 * Fixter Lab — an experimental, Admin-only 3D testing surface.
 *
 * The parent admin layout already carries robots noindex; it is restated here
 * because this page is the one route in the app nobody should ever find by
 * accident, and an inherited setting is easy to lose in a later refactor.
 */
export const metadata: Metadata = {
  title: "Fixter Lab",
  robots: { index: false, follow: false },
};

export default function FixterLabPage() {
  return <LabClient />;
}
