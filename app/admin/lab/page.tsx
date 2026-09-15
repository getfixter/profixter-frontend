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

/**
 * Rendered fresh on every request, and never stored.
 *
 * This route was statically prerendered, which meant a phone could hold on to
 * an old shell and show a version of the Lab that no longer existed — and there
 * was no way to tell that from the Lab being broken, because the served HTML
 * is nothing but a "Loading..." placeholder either way. Nobody should have to
 * clear a cache to see whether a fix landed.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Bumped on every deploy of this route. Rendered on the server, in the HTML. */
export const LAB_BUILD = "diag-5";

export default function FixterLabPage() {
  return (
    <>
      {/*
        Server-rendered, plain HTML, before any client code runs.

        This is the one thing on the page that cannot fail. If it is on screen,
        the route is the Lab and the HTML is current; if it is not, nothing
        below it is worth looking at and the problem is upstream of the
        experiment entirely. Everything else here renders on the client, which
        is exactly why the previous markers were invisible when it mattered.
      */}
      <div
        id="lab-build-marker"
        style={{
          position: "relative",
          zIndex: 100,
          background: "#0B1628",
          borderBottom: "4px solid #FFB300",
          color: "#ffffff",
          padding: "14px 16px",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "15px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        <span style={{ color: "#FFB300" }}>3D FIXTER LAB</span>
        {" — BUILD "}
        <span style={{ color: "#FFB300" }}>{LAB_BUILD}</span>
      </div>

      <LabClient />
    </>
  );
}
