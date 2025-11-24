'use client';
import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';

interface AccountHeaderProps {
  userName: string;
}

export function AccountHeader({ userName }: AccountHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full py-4 px-[20px] max-w-[1240px] mx-auto">
      <div className="max-w-[1240px] mx-auto flex items-center justify-between">
        <Link href="/">
          <div className="cursor-pointer">
            <h1 className="text-lg sm:text-xl font-medium text-[#313234]">Profixter</h1>
            <p className="text-xs text-[#313234] text-right">Long Island</p>
          </div>
        </Link>
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="#how-it-works" className="text-[#313234] text-base hover:text-[#306EEC]">How it works</Link>
          <Link href="#plans" className="text-[#313234] text-base hover:text-[#306EEC]">Plans</Link>
          <Link href="#pick-day" className="text-[#313234] text-base hover:text-[#306EEC]">Pick day</Link>
          <Link href="#projects" className="text-[#313234] text-base hover:text-[#306EEC]">Projects</Link>
        </nav>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span className="text-[#313234] text-sm sm:text-base">{userName.split(' ')[0]}</span>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#C5CBD8] flex items-center justify-center">
              <svg width="24" height="22" viewBox="0 0 31 28" fill="none" className="sm:w-[31px] sm:h-[28px]">
                <path d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z" fill="#EEF2FF"/>
                <path d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z" fill="#EEF2FF"/>
              </svg>
            </div>
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 sm:w-56 bg-white border border-[#C5CBD8] rounded-[14px] shadow-lg py-2 z-50">
              {['how-it-works','plans','pick-day','projects'].map(anchor => (
                <Link
                  key={anchor}
                  href={`#${anchor}`}
                  className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {anchor.replace('-', ' ').replace('pick', 'Pick').replace('how it works','How it works')}
                </Link>
              ))}
              <div className="border-t border-[#C5CBD8] my-2" />
              <Link
                href="/"
                className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <button
                className="block w-full text-left px-4 py-3 text-sm sm:text-base text-red-600 hover:bg-[#EEF2FF] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
