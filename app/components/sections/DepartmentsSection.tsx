"use client";

import Link from "next/link";

/**
 * DepartmentsSection
 *
 * Lists the various service offerings Profixter provides.  Each card links
 * to a dedicated page that details the service.  The layout adapts
 * gracefully to mobile screens by stacking the cards and adjusting spacing.
 */
export default function DepartmentsSection() {
  const departments = [
    {
      title: "Subscription Handyman",
      description: "Choose the plan that fits your home, from simple ongoing tasks to larger full-day projects.",
      href: "/services/subscription",
      icon: "📅",
    },
    {
      title: "General Contractor",
      description: "Large renovations, additions and custom projects handled start to finish.",
      href: "/services/general-contractor",
      icon: "🏗️",
    },
    {
      title: "Home Improvement",
      description: "Medium‑sized jobs like painting, flooring and cabinetry done right.",
      href: "/services/home-improvement",
      icon: "🛠️",
    },
    {
      title: "One‑Time Service",
      description: "Need a fix now? Book a single visit at an hourly or daily rate.",
      href: "/on-demand",
      icon: "⏰",
    },
  ];
  return (
    <section className="animate-fadeIn bg-[#eaedfa] px-5 py-10 sm:px-6 sm:py-12 lg:px-5 lg:py-14" id="departments">
      <div className="mx-auto max-w-[1240px]">
        <div className="rounded-[22px] border border-[#C5CBD8] bg-white p-5 shadow-[0_0_160px_rgba(0,0,0,0.06)] sm:p-7 lg:p-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-8">
            Our Services
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-[15px] leading-relaxed text-[#6A6D71] sm:text-[16px]">
            Explore the main ways homeowners work with Profixter.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {departments.map((dept) => (
              <Link
                key={dept.href}
                href={dept.href}
                className="group block rounded-2xl border border-[#E6E8EF] bg-[#F8FAFF] p-6 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#306EEC]"
              >
                <div className="flex flex-col items-center text-center h-full">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl text-[#306EEC]">
                    <span>{dept.icon}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-800 group-hover:text-[#306EEC]">
                    {dept.title}
                  </h3>
                  <p className="text-sm text-gray-600 flex-grow">
                    {dept.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
