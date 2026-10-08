import type { MetadataRoute } from "next";
import { absoluteUrl, PUBLIC_SITEMAP_ROUTES } from "@/lib/seo";

/*
 * lastModified is each page's real content date (see PUBLIC_SITEMAP_ROUTES),
 * not the time of the request. A lastmod that always says "now" teaches search
 * engines to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(`${route.updated}T00:00:00Z`),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
