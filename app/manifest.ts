import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Profixter",
    short_name: "Profixter",
    description:
      "Home maintenance Membership, $99 handyman visits, and renovation estimates for Long Island homeowners.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B1628",
    theme_color: "#0B1628",
    icons: [
      {
        src: "/manifest-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/manifest-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
