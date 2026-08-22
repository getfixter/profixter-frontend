import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import {
  KITCHEN_BATH_HERO,
  KITCHEN_BATH_PHOTOS,
  photoBySlug,
  type GalleryPhoto,
} from "@/app/data/kitchen-bath-gallery";
import { absoluteUrl, BUSINESS_PHONE_E164, SITE_URL } from "@/lib/seo";
import { CUSTOMER_CARE } from "@/lib/fixter";
import WorkGallery from "./WorkGallery";
import ProjectInquiryForm from "./ProjectInquiryForm";
import { CallButton, InquiryButton, StickyInquiryBar } from "./ctas";

/**
 * Fails the render rather than the page.
 *
 * Every slug below is chosen by hand for a specific place in the layout. If
 * the gallery is regenerated without one, a silent `undefined` would leave a
 * hole in the design that nobody notices until a homeowner does.
 */
function pick(slug: string): GalleryPhoto {
  const photo = photoBySlug(slug);
  if (!photo) throw new Error(`kitchen-bathroom: no gallery photo "${slug}"`);
  return photo;
}

const SHELL = "mx-auto w-full max-w-[1560px] px-5 sm:px-8 lg:px-12";
const SECTION = "py-20 sm:py-28 lg:py-36";

/** The grid tiles inside a section, never the full viewport. */
const SIZES_HALF = "(min-width: 1024px) 58vw, 100vw";
const SIZES_THIRD = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw";

/**
 * Section label.
 *
 * Renders as a paragraph by default because it sits above a real heading. The
 * "Why Profixter" block has no headline of its own - it is deliberately three
 * columns and nothing else - so there it becomes the h2, which keeps the
 * document outline from jumping straight from one section's h2 to the next
 * section's h3s.
 */
