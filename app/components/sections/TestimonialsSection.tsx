"use client";

/**
 * TestimonialsSection
 *
 * Displays a collection of customer testimonials to build social proof.  In a
 * production environment you might fetch this data from a CMS or API.  Here
 * we hard code a few examples.  The responsive grid ensures the quotes look
 * good on both mobile and desktop screens.
 */
export default function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah M.",
      location: "Nassau County",
      quote:
        "Profixter has been a game changer. My membership pays for itself after two visits and their team is always on time!",
    },
    {
      name: "James L.",
      location: "Huntington",
      quote:
        "I booked a one‑time service for a leaking sink and ended up signing up for a plan. Highly recommend their professionalism.",
    },
    {
      name: "Lisa R.",
      location: "Babylon",
      quote:
        "We used their general contractor services for our kitchen remodel and couldn’t be happier with the results.",
    },
  ];
  return (
    <section className="py-12 sm:py-16 bg-white px-4 sm:px-6 md:px-8 animate-fadeIn" id="testimonials">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-8">Our Customers Love Us</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="p-6 rounded-2xl bg-[#F3F4F6] shadow hover:shadow-md transition">
              <p className="text-gray-700 italic mb-4">“{t.quote}”</p>
              <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#86EFAC] text-[#0B1220] flex items-center justify-center font-bold mr-3">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}