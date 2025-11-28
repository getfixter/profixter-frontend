import Link from 'next/link';

export default function CommunicationConsentPage() {
  return (
    <div className="min-h-screen px-4 py-24 sm:py-32 bg-[#020617] text-white">
      <div
        className="max-w-4xl mx-auto rounded-[20px] p-6 sm:p-8 lg:p-10 backdrop-blur-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(49,50,52,0.6) 0%, rgba(49,50,52,0.5) 50%, rgba(49,50,52,0.5) 100%), rgba(15,23,42,0.9)',
          boxShadow: '0px 0px 80px 0px rgba(0,0,0,0.45)',
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-semibold mb-6 text-center">
          SMS / Call / Email Communication Consent
        </h1>

        <p className="text-xs sm:text-sm text-white/60 text-center mb-8">
          Company: Premium Island Construction Inc., doing business as &quot;Profixter&quot;
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        </p>

        <div className="space-y-6 text-sm sm:text-base text-white/80">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Purpose of Communications</h2>
            <p>
              By providing your mobile phone number, landline number, and email address,
              you authorize us to contact you using SMS/text messages, phone calls, and
              emails for purposes directly related to our services, including:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Scheduling, confirming, or updating appointments and visits.</li>
              <li>
                Sending service reminders, arrival notifications, follow-ups, and
                satisfaction surveys.
              </li>
              <li>
                Providing information about your subscription, billing, and account
                status.
              </li>
              <li>
                Offering relevant service updates, safety notices, and limited promotional
                offers about our own services.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Who May Contact You</h2>
            <p>
              Messages and calls may be sent by Premium Island Construction Inc. and our
              internal brands or entities under common ownership that help deliver the
              Profixter service. We will not sell or license your phone number or email
              address to unaffiliated third parties for their own marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Types of Technology We May Use</h2>
            <p>
              With your consent, we and our service providers may use manual dialing,
              automatic telephone dialing systems (&quot;autodialers&quot;), and
              prerecorded/artificial voice messages to contact the phone numbers you
              provide, and we may use email automation tools to contact the email
              addresses you provide. Message frequency will vary based on your activity
              and account status.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Message &amp; Data Rates</h2>
            <p>
              Standard message and data rates may apply to SMS/text messages and calls,
              depending on your mobile carrier plan. You are responsible for any charges
              imposed by your carrier or service provider. We do not charge a separate fee
              for SMS/text messages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. How to Opt Out</h2>
            <p>
              You can revoke your consent to SMS/text and marketing calls at any time:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                For SMS/text messages: reply <span className="font-semibold">STOP</span>{' '}
                to any message we send. You may also reply{' '}
                <span className="font-semibold">HELP</span> for assistance.
              </li>
              <li>
                For emails: use the unsubscribe link (where provided) or email us at{' '}
                <a href="mailto:my@profixter.com" className="text-[#93c5fd]">
                  my@profixter.com
                </a>
                .
              </li>
              <li>
                For phone calls: tell our team member that you no longer wish to receive
                marketing calls and we will record your preference.
              </li>
            </ul>
            <p className="mt-2">
              Opting out of marketing or reminder communications may limit our ability to
              notify you about appointment changes, delays, or other service updates, but
              we may still contact you where necessary to complete active services or
              comply with law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Your Consent</h2>
            <p>
              By checking the consent box on our sign-up or booking form, you confirm that:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                You are the account holder or authorized user for the phone number(s) and
                email address(es) you provide to us.
              </li>
              <li>
                You expressly agree to receive SMS/text messages, calls (including
                autodialed and prerecorded calls), and emails from us at those numbers and
                addresses for the purposes described above.
              </li>
              <li>
                Your consent is not a condition of purchasing any goods or services, and
                you may receive services even if you later opt out of marketing
                communications.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data Privacy</h2>
            <p>
              We use your contact information only as described in this Communication
              Consent and in our{' '}
              <Link
                href="/terms"
                className="underline underline-offset-2 text-[#93c5fd]"
              >
                Terms &amp; Privacy Policy
              </Link>
              . We do not share your contact information with unaffiliated third parties so
              that they can market their own products directly to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Changes to this Consent</h2>
            <p>
              We may update this Communication Consent from time to time. The latest
              version will be posted on our website. If you continue to use our services
              after changes are posted, you agree to the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Contact</h2>
            <p>
              If you have any questions about this Communication Consent or how your
              contact information is used, please contact us at:
            </p>
            <p className="mt-2">
              Phone: <span className="font-semibold">631-599-1363</span>
              <br />
              Email:{' '}
              <a href="mailto:my@profixter.com" className="text-[#93c5fd]">
                my@profixter.com
              </a>
            </p>
          </section>

          <p className="text-xs text-white/50 mt-8 text-center">
            Last Updated: Oct 4, 2025
          </p>

          <div className="mt-6 text-center">
            <Link
              href="/signup"
              className="text-sm sm:text-base text-[#93c5fd] underline underline-offset-2"
            >
              Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
