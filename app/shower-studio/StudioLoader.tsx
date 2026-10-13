"use client";

import dynamic from "next/dynamic";

/** The Studio runs in the browser only (WebGL, canvas, the photo never leaves except to our API). */
const StudioApp = dynamic(() => import("./StudioApp"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[100dvh] place-items-center bg-[#F3F0EB] text-[15px] text-[#5F5A52]">Loading the Shower Studio…</div>
  ),
});

/** `preview`: the owner's live preview (demo catalog, nothing saved or sent). */
export default function StudioLoader({ preview = false }: { preview?: boolean }) {
  return <StudioApp preview={preview} />;
}
