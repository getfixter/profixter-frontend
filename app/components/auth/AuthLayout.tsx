"use client";
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';

interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Shared layout for auth pages: centers a glass form card over background.
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <Image src="/images/pass-bg.png" alt="Background" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Logo */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 lg:top-12 lg:left-12 z-20">
        <Link href="/">
          <Image src="/images/logo.svg" alt="ProFixter" width={80} height={32} />
        </Link>
      </div>

      {/* Center Card */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-24 sm:py-32">
        <div className="w-full max-w-[880px] mx-auto">
          <div
            className="rounded-[24px] px-6 sm:px-10 py-10 sm:py-14 backdrop-blur-xl border border-white/15"
            style={{
              background:
                'linear-gradient(145deg, rgba(49,50,52,0.55) 0%, rgba(49,50,52,0.35) 50%, rgba(49,50,52,0.55) 100%)',
              boxShadow: '0 0 80px 0 rgba(0,0,0,0.25)',
            }}
          >
            {(title || subtitle) && (
              <div className="mb-10 text-center">
                {title && (
                  <h1 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-[#C5CBD8] text-base sm:text-lg leading-relaxed max-w-[520px] mx-auto">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            {children}
            {footer && <div className="mt-10">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
