import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "@/app/components/seo/SeoPageComponents";
import {
  getRenovationService,
  getServiceArea,
  renovationServices,
} from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return renovationServices.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getRenovationService(slug);
  if (!service) return {};

  return {
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: {
      canonical: `/renovations/${service.slug}`,
    },
    openGraph: {
      title: service.metaTitle,
      description: service.metaDescription,
      url: absoluteUrl(`/renovations/${service.slug}`),
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

export default async function RenovationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const service = getRenovationService(slug);
  if (!service) notFound();

  const relatedLinks = [
    ...(service.relatedRenovationSlugs || []).flatMap((relatedSlug) => {
      const related = getRenovationService(relatedSlug);
      return related
        ? [
            {
              label: related.title,
              href: `/renovations/${related.slug}`,
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

  const renovationJsonLd = {
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
        url: `${SITE_URL}/renovations/${service.slug}`,
        serviceType: "Renovation and construction",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(renovationJsonLd) }}
      />
      <DetailPage content={service} type="renovation" relatedLinks={relatedLinks} />
    </>
  );
}
