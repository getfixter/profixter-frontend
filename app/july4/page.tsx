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
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import CopyCouponButton from "./CopyCouponButton";

const signupHref = "/signup?promo=JULY4";

const planBenefits = [
  "90-minute handyman visits",
  "Request visits as needed",
  "One active appointment at a time",
  "Easy online scheduling",
];

const frustrations = [
  {
    title: "No more contractor chase",
    text: "Skip the calls, unanswered messages, and searching for someone willing to take a small job.",
  },
  {
    title: "Get your weekends back",
    text: "Stop spending Saturday watching repair videos or making another trip to the hardware store.",
  },
  {
    title: "Keep small problems small",
    text: "Handle the loose, leaky, cracked, and unfinished things before they turn into bigger headaches.",
  },
];

const steps = [
  {
    title: "Join online",
    text: "Add your property and choose Profixter Basic. Your JULY4 code comes with you.",
  },
  {
    title: "Tell us what needs attention",
    text: "Schedule a visit through your account-no estimate appointment for everyday handyman tasks.",
  },
  {
    title: "Cross it off your list",
    text: "A local Profixter handyman arrives for your 90-minute visit and gets to work.",
  },
];

const services = [
  "TV & picture mounting",
  "Door adjustments & repairs",
  "Light fixture replacement",
  "Faucet replacement",
  "Small drywall patches",
  "Shelves & curtain rods",
  "Caulking & sealing",
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

const faqs = [
  {
    question: "Is the first month really free?",
    answer:
      "Yes. Promo code JULY4 makes the first month of the Profixter Basic membership $0. A card is required to activate your membership. After the free month, Basic renews at $149 per month unless you cancel before renewal.",
  },
  {
    question: "What is included with the Basic Plan?",
    answer:
      "Basic includes 90-minute handyman visits and one active appointment at a time. It is designed for common small and medium home-maintenance tasks that can be completed within the visit time. Materials and work outside the membership scope may cost extra.",
  },
  {
    question: "Can I really book more than one visit per month?",
    answer:
      "Yes. Members can request visits as needed. Basic includes one active appointment at a time; after that appointment is completed, you can schedule the next visit subject to availability.",
  },
  {
    question: "Do I need to schedule an estimate first?",
    answer:
      "Not for the everyday handyman tasks covered by the membership. You can describe the work and schedule through your account. Larger projects or work outside the membership scope may require a separate evaluation.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. The membership is month-to-month with no long-term contract. Cancel before your next renewal if you do not want the following month charged.",
  },
  {
    question: "Why do you require a credit card for a free month?",
    answer:
      "Your card activates the month-to-month membership through secure Stripe checkout. The first Basic membership charge is $0 with JULY4, then the plan renews at $149 per month unless canceled.",
  },
  {
    question: "What areas does this offer cover?",
    answer:
      "This promotion is for homeowners in Babylon, West Babylon, North Babylon, Lindenhurst, Copiague, Amityville, West Islip, and Islip. Service is subject to route and appointment availability.",
  },
  {
    question: "Does JULY4 work on every plan?",
    answer:
      "No. JULY4 applies to the Profixter Basic Plan only. Other Profixter plans are available separately at their regular prices.",
  },
];

function CTA({
  className = "",
  label = "Start My Free Month",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={signupHref}
      className={`group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#2F6FED] px-7 text-[15px] font-bold text-white shadow-[0_14px_34px_rgba(47,111,237,0.3)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#2459C4] hover:shadow-[0_18px_42px_rgba(47,111,237,0.38)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F6FED] ${className}`}
    >
      {label}
      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = true,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-[760px] text-center" : "max-w-[680px]"}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2F6FED] sm:text-[12px]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-[#101828] sm:text-[42px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-[15px] leading-7 text-[#667085] sm:text-[17px]">{description}</p>
      ) : null}
    </div>
  );
}

