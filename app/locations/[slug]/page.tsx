import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationDetailPage } from "@/app/components/seo/SeoPageComponents";
import { getServiceArea, handymanServices, serviceAreas } from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";
import { plans } from "@/app/data/content";
import { getGoogleRating, getOneTimeOffer } from "@/lib/offers";
import { DATA_AS_OF, TASK_MIX, TOWN_RECORDS } from "@/lib/profixter-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;
/* The Google rating and the One-Time price are read live, hourly. */
export const revalidate = 3600;

export function generateStaticParams() {
  return serviceAreas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const area = getServiceArea(slug);
  if (!area) return {};

  return {
    title: {
      absolute: area.metaTitle,
    },
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

  const [rating, oneTime] = await Promise.all([getGoogleRating(), getOneTimeOffer()]);
  const record = TOWN_RECORDS[area.slug] || null;

  /*
   * Handyman jobs only. Renovation pages used to fill half of this grid, which
   * made every town page look like a contractor directory rather than a
   * handyman page for that town.
   */
  const relatedLinks = handymanServices.map((service) => ({
    label: service.title,
    href: `/services/${service.slug}`,
    body: service.homeownerNeed,
  }));

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(locationJsonLd) }} />
      <LocationDetailPage
        area={area}
        relatedLinks={relatedLinks}
        record={record}
        rating={rating}
        oneTimePrice={oneTime.priceDollars}
        lowestPlanPrice={Math.min(...plans.map((plan) => plan.price))}
        taskMix={TASK_MIX}
        dataAsOf={DATA_AS_OF}
      />
    </>
  );
}
