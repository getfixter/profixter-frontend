import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationDetailPage } from "@/app/components/seo/SeoPageComponents";
import {
  getServiceArea,
  handymanServices,
  renovationServices,
  serviceAreas,
} from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return serviceAreas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) return {};

  return {
    title: area.metaTitle,
    description: area.metaDescription,
    alternates: {
      canonical: `/locations/${area.slug}`,
    },
    openGraph: {
      title: area.metaTitle,
      description: area.metaDescription,
      url: absoluteUrl(`/locations/${area.slug}`),
      siteName: SITE_NAME,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: area.metaTitle,
      description: area.metaDescription,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function LocationPage({ params }: PageProps) {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) notFound();

  const relatedLinks = [
    ...handymanServices.slice(0, 3).map((service) => ({
      label: service.title,
      href: `/services/${service.slug}`,
      body: service.homeownerNeed,
    })),
    ...renovationServices.slice(0, 3).map((service) => ({
      label: service.title,
      href: `/renovations/${service.slug}`,
      body: service.homeownerNeed,
    })),
  ];

  const locationJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: area.metaTitle,
    description: area.metaDescription,
    url: `${SITE_URL}/locations/${area.slug}`,
    about: {
      "@type": "Place",
      name: `${area.name}, NY`,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: `${area.county}, NY`,
      },
    },
    provider: {
      "@id": `${SITE_URL}/#business`,
      name: "Profixter",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(locationJsonLd) }}
      />
      <LocationDetailPage area={area} relatedLinks={relatedLinks} />
    </>
  );
}
