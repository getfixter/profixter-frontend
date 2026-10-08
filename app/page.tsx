import type { Metadata } from "next";
import HomePageClient from "@/app/components/home/HomePageClient";

/**
 * The homepage's own canonical.
 *
 * The root layout used to declare `canonical: "/"`, which every page without
 * metadata of its own inherited - so /gift, /signup and any page added later
 * quietly asked search engines to treat it as a copy of the homepage. The
 * layout no longer sets one; the homepage says it here, for itself only.
 *
 * The page body is unchanged and still a client component.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomePageClient />;
}
