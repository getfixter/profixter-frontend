import type { Metadata } from "next";
import {
  CardGrid,
  ConversionBand,
  HubHero,
  SeoPageShell,
} from "@/app/components/seo/SeoPageComponents";
import { serviceAreas } from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Profixter Service Areas | Long Island Home Help",
  },
  description:
    "See where Profixter helps homeowners across Long Island with Membership, $99 handyman visits, and renovation estimate paths.",
  alternates: {
    canonical: "/locations",
  },
  openGraph: {
    title: "Profixter Service Areas | Long Island Home Help",
    description:
      "Membership, $99 handyman visits, and renovation estimate paths for Long Island homeowners.",
    url: absoluteUrl("/locations"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Service Areas | Long Island Home Help",
    description:
      "Explore Profixter service areas for Long Island homeowners.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

const locationsJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Profixter service areas",
  url: `${SITE_URL}/locations`,
  itemListElement: serviceAreas.map((area, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: `${area.name}, NY`,
    url: `${SITE_URL}/locations/${area.slug}`,
  })),
};

export default function LocationsPage() {
  return (
    <SeoPageShell>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(locationsJsonLd) }}
        />
        <HubHero
          eyebrow="Locations"
          title="Long Island home help, organized by town."
          description="Explore Profixter service area pages for nearby Long Island communities. Each page points homeowners to Membership, One-Time Handyman Visits, and Renovation Estimates."
          primaryCta={{ label: "Become a Member", href: "/membership/plans" }}
          secondaryCta={{ label: "Book One-Time Visit", href: "/book" }}
          breadcrumb={{ label: "Locations", href: "/locations" }}
        />

        <CardGrid
          eyebrow="Service areas"
          title="Starter location pages for local SEO."
          description="This foundation can later support service plus town pages, neighborhood guides, case studies, and seasonal maintenance content."
          items={serviceAreas.map((area) => ({
            label: area.name,
            href: `/locations/${area.slug}`,
            body: area.intro,
          }))}
        />

        <ConversionBand />
      </main>
    </SeoPageShell>
  );
}
