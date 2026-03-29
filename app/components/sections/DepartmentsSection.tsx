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
      description: "Unlimited visits and priority scheduling for ongoing home maintenance.",
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
    <section className="py-12 sm:py-16 bg-[#F3F4F6] px-4 sm:px-6 md:px-8 animate-fadeIn" id="departments">
      <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-8">
            Our Services
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {departments.map((dept) => (
              <Link
                key={dept.href}
                href={dept.href}
                className="group block p-6 rounded-2xl bg-white shadow hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#86EFAC]"
              >
                <div className="flex flex-col items-center text-center h-full">
                  <div className="w-14 h-14 flex items-center justify-center rounded-full bg-[#E6F8EC] text-2xl text-[#34A853] mb-4">
                    <span>{dept.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-[#34A853]">
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
    </section>
  );
}