import Image from 'next/image';
import { useAuth } from "@/lib/useAuth";
import { checkSubscription } from "@/lib/booking-service";

type FixterUser = {
  defaultAddressId: string;
};

type SubscriptionResponse = {
  hasSubscription: boolean;
};

export default function HeroSection() {

  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const handleFixTodayClick = async () => {

    if (!isAuthenticated) {
      window.location.href = "/signin?redirect=/";
      return;
    }

    const addressId = typedUser.defaultAddressId;

    const subscription = await checkSubscription(addressId) as SubscriptionResponse;

    if (!subscription.hasSubscription) {
      const plans = document.getElementById("plans");
      if (plans) plans.scrollIntoView({ behavior: "smooth" });
      else window.location.href = "/#plans";
      return;
    }

    const booking = document.getElementById("pick-day");
    if (booking) booking.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "/#pick-day";
  };


  return (
    <>
    <section className="relative w-full h-[860px] md:h-[700px] lg:h-[860px] overflow-hidden bg-[#313234]">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.png"
          alt="Professional handyman fixing lights"
          fill
          className="object-cover opacity-90"
          priority
        />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-[20px] max-w-[1240px] h-full flex flex-col justify-between pt-16 sm:pt-20 lg:pt-24 pb-8 sm:pb-12 lg:pb-16">
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-between lg:block">
          {/* Top - Heading Only on Mobile */}
          <div className="lg:hidden w-full max-w-[1200px] relative mx-auto">
            {/* Main Heading */}
            <h1 className="w-full flex flex-col pt-6" >
              {/* First line - centered */}
              <div className="text-[32px] sm:text-[48px] font-bold leading-[88.9%] text-white uppercase tracking-tight text-center">
                Regular House Maintenance
              </div>
              
              {/* Second line - responsive layout */}
              <div className="relative flex flex-col items-center justify-center gap-2">
                <div className="text-[32px] sm:text-[48px] font-bold leading-[88.9%] uppercase tracking-tight text-center">
                  <span className="text-[#5E8BFF]">Service</span>{' '}
                  <span className="text-white">Luxury</span>
                </div>
              </div>
              
              {/* Third line */}
              <div className="text-[32px] sm:text-[48px] font-bold leading-[88.9%]  uppercase tracking-tight text-center">
                <span className="text-white">Price </span>
                <span className="text-[#5E8BFF]">Honest</span>
              </div>
            </h1>
          </div>

          {/* Desktop Heading */}
          <div className="hidden lg:block w-full max-w-[1200px] relative mx-auto lg:pt-12">
            {/* Main Heading */}
            <h1 className="mb-4 sm:mb-6 w-full flex flex-col -gap-2" >
              {/* First line - centered */}
              <div className="text-[64px] font-bold leading-[89%] text-white uppercase tracking-[-0.05em] text-center lg:ml-[0px]">
                Regular House Maintenance
              </div>
              
              {/* Second line - responsive layout */}
              <div className="relative flex flex-row items-center justify-start gap-4 -mt-2">
                <div className="text-[64px] font-bold leading-[89%] uppercase tracking-[-0.05em] text-left">
                  <span className="text-[#5E8BFF]">Service</span>{' '}
                  <span className="text-white"> - Luxury</span>
                </div>
                
                {/* Review Badge */}
                <div>
                  <a 
  href="https://share.google/tXfssMqyKFLeqqTHm" 
  target="_blank" 
  rel="noopener noreferrer"
>
  <div className="flex items-center gap-2 px-3 py-2 bg-[#313234]/30 backdrop-blur-[8px] rounded-full h-[38px]">
    <Image src="/images/icons/icon-google.svg" alt="" width={16} height={16} className="w-4 h-4" />
    <span className="text-base font-semibold text-[#EEF2FF] leading-[88.9%]">5.0 stars</span>
    <span className="text-base text-[#C5CBD8] leading-[88.9%]">by Homeowners Across Long Island</span>
  </div>
</a>

                </div>
              </div>
              
              {/* Third line */}
              <div className="text-[64px] font-bold leading-[89%] uppercase tracking-[-0.05em] text-left -mt-2">
                <span className="text-white">Price - </span>
                <span className="text-[#5E8BFF]">Honest</span>
              </div>
            </h1>

            {/* Subheading with responsive margin */}
            <div className="lg:ml-[90px] text-left">
              <p className="text-[20px] font-medium text-[#C5CBD8] leading-[120%] max-w-[362px] mb-6">
                Book professional help for your home in seconds. Choose a plan, pick a date - we handle the rest.
              </p>

              {/* CTA Button */}
<button 
  onClick={handleFixTodayClick}
  className="w-[362px] h-[60px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors rounded-[14px] border border-[#306EEC]"
>
                <span className="text-[20px] font-semibold text-[#EEF2FF]">Book Now</span>
              </button>
            </div>
          </div>

          {/* Bottom - Description, Review, CTA on Mobile */}
          <div className="lg:hidden w-full max-w-[1200px] relative mx-auto text-center">
            <p className="text-base sm:text-lg font-medium text-[#C5CBD8] leading-[120%] max-w-[362px] mx-auto mb-6">
              Book professional help for your home in seconds. Choose a plan, pick a date - we handle the rest.
            </p>

            {/* Review Badge - Mobile only */}
            <div className="flex justify-center mb-6">
              <a 
  href="https://share.google/tXfssMqyKFLeqqTHm" 
  target="_blank" 
  rel="noopener noreferrer"
>
  <div className="flex items-center gap-2 px-3 py-2 bg-[#313234]/30 backdrop-blur-[8px] rounded-full h-[38px]">
    <Image src="/images/icons/icon-google.svg" alt="" width={16} height={16} className="w-4 h-4" />
    <span className="text-sm font-semibold text-[#EEF2FF] leading-[88.9%]">5.0 stars</span>
    <span className="text-sm text-[#C5CBD8] leading-[88.9%]">by Homeowners Across Long Island</span>
  </div>
</a>

            </div>

            {/* CTA Button */}
<button 
  onClick={handleFixTodayClick}
  className="w-full sm:w-[300px] h-[50px] sm:h-[56px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors rounded-[14px] border border-[#306EEC]"
>
              <span className="text-lg sm:text-xl font-semibold text-[#EEF2FF]">Book Now</span>
            </button>
          </div>
        </div>

        {/* Bottom Section - Location & Cards */}
        <div className="hidden sm:flex flex-col sm:flex-row items-center sm:items-end justify-between mt-auto gap-6 sm:gap-0">
          {/* Location Text */}
          <div className="text-sm sm:text-base font-normal text-[#eef2ff] leading-[19px] text-center sm:text-left">
            Serving Long Island:<br />Suffolk & Nassau
          </div>

          {/* Stats Cards */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 justify-center sm:justify-end w-full sm:w-auto">
            {/* Card 1 - Savings */}
            <div className="w-[140px] sm:w-[150px] h-[110px] sm:h-[120px] bg-[#eef2ff] rounded-[14px] border border-[#c5cbd8] p-3 sm:p-4 shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
              <h3 className="text-xl sm:text-[24px] font-semibold text-[#313234] leading-[21px]">$1,800+</h3>
              <p className="text-sm sm:text-base font-normal text-[#6a6c71] leading-[14px] mt-2 sm:mt-3">
                saved yearly with Mr.Fixter plans
              </p>
            </div>

            {/* Card 2 - Trial */}
            <div className="w-[140px] sm:w-[150px] h-[110px] sm:h-[120px] bg-[#eef2ff] rounded-[14px] border border-[#c5cbd8] p-3 sm:p-4 shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
              <h3 className="text-xl sm:text-[24px] font-semibold text-[#313234] leading-[21px]">7 days</h3>
              <p className="text-sm sm:text-base font-normal text-[#6a6c71] leading-[14px] mt-2 sm:mt-3">
                Free trial on every service
              </p>
            </div>

            {/* Card 3 - #1 Badge */}
            <div className="relative w-full sm:w-[254px] h-[110px] sm:h-[120px] rounded-[14px] p-3 sm:p-4 shadow-[0_10px_80px_rgba(0,0,0,0.25)] overflow-hidden bg-[#313234]/30 backdrop-blur-[10px]">
              <div className="relative z-10">
                <h3 className="text-xl sm:text-[24px] font-semibold text-[#eef2ff] leading-[21px]">№1</h3>
                <p className="text-sm sm:text-base font-normal text-[#c5cbd8] leading-[14px] mt-2 sm:mt-3">
                  House Maintaice service on Long Island with a subscription model
                </p>
              </div>
            </div>
          </div>
        </div>

        
      </div>
    </section>

    {/* Mobile Stats Cards Section - Below Hero */}
    <section className="sm:hidden bg-white px-4 py-8">
      <div className="container mx-auto max-w-[1240px]">
        {/* Top Row - Two Cards Side by Side */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Card 1 - Savings */}
          <div className="h-[110px] bg-[#EEF2FF] rounded-[14px] border border-[#C5CBD8] p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-[#313234] leading-tight mb-2">$1,800+</h3>
            <p className="text-xs font-normal text-[#6A6C71] leading-snug">
              saved yearly with Mr.Fixter plans
            </p>
          </div>

          {/* Card 2 - Trial */}
          <div className="h-[110px] bg-[#EEF2FF] rounded-[14px] border border-[#C5CBD8] p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-[#313234] leading-tight mb-2">7 days</h3>
            <p className="text-xs font-normal text-[#6A6C71] leading-snug">
              Free trial on every service
            </p>
          </div>
        </div>

        {/* Bottom - Full Width Card */}
        <div className="mb-6">
          {/* Card 3 - #1 Badge */}
          <div className="h-[110px] bg-[#EEF2FF] rounded-[14px] border border-[#C5CBD8] p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-[#313234] leading-tight mb-2">№1</h3>
            <p className="text-sm font-normal text-[#6A6C71] leading-snug">
                  House Maintaice service on Long Island with a subscription model
            </p>
          </div>
        </div>

        {/* Location Text */}
        <div className="text-sm font-normal text-[#6A6C71] leading-snug text-center">
          Serving Long Island:<br />Suffolk & Nassau
        </div>
      </div>
    </section>
    </>
  );
}
