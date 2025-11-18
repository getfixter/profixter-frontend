import Image from 'next/image';

export default function StepsSection() {
  return (
    <section className="w-full bg-white h-full py-12 sm:py-16 lg:py-20 flex items-center justify-center mb-16 sm:mb-32 lg:mb-75">
      <div className="container mx-auto px-[20px] max-w-[1240px]">
        <div className="relative w-full lg:w-[1240px] mx-auto">
          {/* Decorative text - left */}
          <div className="hidden lg:block absolute top-0 left-0 md:-left-8 text-base text-[#6a6c71] leading-[19px]">
            A clean process for a cozy life.
          </div>

          {/* Main Heading */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-3xl sm:text-5xl lg:text-[64px] font-bold leading-tight sm:leading-[48px] lg:leading-[89%] text-[#313234] lg:mr-15 tracking-[-0.05em]">
              <span className="text-[#313234]">JUST </span>
              <span className="text-[#306eec]">3</span>
              <span className="text-[#313234]"> STEPS</span>
            </h2>
            <h2 className="text-3xl sm:text-5xl lg:text-[64px] font-bold leading-tight sm:leading-[48px] lg:leading-[89%] text-[#313234] -mt-1 lg:ml-15 tracking-[-0.05em]">
              TO GET <span className="text-[#306eec]">HELP</span>
            </h2>
          </div>

          {/* Decorative text - right */}
          <div className="hidden lg:block absolute top-0 right-0 text-base text-[#6a6c71] leading-[19px]">
            Try your first week for free — 7 days on us!
          </div>

          {/* Steps Container with SVG Path */}
          <div className="relative mt-12 sm:mt-20 lg:mt-18">
            {/* SVG Wave Line from images - Desktop only */}
            <div 
              className="hidden lg:block absolute pointer-events-none" 
              style={{ 
                left: '0',
                width: '1200px',
                height: '250px',
              }}
            >
              <img
                src="/images/icons/line.svg"
                alt=""
                className="w-full min-h-full"
                style={{ filter: 'drop-shadow(0px 29px 20px rgba(0, 0, 0, 0.25))' }}
              />
            </div>

            {/* Mobile & Tablet: Vertical Stack */}
            <div className="lg:hidden flex flex-col gap-12 sm:gap-16">
              {/* Step 01 - Mobile */}
              <div className="text-center sm:text-left">
                <div className="relative inline-block mb-6">
                  <div className="text-7xl sm:text-8xl font-bold leading-none bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                    01
                  </div>
                  <div className="hidden sm:block absolute -bottom-2 left-1/2 sm:left-8 -translate-x-1/2 sm:translate-x-0 w-4 h-4 bg-[#306eec] rounded-full"></div>
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-[#313234] leading-tight mb-3">
                  Choose your perfect plan
                </h3>
                <p className="text-sm sm:text-base text-[#6a6c71] leading-relaxed max-w-md mx-auto sm:mx-0">
                  Pick the option that fits you best. With a plan, you save up to 50% on every visit and get priority support.
                </p>
              </div>

              {/* Step 02 - Mobile */}
              <div className="text-center sm:text-left">
                <div className="relative inline-block mb-6">
                  <div className="text-7xl sm:text-8xl font-bold leading-none bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                    02
                  </div>
                  <div className="hidden sm:block absolute -bottom-2 left-1/2 sm:left-8 -translate-x-1/2 sm:translate-x-0 w-4 h-4 bg-[#306eec] rounded-full"></div>
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-[#313234] leading-tight mb-3">
                  Add your address and time
                </h3>
                <p className="text-sm sm:text-base text-[#6a6c71] leading-relaxed max-w-md mx-auto sm:mx-0">
                  Enter your location, select the day and time that work for you and that's it. No calls, no waiting.
                </p>
              </div>

              {/* Step 03 - Mobile */}
              <div className="text-center sm:text-left">
                <div className="relative inline-block mb-6">
                  <div className="text-7xl sm:text-8xl font-bold leading-none bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                    03
                  </div>
                  <div className="hidden sm:block absolute -bottom-2 left-1/2 sm:left-8 -translate-x-1/2 sm:translate-x-0 w-4 h-4 bg-[#306eec] rounded-full"></div>
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-[#313234] leading-tight mb-3">
                  Get confirmation and relax
                </h3>
                <p className="text-sm sm:text-base text-[#6a6c71] leading-relaxed max-w-md mx-auto sm:mx-0">
                  After payment, you'll get a confirmation email and see your booking in your account.
                </p>
              </div>
            </div>

            {/* Desktop: Original Absolute Positioning */}
            <div className="hidden lg:block">
              {/* Step 01 */}
              <div className="absolute top-9 -left-8 w-[295px]">
                <div className="relative ">
                  <h3 className="text-2xl font-semibold text-[#313234] leading-[21px] mb-4">
                    Choose your<br />perfect plan
                  </h3>
                  <p className="text-base text-[#6a6c71] leading-[19px] mb-12">
                    Pick the option that fits you best. With a plan, you save up to 50% on every visit and get priority support.
                  </p>
                  <div className="relative">
                    <div className="text-[128px] font-bold leading-[114px] bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                      01
                    </div>
                    {/* Blue dot (on wave, above number) */}
                    <div className="absolute -top-[35px] left-[49px] w-5 h-5 bg-[#306eec] rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Step 02 */}
              <div className="absolute top-7 left-1/2 -translate-x-1/2 w-[309px] text-center">
                <div className="relative">
                  <div className="relative inline-block">
                    <div className="text-[128px] font-bold leading-[114px] bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                      02
                    </div>
                    {/* Blue dot */}
                    <div className="absolute -top-[35px] left-1/2 -translate-x-1/2 w-5 h-5 bg-[#306eec] rounded-full"></div>
                  </div>
                  <h3 className="text-2xl font-semibold text-[#313234] leading-[21px] mt-4 mb-4">
                    Add your address and time
                  </h3>
                  <p className="text-base text-[#6a6c71] leading-[19px]">
                    Enter your location, select the day and time that work for you and that's it. No calls, no waiting.
                  </p>
                </div>
              </div>

              {/* Step 03 */}
              <div className="absolute top-4 right-1 w-[221px] text-right">
                <div className="relative">
                  <h3 className="text-2xl font-semibold text-[#313234] leading-[21px] mb-4">
                    Get confirmation<br />and relax
                  </h3>
                  <p className="text-base text-[#6a6c71] leading-[19px] mb-12">
                    After payment, you'll get a confirmation email and see your booking in your account.
                  </p>
                  <div className="relative inline-block">
                    <div className="text-[128px] font-bold leading-[114px] bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                      03
                    </div>
                    {/* Blue dot (on wave, above number) */}
                    <div className="absolute -top-[35px] left-[98px] w-5 h-5 bg-[#306eec] rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
