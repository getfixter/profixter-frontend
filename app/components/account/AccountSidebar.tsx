"use client";

import type { ReactNode } from "react";
import { ActiveTab } from "./types";

interface AccountSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout?: () => void;
  userName: string;
  userEmail?: string;
}

const menuItems: {
  key: ActiveTab;
  label: string;
  icon: ReactNode;
}[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "bookings",
    label: "My Visits",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    key: "plan",
    label: "My Plan",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    key: "personal",
    label: "Profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "password",
    label: "Security",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

export function AccountSidebar({
  activeTab,
  setActiveTab,
  onLogout,
  userName,
  userEmail,
}: AccountSidebarProps) {
  const initial = (userName || "M").charAt(0).toUpperCase();
  const firstName = userName.split(" ")[0] || "Member";

  return (
    <aside className="hidden lg:flex lg:flex-col w-[260px] xl:w-[280px] flex-shrink-0">

      {/* Member card */}
      <div className="bg-white border border-[#E0E6F5] rounded-[16px] p-5 mb-4">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#F0F4FF]">
          <div className="w-11 h-11 rounded-full bg-[#306EEC] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[17px] font-bold leading-none">{initial}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[#313234] truncate">{firstName}</div>
            {userEmail && (
              <div className="text-[11px] text-[#6A6D71] truncate mt-0.5">{userEmail}</div>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] border border-[#D7E0F5] px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#306EEC]" />
          <span className="text-[11px] font-bold text-[#306EEC] uppercase tracking-[0.12em]">
            Fixter Member
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white border border-[#E0E6F5] rounded-[16px] overflow-hidden flex-1">
        {menuItems.map((item, i) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                i !== menuItems.length - 1 ? "border-b border-[#F0F4FF]" : ""
              } ${
                isActive
                  ? "bg-[#EEF2FF] text-[#306EEC]"
                  : "text-[#6A6D71] hover:bg-[#F8FAFF] hover:text-[#313234]"
              }`}
            >
              <span className={`flex-shrink-0 transition-colors ${isActive ? "text-[#306EEC]" : "text-[#9CA3AF]"}`}>
                {item.icon}
              </span>
              <span className={`text-[14px] font-semibold transition-colors ${isActive ? "text-[#306EEC]" : ""}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#306EEC] flex-shrink-0" />
              )}
            </button>
          );
        })}

        {/* Divider + logout */}
        <div className="border-t border-[#F0F4FF]">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-[#DC2626] hover:bg-red-50 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="text-[14px] font-semibold">Log Out</span>
          </button>
        </div>
      </nav>

      {/* Help footer */}
      <div className="mt-4 bg-white border border-[#E0E6F5] rounded-[14px] p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] mb-2">Need help?</div>
        <a
          href="tel:631-599-1363"
          className="flex items-center gap-2 text-[13px] font-semibold text-[#306EEC] hover:text-[#2557C7] transition"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 10.91a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18.09z" />
          </svg>
          631-599-1363
        </a>
      </div>

    </aside>
  );
}
