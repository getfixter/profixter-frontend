import type { MetadataRoute } from "next";

const siteUrl = "https://www.profixter.com";

const routes = [
  "",
  "/about",
  "/home-support",
  "/book",
  "/membership",
  "/projects",
  "/bathroom",
  "/signin",
  "/signup",
  "/privacy",
  "/terms",
  "/communication-consent",
  "/review",
  "/tip",
  "/careers",
  "/partnerships",
  "/communities",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency:
      route === "" || route === "/home-support" || route === "/book"
        ? "weekly"
        : "monthly",
    priority:
      route === ""
        ? 1
        : ["/home-support", "/book", "/membership", "/projects"].includes(route)
          ? 0.9
          : route === "/about"
            ? 0.8
          : 0.5,
  }));
}
