'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MAIN_NAV_LINKS } from '@/lib/site-architecture';
import type { ActiveTab } from './types';

interface AccountHeaderProps {
  userName: string;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onLogout: () => void;
}

const accountItems: { key: ActiveTab; label: string }[] = [
  { key: 'overview', label: 'Account overview' },
  // Visits are under Book; ?tab=bookings redirects there.
  { key: 'plan', label: 'Membership' },
  { key: 'personal', label: 'Profile & property' },
  { key: 'password', label: 'Security' },
];

export function AccountHeader({ userName, activeTab, onSelectTab, onLogout }: AccountHeaderProps) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const initial = (userName || "U").charAt(0).toUpperCase();
  const firstName = userName.split(' ')[0] || "Account";

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleSelectTab = (tab: ActiveTab) => {
    onSelectTab(tab);
    setIsAccountOpen(false);
  };

  return (
    <header className="relative z-50 w-full border-b border-[#E0E6F5] bg-white">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-5 h-[48px] flex items-center justify-between gap-4">

        {/* Logo. The same dark chip the marketing pages use: Account was the
            one place the brand appeared as plain black text, so the signed-in
            half of the site did not look like the half that sold it. */}
        <Link
          href="/"
          aria-label="Profixter home"
          className="flex flex-shrink-0 items-center rounded-[6px] bg-[#0B1628] px-2 py-1.5 transition hover:bg-[#172033] sm:px-2.5"
        >
          <Image
            src="/images/logo-footer.svg"
            alt="Profixter Long Island"
            width={113}
            height={24}
            className="nav-brand-logo"
          />
        </Link>

        {/* Website nav */}
        <nav className="hidden items-center gap-1 rounded-[6px] border border-[#E6ECF7] bg-[#F8FAFF] p-1 lg:flex" aria-label="Website navigation">
          {MAIN_NAV_LINKS.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[6px] px-3.5 py-2 text-[13px] font-black text-[#172033] transition-colors hover:bg-white hover:text-[#306EEC]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Account menu */}
        <div className="relative flex-shrink-0" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setIsAccountOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isAccountOpen}
            className="flex items-center gap-2 rounded-[6px] border border-[#D8E2F2] bg-white py-1.5 pl-2 pr-3 shadow-sm transition hover:bg-[#F8FAFF] sm:pl-3"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#306EEC]">
              <span className="text-[13px] font-bold leading-none text-white">{initial}</span>
            </span>
            <span className="hidden text-[14px] font-black text-[#313234] sm:block">{firstName}</span>
            <span className="text-[12px] font-black text-[#64748B] sm:hidden">Account</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className={`text-[#64748B] transition-transform ${isAccountOpen ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {isAccountOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-[min(290px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-[#E0E6F5] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.16)]"
            >
              <div className="border-b border-[#EEF2F7] bg-[#F8FAFF] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748B]">My Account</div>
                <div className="mt-0.5 truncate text-[15px] font-black text-[#0B1628]">{firstName}</div>
              </div>

              <div className="p-2">
                {accountItems.map((item) => {
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectTab(item.key)}
                      className={[
                        "flex w-full items-center justify-between rounded-[8px] px-3 py-3 text-left text-[14px] font-black transition",
                        active ? "bg-[#EEF5FF] text-[#306EEC]" : "text-[#344054] hover:bg-[#F8FAFF]",
                      ].join(" ")}
                    >
                      <span>{item.label}</span>
                      {active ? <span className="h-1.5 w-1.5 rounded-full bg-[#306EEC]" /> : null}
                    </button>
                  );
                })}

                <div className="my-2 border-t border-[#EEF2F7]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAccountOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center rounded-[8px] px-3 py-3 text-left text-[14px] font-black text-red-600 transition hover:bg-red-50"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : null}
        </div>

      </div>
    </header>
  );
}
