import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import MembershipCtaLink from "@/app/components/membership/MembershipCtaLink";
import { FREE_VISIT_CTA, ONE_TIME_CTA, type CtaLink, type SeoPageContent, type ServiceAreaContent } from "@/lib/seo-content";
import { breadcrumbJsonLd } from "@/lib/breadcrumbs";

type LinkItem = {
  label: string;
  href: string;
  body?: string;
};

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function SmartCtaLink({
  cta,
  className,
  children,
}: {
  cta: CtaLink;
  className: string;
  children: React.ReactNode;
}) {
  if (cta.label === "Become a Member") {
    return <MembershipCtaLink className={className}>{children}</MembershipCtaLink>;
  }

  return (
    <Link href={cta.href} className={className}>
      {children}
    </Link>
  );
}

/** The free first visit wears the accent (its one job in the system); any other lead CTA is navy. */
function ctaClass(cta: CtaLink, lead: boolean) {
  if (!lead) return "ui-btn ui-btn--secondary";
  return cta.href === "/book/free" ? "ui-btn ui-btn--accent" : "ui-btn ui-btn--primary";
}

export function SeoPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[color:var(--ui-ink)]">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      {children}
      <Footer />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: LinkItem[] }) {
  return (
    <>
    {/* The visible trail and its BreadcrumbList markup always travel together. */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(items)) }}
    />
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-[color:var(--ui-text-3)]">
      <Link href="/" className="transition-colors hover:text-[color:var(--ui-accent-ink)]">
        Home
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-2">
          <span aria-hidden="true" className="text-[color:var(--ui-line-2)]">/</span>
          <Link href={item.href} className="transition-colors hover:text-[color:var(--ui-accent-ink)]">
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
    </>
  );
}

