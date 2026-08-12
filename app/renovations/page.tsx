import type { Metadata } from "next";
import {
  CardGrid,
  ConversionBand,
  HubHero,
  SeoPageShell,
} from "@/app/components/seo/SeoPageComponents";
import { renovationServices } from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Home Renovations on Long Island | Profixter",
  },
  description:
    "Roofing, siding, kitchens, bathrooms, full-home renovations, and new construction. Compare project paths and request a renovation estimate.",
  alternates: {
    canonical: "/renovations",
  },
  openGraph: {
    title: "Home Renovations on Long Island | Profixter",
    description:
      "Compare Long Island renovation paths for bathrooms, kitchens, roofing, siding, full-home renovation, and new construction.",
    url: absoluteUrl("/renovations"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Home Renovations on Long Island | Profixter",
    description:
      "Compare larger home project paths and request a renovation estimate from Profixter.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

const renovationsJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Profixter renovation and construction services",
  url: `${SITE_URL}/renovations`,
  itemListElement: renovationServices.map((service, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: service.title,
    url: `${SITE_URL}/renovations/${service.slug}`,
  })),
};

export default function RenovationsPage() {
  return (
    <SeoPageShell>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(renovationsJsonLd) }}
        />
        <HubHero
          eyebrow="Renovations"
          title="Larger home projects need a clearer first step."
          description="Explore Profixter renovation and construction paths for bathrooms, kitchens, roofing, siding, full-home renovation, and new home construction."
          primaryCta={{ label: "Request Renovation Estimate", href: "/projects#estimate" }}
          secondaryCta={{ label: "Become a Member", href: "/membership/plans" }}
          breadcrumb={{ label: "Renovations", href: "/renovations" }}
        />

        <CardGrid
          eyebrow="Renovation library"
          title="Plan the larger work separately from small handyman visits."
          description="These pages help homeowners understand which projects belong in the estimate path instead of the $99 One-Time Visit flow."
          items={renovationServices.map((service) => ({
            label: service.title,
            href: `/renovations/${service.slug}`,
            body: service.homeownerNeed,
          }))}
        />

        <ConversionBand
          title="Not sure if it is a small task or a renovation?"
          description="Use Profixter AI for a first-pass recommendation, Book Handyman for one small job, or request a renovation estimate for larger work."
        />
      </main>
    </SeoPageShell>
  );
}
