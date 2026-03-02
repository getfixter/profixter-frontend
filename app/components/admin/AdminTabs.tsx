'use client';

import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const tabs: Tab[] = [
  { id: 'bookings', label: 'Bookings', icon: '📅', color: 'from-blue-500 to-blue-600' },
  { id: 'users', label: 'Users', icon: '👤', color: 'from-purple-500 to-purple-600' },
  { id: 'subscribed', label: 'Subscribed', icon: '✅', color: 'from-green-500 to-green-600' },
  { id: 'emails', label: 'Emails', icon: '✉️', color: 'from-orange-500 to-orange-600' },
  { id: 'blacklist', label: 'Blacklist', icon: '⛔', color: 'from-red-500 to-red-600' },

  // ⭐ ADD THIS:
  { id: 'calendar', label: 'Calendar', icon: '🗓️', color: 'from-indigo-500 to-indigo-600' },
  // 🛠️ Technicians tab for managing service providers
  { id: 'techs', label: 'Technicians', icon: '🛠️', color: 'from-teal-500 to-teal-600' },
];

interface AdminTabsProps {
  active: string;
  onChange: (tab: string) => void;
}

export default function AdminTabs({ active, onChange }: AdminTabsProps) {
  return (
    <>
      {/* Top horizontal tab bar for desktop/tablet */}
      <div className="flex gap-1.5 md:gap-2 items-center flex-wrap md:static relative">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={
              `relative px-3 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-all duration-200 ` +
              (active === tab.id
                ? `bg-gradient-to-r ${tab.color} text-white shadow-lg md:scale-105`
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-md active:scale-95 md:hover:scale-102')
            }
          >
            <span className="text-base md:text-lg mr-1 md:mr-2">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>

            {active === tab.id && (
              <div
                className={`absolute bottom-0 left-0 right-0 h-0.5 md:h-1 bg-gradient-to-r ${tab.color} rounded-b-lg md:rounded-b-xl`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Fixed bottom navigation bar for mobile phones. Hidden on md and above. */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex justify-around items-center py-1">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={`mobile-${tab.id}`}
                onClick={() => onChange(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'
                }`}
                title={tab.label}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-[9px] leading-none mt-0.5 hidden sm:inline-block">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
