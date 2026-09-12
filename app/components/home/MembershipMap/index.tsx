"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/**
 * The membership map, kept out of the homepage bundle until it is wanted.
 *
 * The section carries about 40KB of coastline path data. That is cheap for what
 * it draws, but it is still 40KB of a marketing page that most visitors leave
 * before reaching, and it has no business sitting in the same chunk as the hero.
 *
 * So the real component is imported only once a sentinel scrolls near the
 * viewport. Until then this renders a single empty div: no geometry, no fetch,
 * no gradients, nothing on the critical path. `ssr: false` because the map has
 * nothing to say server-side - it has no data until it asks for some.
 *
 * The sentinel reserves no height on purpose. The section removes itself
 * entirely when there is nothing to show, so reserving space for it would leave
 * a hole on the page in exactly the case where it renders nothing.
 */

const MembershipMapSection = dynamic(() => import("./MembershipMapSection"), {
  ssr: false,
});

export default function MembershipMap({ className = "" }: { className?: string }) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  /*
   * Always false to begin with, on both sides of the render.
   *
   * Seeding this from `typeof IntersectionObserver === "undefined"` looks
   * tempting and is a hydration bug: the check is true on the server and false
   * in the browser, so the server sends the full section and the client expects
   * a sentinel. React reports that as error #418 and throws the markup away.
   * The environment is only allowed to influence this after mounting.
   */
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      /*
       * Deferred by a tick rather than set inline: an effect that calls
       * setState synchronously triggers a cascading render, and there is
       * nothing here worth doing before paint.
       */
      const timer = setTimeout(() => setLoad(true), 0);
      return () => clearTimeout(timer);
    }
    const node = sentinel.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoad(true);
          observer.disconnect();
        }
      },
      /* Far enough ahead that the chunk and the fetch land before it is seen. */
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (load) return <MembershipMapSection className={className} />;
  /*
   * One pixel tall rather than zero. A box with no height is a legitimate
   * observer target in principle, but giving it a real rect removes any doubt
   * about whether it can ever report as intersecting.
   */
  return <div ref={sentinel} aria-hidden="true" style={{ minHeight: 1 }} />;
}