export function HubHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  breadcrumb,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  breadcrumb: LinkItem;
}) {
  return (
    <section className="ui-section ui-section--tight !pt-5 sm:!pt-8">
      <div className="ui-container">
        <Breadcrumbs items={[breadcrumb]} />
        <div className="max-w-[760px] ui-rise">
          <p className="ui-eyebrow ui-eyebrow--accent">{eyebrow}</p>
          <h1 className="ui-display">{title}</h1>
          <p className="ui-lede !max-w-[62ch]">{description}</p>
          <div className="pg-actions pg-actions--stack">
            <SmartCtaLink cta={primaryCta} className={ctaClass(primaryCta, true)}>
              {primaryCta.label}
            </SmartCtaLink>
            <SmartCtaLink cta={secondaryCta} className="ui-btn ui-btn--secondary">
              {secondaryCta.label}
            </SmartCtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CardGrid({
  eyebrow,
  title,
  description,
  items,
  soft = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  items: LinkItem[];
  /** Warm stone background, for alternating sections. */
  soft?: boolean;
}) {
  return (
    <section className={`ui-section ui-section--tight ${soft ? "ui-section--soft" : ""}`}>
      <div className="ui-container">
        <div className="ui-head">
          <p className="ui-eyebrow">{eyebrow}</p>
          <h2 className="ui-h2">{title}</h2>
          {description ? <p className="ui-lede !max-w-[62ch]">{description}</p> : null}
        </div>
        <div className="pg-cards pg-cards--3">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="ui-card ui-card--link group">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="pg-card__title !text-[17px]">{item.label}</h3>
                  {item.body ? <p className="pg-card__meta">{item.body}</p> : null}
                </div>
                <span className="mt-0.5 flex-shrink-0 text-[color:var(--ui-text-3)] transition-transform group-hover:translate-x-0.5">
                  <ArrowIcon />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConversionBand({
  title = "Choose the right Profixter path.",
  description = "Membership is best for ongoing home care. One-Time Visit is best for one small task. Renovation Estimate is best for larger work.",
  freeVisitFirst = false,
}: {
  title?: string;
  description?: string;
  /** Handyman and town pages: lead with the free first visit, the step a new visitor can take. */
  freeVisitFirst?: boolean;
}) {
  const links: CtaLink[] = [
    ...(freeVisitFirst ? [FREE_VISIT_CTA] : []),
    { label: "Become a Member", href: "/membership/plans" },
    ONE_TIME_CTA,
    { label: "Request Renovation Estimate", href: "/projects#estimate" },
  ];

  return (
    <section className="ui-section ui-section--tight">
      <div className="ui-container">
        <div className="ui-card ui-card--dark grid gap-6 !p-6 sm:!p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:!p-10">
          <div>
            <p className="ui-eyebrow !text-[color:var(--ui-on-dark-2)]">Next step</p>
            <h2 className="ui-h2 !text-white">{title}</h2>
            <p className="mt-3 text-[15px] leading-[1.6] text-[color:var(--ui-on-dark-2)]">{description}</p>
          </div>
          <div className={`grid gap-2 ${links.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3 lg:grid-cols-1"}`}>
            {links.map((link) => (
              <SmartCtaLink
                key={link.href}
                cta={link}
                className="inline-flex min-h-[48px] items-center justify-between gap-3 rounded-[var(--ui-r-sm)] border border-white/15 px-4 text-[15px] font-semibold text-white transition-colors hover:bg-white hover:text-[color:var(--ui-ink)]"
              >
                {link.label}
                <ArrowIcon />
              </SmartCtaLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DetailPage({
  content,
  type,
  relatedLinks = [],
  photos = [],
}: {
  content: SeoPageContent;
  type: "service" | "renovation";
  relatedLinks?: LinkItem[];
  /** Captioned Recent Work photos of this kind of job, if any are published. */
  photos?: { id: string; title: string; caption: string; thumbUrl: string; width: number; height: number }[];
}) {
  const detailLabel = type === "service" ? "Services" : "Renovations";
  const detailHref = type === "service" ? "/services" : "/renovations";
  const pathCards =
    type === "service"
      ? [
          {
            title: "Best first step",
            body: "New to Profixter? Your first visit is free: up to 90 minutes of handyman work, one per customer, no card needed. After that, book a $99 One-Time Visit when the task is specific, small, and on the approved service list.",
          },
          {
            title: "Better long-term answer",
            body: "Choose Membership when you expect ongoing home maintenance and do not want to restart the search every time.",
          },
          {
            title: "When scope grows",
            body: "Use the renovation estimate path when the work becomes multi-day, licensed-trade, structural, or project-sized.",
          },
        ]
      : [
          {
            title: "Best first step",
            body: "Request a renovation estimate so scope, photos, timeline, and the right next step can be reviewed.",
          },
          {
            title: "Smaller fixes along the way",
            body: "A focused small task may fit Book Handyman. Larger layout or finish work belongs in the renovation estimate path.",
          },
          {
            title: "Membership connection",
            body: "Members may receive project discounts, and eligible larger projects may include up to 12 months of Membership.",
          },
        ];

  return (
    <SeoPageShell>
      <main>
        <section className="ui-section ui-section--tight !pt-5 sm:!pt-8">
          <div className="ui-container">
            <Breadcrumbs
              items={[
                { label: detailLabel, href: detailHref },
                { label: content.shortTitle, href: `${detailHref}/${content.slug}` },
              ]}
            />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start lg:gap-14">
              <div className="ui-rise">
                <p className="ui-eyebrow ui-eyebrow--accent">
                  Profixter {type === "service" ? "handyman service" : "renovation service"}
                </p>
                <h1 className="ui-display">{content.h1}</h1>
                <p className="ui-lede !max-w-[62ch]">{content.intro}</p>
              </div>
              <aside className="ui-card ui-card--soft ui-rise" style={{ animationDelay: "60ms" }}>
                <p className="ui-eyebrow">Homeowner intent</p>
                <p className="text-[17px] font-semibold leading-[1.35] text-[color:var(--ui-ink)]">{content.homeownerNeed}</p>
                <div className="mt-4 grid gap-2">
                  {[content.primaryCta, content.secondaryCta, content.tertiaryCta].map((cta, index) => (
                    <SmartCtaLink
                      key={cta.href}
                      cta={cta}
                      className={index === 0 ? `${ctaClass(cta, true)} !justify-between` : "ui-btn ui-btn--secondary !justify-between"}
                    >
                      {cta.label}
                      <ArrowIcon />
                    </SmartCtaLink>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container grid gap-3 md:grid-cols-2 md:gap-4">
            <div className="ui-card">
              <h2 className="ui-h3">Good fit for</h2>
              <ul className="ui-checks mt-3">
                {content.goodFit.map((item) => (
                  <li key={item} className="!text-[15px]">{item}</li>
                ))}
              </ul>
            </div>
            <div className="ui-card">
              <h2 className="ui-h3">Not the right path for</h2>
              <ul className="mt-3 grid gap-2">
                {(content.notAFit || []).map((item) => (
                  <li key={item} className="flex gap-2.5 text-[15px] leading-[1.5] text-[color:var(--ui-text-2)]">
                    <span className="mt-[9px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[color:var(--ui-line-2)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--tight">
          <div className="ui-container grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
            <div>
              <p className="ui-eyebrow">How to use Profixter</p>
              <h2 className="ui-h2">Pick the path that matches the scope.</h2>
              <p className="ui-body mt-3">
                Profixter separates small handyman visits, ongoing Membership, and larger renovation work so homeowners do not have to force every job into the same box.
              </p>
            </div>
            <ol className="m-0 list-none border-t border-[color:var(--ui-line)] p-0">
              {pathCards.map((card, index) => (
                <li key={card.title} className="flex gap-4 border-b border-[color:var(--ui-line)] py-4">
                  <span className="ui-num w-6 flex-none pt-0.5 text-[13px] font-semibold text-[color:var(--ui-accent-ink)]">0{index + 1}</span>
                  <span>
                    <h3 className="text-[16px] font-semibold text-[color:var(--ui-ink)]">{card.title}</h3>
                    <p className="mt-1 text-[15px] leading-[1.55] text-[color:var(--ui-text-2)]">{card.body}</p>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
            <div>
              <h2 className="ui-h3">Before you start</h2>
              <ul className="ui-checks mt-3">
                {content.prepNotes.map((item) => (
                  <li key={item} className="!text-[15px]">{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="ui-h3">Common questions</h2>
              <div className="ui-faq mt-3">
                {content.faq.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p className="ui-faq__a">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/*
          Real photographs of this kind of job, from the Recent Work library,
          captioned by an admin. Nothing renders when none are published.
        */}
        {photos.length ? (
          <section aria-labelledby="service-photos" className="ui-section ui-section--tight">
            <div className="ui-container">
              <h2 id="service-photos" className="ui-h2">
                Recent work: {content.shortTitle}
              </h2>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.slice(0, 8).map((photo) => (
                  <figure key={photo.id} className="min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={photo.title}
                      width={photo.width || 960}
                      height={photo.height || 1280}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/4] w-full rounded-[var(--ui-r-md)] bg-[color:var(--ui-bg-sunk)] object-cover"
                    />
                    <figcaption className="mt-2 text-[13px] leading-[1.45] text-[color:var(--ui-text-3)]">{photo.caption}</figcaption>
                  </figure>
                ))}
              </div>
              <Link href="/recent-work" className="ui-link mt-4">
                See all recent work
              </Link>
            </div>
          </section>
        ) : null}

        {relatedLinks.length ? (
          <CardGrid
            eyebrow="Related pages"
            title="Keep exploring the right path."
            description="These links help homeowners compare small service needs, larger renovation work, and local availability."
            items={relatedLinks}
            soft
          />
        ) : null}

        <ConversionBand freeVisitFirst={type === "service"} />
      </main>
    </SeoPageShell>
  );
}

export function LocationDetailPage({
  area,
  relatedLinks = [],
  record,
  rating,
  oneTimePrice,
  lowestPlanPrice,
  dataAsOf,
}: {
  area: ServiceAreaContent;
  relatedLinks?: LinkItem[];
  /** Profixter's own record in this town, only where three or more customers are behind it. */
  record?: { visits: number; customers: number } | null;
  rating?: { rating: number; total: number; url: string } | null;
  oneTimePrice: number;
  lowestPlanPrice: number;
  dataAsOf: string;
}) {
  /* The free first visit leads: it is the step a new visitor can take today. */
  const paths: { title: string; body: string; href: string; label: string }[] = [
    {
      title: "New to Profixter",
      body: "A free first 90-minute visit, one per customer, for new customers in Nassau and Suffolk.",
      href: "/book/free",
      label: "Book a free first visit",
    },
    {
      title: "One small job",
      body: `A One-Time Visit: $${oneTimePrice} for up to 90 minutes on one small job from a set list. No membership.`,
      href: "/book?visit=additional",
      label: "Book a One-Time Visit",
    },
    {
      title: "A list that keeps coming back",
      body: `A handyman membership from $${lowestPlanPrice}/month: 90-minute visits booked as often as you need, with the same local team.`,
      href: "/membership/plans",
      label: "Compare plans",
    },
  ];

  return (
    <SeoPageShell>
      <main>
        <section className="ui-section ui-section--tight !pt-5 sm:!pt-8">
          <div className="ui-container">
            <Breadcrumbs
              items={[
                { label: "Locations", href: "/locations" },
                { label: area.name, href: `/locations/${area.slug}` },
              ]}
            />
            <div className="max-w-[760px] ui-rise">
              <p className="ui-eyebrow ui-eyebrow--accent">
                {area.municipality} · {area.county}
              </p>
              <h1 className="ui-display">{area.h1}</h1>
              <p className="ui-lede !max-w-[62ch]">{area.intro}</p>
              {record || rating ? (
                <dl className="mt-5 flex flex-wrap gap-2">
                  {record ? (
                    <div className="rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] px-3.5 py-2.5">
                      <dt className="text-[12px] font-medium text-[color:var(--ui-text-3)]">In {area.name}</dt>
                      <dd className="mt-0.5 text-[15px] font-medium text-[color:var(--ui-ink)]">
                        {record.visits}+ completed visits for {record.customers} customers
                      </dd>
                    </div>
                  ) : null}
                  {rating ? (
                    <div className="rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] px-3.5 py-2.5">
                      <dt className="text-[12px] font-medium text-[color:var(--ui-text-3)]">On Google</dt>
                      <dd className="mt-0.5 text-[15px] font-medium text-[color:var(--ui-ink)]">
                        {rating.rating.toFixed(1)} stars from {rating.total} reviews
                        {rating.url ? (
                          <>
                            {" "}
                            <a href={rating.url} rel="noopener" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                              Read them
                            </a>
                          </>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {record ? (
                <p className="mt-2 text-[13px] text-[color:var(--ui-text-3)]">Visit record since August 2025, as of {dataAsOf}.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container grid gap-3 md:gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="ui-card">
              <h2 className="ui-h3">About {area.name}</h2>
              <p className="ui-body mt-2">{area.localContext}</p>
              {area.nearby.length ? (
                <p className="ui-small mt-3">
                  Nearby, Profixter has also completed visits in {area.nearby.join(", ")}.
                </p>
              ) : null}
            </div>
            {/*
              Practical, place-specific notes instead of the same data table on
              every town page: who issues permits here, and when to winterize.
            */}
            <div className="ui-card">
              <h2 className="ui-h3">Good to know in {area.name}</h2>
              <dl className="mt-3 grid gap-3 text-[15px] leading-[1.55]">
                <div>
                  <dt className="font-semibold text-[color:var(--ui-ink)]">Building permits</dt>
                  <dd className="mt-0.5 text-[color:var(--ui-text-2)]">{area.permits}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[color:var(--ui-ink)]">Winterizing</dt>
                  <dd className="mt-0.5 text-[color:var(--ui-text-2)]">
                    The first fall freeze here typically arrives {area.freeze} (National Weather Service). Shut off and
                    drain outdoor faucets before then.{" "}
                    <Link href="/guides/long-island-home-maintenance-calendar" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                      Seasonal checklist
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="ui-section ui-section--tight">
          <div className="ui-container">
            <h2 className="ui-h2">Getting help in {area.name}</h2>
            <div className="pg-cards pg-cards--3 mt-5">
              {paths.map((path) => (
                <div key={path.title} className="ui-card flex flex-col">
                  <h3 className="pg-card__title !text-[17px]">{path.title}</h3>
                  <p className="pg-card__meta flex-1">{path.body}</p>
                  <Link href={path.href} className="ui-link mt-3">
                    {path.label}
                  </Link>
                </div>
              ))}
            </div>
            <p className="ui-small mt-5 max-w-[70ch]">
              Larger work (kitchens, bathrooms, roofing, siding) runs as a separate{" "}
              <Link href="/projects" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                project estimate
              </Link>
              . Not sure which you need? Read{" "}
              <Link href="/guides/handyman-for-small-jobs" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                getting small jobs done
              </Link>{" "}
              and{" "}
              <Link href="/guides/handyman-cost-long-island" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                what a handyman costs on Long Island
              </Link>
              .
            </p>
          </div>
        </section>

        {relatedLinks.length ? (
          <CardGrid eyebrow="Common jobs" title="Common handyman jobs, and what each one involves." items={relatedLinks} soft />
        ) : null}

        <ConversionBand
          title={`Start with the right Profixter path in ${area.name}.`}
          description="New here: your first visit is free. One small job: a One-Time Visit. A running list: a membership. Larger work: a project estimate."
          freeVisitFirst
        />
      </main>
    </SeoPageShell>
  );
}
