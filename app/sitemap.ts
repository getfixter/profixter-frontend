import type { MetadataRoute } from "next";
import { absoluteUrl, PUBLIC_SITEMAP_ROUTES } from "@/lib/seo";
import { getRecentWorkPhotos } from "@/lib/offers";

/*
 * lastModified is each page's real content date (see PUBLIC_SITEMAP_ROUTES),
 * not the time of the request. A lastmod that always says "now" teaches search
 * engines to ignore it.
 *
 * /recent-work also lists its captioned photographs as sitemap images, so image
 * search can find real job photos even though the gallery renders in the
 * browser. The photo list is read live (hourly); if the feed is unavailable the
 * sitemap is simply published without images.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const photos = await getRecentWorkPhotos(undefined, 48);
  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(`${route.updated}T00:00:00Z`),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    ...(route.path === "/recent-work" && photos.length ? { images: photos.map((photo) => photo.imageUrl) } : {}),
  }));
}
