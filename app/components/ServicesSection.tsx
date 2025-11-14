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
      className={`${bgColor} ${width} ${height} w-full h-[220px] sm:h-[240px] rounded-[20px] ${padding} flex flex-col justify-between shadow-[0_10px_80px_rgba(0,0,0,0.25)] transition-transform hover:scale-105`}
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
    <section className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative overflow-hidden">
      {/* Decorative Background Circle */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1460px] h-[1460px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(48, 110, 236, 0.1) 0%, transparent 70%)',
        }}
      ></div>

      <div className="container mx-auto px-4 max-w-[1440px] relative z-10">
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
