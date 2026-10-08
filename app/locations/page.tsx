import type { Metadata } from "next";
import Link from "next/link";
import { ConversionBand, HubHero, SeoPageShell } from "@/app/components/seo/SeoPageComponents";
import { serviceAreas } from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  COMPLETED_VISITS_ROUNDED,
  COUNTY_SPLIT,
  DATA_AS_OF,
  DATA_SINCE,
  HOUSEHOLDS_ROUNDED,
  TOWNS_SERVED,
  TOWNS_WITH_COMPLETED_WORK,
  TOWN_RECORDS,
} from "@/lib/profixter-data";

const TITLE = "Where Profixter Works: Handyman Service Across Nassau & Suffolk";
const DESCRIPTION = `Profixter has completed more than ${COMPLETED_VISITS_ROUNDED} handyman visits in ${TOWNS_SERVED} Long Island towns since ${DATA_SINCE}. Town pages, and every town in Nassau and Suffolk where we have done repeated work.`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Profixter` },
  description: DESCRIPTION,
  alternates: {
    canonical: "/locations",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/locations"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
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

/**
 * Where Profixter works, from the visit records rather than a wish list.
 *
 * The town pages are the places with enough real work to say something
 * specific; the county lists below them are every town with at least five
 * completed visits, so a homeowner in Commack or Wantagh can see their town is
 * served without a thin page being invented for it.
 */
export default function LocationsPage() {
  const counties: ("Suffolk County" | "Nassau County")[] = ["Suffolk County", "Nassau County"];
  return (
    <SeoPageShell>
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(locationsJsonLd) }} />
        <HubHero
          eyebrow="Locations"
          title="Handyman help across Nassau and Suffolk."
          description={`Based in Lindenhurst, Profixter has completed more than ${COMPLETED_VISITS_ROUNDED} visits for about ${HOUSEHOLDS_ROUNDED} households in ${TOWNS_SERVED} Long Island towns since ${DATA_SINCE}: about ${COUNTY_SPLIT.suffolkPercent}% in Suffolk and ${COUNTY_SPLIT.nassauPercent}% in Nassau.`}
          primaryCta={{ label: "Book a free first visit", href: "/book/free" }}
          secondaryCta={{ label: "Compare membership plans", href: "/membership/plans" }}
          breadcrumb={{ label: "Locations", href: "/locations" }}
        />

        {counties.map((county) => {
          const areas = serviceAreas.filter((area) => area.county === county);
          return (
            <section key={county} className="px-4 py-8 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-[1180px]">
                <h2 className="text-[26px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[32px]">
                  {county}
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {areas.map((area) => {
                    const record = TOWN_RECORDS[area.slug];
                    return (
                      <Link
                        key={area.slug}
                        href={`/locations/${area.slug}`}
                        className="rounded-[8px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#BFD2FF]"
                      >
                        <span className="block text-[19px] font-black text-[#0B1628]">{area.name}</span>
                        <span className="mt-1 block text-[13px] font-semibold text-[#64748B]">{area.municipality}</span>
                        {record ? (
                          <span className="mt-3 block text-[14px] text-[#334155]">
                            {record.visits}+ completed visits, {record.households} households
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
                <p className="mt-5 text-[14px] leading-6 text-[#64748B]">
                  <span className="font-bold text-[#0B1628]">Other {county} towns with repeated Profixter visits: </span>
                  {TOWNS_WITH_COMPLETED_WORK[county]
                    .filter((town) => !areas.some((area) => area.name === town))
                    .join(", ")}
                  .
                </p>
              </div>
            </section>
          );
        })}

        <section className="px-4 pb-4 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-[1180px] text-[12px] text-[#94A3B8]">
            Figures from Profixter&apos;s completed-visit records, {DATA_SINCE} to {DATA_AS_OF}. Town figures are shown
            only where at least three households are behind them.
          </p>
        </section>

        <ConversionBand />
      </main>
    </SeoPageShell>
  );
}
