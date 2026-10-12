"use client";

import dynamic from "next/dynamic";

/** The Studio runs in the browser only (WebGL, canvas, the photo never leaves except to our API). */
const StudioApp = dynamic(() => import("./StudioApp"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-[#475569]">Loading the Shower Studio…</div>
  ),
});

export default function StudioLoader() {
  return <StudioApp />;
}
