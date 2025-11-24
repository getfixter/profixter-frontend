import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

// Shared layout for auth pages: extracts background + logo only.
// Children must provide their own inner positioning/padding wrappers.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image src="/images/pass-bg.png" alt="Background" fill className="object-cover" priority />
      </div>
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 lg:top-12 lg:left-12 z-20">
        <Link href="/">
          <Image src="/images/logo.svg" alt="ProFixter" width={80} height={32} />
        </Link>
      </div>
      {children}
    </div>
  );
}
