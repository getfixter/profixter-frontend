'use client';

import { useState } from 'react';
import Image from 'next/image';

const projects = [
  {
    id: 1,
    title: 'Lighting installation',
    description: 'Elegant brass chandelier for a warm, inviting interior.',
    image: '/images/project2.png',
  },
  {
    id: 2,
    title: 'Chandelier upgrade',
    description: 'Modern chandelier installation for elegant living spaces.',
    image: '/images/project2.png',
  },
  {
    id: 3,
    title: 'Kitchen renovation',
    description: 'Complete kitchen transformation with modern fixtures.',
    image: '/images/project2.png',
  },
];

export default function ProjectsSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % projects.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + projects.length) % projects.length);
  };

  return (
    <section className="w-full bg-[#313234] py-12 sm:py-16 lg:py-20 overflow-hidden relative">
      <div className="max-w-[1240px] mx-auto px-[20px]">
        {/* Mobile/Tablet Layout */}
        <div className="lg:hidden">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold leading-[89%] uppercase mb-2 tracking-[-0.05em]">
              <span className="text-[#EEF2FF]">OUR </span>
              <span className="text-[#306EEC]">LATEST</span>
            </h2>
            <h2 className="text-3xl sm:text-4xl font-bold leading-[89%] uppercase mb-4 text-[#EEF2FF] tracking-[-0.05em]">
              PROJECT
            </h2>
            
            <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed mb-6 max-w-md mx-auto">
              Recent home improvements crafted with precision and care.
            </p>
            
            <button className="w-full sm:w-auto px-8 h-[56px] sm:h-[60px] bg-[#306EEC] hover:bg-[#2558c7] text-[#EEF2FF] rounded-[14px] text-lg sm:text-xl font-semibold transition-colors">
              Fix it today
            </button>
          </div>

          {/* Carousel */}
          <div className="relative">
            <div className="relative w-full aspect-square max-w-[450px] mx-auto rounded-[20px] overflow-hidden shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
              <Image
                src={projects[currentSlide].image}
                alt={projects[currentSlide].title}
                fill
                className="object-cover"
              />
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={prevSlide}
                className="bg-[#EEF2FF] hover:bg-white text-[#313234] w-[52px] h-[52px] rounded-[12px] flex items-center justify-center transition-colors shadow-md"
                aria-label="Previous project"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={nextSlide}
                className="bg-[#EEF2FF] hover:bg-white text-[#313234] w-[52px] h-[52px] rounded-[12px] flex items-center justify-center transition-colors shadow-md"
                aria-label="Next project"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Dots Indicator */}
            <div className="flex gap-2 justify-center mt-4">
              {projects.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentSlide ? 'w-8 bg-[#306EEC]' : 'w-2 bg-[#C5CBD8]'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Text */}
          <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed text-center mt-8 max-w-md mx-auto">
            Every project we take on is built on trust, skill, and attention to detail.
          </p>
        </div>

        {/* Desktop Layout - Original */}
        <div className="hidden lg:flex items-start gap-12">
          {/* Left Content */}
          <div className="flex-shrink-0 w-[390px] pt-4 flex flex-col justify-between ">
            <div className="w-full">
              <h2 className="text-[64px] font-bold leading-[89%] uppercase w-full flex gap-2 tracking-[-0.05em]">
                <span className="text-[#EEF2FF]">OUR </span>
                <span className="text-[#306EEC]">LATEST</span>
              </h2>
              <h2 className="text-[64px] font-bold leading-[89%] uppercase mb-8 text-[#EEF2FF] tracking-[-0.05em]">
                PROJECT
              </h2>
              
              <p className="text-[#C5CBD8] text-base leading-[120%] mb-8 max-w-[291px]">
                Recent home improvements crafted with precision and care.
              </p>
              
              <button className="w-[362px] h-[60px] bg-[#306EEC] hover:bg-[#2558c7] text-[#EEF2FF] rounded-[14px] text-[20px] font-semibold transition-colors mb-32">
                Fix it today
              </button>
            </div>

            <p className="text-[#C5CBD8] text-[15px] leading-[120%] max-w-[272px]">
              Every project we take on is built on trust, skill, and attention to detail.
            </p>
          </div>

          {/* Right Side - Carousel */}
          <div className="relative min-h-[506px]">
            <div className="relative flex items-center gap-6 ml-16">
              {/* Main Card (Active) - 450x450 */}
              <div className="relative w-[450px] h-[450px] rounded-[20px]  flex-shrink-0 shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
                <Image
                  src={projects[currentSlide].image}
                  alt={projects[currentSlide].title}
                  width={450}
                  height={450}
                  priority
                  className="w-full h-full object-cover"
                />
                
                {/* Navigation Buttons - at the bottom right of big photo */}
                <div className="flex gap-3 absolute bottom-0 -right-34 z-10">
                  <button
                    onClick={prevSlide}
                    className="bg-[#EEF2FF] hover:bg-white text-[#313234] w-[52px] h-[52px] rounded-[12px] flex items-center justify-center transition-colors shadow-md"
                    aria-label="Previous project"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    className="bg-[#EEF2FF] hover:bg-white text-[#313234] w-[52px] h-[52px] rounded-[12px] flex items-center justify-center transition-colors shadow-md"
                    aria-label="Next project"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Preview Cards - 300x300 with blur overlay */}
              <div className="flex gap-6">
                {[1, 2].map((offset) => {
                  const index = (currentSlide + offset) % projects.length;
                  const project = projects[index];
                  return (
                    <div key={offset} className="relative w-[300px] h-[300px] flex-shrink-0">
                      <div className="absolute inset-0 rounded-[10px] overflow-hidden">
                        <Image
                          src={project.image}
                          alt={project.title}
                          width={300}
                          height={300}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-[#313234]/30 backdrop-blur-[3px] rounded-[10px] pointer-events-none" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
