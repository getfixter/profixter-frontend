"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { surfaceFor } from "@/lib/surface";

/**
 * Keeps <html data-surface> right across client-side navigation. The first
 * value is set before paint by SURFACE_SCRIPT (lib/surface.ts) in <head>.
 */
export default function SurfaceMarker() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    document.documentElement.dataset.surface = surfaceFor(pathname);
  }, [pathname]);
  return null;
}
