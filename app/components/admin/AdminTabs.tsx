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
];

interface AdminTabsProps {
  active: string;
  onChange: (tab: string) => void;
}

export default function AdminTabs({ active, onChange }: AdminTabsProps) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            relative px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200
            ${
              active === tab.id
                ? `bg-gradient-to-r ${tab.color} text-white shadow-lg scale-105`
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-102'
            }
          `}
        >
          <span className="text-lg mr-2">{tab.icon}</span>
          {tab.label}
          {active === tab.id && (
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${tab.color} rounded-b-xl`} />
          )}
        </button>
      ))}
    </div>
  );
}
