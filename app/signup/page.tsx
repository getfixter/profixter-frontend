'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import Header from '../components/Header';

export default function SignUpPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signup');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/pass-bg.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Header */}
      <Header />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-24 sm:py-32">
        {/* Sign Up Form Container with Blur */}
        <div 
          className="w-full max-w-[860px] rounded-[20px] p-6 sm:p-8 lg:p-12 backdrop-blur-[10px]"
          style={{
            background: 'linear-gradient(180deg, rgba(49, 50, 52, 0.4) 0%, rgba(49, 50, 52, 0.3) 50%, rgba(49, 50, 52, 0.3) 100%), rgba(238, 242, 255, 0.1)',
            boxShadow: '0px 0px 80px 0px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Tabs */}
          <div className="flex gap-6 sm:gap-8 mb-8 sm:mb-12">
            <Link
              href="/signin"
              className="text-xl sm:text-2xl font-medium pb-2 text-white/60 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <button
              onClick={() => setActiveTab('signup')}
              className={`text-xl sm:text-2xl font-medium pb-2 transition-colors relative ${
                activeTab === 'signup' ? 'text-white' : 'text-white/60'
              }`}
            >
              Sign up
              {activeTab === 'signup' && (
                <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#306EEC]"></span>
              )}
            </button>
          </div>

          {/* Form */}
          <form className="space-y-6 sm:space-y-8">
            {/* Google Sign Up */}
            <button
              type="button"
              className="w-full sm:max-w-[312px] py-3 sm:py-4 px-4 sm:px-6 bg-white rounded-[14px] flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-[#3C4043] text-sm sm:text-base font-medium">Continue with Google</span>
            </button>

            {/* Two Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-x-12 sm:gap-y-8">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                  placeholder=""
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                  placeholder=""
                />
              </div>

              {/* Create Password Field */}
              <div>
                <label htmlFor="password" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Create password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors pr-10"
                    placeholder=""
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 bottom-2 sm:bottom-3 text-white/60 hover:text-white transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-6 sm:h-6">
                      {showPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Phone Number Field */}
              <div>
                <label htmlFor="phone" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Phone number
                </label>
                <input
                  type="tel"
                  id="phone"
                  className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                  placeholder=""
                />
              </div>

              {/* Repeat Password Field */}
              <div>
                <label htmlFor="repeat-password" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Repeat password
                </label>
                <div className="relative">
                  <input
                    type={showRepeatPassword ? 'text' : 'password'}
                    id="repeat-password"
                    className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors pr-10"
                    placeholder=""
                  />
                  <button
                    type="button"
                    onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                    className="absolute right-0 bottom-2 sm:bottom-3 text-white/60 hover:text-white transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-6 sm:h-6">
                      {showRepeatPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Zip Code Field */}
              <div>
                <label htmlFor="zip" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Zip code
                </label>
                <input
                  type="text"
                  id="zip"
                  className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                  placeholder=""
                />
              </div>

              {/* State Field */}
              <div>
                <label htmlFor="state" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                  placeholder=""
                />
              </div>

              {/* Full Address Field */}
              <div>
                <label htmlFor="address" className="block text-white text-sm sm:text-base mb-2 sm:mb-3">
                  Full addres
                </label>
                <input
                  type="text"
                  id="address"
                  className="w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                  placeholder=""
                />
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="flex items-center gap-2 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white rounded flex items-center justify-center peer-checked:bg-transparent peer-checked:border-white">
                    {agreeToTerms && (
                      <svg width="12" height="10" viewBox="0 0 14 11" fill="none" className="sm:w-[14px] sm:h-[11px]">
                        <path d="M1 5.5L5 9.5L13 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-white text-sm sm:text-base">I agree to Terms & Privacy</span>
              </label>
            </div>

            {/* Sign Up Button */}
            <div className="flex justify-center pt-6 sm:pt-8">
              <button
                type="submit"
                className="w-full sm:max-w-[355px] py-3 sm:py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
