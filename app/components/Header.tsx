'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="w-full bg-transparent py-[20px] max-w-[1250px] mx-auto relative z-50">
      <div className="container mx-auto px-4 flex items-center justify-between max-w-[1440px]">
        {/* Logo */}
        <Link href="/" className="flex items-center relative z-50">
          <Image 
            src="/logo.svg" 
            alt="Profixter Long Island" 
            width={80} 
            height={32}
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link 
            href="#how-it-works" 
            className="text-[#eef2ff] hover:text-white transition-colors text-base font-normal relative group pb-2"
          >
            How it works
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
          </Link>
          <Link 
            href="#plans" 
            className="text-[#eef2ff] hover:text-white transition-colors text-base font-normal relative group pb-2"
          >
            Plans
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
          </Link>
          <Link 
            href="#pick-day" 
            className="text-[#eef2ff] hover:text-white transition-colors text-base font-normal relative group pb-2"
          >
            Pick day
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-100"></span>
          </Link>
          <Link 
            href="#projects" 
            className="text-[#eef2ff] hover:text-white transition-colors text-base font-normal relative group pb-2"
          >
            Projects
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
          </Link>
          <Link 
            href="#contact-us" 
            className="text-[#eef2ff] hover:text-white transition-colors text-base font-normal relative group pb-2"
          >
            Contact us
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
          </Link>
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden lg:flex items-center gap-4">
          <Link 
            href="/signin"
            className="px-6 py-3 text-[#eef2ff] hover:text-white border border-[#eef2ff] rounded-[14px] text-base font-normal transition-colors hover:bg-white/10"
          >
            Sign in
          </Link>
          <Link 
            href="/signup"
            className="px-8 py-3 bg-[#eef2ff] text-[#313234] rounded-[14px] text-base font-normal transition-colors hover:bg-white"
          >
            Sign up
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="lg:hidden relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-1.5 group"
          aria-label="Toggle menu"
        >
          <span className={`w-6 h-0.5 bg-[#eef2ff] transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`w-6 h-0.5 bg-[#eef2ff] transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`w-6 h-0.5 bg-[#eef2ff] transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`lg:hidden fixed inset-0 bg-[#313234]/95 backdrop-blur-md transition-all duration-300 ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <nav className="flex flex-col items-center justify-center h-full gap-8 px-8">
          <Link 
            href="#how-it-works"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#eef2ff] hover:text-white text-2xl font-normal transition-colors"
          >
            How it works
          </Link>
          <Link 
            href="#plans"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#eef2ff] hover:text-white text-2xl font-normal transition-colors"
          >
            Plans
          </Link>
          <Link 
            href="#pick-day"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#eef2ff] hover:text-white text-2xl font-normal transition-colors"
          >
            Pick day
          </Link>
          <Link 
            href="#projects"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#eef2ff] hover:text-white text-2xl font-normal transition-colors"
          >
            Projects
          </Link>
          <Link 
            href="#contact-us"
            onClick={() => setIsMenuOpen(false)}
            className="text-[#eef2ff] hover:text-white text-2xl font-normal transition-colors"
          >
            Contact us
          </Link>

          <div className="flex flex-col gap-4 mt-8 w-full max-w-xs">
            <Link 
              href="/signin"
              onClick={() => setIsMenuOpen(false)}
              className="w-full text-center px-6 py-3 text-[#eef2ff] hover:text-white border border-[#eef2ff] rounded-[14px] text-base font-normal transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
            <Link 
              href="/signup"
              onClick={() => setIsMenuOpen(false)}
              className="w-full text-center px-8 py-3 bg-[#eef2ff] text-[#313234] rounded-[14px] text-base font-normal transition-colors hover:bg-white"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
