'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    router.push('/');
  };

  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <header className="w-full bg-transparent py-[20px] max-w-[1240px] mx-auto relative z-50">
      <div className="container mx-auto px-[20px] flex items-center justify-between max-w-[1240px]">
        {/* Logo */}
        <Link href="/" className="flex items-center relative z-50">
          <Image 
            src="/images/logo.svg" 
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
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
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

        {/* Desktop Auth Buttons / User Profile */}
        <div className="hidden lg:flex items-center gap-4">
          {isAuthenticated ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <span className="text-[#eef2ff] text-base">{firstName}</span>
                <div className="w-11 h-11 rounded-full bg-[#C5CBD8] flex items-center justify-center">
                  <svg width="31" height="28" viewBox="0 0 31 28" fill="none">
                    <path d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z" fill="#EEF2FF"/>
                    <path d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z" fill="#EEF2FF"/>
                  </svg>
                </div>
              </button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#C5CBD8] rounded-[14px] shadow-lg py-2 z-50">
                  <Link
                    href="/account"
                    className="block px-4 py-3 text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    My Account
                  </Link>
                  <div className="border-t border-[#C5CBD8] my-2" />
                  <button
                    className="block w-full text-left px-4 py-3 text-base text-red-600 hover:bg-[#EEF2FF] transition-colors"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
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
            {isAuthenticated ? (
              <>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#C5CBD8] flex items-center justify-center">
                    <svg width="40" height="36" viewBox="0 0 31 28" fill="none">
                      <path d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z" fill="#EEF2FF"/>
                      <path d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z" fill="#EEF2FF"/>
                    </svg>
                  </div>
                  <span className="text-[#eef2ff] text-xl font-medium">{firstName}</span>
                </div>
                <Link 
                  href="/account"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full text-center px-6 py-3 text-[#eef2ff] hover:text-white border border-[#eef2ff] rounded-[14px] text-base font-normal transition-colors hover:bg-white/10"
                >
                  My Account
                </Link>
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-center px-8 py-3 bg-red-600 text-white rounded-[14px] text-base font-normal transition-colors hover:bg-red-700"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
