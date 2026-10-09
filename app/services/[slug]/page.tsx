import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "@/app/components/seo/SeoPageComponents";
import {
  getHandymanService,
  getServiceArea,
  handymanServices,
} from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getOneTimeOffer, getRecentWorkPhotos, type RecentWorkPhoto } from "@/lib/offers";

/* Photos and the One-Time price are read live, hourly. */
export const revalidate = 3600;

/*
 * Which Recent Work photos belong on which service page. Most service slugs are
 * also gallery categories; plumbing photos are filed under general handyman
 * work, so the plumbing pages pick them out by what the caption describes.
 */
async function photosFor(slug: string): Promise<RecentWorkPhoto[]> {
  const plumbing = /sink|faucet|vanity|toilet|drain|disposal/i;
  if (slug === "handyman-plumbing" || slug === "faucet-replacement") {
    return (await getRecentWorkPhotos("general-handyman")).filter((p) => plumbing.test(`${p.title} ${p.caption}`));
  }
  if (slug === "ceiling-fan-installation") return [];
  return getRecentWorkPhotos(slug);
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return handymanServices.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getHandymanService(slug);
  if (!service) return {};

  return {
    title: {
      absolute: service.metaTitle,
    },
    description: service.metaDescription,
    alternates: {
      canonical: `/services/${service.slug}`,
    },
    openGraph: {
      title: service.metaTitle,
      description: service.metaDescription,
      url: absoluteUrl(`/services/${service.slug}`),
      siteName: SITE_NAME,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: service.metaTitle,
      description: service.metaDescription,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const service = getHandymanService(slug);
  if (!service) notFound();

  const [photos, oneTime] = await Promise.all([photosFor(slug), getOneTimeOffer()]);

  const relatedLinks = [
    ...(service.relatedServiceSlugs || []).flatMap((relatedSlug) => {
      const related = getHandymanService(relatedSlug);
      return related
        ? [
            {
              label: related.title,
              href: `/services/${related.slug}`,
              body: related.homeownerNeed,
            },
          ]
        : [];
    }),
    /*
     * The two questions people with one small job ask next: is it worth a
     * visit on its own, and what should it cost.
     */
    {
      label: "Getting small jobs done",
      href: "/guides/handyman-for-small-jobs",
      body: "Bundle it, book one visit, or set up ongoing help: which fits when the jobs keep coming.",
    },
    {
      label: "What a handyman costs on Long Island",
      href: "/guides/handyman-cost-long-island",
      body: "Hourly rates, minimum charges and typical prices for common jobs.",
    },
    ...(service.relatedLocationSlugs || []).flatMap((areaSlug) => {
      const area = getServiceArea(areaSlug);
      return area
        ? [
            {
              label: area.name,
              href: `/locations/${area.slug}`,
              body: area.intro,
            },
          ]
        : [];
    }),
  ];

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: service.title,
        description: service.metaDescription,
        provider: {
          "@id": `${SITE_URL}/#business`,
          name: "Profixter",
        },
        areaServed: {
          "@type": "Place",
          name: "Long Island, NY",
        },
        url: `${SITE_URL}/services/${service.slug}`,
        serviceType: "Handyman service",
        offers: {
          "@type": "Offer",
          name: "One-Time Handyman Visit",
          price: oneTime.priceDollars.toFixed(2),
          priceCurrency: "USD",
          url: `${SITE_URL}/book?visit=additional`,
        },
        ...(photos.length ? { image: photos.slice(0, 8).map((photo) => photo.imageUrl) } : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: service.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <DetailPage content={service} type="service" relatedLinks={relatedLinks} photos={photos} />
    </>
  );
}
