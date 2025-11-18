'use client';

import Image from 'next/image';

const services = [
  { id: '01', title: 'Unlimited requests', description: 'One active job at a time; finish one — book the next.', color: 'blue', size: 'normal', offset: 0 },
  { id: '02', title: 'Basic improvements', description: 'Mount TVs/shelves, replace faucets/locks, hang fixtures, assemble furniture.', color: 'light', size: 'normal', offset: 0 },
  { id: '03', title: 'Quick fixes', description: 'Outlets, leaks, cabinet hinges, caulk, drywall touch-ups.', color: 'dark', size: 'small', offset: 0 },
  { id: '04', title: 'Standard materials included', description: 'We bring repair supplies. Specialty finishes billed at cost if needed.', color: 'blue', size: 'normal', offset: -50 },
  { id: '05', title: 'Consultation', description: 'Practical DIY & planning advice on-site or virtual.', color: 'dark', size: 'large', offset: -20 },
  { id: '06', title: 'Get 2 pros when needed', description: 'Safe lifting or added complexity.', color: 'dark', size: 'small', offset: -100 },
  { id: '07', title: 'Renovation consultation', description: 'Scope, estimate ranges, timelines, materials guidance.', color: 'dark', size: 'normal', offset: 10 },
  { id: '08', title: '24/7 emergency help', description: 'Scope, estimate ranges, timelines, materials guidance.', color: 'light', size: 'normal', offset: -20 },
  { id: '09', title: 'Seasonal property inspection', description: 'Regular seasonal assessments to spot maintenance needs early.', color: 'dark', size: 'large', offset: -30 },
  { id: '10', title: 'Exclusive discount', description: 'Best rates on bigger projects.', color: 'blue', size: 'large', offset: -60 },
];

function ServiceCard({ service, customSize }: { service: typeof services[0], customSize?: { width?: string, height?: string } }) {
  const bgColor = service.color === 'blue' ? 'bg-gradient-to-b from-[#306EEC] to-[#1B3E86]' : 
                 service.color === 'light' ? 'bg-[#EEF2FF]' : 'bg-[#3A3C3E]';
  const textColor = service.color === 'light' ? 'text-[#313234]' : 'text-white';
  const descColor = service.color === 'light' ? 'text-[#6A6D71]' : 'text-[#C5CBD8]';
  const numberColor = service.color === 'light' ? 'text-[#313234]' : 'text-white';
  
  const defaultWidth = service.size === 'small' ? 'lg:w-[220px]' : 
                       service.size === 'large' ? 'lg:w-[260px]' : 'lg:w-[240px]';
  const defaultHeight = service.size === 'small' ? 'lg:h-[200px]' : 
                        service.size === 'large' ? 'lg:h-[280px]' : 'lg:h-[240px]';
  
  const width = customSize?.width || defaultWidth;
  const height = customSize?.height || defaultHeight;
  
  // Special padding for card 04 with longer title
  const padding = service.id === '04' ? 'p-5 sm:p-6 lg:px-6 lg:py-6' : 'p-5 sm:p-6';
  
  return (
    <div 
      className={`${bgColor} ${width} ${height} w-full h-[220px] sm:h-[240px] rounded-[20px] ${padding} flex flex-col justify-between shadow-none sm:shadow-[0_10px_80px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 border border-[#C5CBD8]`}
      style={{ marginTop: `${service.offset}px` }}
    >
      <div>
        <h3 className={`text-lg sm:text-xl lg:text-2xl font-semibold ${textColor} mb-2 sm:mb-3 leading-[89%] font-montserrat`}>
          {service.title}
        </h3>
        <p className={`text-sm sm:text-base lg:text-xl font-medium ${descColor} leading-[120%] font-montserrat`}>
          {service.description}
        </p>
      </div>
      <div className="text-right">
        <span className={`text-5xl sm:text-6xl lg:text-[64px] font-bold leading-[89%] ${numberColor} font-montserrat`}>
          {service.id}
        </span>
      </div>
    </div>
  );
}

