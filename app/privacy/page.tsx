import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-4 py-24 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-5xl mx-auto rounded-[24px] p-6 sm:p-10 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49,50,52,0.62) 0%, rgba(49,50,52,0.52) 55%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.92)",
          boxShadow: "0px 0px 90px 0px rgba(0,0,0,0.55)",
        }}
      >
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3 text-center tracking-tight">
          Privacy Policy
        </h1>

        <p className="text-sm sm:text-base text-white/65 text-center mb-8 leading-relaxed">
          Effective Date: January 9, 2026 · Company:{" "}
          <span className="font-semibold">Premium Island Homes Inc.</span>, doing business as{" "}
          <span className="font-semibold">“Profixter”</span> and/or{" "}
          <span className="font-semibold">“Mr. Fixter”</span> (“we”, “us”, “our”).
        </p>

        <div className="space-y-8 text-sm sm:text-base text-white/85 leading-relaxed">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">1. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Contact information (name, email, phone number)</li>
              <li>Service address, booking details, service notes</li>
              <li>Payment-related data handled by payment processors (we do not store full card numbers)</li>
              <li>Communications with us (SMS, email, support messages)</li>
              <li>Technical data (IP address, browser/device info, cookies for basic functionality/security)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">2. How We Use Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Provide services, schedule visits, and manage your account</li>
              <li>Send appointment confirmations, reminders, and service updates</li>
              <li>Process payments and prevent fraud</li>
              <li>Customer support and service improvement</li>
              <li>Send marketing messages only if you opt in</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">3. Information Sharing</h2>
            <p>
              We may share limited information with service providers that help us operate (payments, messaging, hosting, analytics)
              under confidentiality obligations, and with contractors/specialists when you approve additional work.
            </p>

            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="font-semibold">
                No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. Information
                sharing to subcontractors in support services, such as customer service is permitted. All other use case categories
                exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">4. Cookies</h2>
            <p>
              We may use cookies and similar technologies for basic site functionality, security, and to understand site usage. You can
              control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">5. Data Security</h2>
            <p>
              We use reasonable safeguards to protect information. No system is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">6. Your Choices</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You can opt out of SMS by replying STOP.</li>
              <li>You can opt out of marketing by using unsubscribe links in emails or contacting us.</li>
              <li>You can request updates or deletion of certain information by contacting us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3">7. Contact</h2>
            <p>
              Phone: <span className="font-semibold">631-599-1363</span>
              <br />
              Email:{" "}
              <a href="mailto:my@profixter.com" className="text-[#93c5fd] underline underline-offset-2">
                my@profixter.com
              </a>
            </p>
          </section>

          <p className="text-xs sm:text-sm text-white/55 mt-10 text-center">
            Last Updated: January 9, 2026
          </p>

          <div className="mt-7 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm sm:text-base text-[#93c5fd] hover:bg-white/10 transition"
            >
              Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
