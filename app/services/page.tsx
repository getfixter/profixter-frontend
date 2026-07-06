import type { Metadata } from "next";
import Link from "next/link";
import {
  CardGrid,
  ConversionBand,
  HubHero,
  SeoPageShell,
} from "@/app/components/seo/SeoPageComponents";
import { handymanServices, membershipBenefits } from "@/lib/seo-content";
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
          description="Browse common handyman services, then choose what fits: become a Member for ongoing help, book one $99 One-Time Visit, or move larger work into a renovation estimate."
          primaryCta={{ label: "Become a Member", href: "/membership#plans" }}
          secondaryCta={{ label: "Book One-Time Visit", href: "/book" }}
          breadcrumb={{ label: "Services", href: "/services" }}
        />

        <CardGrid
          eyebrow="Service library"
          title="Common handyman tasks homeowners search for."
          description="These pages are designed to help you understand scope before you book. Profixter does not offer appliance repair."
          items={handymanServices.map((service) => ({
            label: service.title,
            href: `/services/${service.slug}`,
            body: service.homeownerNeed,
          }))}
        />

        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-[1180px] rounded-[28px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="max-w-[720px]">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Why Membership comes first
              </div>
              <h2 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[46px]">
                If the home list keeps growing, Membership is usually the better answer.
              </h2>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {membershipBenefits.map((benefit) => (
                <div key={benefit.title} className="rounded-[20px] bg-[#F8FAFF] p-5">
                  <h3 className="text-[17px] font-black text-[#0B1628]">{benefit.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-[#64748B]">{benefit.body}</p>
                </div>
              ))}
            </div>
            <Link
              href="/membership#plans"
              className="mt-7 inline-flex min-h-[50px] items-center justify-center rounded-[14px] bg-[#0B1628] px-6 text-[14px] font-black text-white transition hover:bg-[#172033]"
            >
              See Membership options
            </Link>
          </div>
        </section>

        <ConversionBand />
      </main>
    </SeoPageShell>
  );
}
