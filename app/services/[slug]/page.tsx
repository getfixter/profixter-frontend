import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "@/app/components/seo/SeoPageComponents";
import {
  getHandymanService,
  getServiceArea,
  handymanServices,
} from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

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
          price: "99.00",
          priceCurrency: "USD",
          url: `${SITE_URL}/book`,
        },
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
      <DetailPage content={service} type="service" relatedLinks={relatedLinks} />
    </>
  );
}
