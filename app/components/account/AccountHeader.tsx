'use client';

import Image from 'next/image';
import Link from 'next/link';

interface AccountHeaderProps {
  userName: string;
}

export function AccountHeader({ userName }: AccountHeaderProps) {
  const initial = (userName || "U").charAt(0).toUpperCase();
  const firstName = userName.split(' ')[0] || "Account";

  return (
    <header className="w-full bg-white border-b border-[#E0E6F5]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-5 h-[60px] flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/images/logo.svg"
            alt="Fixter"
            width={82}
            height={30}
            className="h-[28px] sm:h-[30px] w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#6A6D71] hover:text-[#313234] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to Fixter
          </Link>
          <Link
            href="/membership"
            className="text-[13px] font-medium text-[#6A6D71] hover:text-[#313234] transition"
          >
            Plans
          </Link>
        </nav>

        {/* User avatar */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#306EEC] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[13px] font-bold leading-none">{initial}</span>
          </div>
          <span className="hidden sm:block text-[14px] font-semibold text-[#313234]">{firstName}</span>
        </div>

      </div>
    </header>
  );
}