export default function July4Page() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F8F9FC] text-[#101828]">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-7 lg:px-8">
          <Link
            href="/"
            aria-label="Profixter home"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <Image
              src="/images/logo-footer.svg"
              alt="Profixter"
              width={160}
              height={42}
              priority
              className="h-auto w-[126px] sm:w-[150px]"
            />
          </Link>
          <a
            href="tel:+16315991363"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-3.5 py-2.5 text-[11px] font-bold text-white backdrop-blur-md transition hover:border-white/45 hover:bg-black/30 sm:px-5 sm:text-[13px]"
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="sm:hidden">Call us</span>
            <span className="hidden sm:inline">631-599-1363</span>
          </a>
        </div>
      </header>

      <section className="relative bg-[#08111F] pb-10 pt-24 text-white sm:pb-16 sm:pt-32 lg:min-h-[780px] lg:py-32">
        <Image
          src="/images/hero-bg.webp"
          alt="A handyman taking care of a light fixture in a comfortable home"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,20,0.34)_0%,rgba(4,10,20,0.82)_49%,#08111F_100%)] lg:bg-[linear-gradient(90deg,rgba(4,10,20,0.97)_0%,rgba(4,10,20,0.9)_42%,rgba(4,10,20,0.3)_73%,rgba(4,10,20,0.16)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(246,184,75,0.16),transparent_34%)]" />

        <div className="relative z-10 mx-auto grid w-full max-w-[1240px] gap-9 px-5 sm:px-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:gap-16 lg:px-8">
          <div className="max-w-[700px] pt-[38vh] sm:pt-[32vh] lg:pt-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD98F]/30 bg-[#F59E0B]/15 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#FFE8B6] backdrop-blur-md sm:text-[12px]">
              <MapPinIcon className="h-4 w-4" />
              Local help for Babylon-area homeowners
            </div>

            <h1 className="mt-5 max-w-[690px] text-[42px] font-bold leading-[1.01] tracking-[-0.045em] sm:text-[62px] lg:text-[68px]">
              One less thing to worry about at home.
            </h1>
            <p className="mt-5 max-w-[640px] text-[16px] leading-7 text-white/78 sm:text-[19px] sm:leading-8">
              Stop chasing contractors for every loose door, leaky faucet, or project that has waited too long.
              Profixter gives you one reliable local team for the jobs that keep piling up.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CTA className="w-full sm:w-auto" />
              <a
                href="#how-it-works"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 text-[14px] font-bold text-white backdrop-blur-md transition hover:bg-white/15"
              >
                See How It Works
              </a>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-[12px] font-semibold text-white/66 sm:text-[13px]">
              <span className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-[#86EFAC]" />
                Licensed & insured
              </span>
              <span className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-[#86EFAC]" />
                No long-term contract
              </span>
              <span className="flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-[#86EFAC]" />
                Based in Babylon
              </span>
            </div>
          </div>

          <aside className="rounded-[26px] border border-white/15 bg-white/[0.1] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-6 lg:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9DB9FF]">
                  JULY4 offer
                </p>
                <h2 className="mt-2 text-2xl font-bold">Try Basic for $0</h2>
              </div>
              <span className="rounded-full bg-[#DCFCE7] px-3 py-1.5 text-[11px] font-extrabold text-[#166534]">
                First month free
              </span>
            </div>

            <ul className="mt-6 space-y-3.5">
              {planBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-[14px] font-semibold text-white/82">
                  <CheckCircleIcon className="h-5 w-5 flex-none text-[#86EFAC]" />
                  {benefit}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-[18px] bg-black/20 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/48">Today</p>
                  <p className="mt-1 text-3xl font-bold">$0</p>
                </div>
                <p className="pb-1 text-right text-[12px] font-semibold leading-5 text-white/58">
                  Then $149/month
                  <br />
                  Cancel anytime
                </p>
              </div>
            </div>

            <CTA className="mt-5 w-full" label="Claim My Free Month" />
            <p className="mt-3 text-center text-[10px] font-semibold leading-4 text-white/48">
              Basic Plan only. Card required. Renews at $149/month unless canceled before renewal.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-b border-[#E4E7EC] bg-white px-5 py-5 sm:px-7 lg:px-8">
        <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Local", "Babylon-based company"],
            ["Protected", "Licensed HI-71484"],
            ["Responsible", "Fully insured"],
            ["Flexible", "Month-to-month"],
          ].map(([title, text]) => (
            <div key={title} className="text-center sm:border-l sm:border-[#E4E7EC] sm:first:border-l-0">
              <p className="text-[12px] font-extrabold text-[#101828] sm:text-[13px]">{title}</p>
              <p className="mt-1 text-[10px] font-medium text-[#667085] sm:text-[11px]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <SectionHeading
            eyebrow="The home list never really ends"
            title="You should not need a new search every time something breaks."
            description="Small repairs are easy to postpone and strangely hard to hire for. Profixter replaces that recurring hassle with one dependable way to get help."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {frustrations.map((item, index) => {
              const icons = [PhoneIcon, CalendarDaysIcon, ShieldCheckIcon];
              const Icon = icons[index];
              return (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-[#E4E7EC] bg-white p-6 shadow-[0_14px_45px_rgba(16,24,40,0.05)] sm:p-7"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#2F6FED]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-[18px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-[#667085]">{item.text}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-8 rounded-[24px] bg-[#101828] px-6 py-7 text-center text-white sm:px-10 sm:py-9">
            <p className="text-[21px] font-bold leading-8 tracking-[-0.02em] sm:text-[27px]">
              The real benefit is not “a handyman visit.”
              <span className="text-[#9DB9FF]"> It is knowing who to call.</span>
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-[#E4E7EC] bg-white px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <SectionHeading
            eyebrow="Simple by design"
            title="From “we need to fix that” to handled."
            description="No repeated search. No waiting around for callbacks. No separate estimate visit for ordinary membership tasks."
          />

          <ol className="mt-11 grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative rounded-[24px] border border-[#E4E7EC] bg-[#F9FAFB] p-6 sm:p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2F6FED] text-sm font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-[18px] font-bold">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#667085]">{step.text}</p>
                {index < steps.length - 1 ? (
                  <ArrowRightIcon className="absolute -right-7 top-1/2 z-10 hidden h-5 w-5 text-[#98A2B3] lg:block" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#EEF3FF] px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1120px] items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <SectionHeading
              centered={false}
              eyebrow="Built for the everyday jobs"
              title="Finally take care of the things that keep getting pushed to next weekend."
              description="If it is a common handyman task that fits within your visit, there is a good chance Profixter can help."
            />
            <div className="mt-8 grid grid-cols-2 gap-3">
              {services.map((service, index) => (
                <div
                  key={service}
                  className="flex min-h-[76px] items-center gap-3 rounded-[18px] border border-[#D7E2FC] bg-white px-4 py-3 text-[12px] font-bold shadow-[0_8px_24px_rgba(47,111,237,0.05)] sm:text-[14px]"
                >
                  {index % 2 === 0 ? (
                    <HomeModernIcon className="h-5 w-5 flex-none text-[#2F6FED]" />
                  ) : (
                    <WrenchScrewdriverIcon className="h-5 w-5 flex-none text-[#2F6FED]" />
                  )}
                  {service}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-5 text-[#667085]">
              Larger projects, major electrical or plumbing work, and work exceeding visit time are outside standard
              membership visits. Materials may cost extra.
            </p>
          </div>

          <aside className="rounded-[28px] border-2 border-[#2F6FED] bg-white p-6 shadow-[0_24px_70px_rgba(47,111,237,0.15)] sm:p-8 lg:sticky lg:top-6">
            <div className="text-center">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#2F6FED]">
                Profixter Basic
              </p>
              <p className="mt-4 text-[18px] font-extrabold uppercase tracking-[0.08em] text-[#166534]">
                First month
              </p>
              <div className="mt-1 flex items-end justify-center gap-3">
                <span className="text-[62px] font-bold leading-none tracking-[-0.06em] text-[#101828] sm:text-[72px]">
                  FREE
                </span>
                <span className="mb-1.5 rounded-full bg-[#DCFCE7] px-3 py-1.5 text-[13px] font-extrabold text-[#166534]">
                  $0
                </span>
              </div>
              <div className="mx-auto mt-5 flex max-w-[330px] items-center justify-between gap-3 rounded-[18px] border border-[#C9D7FA] bg-[#F2F6FF] p-2 pl-4 text-left">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">Coupon code</p>
                  <p className="mt-0.5 text-[18px] font-extrabold tracking-[0.12em] text-[#2F6FED]">JULY4</p>
                </div>
                <CopyCouponButton />
              </div>
            </div>

            <CTA className="mt-6 w-full" />

            <div className="mt-4 rounded-[14px] bg-[#F8F9FC] px-4 py-3 text-center">
              <p className="text-[11px] font-semibold leading-5 text-[#667085]">
                Basic renews at <span className="font-bold text-[#344054]">$149/month</span> unless canceled before
                renewal.
              </p>
            </div>

            <ul className="mt-6 space-y-4 border-t border-[#E4E7EC] pt-6">
              {planBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-[14px] font-semibold text-[#344054]">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#EAF8EE] text-[#15803D]">
                    <CheckCircleIcon className="h-4 w-4" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-[#667085]">
              <CreditCardIcon className="h-4 w-4" />
              Secure Stripe checkout · Card required
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <SectionHeading
            eyebrow="A better default"
            title="Trade the handyman hunt for one trusted solution."
          />

          <div className="mt-10 overflow-hidden rounded-[26px] border border-[#E4E7EC]">
            <div className="grid grid-cols-2 bg-[#101828] text-white">
              <div className="p-4 text-center text-[13px] font-bold sm:p-5 sm:text-[16px]">The usual way</div>
              <div className="border-l border-white/15 bg-[#17325E] p-4 text-center text-[13px] font-bold sm:p-5 sm:text-[16px]">
                With Profixter
              </div>
            </div>
            {[
              ["Search for someone each time", "One local team to contact"],
              ["Wait and hope for a callback", "Schedule through your account"],
              ["Small jobs get deprioritized", "Membership built for everyday tasks"],
              ["Give up another weekend", "Get the list moving"],
              ["Wonder what happens next", "Clear plan and monthly price"],
            ].map(([without, withProfixter]) => (
              <div key={without} className="grid grid-cols-2 border-t border-[#E4E7EC] bg-white">
                <div className="flex items-start gap-2 p-4 text-[12px] font-semibold leading-5 text-[#667085] sm:items-center sm:p-5 sm:text-[14px]">
                  <XMarkIcon className="mt-0.5 h-4 w-4 flex-none text-[#D92D20] sm:mt-0" />
                  {without}
                </div>
                <div className="flex items-start gap-2 border-l border-[#E4E7EC] bg-[#F7FAFF] p-4 text-[12px] font-bold leading-5 text-[#344054] sm:items-center sm:p-5 sm:text-[14px]">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-[#15803D] sm:mt-0" />
                  {withProfixter}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0A1424] px-5 py-16 text-white sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1080px] items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="relative mx-auto w-full max-w-[390px]">
            <div className="absolute -inset-3 rounded-[32px] bg-[#2F6FED]/25 blur-2xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-[#14233A] lg:aspect-[4/5]">
              <Image
                src="/images/Taras.png"
                alt="Taras, founder of Profixter"
                fill
                loading="eager"
                sizes="(max-width: 1024px) 390px, 35vw"
                className="object-cover object-[center_20%] lg:object-top"
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#9DB9FF] sm:text-[12px]">
              Local means accountable
            </p>
            <h2 className="mt-3 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">
              Built here, for the way local homeowners actually need help.
            </h2>
            <p className="mt-6 text-[16px] leading-8 text-white/72 sm:text-[18px]">
              I&apos;m Taras, founder of Profixter. I started this company because getting a small home repair handled
              should not require days of searching, chasing, and rearranging your schedule. Profixter gives our
              neighbors one reliable place to turn when the home list starts growing.
            </p>
            <p className="mt-5 text-[16px] font-bold leading-7 text-white">
              We are not a lead marketplace. We are a local service company with a name, a license, and a reputation to
              stand behind.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {["Based in Babylon", "Licensed HI-71484", "Fully insured", "631-599-1363"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-[11px] font-bold text-white/72 sm:text-[12px]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F8F9FC] px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px]">
          <SectionHeading
            eyebrow="Your neighborhood is our service area"
            title="Local help for Babylon and nearby communities."
            description="Keeping the service area focused helps us provide a more dependable experience for local members."
          />
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {serviceAreas.map((area) => (
              <div
                key={area}
                className="flex min-h-20 items-center justify-center gap-2 rounded-[18px] border border-[#DCE3EF] bg-white px-3 text-center text-[12px] font-bold shadow-[0_8px_24px_rgba(16,24,40,0.04)] sm:text-[14px]"
              >
                <MapPinIcon className="h-4 w-4 flex-none text-[#2F6FED]" />
                {area}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#E4E7EC] bg-white px-5 py-16 sm:px-7 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[820px]">
          <SectionHeading
            eyebrow="Straight answers"
            title="Know exactly what you are starting."
            description="A clear offer earns more trust than fine print. Here are the questions homeowners ask most."
          />

          <div className="mt-9 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-[18px] border border-[#E1E5ED] bg-[#FCFCFD] shadow-[0_8px_28px_rgba(15,23,42,0.025)] open:border-[#B9CBF8] open:bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 text-[14px] font-bold marker:content-none sm:px-6 sm:text-[16px]">
                  {faq.question}
                  <ChevronDownIcon className="h-5 w-5 flex-none text-[#667085] transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-[13px] leading-7 text-[#667085] sm:px-6 sm:pb-6 sm:text-[15px]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#07111F] px-5 py-16 text-center text-white sm:px-7 sm:py-24 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(47,111,237,0.34),transparent_48%)]" />
        <div className="relative mx-auto max-w-[780px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#FFD98F]/25 bg-[#F59E0B]/12 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#FFE8B6] sm:text-[11px]">
            <SparklesIcon className="h-4 w-4" />
            JULY4 · Basic first month free
          </span>
          <h2 className="mt-5 text-[34px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[52px]">
            Your home will keep making a list. You do not have to handle it alone.
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-[15px] leading-7 text-white/68 sm:text-[17px]">
            Try Profixter Basic for one month at $0 and see what it feels like to finally have a reliable answer for the
            small jobs around your home.
          </p>
          <CTA className="mt-8 w-full sm:w-auto" label="Get One Less Thing to Worry About" />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-white/48 sm:text-[12px]">
            <span>First month $0</span>
            <span aria-hidden="true">•</span>
            <span>Then $149/month</span>
            <span aria-hidden="true">•</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </section>

      <footer className="bg-[#050B14] px-5 pb-28 pt-8 text-white sm:px-7 sm:pb-8 lg:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-5 sm:flex-row">
          <Link href="/">
            <Image
              src="/images/logo-footer.svg"
              alt="Profixter"
              width={135}
              height={36}
              className="h-auto w-[125px]"
            />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-5 text-[12px] font-semibold text-white/45">
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <a href="tel:+16315991363" className="transition hover:text-white">
              631-599-1363
            </a>
          </div>
          <p className="text-[11px] text-white/30">© 2026 Profixter</p>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DDE3EE] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+9px)] pt-2.5 shadow-[0_-12px_35px_rgba(15,23,42,0.12)] backdrop-blur-lg sm:hidden">
        <CTA className="min-h-12 w-full" label="Start My Free Month" />
        <p className="mt-1.5 text-center text-[9px] font-bold text-[#667085]">
          Basic only · First month $0 · Then $149/mo · Cancel anytime
        </p>
      </div>
    </main>
  );
}
