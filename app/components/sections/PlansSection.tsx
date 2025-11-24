'use client';

import { useState } from 'react';
import Image from 'next/image';
import { plans } from '@/app/data/content';

export default function PlansSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % plans.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + plans.length) % plans.length);
  };

  return (
    <section className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative overflow-hidden">
      <div className="lg:max-w-[1240px] lg:mx-auto lg:px-[20px]">
        {/* Mobile/Tablet Header - Centered */}
        <div className="lg:hidden text-center mb-8 sm:mb-12 px-[20px]">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <Image src="/images/logo.svg" alt="Profixter" width={80} height={32} />
          </div>

          {/* Main Heading */}
          <h2 className="text-5xl sm:text-6xl font-bold leading-[89%] mb-8 uppercase tracking-[-0.05em] flex flex-col gap-0">
            <span className="text-white">Choose</span>
            <span className="text-[#306EEC] -mt-2">Your</span>
            <span className="text-white -mt-2">Plan</span>
          </h2>

          {/* Trial Info */}
          <div className="mb-6">
            <p className="text-white text-2xl sm:text-3xl font-normal leading-tight mb-2">
              $0 today.
            </p>
            <p className="text-[#C5CBD8] text-base sm:text-lg leading-relaxed">
              Free 7-day trial; cancel anytime<br />
              in your account.
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-8 sm:gap-10 lg:gap-12">
          {/* Left Side - Text Content - Desktop Only */}
          <div className="hidden lg:flex flex-shrink-0 w-[340px] pt-4 flex-col justify-between h-[522px]">
            <div>
              {/* Logo */}
              <div className="mb-16">
                <Image src="/images/logo.svg" alt="Profixter" width={80} height={32} />
              </div>

              {/* Main Heading */}
              <h2 className="text-[64px] font-bold leading-[89%] mb-12 uppercase ml-[100px] tracking-[-0.05em] flex flex-col gap-0">
                <span className="text-white">Choose</span>
                <span className="text-[#306EEC] -ml-[100px] -mt-2">Your</span>
                <span className="text-white -mt-2">Plan</span>
              </h2>

              {/* Trial Info */}
              <div className="mb-12 ml-[100px]">
                <p className="text-white text-2xl font-normal leading-[21px] mb-2">
                  $0 today.
                </p>
                <p className="text-[#C5CBD8] text-base leading-[19px]">
                  Free 7-day trial;<br />
                  cancel anytime<br />
                  in your account.
                </p>
              </div>
            </div>

            {/* Materials Info - at bottom aligned with big card */}
            <p className="text-[#C5CBD8] text-base leading-[19px]">
              Materials at cost. Only if needed,<br />
              with your approval — no markups.
            </p>
          </div>

          {/* Right Side - Carousel - extends to edge of screen */}
          <div className="flex-1 relative lg:min-h-[522px] w-full lg:w-auto">
            {/* Mobile/Tablet: Carousel slider */}
            <div className="lg:hidden">
              {/* Fixed height container to prevent jumping */}
              <div className="relative overflow-hidden">
                <div 
                  className="flex transition-transform duration-500 ease-out"
                  style={{ 
                    transform: `translateX(-${currentSlide * 100}%)`
                  }}
                >
                  {plans.map((plan, idx) => (
                    <div
                      key={idx}
                      className="w-full flex-shrink-0 px-5"
                    >
                      <div 
                        className="w-full max-w-[420px] mx-auto bg-[#EEF2FF] rounded-[24px] border border-[#C5CBD8] p-6 sm:p-8 flex flex-col"
                        style={{ minHeight: '500px' }}
                      >
                        <div className="text-center mb-4 sm:mb-5">
                          <h3 className="text-2xl sm:text-3xl font-bold text-[#313234] leading-tight mb-2">
                            {plan.name}
                          </h3>
                          <p className="text-sm sm:text-base text-[#6A6D71] leading-relaxed">
                            {plan.description}
                          </p>
                        </div>
                        
                        {/* Price */}
                        <div className="mb-5 sm:mb-6 text-center">
                          <div className="flex items-end gap-2 justify-center">
                            <span className="text-5xl sm:text-6xl font-bold text-[#313234] leading-none">
                              ${plan.price}
                            </span>
                            <span className="text-base sm:text-lg text-[#6A6D71] leading-tight pb-1">
                              /month
                            </span>
                          </div>
                        </div>

                        {/* Features */}
                        <div className="space-y-2.5 mb-auto">
                          {plan.features.map((feature, featureIdx) => (
                            <div 
                              key={featureIdx} 
                              className="flex items-center gap-2.5"
                            >
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                <svg width="14" height="11" viewBox="0 0 16 13" fill="none">
                                  <path d="M1 6.5L5.5 11L15 1.5" stroke="#43A047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                              <span className="text-base sm:text-lg font-semibold text-[#313234] leading-tight">
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* CTA Button */}
                        <a 
                          href={plan.stripeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-[56px] sm:h-[60px] bg-[#306EEC] hover:bg-[#2558c9] rounded-2xl text-lg sm:text-xl font-bold text-[#EEF2FF] leading-none transition-all duration-300 shadow-lg mt-6 flex items-center justify-center"
                        >
                          {plan.buttonText}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Swipe Indicators */}
              <div className="flex gap-2 justify-center mt-6 mb-4">
                {plans.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      idx === currentSlide 
                        ? 'w-10 bg-[#306EEC]' 
                        : 'w-2.5 bg-[#C5CBD8] hover:bg-[#306EEC]/50'
                    }`}
                  />
                ))}
              </div>

              {/* Mobile Navigation Buttons */}
              <div className="flex gap-4 justify-center mt-4">
                <button
                  onClick={prevSlide}
                  className="bg-white hover:bg-gray-50 text-[#313234] w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg border-2 border-[#E5E7EB] hover:scale-110 transform"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextSlide}
                  className="bg-[#306EEC] hover:bg-[#2558c9] text-white w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-[#306EEC]/30 hover:scale-110 transform border-2 border-[#F97316]"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Materials Info - Mobile */}
              <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed text-center mt-6 px-4">
                Materials at cost. Only if needed,<br />
                with your approval — no markups.
              </p>
            </div>

            {/* Desktop: Original Carousel Layout */}
            <div className="hidden lg:flex relative items-center gap-6 ml-16">
              {/* Main Card (Active) */}
              <div className="relative w-[390px] h-[522px] bg-[#EEF2FF] rounded-[20px] border-2 border-transparent shadow-[0_10px_80px_rgba(0,0,0,0.25)] flex-shrink-0"
               >
                {/* Popular Badge */}
                {plans[currentSlide].isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-10 py-2 rounded-[5px] border border-[#EEF2FF]">
                      <span className="text-[20px] font-medium text-[#EEF2FF] leading-[120%]">Popular</span>
                    </div>
                  </div>
                )}
            <div className="flex flex-col h-full p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold text-[#313234] leading-[88.9%] mb-2">
                  {plans[currentSlide].name}
                </h3>
                <p className="text-base text-[#6A6D71] leading-[120%]">
                  {plans[currentSlide].description}
                </p>
              </div>
              <div className="mb-8">
                <div className="flex items-end gap-1">
                  <span className="text-[64px] font-bold text-[#313234] leading-[88.9%]">
                    ${plans[currentSlide].price}
                  </span>
                  <span className="text-base text-[#6A6D71] leading-[120%] pb-2">
                    /per month
                  </span>
                </div>
              </div>
              {plans[currentSlide].subtitle && (
                <p className="text-[20px] font-medium text-[#306EEC] leading-[120%] mb-4">
                  {plans[currentSlide].subtitle}
                </p>
              )}
              <div className="space-y-3 mb-auto">
                {plans[currentSlide].features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-[33px] h-[33px] rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
                        <path d="M1 6.5L5.5 11L15 1.5" stroke="#43A047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-xl font-medium text-[#313234] leading-[120%]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
              <a 
                href={plans[currentSlide].stripeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-[60px] bg-[#306EEC] hover:bg-[#2558c9] rounded-[10px] text-xl font-medium text-[#EEF2FF] leading-[120%] transition-colors mt-6 flex items-center justify-center"
              >
                {plans[currentSlide].buttonText}
              </a>
            </div>
            </div>
          <div className="flex gap-6">
            {[1, 2].map((offset) => {
              const index = (currentSlide + offset) % plans.length;
              const plan = plans[index];
              return (
                <div key={offset} className="relative w-[294px] h-[394px] flex-shrink-0">
                  <div className="absolute inset-0 bg-[#EEF2FF] rounded-[15px] border border-[#C5CBD8] p-6">
                    <div className="flex flex-col h-full">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-semibold text-[#313234] leading-[88.9%] mb-1">
                          {plan.name}
                        </h3>
                        <p className="text-xs text-[#6A6D71] leading-[120%]">
                          {plan.description}
                        </p>
                      </div>
                      <div className="mb-6">
                        <div className="flex items-end gap-1">
                          <span className="text-5xl font-bold text-[#313234] leading-[88.9%]">
                            ${plan.price}
                          </span>
                          <span className="text-xs text-[#6A6D71] leading-[120%] pb-1">
                            /per month
                          </span>
                        </div>
                      </div>
                      {plan.subtitle && (
                        <p className="text-[15px] font-medium text-[#306EEC] leading-[120%] mb-3">
                          {plan.subtitle}
                        </p>
                      )}
                      <div className="space-y-2 mb-auto">
                        {plan.features.slice(0, 2).map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-[24px] h-[24px] rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                <path d="M1 4.5L4 7.5L10 1.5" stroke="#43A047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            <span className="text-[15px] font-medium text-[#313234] leading-[120%]">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>
                      <a 
                        href={plan.stripeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-[46px] bg-[#306EEC] hover:bg-[#2558c9] rounded-[8px] text-[15px] font-medium text-[#EEF2FF] leading-[120%] transition-colors mt-4 flex items-center justify-center"
                      >
                        {plan.buttonText}
                      </a>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-[#313234]/30 backdrop-blur-[3px] rounded-[16px] pointer-events-none" />
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Navigation Buttons - positioned at the level of bottom of big card, under small cards */}
        <div className="flex gap-4 absolute bottom-0 left-[480px]">
          <button
            onClick={prevSlide}
            className="bg-white hover:bg-gray-100 text-gray-800 w-12 h-12 rounded-lg flex items-center justify-center transition-colors shadow-md border border-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="bg-white hover:bg-gray-100 text-gray-800 w-12 h-12 rounded-lg flex items-center justify-center transition-colors shadow-md border border-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
          </div>
        </div>
      </div>
    </section>
  );
}
