import { absoluteUrl } from "@/lib/seo";

export type Crumb = { label: string; href: string };

/**
 * schema.org BreadcrumbList for a visible breadcrumb trail.
 *
 * Only ever emitted beside a breadcrumb the reader can actually see (the
 * Breadcrumbs component does both), so the markup describes the page rather
 * than decorating it. "Home" is always the first item.
 */
export function breadcrumbJsonLd(items: Crumb[]) {
  const trail = [{ label: "Home", href: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: absoluteUrl(item.href),
    })),
  };
}
