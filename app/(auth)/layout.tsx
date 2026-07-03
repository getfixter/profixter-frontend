import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-dark-form relative min-h-screen w-full overflow-hidden" style={{ background: "#080F1E" }}>
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/pass-bg.webp"
          alt=""
          fill
          className="object-cover"
          priority
          style={{ opacity: 0.07 }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #080F1E 0%, #0B1628 55%, #060E1C 100%)" }}
        />
        {/* Blue ambient glow */}
        <div
          aria-hidden="true"
          className="absolute -top-80 -left-80 h-[900px] w-[900px] rounded-full blur-[220px] opacity-[0.18]"
          style={{ background: "#306EEC" }}
        />
        {/* Green ambient glow */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full blur-[200px] opacity-[0.06]"
          style={{ background: "#4ADE80" }}
        />
        {/* Dot texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Mobile logo — desktop logo lives inside the left panel */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20 lg:hidden">
        <Link href="/">
          <Image src="/images/logo.svg" alt="Fixter" width={80} height={32} />
        </Link>
      </div>

      {children}
    </div>
  );
}
