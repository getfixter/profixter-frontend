"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useStartScreenCovering } from "@/lib/start-screen";

/**
 * THE ONE PLACE THE LITTLE WORLD IS MOUNTED.
 *
 * It hangs off the root layout so there is exactly one Canvas for the whole
 * site and it survives navigation between the pages that want it, rather than
 * a fresh WebGL context and a fresh five-megabyte character on every route.
 *
 * Loaded lazily and never on the server. That matters more than it looks: the
 * import below is a declaration, not a fetch, so the three.js bundle and the
 * character are only requested once this component actually renders something.
 * A dashboard mounts this file, renders null, and pays nothing at all for it.
 */
const WorldScene = dynamic(() => import("@/app/components/lab/WorldScene"), {
  ssr: false,
});

/**
 * WHERE HE IS ALLOWED TO BE — an allow-list, deliberately.
 *
 * The obvious build is a deny-list of "/admin, /account, everything signed-in",
 * and it is the wrong way round: the failure mode of a missed deny rule is a
 * cartoon handyman walking across somebody's operational dashboard, and the
 * failure mode of a missed allow rule is a marketing page that is slightly less
 * fun. Those are not comparable, so a route has to be named here to get him.
 *
 * There is a second reason, and it is the stronger one. He is drawn BETWEEN a
 * page's background colours and its text, which only works on a page whose
 * bands paint their colour at z-0 and their content at z-20. On a page that has
 * not been split that way he would paint over the words. So this list is not
 * "pages we like" — it is "pages that have been built to hold him".
 */
const STAGES = new Set<string>(["/"]);

export default function FixterStage() {
  const pathname = usePathname();
  /*
   * The homepage now opens on a photographic start screen for logged-out
   * visitors, and he is not in it — that page is one image, one headline and
   * one button, and a second character would be a second thing to look at.
   *
   * The cost matters more than the composition, though. This component is a
   * declaration, not a fetch: returning null here means three.js and the
   * character are never requested, so the first screen a new customer sees is
   * not competing for bandwidth with a five megabyte model they cannot see. He
   * mounts as soon as they scroll into the homepage he was built for.
   */
  const startScreenCovering = useStartScreenCovering();
  if (!pathname || !STAGES.has(pathname)) return null;
  if (startScreenCovering) return null;
  return <WorldScene />;
}
