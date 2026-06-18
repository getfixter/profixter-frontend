import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  HomeModernIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const signupHref = "/signup?promo=JULY4";

const steps = [
  {
    title: "Create your account",
    text: "Tell us who you are and where you need service.",
  },
  {
    title: "Select the Basic Plan",
    text: "The JULY4 offer is exclusively for Profixter Basic.",
  },
  {
    title: "JULY4 is applied",
    text: "We carry the promo code into your secure checkout.",
  },
  {
    title: "Book your first visit",
    text: "Once activated, schedule service through your account.",
  },
];

const services = [
  "TV mounting",
  "Door repairs",
  "Light fixtures",
  "Faucet replacements",
  "Drywall patches",
  "Shelving installation",
  "Caulking and sealing",
  "General home maintenance",
];

const serviceAreas = [
  "Babylon",
  "West Babylon",
  "North Babylon",
  "Lindenhurst",
  "Copiague",
  "Amityville",
  "West Islip",
  "Islip",
];

const comparison = {
  without: [
    "Finding contractors",
    "Waiting for callbacks",
    "Paying minimum service charges",
  ],
  with: [
    "Simple membership",
    "Easy online scheduling",
    "Trusted local handyman service",
  ],
};

const upgradePlans = [
  { name: "Plus", price: 249 },
  { name: "Premium", price: 349 },
  { name: "Elite", price: 499 },
];

const faqs = [
  {
    question: "Is the first month really free?",
    answer:
      "Yes. Promo code JULY4 makes your first month of the Profixter Basic Plan $0. Normal Basic Plan rules, appointment availability, and charges for items outside the membership still apply.",
  },
  {
    question: "Does the JULY4 promotion apply to all plans?",
    answer:
      "No. The JULY4 promotion applies to the Profixter Basic Plan only. Plus, Premium, and Elite are available separately at their regular prices.",
  },
  {
    question: "Why are you offering a free month?",
    answer:
      "We want local homeowners to experience Profixter before deciding if a membership is right for them.",
  },
  {
    question: "Do I need a credit card?",
    answer:
      "Yes. A card is required when you activate the Basic Plan through our secure Stripe checkout, even though JULY4 makes the first month’s membership charge $0.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Profixter memberships are month-to-month with no long-term contract. You can manage your membership from your account. Cancel before your next renewal if you do not want the following month charged.",
  },
  {
    question: "What areas do you serve?",
    answer:
      "This promotion is for homeowners in Babylon, West Babylon, North Babylon, Lindenhurst, Copiague, Amityville, West Islip, and Islip. Service is subject to route and appointment availability.",
  },
  {
    question: "What kind of work is included?",
    answer:
      "Basic Plan visits cover common handyman repairs and home-maintenance tasks such as mounting, fixture replacements, small patches, caulking, shelving, and door repairs. Visit length, materials, project scope, and exclusions follow the Basic Plan rules.",
  },
  {
    question: "What happens after the first month?",
    answer:
      "After the free first month, the Basic Plan continues at $149 per month unless you cancel before renewal. You may choose a different plan separately at its regular price.",
  },
];

