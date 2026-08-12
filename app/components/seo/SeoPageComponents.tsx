import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import MembershipCtaLink from "@/app/components/membership/MembershipCtaLink";
import type { CtaLink, SeoPageContent, ServiceAreaContent } from "@/lib/seo-content";

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

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 12h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
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

export function SeoPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <Header />
      {children}
      <Footer />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: LinkItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#64748B]">
      <Link href="/" className="transition hover:text-[#306EEC]">
        Home
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-2">
          <span aria-hidden="true" className="text-[#94A3B8]">/</span>
          <Link href={item.href} className="transition hover:text-[#306EEC]">
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
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
    <section className="px-4 pb-10 pt-3 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <Breadcrumbs items={[breadcrumb]} />
        <div className="max-w-[880px]">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
            {eyebrow}
          </div>
          <h1 className="mt-4 text-[38px] font-black leading-[0.96] tracking-[-0.04em] text-[#0B1628] sm:text-[68px] sm:leading-[0.92] sm:tracking-[-0.05em]">
            {title}
          </h1>
          <p className="mt-5 max-w-[720px] text-[15px] font-medium leading-7 text-[#475569] sm:text-[18px] sm:leading-8">
            {description}
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <SmartCtaLink
              cta={primaryCta}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[14px] bg-[#306EEC] px-6 text-[14px] font-black text-white shadow-[0_16px_42px_rgba(48,110,236,0.26)] transition hover:bg-[#2558C9] sm:min-h-[54px] sm:text-[15px]"
            >
              {primaryCta.label}
              <ArrowIcon />
            </SmartCtaLink>
            <SmartCtaLink
              cta={secondaryCta}
              className="inline-flex min-h-[50px] items-center justify-center rounded-[14px] border border-[#D7DEE9] bg-white px-6 text-[14px] font-black text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC] sm:min-h-[54px] sm:text-[15px]"
            >
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
}: {
  eyebrow: string;
  title: string;
  description?: string;
  items: LinkItem[];
}) {
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="max-w-[720px]">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
            {eyebrow}
          </div>
          <h2 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[48px]">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 text-[15px] leading-7 text-[#64748B] sm:text-[16px]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[22px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#BFD2FF] hover:shadow-[0_22px_70px_rgba(48,110,236,0.10)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[19px] font-black leading-tight text-[#0B1628]">
                    {item.label}
                  </h3>
                  {item.body ? (
                    <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
                      {item.body}
                    </p>
                  ) : null}
                </div>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[#306EEC] transition group-hover:bg-[#306EEC] group-hover:text-white">
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
}: {
  title?: string;
  description?: string;
}) {
  const links: CtaLink[] = [
    { label: "Become a Member", href: "/membership/plans" },
    { label: "Book One-Time Visit", href: "/book" },
    { label: "Request Renovation Estimate", href: "/projects#estimate" },
  ];

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-[1180px] rounded-[28px] bg-[#0B1628] p-5 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
        <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#93C5FD]">
              Next step
            </div>
            <h2 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.034em] sm:text-[46px]">
              {title}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-white/68">
              {description}
            </p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            {links.map((link) => (
              <SmartCtaLink
                key={link.href}
                cta={link}
                className="inline-flex min-h-[50px] items-center justify-between gap-3 rounded-[16px] border border-white/12 bg-white/[0.07] px-5 text-[14px] font-black text-white transition hover:bg-white hover:text-[#0B1628]"
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
}: {
  content: SeoPageContent;
  type: "service" | "renovation";
  relatedLinks?: LinkItem[];
}) {
  const detailLabel = type === "service" ? "Services" : "Renovations";
  const detailHref = type === "service" ? "/services" : "/renovations";
  const pathCards =
    type === "service"
      ? [
          {
            title: "Best first step",
            body: "Book a $99 One-Time Visit when the task is specific, small, and on the approved service list.",
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
            title: "Useful before hiring",
            body: "Use Profixter AI to review quotes, agreements, photos, and project questions as practical homeowner guidance.",
          },
          {
            title: "Membership connection",
            body: "Members may receive project discounts, and eligible larger projects may include up to 12 months of Membership.",
          },
        ];

  return (
    <SeoPageShell>
      <main>
        <section className="px-4 pb-10 pt-3 sm:px-6 sm:pb-16 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Breadcrumbs
              items={[
                { label: detailLabel, href: detailHref },
                { label: content.shortTitle, href: `${detailHref}/${content.slug}` },
              ]}
            />
            <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-start">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                  Profixter {type === "service" ? "handyman service" : "renovation service"}
                </div>
                <h1 className="mt-4 text-[38px] font-black leading-[0.96] tracking-[-0.04em] text-[#0B1628] sm:text-[68px] sm:leading-[0.92] sm:tracking-[-0.05em]">
                  {content.h1}
                </h1>
                <p className="mt-5 max-w-[720px] text-[15px] font-medium leading-7 text-[#475569] sm:text-[18px] sm:leading-8">
                  {content.intro}
                </p>
              </div>
              <aside className="rounded-[24px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.06)] sm:p-6">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                  Homeowner intent
                </div>
                <p className="mt-3 text-[22px] font-black leading-tight text-[#0B1628]">
                  {content.homeownerNeed}
                </p>
                <div className="mt-5 grid gap-2">
                  {[content.primaryCta, content.secondaryCta, content.tertiaryCta].map((cta) => (
                    <SmartCtaLink
                      key={cta.href}
                      cta={cta}
                      className="inline-flex min-h-[48px] items-center justify-between gap-3 rounded-[14px] border border-[#D9E4FF] bg-[#F8FAFF] px-4 text-[13px] font-black text-[#0B1628] transition hover:border-[#306EEC] hover:bg-[#EEF4FF]"
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

        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[#DDE5F0] bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-[24px] font-black text-[#0B1628]">Good fit for</h2>
              <div className="mt-5 grid gap-3">
                {content.goodFit.map((item) => (
                  <div key={item} className="flex gap-3 text-[14px] font-semibold leading-6 text-[#334155]">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16834B]">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[#DDE5F0] bg-[#FBFCFF] p-5 shadow-sm sm:p-7">
              <h2 className="text-[24px] font-black text-[#0B1628]">Not the right path for</h2>
              <div className="mt-5 grid gap-3">
                {(content.notAFit || []).map((item) => (
                  <div key={item} className="flex gap-3 text-[14px] font-semibold leading-6 text-[#64748B]">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#94A3B8]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                  How to use Profixter
                </div>
                <h2 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[46px]">
                  Pick the path that matches the scope.
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-[#64748B] sm:text-[16px]">
                  Profixter separates small handyman visits, ongoing Membership, and larger renovation work so homeowners do not have to force every job into the same box.
                </p>
              </div>
              <div className="grid gap-3">
                {pathCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[20px] border border-[#DDE5F0] bg-white p-5 shadow-[0_16px_46px_rgba(15,23,42,0.045)]"
                  >
                    <h3 className="text-[17px] font-black text-[#0B1628]">{card.title}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-[#64748B]">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[24px] border border-[#DDE5F0] bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-[24px] font-black text-[#0B1628]">
                Before you start
              </h2>
              <div className="mt-5 grid gap-3">
                {content.prepNotes.map((item) => (
                  <div key={item} className="flex gap-3 text-[14px] font-semibold leading-6 text-[#334155]">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[#306EEC]">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[#DDE5F0] bg-[#FBFCFF] p-5 shadow-sm sm:p-7">
              <h2 className="text-[24px] font-black text-[#0B1628]">
                Common questions
              </h2>
              <div className="mt-5 divide-y divide-[#DDE5F0]">
                {content.faq.map((item) => (
                  <details key={item.question} className="group py-4 first:pt-0 last:pb-0">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[14px] font-black leading-6 text-[#0B1628]">
                      {item.question}
                      <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[#306EEC] transition group-open:rotate-180">
                        <MinusIcon />
                      </span>
                    </summary>
                    <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {relatedLinks.length ? (
          <CardGrid
            eyebrow="Related pages"
            title="Keep exploring the right path."
            description="These links help homeowners compare small service needs, larger renovation work, and local availability."
            items={relatedLinks}
          />
        ) : null}

        <ConversionBand />
      </main>
    </SeoPageShell>
  );
}

export function LocationDetailPage({
  area,
  relatedLinks = [],
}: {
  area: ServiceAreaContent;
  relatedLinks?: LinkItem[];
}) {
  return (
    <SeoPageShell>
      <main>
        <section className="px-4 pb-10 pt-3 sm:px-6 sm:pb-16 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Breadcrumbs
              items={[
                { label: "Locations", href: "/locations" },
                { label: area.name, href: `/locations/${area.slug}` },
              ]}
            />
            <div className="max-w-[880px]">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                {area.county}
              </div>
              <h1 className="mt-4 text-[38px] font-black leading-[0.96] tracking-[-0.04em] text-[#0B1628] sm:text-[68px] sm:leading-[0.92] sm:tracking-[-0.05em]">
                {area.h1}
              </h1>
              <p className="mt-5 max-w-[720px] text-[15px] font-medium leading-7 text-[#475569] sm:text-[18px] sm:leading-8">
                {area.intro}
              </p>
              <p className="mt-4 max-w-[680px] rounded-[18px] border border-[#D9E4FF] bg-white px-4 py-3 text-[14px] font-bold leading-6 text-[#334155] shadow-sm">
                {area.localNote}
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Local path
              </div>
              <h2 className="mt-3 text-[30px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[46px]">
                What Profixter offers in {area.name}.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[#64748B] sm:text-[16px]">
                Choose the path that matches the job: ongoing Membership, one small handyman visit, or a renovation estimate for larger work.
              </p>
            </div>
            <div className="grid gap-3">
              {area.homeownerPaths.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-[20px] border border-[#DDE5F0] bg-white p-5 text-[14px] font-semibold leading-6 text-[#334155] shadow-[0_16px_46px_rgba(15,23,42,0.045)]"
                >
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16834B]">
                    <CheckIcon />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {relatedLinks.length ? (
          <CardGrid
            eyebrow="Popular paths"
            title={`Useful starting points for ${area.name} homeowners.`}
            items={relatedLinks}
          />
        ) : null}

        <ConversionBand
          title={`Start with the right Profixter path in ${area.name}.`}
          description="Membership is the priority for ongoing home care. Book Handyman is for one listed small task. Renovation Estimate is for larger project work."
        />
      </main>
    </SeoPageShell>
  );
}