function Eyebrow({
  children,
  tone = "light",
  as: Tag = "p",
}: {
  children: string;
  tone?: "light" | "dark";
  as?: "p" | "h2";
}) {
  return (
    <Tag
      className={[
        "flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em]",
        tone === "light" ? "text-[#8A6D3F]" : "text-[#D4A574]",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={`h-px w-8 ${tone === "light" ? "bg-[#C9AE83]" : "bg-[#D4A574]/60"}`}
      />
      {children}
    </Tag>
  );
}

function Figure({
  photo,
  sizes,
  className = "",
  ratio = "aspect-[4/3]",
}: {
  photo: GalleryPhoto;
  sizes: string;
  className?: string;
  ratio?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[14px] bg-[#EDEAE4] ${ratio} ${className}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        placeholder="blur"
        blurDataURL={photo.blurDataURL}
        className="object-cover"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/**
 * What Profixter does on a kitchen or bathroom project.
 *
 * Taken from what the site already tells homeowners: the Projects page scope
 * for kitchens and bathrooms, and the Remodeling section on the homepage.
 * Nothing here is a new capability claim - notably appliances are coordinated
 * with the vendor, not repaired, which is what the About page says.
 */
const TRADES = [
  { title: "Demolition and prep", body: "Full gut-and-rebuild or a targeted upgrade, with the space protected before anything comes out." },
  { title: "Plumbing coordination", body: "Supply, drainage and fixture rough-in planned around the layout you actually want." },
  { title: "Lighting and electrical", body: "Recessed, under-cabinet, vanity and pendant lighting coordinated with the rest of the work." },
  { title: "Waterproofing", body: "Wet-area details and moisture barriers reviewed carefully before anything is closed up." },
  { title: "Tile and stone", body: "Floors, walls, showers, niches and the pattern work that decides how the room reads." },
  { title: "Flooring", body: "Tile, stone and wood-look floors set to run cleanly into the rest of the house." },
  { title: "Cabinetry and vanities", body: "Cabinets, vanities, hardware and the storage that changes how the room works day to day." },
  { title: "Countertops and backsplash", body: "Counters, edges and backsplash chosen and templated as one decision, not three." },
  { title: "Fixtures and hardware", body: "Showers, tubs, sinks, faucets and the finishes that tie a room together." },
  { title: "Finish carpentry and trim", body: "Trim, panelling and the joinery that makes new work look like it belongs." },
  { title: "Appliance coordination", body: "Delivery timing, measurements and rough-in handled with your appliance vendor." },
  { title: "Paint and final finish", body: "A clean finish on every surface, and the punch-list details at the end." },
];

const REASONS = [
  {
    title: "Licensed and insured",
    body: "Profixter operates under NY State Home Improvement Contractor license HI-71484 and carries insurance for the work.",
  },
  {
    title: "A Long Island company",
    body: "Based on Long Island and working across Nassau and Suffolk County — not a national marketplace routing your job to whoever answers first.",
  },
  {
    title: "One team, one project",
    body: "The same company plans the scope, runs the trades and finishes the room. One relationship, and one place the answer comes from.",
  },
];

/*
 * The East End, written the way somebody who lives there would say it.
 *
 * These are the South Fork and North Fork towns inside Suffolk County, which
 * is territory the site already says Profixter serves. Deliberately a sentence
 * rather than a list of link-shaped town names - the page is for a homeowner
 * checking whether we come out that far, not for a crawler counting keywords.
 */
const SOUTH_FORK =
  "Westhampton and Westhampton Beach, Quogue and East Quogue, Hampton Bays, Southampton and Shinnecock Hills, Water Mill, Bridgehampton, Sag Harbor, East Hampton, Springs, Amagansett and out to Montauk";
const NORTH_FORK =
  "Riverhead, Aquebogue, Mattituck, Cutchogue, Peconic, Southold, Greenport, East Marion and Orient, and across the water on Shelter Island";

/* ------------------------------------------------------------------ */

export default function KitchenBathroomPage() {
  const hero = KITCHEN_BATH_HERO;
  const galleryPhotos = KITCHEN_BATH_PHOTOS.filter((photo) => !photo.hero);

  /*
   * Section leads are shown around 750 CSS pixels wide, so they are picked
   * from the camera originals rather than the older social exports - the
   * navy-island kitchen is the better photograph but only exists at 828px,
   * which is a support tile's worth of pixels, not a lead's.
   */
  const kitchenLead = pick("kitchen-handleless-island");
  const kitchenSupport = [
    pick("kitchen-navy-island"),
    pick("kitchen-grey-shaker-island"),
    pick("kitchen-cream-shaker"),
  ];
  const bathLead = pick("bath-dark-marble-suite");
  const bathSupport = [
    pick("shower-marble-gold-tub"),
    pick("bath-backlit-vanity-stone"),
    pick("shower-black-marble-glass"),
  ];
  const areaPhoto = pick("bath-navy-vanity-shiplap");

  /*
   * A Service node hung off the LocalBusiness the root layout already
   * publishes, rather than a second business. Same @id, so search engines read
   * one company that offers this service, not two companies.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE_URL}/kitchen-bathroom#service`,
    name: "Kitchen and bathroom renovation",
    serviceType: "Kitchen and bathroom remodeling",
    url: absoluteUrl("/kitchen-bathroom"),
    description:
      "Complete kitchen and bathroom renovation for homeowners across the Hamptons and Long Island, including demolition, plumbing and lighting coordination, waterproofing, tile, cabinetry, countertops, fixtures and finishing.",
    provider: { "@id": `${SITE_URL}/#business` },
    telephone: BUSINESS_PHONE_E164,
    image: absoluteUrl("/images/kitchen-bath/og.jpg"),
    areaServed: [
      "Long Island, NY",
      "Suffolk County, NY",
      "Nassau County, NY",
      "The Hamptons, NY",
      "Southampton, NY",
      "East Hampton, NY",
      "Sag Harbor, NY",
      "Bridgehampton, NY",
      "Water Mill, NY",
      "Hampton Bays, NY",
      "Westhampton Beach, NY",
      "Montauk, NY",
      "Riverhead, NY",
      "Southold, NY",
    ].map((name) => ({ "@type": "Place", name })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Kitchen and bathroom renovation",
      itemListElement: [
        { "@type": "Offer", name: "Kitchen renovation" },
        { "@type": "Offer", name: "Bathroom renovation" },
        { "@type": "Offer", name: "Shower renovation" },
      ],
    },
  };

  return (
    <div className="bg-[#FAF9F7] text-[#0C1117]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ---------------------------------------------------------- Hero */}
        <section
          id="hero"
          className="relative isolate flex min-h-[88svh] flex-col overflow-hidden bg-[#0C1117] lg:min-h-[94svh]"
        >
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            priority
            sizes="100vw"
            placeholder="blur"
            blurDataURL={hero.blurDataURL}
            className="object-cover object-center"
          />
          {/*
            The photograph is a bright white bathroom, so the headline needs a
            real scrim rather than a tint.

            Two of them, because one could not do both jobs. The vertical pass
            is weighted to the bottom so the top of the frame — the skylight
            and the tile — stays the first thing anybody sees. On its own it
            left the brass eyebrow sitting a third of the way up on a pale
            wall, well under 4.5:1. The horizontal pass darkens only the column
            the text occupies and clears by the right-hand edge, so the tub and
            the shower are still legible photography.
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,10,14,0.94)_0%,rgba(7,10,14,0.78)_22%,rgba(7,10,14,0.34)_52%,rgba(7,10,14,0.16)_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(7,10,14,0.64)_0%,rgba(7,10,14,0.4)_42%,rgba(7,10,14,0)_78%)]"
          />

          <div className="relative z-50">
            <Header />
          </div>

          <div
            /*
             * Tuned so the whole block - down to the licence line - lands
             * above the fixed bottom navigation on a 664px phone. It used to
             * overrun by about 60px, which quietly hid the one line on the
             * page that says we are licensed and insured.
             */
            className={`${SHELL} relative z-10 mt-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] pt-12 lg:pb-24 lg:pt-16`}
          >
            <Eyebrow tone="dark">The Hamptons &amp; Long Island</Eyebrow>
            <h1 className="mt-5 max-w-[15ch] text-[40px] font-bold leading-[0.96] tracking-[-0.035em] text-white sm:text-[62px] lg:text-[78px] xl:text-[88px]">
              Kitchen &amp; Bathroom Renovations
            </h1>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.55] text-white/78 sm:mt-7 sm:text-[19px] sm:leading-relaxed">
              Complete kitchen and bathroom renovations, planned and built by one licensed
              Long Island team — from demolition through the final finish.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
              <InquiryButton placement="hero" />
              <CallButton placement="hero" tone="dark" />
            </div>

            <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-semibold text-white/55 sm:mt-10 sm:gap-x-8 sm:text-[13px]">
              {["NY State Licensed HI-71484", "Fully insured", "Long Island based"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#D4A574]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- Work */}
        <section id="work" className={`${SHELL} ${SECTION}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Our work</Eyebrow>
              <h2 className="mt-5 max-w-[16ch] text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[48px] lg:text-[58px]">
                Rooms we have actually built.
              </h2>
            </div>
            <p className="max-w-[46ch] text-[15px] leading-relaxed text-[#5C6470] sm:text-[16px] lg:pb-3">
              Every photograph on this page is a Profixter kitchen or bathroom. No stock
              rooms, no renderings. Open any one of them to see it full size.
            </p>
          </div>

          <div className="mt-12 sm:mt-14">
            <WorkGallery photos={galleryPhotos} />
          </div>
        </section>

        {/* ------------------------------------------------------ Kitchens */}
        <section id="kitchen-renovations" className="border-t border-[#E7E3DC] bg-[#F3F1ED]">
          <div className={`${SHELL} ${SECTION}`}>
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Eyebrow>Kitchen renovation</Eyebrow>
                <h2 className="mt-5 text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
                  Kitchen Renovations
                </h2>
                <p className="mt-6 max-w-[50ch] text-[16px] leading-relaxed text-[#4A5058] sm:text-[17px]">
                  Cabinets, countertops, backsplash, flooring, lighting and layout, planned
                  together and run as one project. The decisions that are expensive to change
                  later get made before demolition starts.
                </p>
                <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-[#4A5058] sm:text-[17px]">
                  Kitchen remodeling is one of the paths Profixter handles as a general
                  contractor, so the trades, the schedule and the finish are one company&apos;s
                  responsibility.
                </p>
                <div className="mt-9">
                  <InquiryButton placement="kitchen_section">Discuss your kitchen</InquiryButton>
                </div>
              </div>

              <div className="lg:col-span-7">
                <Figure photo={kitchenLead} sizes={SIZES_HALF} ratio="aspect-[4/3]" />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {kitchenSupport.map((photo) => (
                <Figure key={photo.slug} photo={photo} sizes={SIZES_THIRD} ratio="aspect-[4/3]" />
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- Bathrooms */}
        <section id="bathroom-renovations" className="bg-[#0C1117] text-white">
          <div className={`${SHELL} ${SECTION}`}>
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7 lg:order-1">
                <Figure photo={bathLead} sizes={SIZES_HALF} ratio="aspect-[4/3] lg:aspect-[5/4]" />
              </div>

              <div className="lg:col-span-5 lg:order-2">
                <Eyebrow tone="dark">Bathroom renovation</Eyebrow>
                <h2 className="mt-5 text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
                  Bathroom Renovations
                </h2>
                <p className="mt-6 max-w-[50ch] text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
                  A bathroom is a small room with a lot happening inside the walls. Tile,
                  shower, tub, vanity, fixtures, ventilation and waterproofing are planned as
                  one job, and the wet-area details are reviewed carefully before anything is
                  closed up.
                </p>
                <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
                  Full bathroom remodeling, shower renovation, or a tub-to-shower change —
                  the same team handles the tile, the plumbing coordination and the finish.
                </p>
                <div className="mt-9">
                  <InquiryButton placement="bathroom_section">Discuss your bathroom</InquiryButton>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {bathSupport.map((photo) => (
                <Figure key={photo.slug} photo={photo} sizes={SIZES_THIRD} ratio="aspect-[4/3]" />
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ What we handle */}
        <section id="what-we-handle" className={`${SHELL} ${SECTION}`}>
          <div className="max-w-[62ch]">
            <Eyebrow>What we handle</Eyebrow>
            <h2 className="mt-5 text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
              The whole renovation, not a piece of it.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-[#5C6470] sm:text-[17px]">
              Profixter runs kitchen and bathroom projects as the general contractor. One
              team, one project, and one company answerable for the result.
            </p>
          </div>

          <ul className="mt-14 grid gap-x-10 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            {TRADES.map((trade) => (
              <li key={trade.title} className="border-t border-[#E0DCD4] py-6">
                <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[#0C1117]">
                  {trade.title}
                </h3>
                <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-[#6B7280]">
                  {trade.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------------- Why Profixter */}
        <section id="why-profixter" className="border-y border-[#E7E3DC] bg-[#F3F1ED]">
          <div className={`${SHELL} ${SECTION}`}>
            <Eyebrow as="h2">Why Profixter</Eyebrow>
            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-14">
              {REASONS.map((reason, index) => (
                <div key={reason.title}>
                  <span
                    aria-hidden="true"
                    className="text-[12px] font-bold tracking-[0.2em] text-[#B3AB9C]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-[22px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[26px]">
                    {reason.title}
                  </h3>
                  <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#5C6470] sm:text-[16px]">
                    {reason.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- Where we work */}
        <section id="service-area" className={`${SHELL} ${SECTION}`}>
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <Eyebrow>Where we work</Eyebrow>
              <h2 className="mt-5 max-w-[18ch] text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
                Long Island, out to the East End.
              </h2>
              <p className="mt-7 max-w-[62ch] text-[17px] leading-relaxed text-[#4A5058] sm:text-[19px]">
                Profixter is a Long Island company working across Nassau and Suffolk County.
                On the South Fork that means {SOUTH_FORK}.
              </p>
              <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-[#4A5058] sm:text-[19px]">
                On the North Fork, {NORTH_FORK}.
              </p>
              <p className="mt-7 max-w-[58ch] text-[15px] leading-relaxed text-[#6B7280]">
                Not sure whether your town is covered? Call and ask — it is a short
                conversation.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <CallButton placement="service_area" />
              </div>
            </div>

            <div className="lg:col-span-5">
              <Figure photo={areaPhoto} sizes={SIZES_HALF} ratio="aspect-[4/5]" />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Final / form */}
        <section id="project-inquiry" className="scroll-mt-4 bg-[#0C1117] text-white">
          <div className={`${SHELL} ${SECTION}`}>
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Eyebrow tone="dark">Start here</Eyebrow>
                <h2 className="mt-5 max-w-[16ch] text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
                  Thinking about renovating? Let&apos;s talk about your project.
                </h2>
                <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-white/65 sm:text-[17px]">
                  Tell us what you are thinking about and where the home is. A real person at
                  Profixter reads every request and follows up.
                </p>

                <div className="mt-10 border-t border-white/12 pt-8">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    Rather just call?
                  </p>
                  <a
                    href={CUSTOMER_CARE.callHref}
                    className="mt-3 inline-block text-[30px] font-bold tracking-[-0.03em] text-white transition-colors hover:text-[#D4A574] sm:text-[38px]"
                  >
                    {CUSTOMER_CARE.phoneDisplay}
                  </a>
                </div>

                <p className="mt-10 max-w-[46ch] text-[14px] leading-relaxed text-white/45">
                  Looking for a smaller job instead of a renovation?{" "}
                  <Link href="/book" className="font-semibold text-white/80 underline underline-offset-4 hover:text-white">
                    Book a handyman visit
                  </Link>
                  , or see{" "}
                  <Link href="/projects" className="font-semibold text-white/80 underline underline-offset-4 hover:text-white">
                    every project path
                  </Link>
                  .
                </p>
              </div>

              <div className="lg:col-span-7">
                <ProjectInquiryForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <StickyInquiryBar />
    </div>
  );
}
