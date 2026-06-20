"use client";

/**
 * ValuePropsSection
 *
 * Highlights the core benefits of Profixter's service and shows a simple
 * cost comparison between subscribing and paying per visit.  The section
 * uses a responsive grid to present icons and text on small and large screens.
 */
export default function ValuePropsSection() {
  return (
    <section className="py-12 sm:py-16 bg-white px-4 sm:px-6 md:px-8 animate-fadeIn" id="value-props">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-8">
          Why Choose Profixter?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E6F8EC] text-[#34A853] flex items-center justify-center mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Predictable Pricing</h3>
            <p className="text-sm text-gray-600">Clear monthly plans make it obvious how many 90-minute visits and support options you get.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E6F8EC] text-[#34A853] flex items-center justify-center mb-3">
              <span className="text-2xl">🛠️</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Professional Handymen</h3>
            <p className="text-sm text-gray-600">Licensed and vetted pros handle your repairs, maintenance and small projects.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E6F8EC] text-[#34A853] flex items-center justify-center mb-3">
              <span className="text-2xl">⏱️</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Fast Scheduling</h3>
            <p className="text-sm text-gray-600">Book appointments online 24/7. Eligible plans include Rush Visits when you need help sooner.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E6F8EC] text-[#34A853] flex items-center justify-center mb-3">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Local & Friendly</h3>
            <p className="text-sm text-gray-600">We are a Long Island team dedicated to keeping your home in perfect shape year‑round.</p>
          </div>
        </div>
        {/* Cost comparison */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2 font-bold bg-gray-50 border-b border-gray-200">Service</th>
                <th className="px-4 py-2 font-bold bg-gray-50 border-b border-gray-200">Non‑Subscriber</th>
                <th className="px-4 py-2 font-bold bg-gray-50 border-b border-gray-200">Subscriber</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2 border-b border-gray-200">Hourly Rate</td>
                {/* Cross out the old price and show the spring discount */}
                <td className="px-4 py-2 border-b border-gray-200">
                  
                  $149/hour
                </td>
                <td className="px-4 py-2 border-b border-gray-200">
                  
                  $99/hour
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 border-b border-gray-200">Full Day Rate</td>
                <td className="px-4 py-2 border-b border-gray-200">
                  
                  $499/day
                </td>
                <td className="px-4 py-2 border-b border-gray-200">Included in elite plan*</td>
              </tr>
              <tr>
                <td className="px-4 py-2 border-b border-gray-200">Rush Visit</td>
                <td className="px-4 py-2 border-b border-gray-200">$300+/visit</td>
                <td className="px-4 py-2 border-b border-gray-200">Included with Premium and Elite</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 border-b border-gray-200">Visits per Month</td>
                <td className="px-4 py-2 border-b border-gray-200">Pay per visit</td>
                <td className="px-4 py-2 border-b border-gray-200">Basic: 2/month, Plus: 4/month, Elite: unlimited by schedule</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">*Full day service may require additional materials or fees depending on project scope.</p>
        </div>
      </div>
    </section>
  );
}
