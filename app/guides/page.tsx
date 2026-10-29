import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, ConversionBand, SeoPageShell } from "@/app/components/seo/SeoPageComponents";
import { GUIDES, GUIDE_CATEGORY_LABELS } from "@/lib/guides";
import type { Guide } from "@/lib/guides/types";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

const TITLE = "Homeowner Guides: Small Repairs & Handyman Costs | Profixter";
const DESCRIPTION =
  "Straight answers for Long Island homeowners: getting small jobs done, handyman minimum charges and costs, honey-do lists, home maintenance by season, and when a handyman membership does and doesn't make sense.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/guides"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const ORDER: Guide["category"][] = ["small-jobs", "cost", "membership", "homeownership", "maintenance"];

/**
 * The guides hub.
 *
 * Grouped by the problem a homeowner has, not by our products. The point of the
 * library is to be useful to somebody who has never heard of a handyman
 * membership; the membership comes up inside the answers, where it fits.
 */
export default function GuidesHubPage() {
  const groups = ORDER.map((category) => ({
    category,
    guides: GUIDES.filter((guide) => guide.category === category),
  })).filter((group) => group.guides.length);

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Profixter homeowner guides",
    url: absoluteUrl("/guides"),
    publisher: { "@id": `${SITE_URL}/#business` },
    hasPart: GUIDES.map((guide) => ({
      "@type": "Article",
      headline: guide.title,
      url: absoluteUrl(`/guides/${guide.slug}`),
    })),
  };

  return (
    <SeoPageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />
      <main>
        <section className="px-4 pb-6 pt-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Breadcrumbs items={[{ label: "Guides", href: "/guides" }]} />
            <div className="max-w-[820px]">
              <p className="ui-eyebrow ui-eyebrow--accent !mb-0">Homeowner guides · Long Island</p>
              <h1 className="ui-display mt-4">
                Straight answers about small repairs and keeping a house up.
              </h1>
              <p className="mt-5 max-w-[680px] text-[15px] font-medium leading-7 text-[color:var(--ui-text-2)] sm:text-[18px] sm:leading-8">
                Written by a Long Island handyman company from what we see in homes every week. Each guide answers the
                question first, including when the answer isn&apos;t us.
              </p>
            </div>
          </div>
        </section>

        {groups.map((group) => (
          <section key={group.category} className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1180px]">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ui-ink)]">
                {GUIDE_CATEGORY_LABELS[group.category]}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.guides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    className="group rounded-[8px] border border-[color:var(--ui-line)] bg-white p-5 shadow-[var(--ui-shadow-1)] transition hover:-translate-y-0.5 hover:border-[#BFD2FF]"
                  >
                    <h3 className="text-[18px] font-semibold leading-snug text-[color:var(--ui-ink)]">{guide.title}</h3>
                    <p className="mt-2.5 text-[14px] leading-6 text-[color:var(--ui-text-3)]">{guide.summary}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}

        <ConversionBand />
      </main>
    </SeoPageShell>
  );
}
