import type { Metadata } from "next";
import Link from "next/link";
import {
  CardGrid,
  ConversionBand,
  HubHero,
  SeoPageShell,
} from "@/app/components/seo/SeoPageComponents";
import { FREE_VISIT_CTA, handymanServices, membershipBenefits } from "@/lib/seo-content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Handyman Services on Long Island | Profixter",
  },
  description:
    "Explore small handyman tasks that fit a Profixter visit, from TV mounting to drywall repair, and see when Membership is the smarter choice.",
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title: "Handyman Services on Long Island | Profixter",
    description:
      "Small handyman services, $99 One-Time Visits, and Membership paths for Long Island homeowners.",
    url: absoluteUrl("/services"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Handyman Services on Long Island | Profixter",
    description:
      "Explore small handyman services, $99 One-Time Visits, and Membership paths for Long Island homeowners.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

const servicesJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Profixter handyman services",
  url: `${SITE_URL}/services`,
  itemListElement: handymanServices.map((service, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: service.title,
    url: `${SITE_URL}/services/${service.slug}`,
  })),
};

export default function ServicesPage() {
  return (
    <SeoPageShell>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesJsonLd) }}
        />
        <HubHero
          eyebrow="Handyman services"
          title="Small home tasks, handled through the right Profixter path."
          description="Browse common handyman services, then choose what fits: new customers start with a free first visit, book one $99 One-Time Visit for a single job, become a Member for ongoing help, or move larger work into a renovation estimate."
          primaryCta={FREE_VISIT_CTA}
          secondaryCta={{ label: "Become a Member", href: "/membership/plans" }}
          breadcrumb={{ label: "Services", href: "/services" }}
        />

        <CardGrid
          eyebrow="Service library"
          title="Common handyman jobs we handle."
          description="What each job involves, what to have ready, and what falls outside a handyman visit. Profixter does not offer appliance repair."
          items={handymanServices.map((service) => ({
            label: service.title,
            href: `/services/${service.slug}`,
            body: service.homeownerNeed,
          }))}
        />

        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <p className="ui-eyebrow">Why Membership comes first</p>
              <h2 className="ui-h2">If the home list keeps growing, Membership is usually the better answer.</h2>
              <Link href="/membership/plans" className="ui-btn ui-btn--primary mt-5">
                See plans
              </Link>
            </div>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {membershipBenefits.map((benefit) => (
                <li key={benefit.title} className="ui-card">
                  <h3 className="pg-card__title !text-[16px]">{benefit.title}</h3>
                  <p className="pg-card__meta">{benefit.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/*
          The bridge from "one job" to "a list of jobs". Most people arrive here
          with one task in mind; these are the guides for the person who has
          several, which is where the membership honestly becomes an option.
        */}
        <CardGrid
          eyebrow="Got more than one job?"
          title="Several small jobs, one plan."
          items={[
            {
              label: "Getting small jobs done",
              href: "/guides/handyman-for-small-jobs",
              body: "Bundle them, book one visit, or set up ongoing help: which fits when the jobs keep coming.",
            },
            {
              label: "Handyman minimum charges",
              href: "/guides/handyman-minimum-charges",
              body: "Why a ten-minute repair can cost an hour, and how to stop paying a minimum for every job.",
            },
            {
              label: "How a handyman membership works",
              href: "/handyman-membership",
              body: "Plans, prices, what is included, and when paying per visit is the better deal.",
            },
          ]}
        />

        <ConversionBand />
      </main>
    </SeoPageShell>
  );
}