function CTA({
  className = "",
  label = "Start Free Basic Plan",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={signupHref}
      className={`group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#306EEC] px-7 text-[15px] font-bold text-white shadow-[0_16px_40px_rgba(48,110,236,0.32)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#2558C9] hover:shadow-[0_20px_46px_rgba(48,110,236,0.4)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#306EEC] ${className}`}
    >
      {label}
      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default function July4Page() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F8FC] text-[#111827]">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-7 lg:px-8">
          <Link href="/" aria-label="Profixter home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <Image
              src="/images/logo-footer.svg"
              alt="Profixter"
              width={160}
              height={42}
              priority
              className="h-auto w-[126px] sm:w-[150px]"
            />
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/25 bg-black/20 px-3.5 py-2.5 text-[11px] font-bold text-white backdrop-blur-md transition hover:border-white/45 hover:bg-black/30 sm:px-5 sm:text-[13px]"
          >
            Main Website
          </Link>
        </div>
      </header>

      <section className="relative flex min-h-[720px] items-end bg-[#07111F] pb-10 pt-24 sm:min-h-[800px] sm:items-center sm:pb-16 lg:min-h-[780px]">
        <Image
          src="/images/hero-bg.webp"
          alt="A Profixter handyman servicing a light fixture in a Long Island home"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[64%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,20,0.35)_0%,rgba(4,10,20,0.15)_28%,rgba(4,10,20,0.88)_82%,#07111F_100%)] sm:bg-[linear-gradient(90deg,rgba(4,10,20,0.94)_0%,rgba(4,10,20,0.76)_44%,rgba(4,10,20,0.16)_78%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_34%,rgba(255,190,80,0.12),transparent_32%)]" />

        <div className="relative z-10 mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-8">
          <div className="max-w-[680px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFD78A]/30 bg-[#F59E0B]/15 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#FFE4A8] backdrop-blur-md sm:mb-5 sm:text-[12px]">
              <SparklesIcon className="h-4 w-4" />
              Babylon-area offer · Code JULY4
            </div>

            <h1 className="max-w-[650px] text-[39px] font-bold leading-[1.04] tracking-[-0.04em] text-white sm:text-[58px] lg:text-[68px]">
              Get your first month of Profixter Basic FREE
            </h1>
            <p className="mt-4 max-w-[620px] text-[15px] leading-6 text-white/78 sm:mt-5 sm:text-[19px] sm:leading-8">
              Homeowners in Babylon and nearby communities can try our local handyman membership with promo code
              JULY4. Your first month of the Basic Plan is $0, then $149/month unless you cancel before renewal.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
              <CTA className="w-full sm:w-auto" />
              <Link
                href="/"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 text-[14px] font-bold text-white backdrop-blur-md transition hover:bg-white/18 sm:w-auto"
              >
                View Main Website
              </Link>
            </div>

            <p className="mt-3 text-center text-[11px] font-semibold text-white/55 sm:text-left sm:text-[12px]">
              JULY4 promotion applies to the Basic Plan only. Upgrade options are available separately.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-semibold text-white/68 sm:mt-7 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-3 sm:text-[13px]">
              <span className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-[#86EFAC]" />
                <span>No setup fee</span>
              </span>
              <span className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-[#86EFAC]" />
                <span>Month-to-month</span>
              </span>
              <span className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-[#86EFAC]" />
                <span>Local service</span>
              </span>
            </div>
            <p className="mt-3 text-[11px] font-semibold text-white/45 sm:text-[12px]">
              Based in Babylon and serving Long Island homeowners. · Licensed HI-71484 · Fully insured
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E5E7EB] bg-white px-5 py-12 sm:px-7 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <div className="mx-auto mb-14 grid max-w-[900px] gap-3 rounded-[24px] border border-[#DCE5FA] bg-[#F6F8FF] p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:grid-cols-3 sm:p-5">
            <div className="rounded-[17px] bg-white p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">First month</p>
              <p className="mt-1 text-xl font-bold text-[#166534]">Basic Plan: $0</p>
            </div>
            <div className="rounded-[17px] bg-white p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">At signup</p>
              <p className="mt-1 flex items-center gap-2 text-[15px] font-bold">
                <CreditCardIcon className="h-5 w-5 text-[#306EEC]" />
                Card required
              </p>
            </div>
            <div className="rounded-[17px] bg-white p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">After month one</p>
              <p className="mt-1 text-[15px] font-bold">Basic renews at $149/mo</p>
              <p className="mt-1 text-[11px] text-[#667085]">Unless you cancel before renewal</p>
            </div>
          </div>

          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#306EEC]">Simple from day one</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">How your free month works</h2>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="group relative rounded-[22px] border border-[#E5E7EB] bg-[#FAFBFF] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#C8D7FF] hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EFFF] text-sm font-extrabold text-[#306EEC]">
                  {index + 1}
                </span>
                <p className="mt-5 text-[16px] font-bold leading-6">{step.title}</p>
                <p className="mt-2 text-[13px] leading-5 text-[#667085]">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#EEF3FF] px-5 py-14 sm:px-7 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#306EEC]">Local service area</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Proudly Serving Babylon and Surrounding Communities
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#667085]">
              Based in Babylon and serving Long Island homeowners.
            </p>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {serviceAreas.map((area) => (
              <div
                key={area}
                className="flex min-h-20 items-center justify-center gap-2 rounded-[18px] border border-[#D7E2FC] bg-white px-3 text-center text-[14px] font-bold shadow-[0_8px_24px_rgba(48,110,236,0.06)] sm:text-[15px]"
              >
                <MapPinIcon className="h-4 w-4 flex-none text-[#306EEC]" />
                {area}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-[650px]">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#306EEC]">One trusted team</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Help with the jobs that keep piling up</h2>
            </div>
            <p className="max-w-[350px] text-[15px] leading-6 text-[#667085]">
              Schedule everyday repairs and maintenance without starting a new handyman search every time.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {services.map((service, index) => (
              <article
                key={service}
                className="rounded-[20px] border border-[#E2E6EE] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:border-[#B8CCFF] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#306EEC]">
                  {index % 3 === 0 ? (
                    <HomeModernIcon className="h-5 w-5" />
                  ) : index % 3 === 1 ? (
                    <WrenchScrewdriverIcon className="h-5 w-5" />
                  ) : (
                    <CheckCircleIcon className="h-5 w-5" />
                  )}
                </div>
                <h3 className="mt-4 text-[14px] font-bold leading-5 sm:text-[15px]">{service}</h3>
              </article>
            ))}
          </div>

          <p className="mt-7 text-center text-[13px] leading-6 text-[#667085]">
            Visits are subject to normal Profixter membership rules and availability.
          </p>
        </div>
      </section>

      <section className="border-y border-[#E5E7EB] bg-white px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <div className="mx-auto max-w-[700px] text-center">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#306EEC]">A simpler way to get help</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Less chasing. More getting things done.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-[24px] border border-[#F1D4D4] bg-[#FFF8F8] p-6 sm:p-8">
              <h3 className="text-xl font-bold text-[#7F1D1D]">Without Profixter</h3>
              <ul className="mt-6 space-y-4">
                {comparison.without.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[15px] font-semibold text-[#667085]">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#FEE2E2] text-[#B91C1C]">
                      <XMarkIcon className="h-4 w-4" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-[24px] border border-[#BFE5CB] bg-[#F4FBF6] p-6 shadow-[0_16px_45px_rgba(22,101,52,0.06)] sm:p-8">
              <h3 className="text-xl font-bold text-[#166534]">With Profixter</h3>
              <ul className="mt-6 space-y-4">
                {comparison.with.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[15px] font-semibold text-[#344054]">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                      <CheckCircleIcon className="h-4 w-4" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[#0A1424] px-5 py-16 text-white sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1080px] items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="relative mx-auto w-full max-w-[390px]">
            <div className="absolute -inset-3 rounded-[32px] bg-[#306EEC]/25 blur-2xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-[#14233A] lg:aspect-[4/5]">
              <Image
                src="/images/Taras.png"
                alt="Taras, founder of Profixter"
                fill
                sizes="(max-width: 1024px) 390px, 35vw"
                className="object-cover object-[center_20%] lg:object-top"
              />
            </div>
          </div>
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#86A9FF]">Local and accountable</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              A local service built for homeowners
            </h2>
            <p className="mt-6 text-[16px] leading-8 text-white/72 sm:text-[18px]">
              My name is Taras, founder of Profixter. I created this service to make small home repairs easier for local
              homeowners in Babylon and surrounding communities. Instead of searching for a handyman every time
              something breaks, members can schedule help through one simple membership.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {["Based in Babylon", "Licensed HI-71484", "Fully insured"].map((item) => (
                <span key={item} className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-[12px] font-bold text-white/70">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#306EEC]">
              <CalendarDaysIcon className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">See the price before you start</h2>
            <p className="mt-4 text-[16px] leading-7 text-[#667085]">
              JULY4 makes your first month of the Profixter Basic Plan $0. Basic renews at $149 per month after the
              free month unless you cancel before renewal.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-[700px] rounded-[28px] border-2 border-[#306EEC] bg-[#F5F7FF] p-6 shadow-[0_22px_60px_rgba(48,110,236,0.14)] sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#306EEC]">JULY4 eligible plan</p>
                <h3 className="mt-2 text-2xl font-bold">Profixter Basic</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#667085]">Ongoing handyman help, one visit at a time.</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[13px] font-bold text-[#166534]">First month FREE</p>
                <p className="mt-1 text-4xl font-bold tracking-[-0.04em]">
                  $149<span className="text-[13px] font-semibold text-[#667085]">/mo after</span>
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-[#D8E1F7] pt-5">
              <p className="text-[13px] font-semibold leading-6 text-[#475467]">
                JULY4 promotion applies to the Basic Plan only. Upgrade options are available separately.
              </p>
            </div>
          </div>

          <div className="mx-auto mt-5 max-w-[700px] rounded-[20px] border border-[#E5E7EB] bg-[#FAFAFB] p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#667085]">Other plans available separately</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-[#475467]">
              {upgradePlans.map((plan) => (
                <span key={plan.name}>
                  {plan.name} ${plan.price}/mo
                </span>
              ))}
            </div>
          </div>

          <div className="mt-9 text-center">
            <CTA />
            <p className="mt-3 text-[12px] font-semibold text-[#667085]">
              Code JULY4 is saved when you start from this page and applies to Basic only.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E5E7EB] bg-[#F7F8FC] px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[820px]">
          <div className="text-center">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#306EEC]">Questions, answered</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Before you get started</h2>
          </div>

          <div className="mt-9 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-[18px] border border-[#E1E5ED] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.035)] open:border-[#BED0FF]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 text-[15px] font-bold marker:content-none sm:px-6 sm:text-[16px]">
                  {faq.question}
                  <ChevronDownIcon className="h-5 w-5 flex-none text-[#667085] transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-[14px] leading-7 text-[#667085] sm:px-6 sm:pb-6 sm:text-[15px]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#07111F] px-5 py-16 text-center text-white sm:px-7 sm:py-24 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(48,110,236,0.32),transparent_46%)]" />
        <div className="relative mx-auto max-w-[760px]">
          <span className="inline-flex rounded-full border border-[#FFD78A]/25 bg-[#F59E0B]/12 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FFE4A8]">
            Basic Plan · First month free
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-[-0.03em] sm:text-5xl">Ready to try Profixter Basic free?</h2>
          <p className="mx-auto mt-4 max-w-[580px] text-[15px] leading-7 text-white/65 sm:text-[17px]">
            Create an account, select the Basic Plan, and confirm the JULY4 discount in secure checkout before you activate.
          </p>
          <CTA className="mt-8 w-full sm:w-auto" />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] font-semibold text-white/45">
            <span>Basic first month $0</span>
            <span>•</span>
            <span>No long-term contract</span>
            <span>•</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </section>

      <footer className="bg-[#050B14] px-5 pb-28 pt-8 text-white sm:px-7 sm:pb-8 lg:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-5 sm:flex-row">
          <Link href="/">
            <Image src="/images/logo-footer.svg" alt="Profixter" width={135} height={36} className="h-auto w-[125px]" />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-5 text-[12px] font-semibold text-white/45">
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <a href="tel:+16315991363" className="transition hover:text-white">631-599-1363</a>
          </div>
          <p className="text-[11px] text-white/30">© 2026 Profixter</p>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DDE3EE] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 shadow-[0_-12px_35px_rgba(15,23,42,0.12)] backdrop-blur-lg sm:hidden">
        <CTA className="min-h-12 w-full" label="Start Free Basic Plan" />
        <p className="mt-1.5 text-center text-[10px] font-bold text-[#667085]">
          JULY4 applies to Basic only · Then $149/mo
        </p>
      </div>
    </main>
  );
}