export default function ServicesSection() {
  return (
    <section className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative -mb-32 sm:-mb-40 lg:-mb-48 overflow-visible  ">
      {/* Light effect from lamp */}
      <div className="hidden lg:block absolute -top-20 left-1/2 -translate-x-1/2 pointer-events-none z-0 opacity-90 scale-150">
        <svg width="1394" height="1698" viewBox="0 0 1394 1698" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g filter="url(#filter0_f_208_636)">
            <path d="M1189.61 1108.83C1083.88 1166.25 965.592 1196.63 845.28 1197.3C724.968 1197.96 606.357 1168.87 500 1112.63L823.875 500.193C829.295 503.06 835.34 504.542 841.471 504.508C847.602 504.474 853.63 502.926 859.019 500L1189.61 1108.83Z" fill="url(#paint0_radial_208_636)" />
          </g>
          <defs>
            <filter id="filter0_f_208_636" x="-3.05176e-05" y="0" width="1689.61" height="1697.31" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="250" result="effect1_foregroundBlur_208_636" />
            </filter>
            <radialGradient id="paint0_radial_208_636" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(841.266 467.306) rotate(90) scale(730)">
              <stop offset="0.403846" stopColor="#F6D28C" />
              <stop offset="1" stopColor="#2B2417" stopOpacity="0.6" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Decorative Background Circle */}
      <div 
        className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[1460px] h-[1460px] rounded-full z-0"
        style={{
          background: 'radial-gradient(circle, rgba(48, 110, 236, 0.1) 0%, transparent 70%)',
        }}
      ></div>

      <div className="container mx-auto px-[20px] max-w-[1240px] relative z-10">
        {/* Header - Hidden on desktop, shown on mobile */}
        <div className="text-center mb-8 sm:mb-12 lg:hidden relative">
          <h2 className="text-3xl sm:text-5xl lg:text-[64px] font-bold leading-tight sm:leading-[48px] lg:leading-[57px] uppercase">
            <span className="text-white">About these</span>
            <br />
            <span className="text-[#306eec]">Services</span>
          </h2>
          <p className="text-[#c5cbd8] text-base sm:text-lg lg:text-xl font-medium mt-3 sm:mt-4">
            Explore your plan services.
          </p>
        </div>

        {/* Mobile/Tablet: Horizontal Scroll */}
        <div className="lg:hidden">
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-4 sm:gap-5" style={{ width: 'max-content' }}>
              {services.map((service) => (
                <div key={service.id} className="flex-shrink-0" style={{ width: '280px' }}>
                  <ServiceCard service={{...service, offset: 0}} />
                </div>
              ))}
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="flex justify-center gap-2 mt-4">
            <svg className="w-6 h-6 text-[#306EEC] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[#C5CBD8] text-sm">Swipe to see more</span>
          </div>
        </div>

        {/* Desktop: Original Layout */}
        <div className="hidden lg:block max-w-[1320px] mx-auto">
          {/* First Row - Card 01 (282x282) + Card 02 (351x235) + Lamp section (533x252) */}
          <div className="flex gap-6 mb-6 items-start">
            {/* Card 01 - 282x282px */}
            <ServiceCard service={services[0]} customSize={{ width: 'lg:w-[282px]', height: 'lg:h-[282px]' }} />
            
            {/* Card 02 - 351x235px */}
            <ServiceCard service={services[1]} customSize={{ width: 'lg:w-[351px]', height: 'lg:h-[235px]' }} />
            
            {/* Lamp section - 533x252px */}
            <div className="lg:w-[550px] lg:h-[270px] flex items-center justify-center" style={{ marginTop: '0px' }}>
              <div className="relative w-[550px] h-[270px]">
                <Image
                  src="/images/lampa.png"
                  alt="Light bulb"
                  width={550}
                  height={270}
                  className="object-contain drop-shadow-[0_40px_70px_rgba(42,30,15,0.2)]"
                />
              </div>
            </div>
          </div>

          {/* Second Row - Card 03 (267x244) + Card 04 (264x264) + Card 05 (341x245) + Card 06 (279x289) */}
          <div className="flex gap-6 mb-6 items-start">
            {/* Card 03 - 267x244px */}
            <ServiceCard service={services[2]} customSize={{ width: 'lg:w-[267px]', height: 'lg:h-[244px]' }} />
            
            {/* Card 04 - 264x264px */}
            <ServiceCard service={services[3]} customSize={{ width: 'lg:w-[264px]', height: 'lg:h-[264px]' }} />
            
            {/* Card 05 - 341x245px */}
            <ServiceCard service={services[4]} customSize={{ width: 'lg:w-[341px]', height: 'lg:h-[245px]' }} />
            
            {/* Card 06 - 279x289px */}
            <ServiceCard service={services[5]} customSize={{ width: 'lg:w-[279px]', height: 'lg:h-[289px]' }} />
          </div>

          {/* Third Row - Card 07 (296x278) + Card 08 (300x248) + Card 09 (282x308) + Card 10 (273x298) */}
          <div className="flex gap-6 items-start">
            {/* Card 07 - 296x278px */}
            <ServiceCard service={services[6]} customSize={{ width: 'lg:w-[296px]', height: 'lg:h-[278px]' }} />
            
            {/* Card 08 - 300x248px */}
            <ServiceCard service={services[7]} customSize={{ width: 'lg:w-[300px]', height: 'lg:h-[248px]' }} />
            
            {/* Card 09 - 282x308px */}
            <ServiceCard service={services[8]} customSize={{ width: 'lg:w-[282px]', height: 'lg:h-[308px]' }} />
            
            {/* Card 10 - 273x298px */}
            <ServiceCard service={services[9]} customSize={{ width: 'lg:w-[273px]', height: 'lg:h-[298px]' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
