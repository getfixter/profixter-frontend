"use client";

import React from "react";

/**
 * Bottom navigation bar for mobile devices.
 *
 * This component renders a fixed bottom bar with icons and labels for each
 * admin tab. It is only visible on small screens (hidden on md and up).
 * When a tab is selected the background and text colors change to indicate
 * the active state. Clicking a tab will call the onChange callback just
 * like the existing AdminTabs component.
 */
interface BottomNavItem {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface BottomNavProps {
  active: string;
  onChange: (tab: string) => void;
}

// Define the same tabs here as in AdminTabs plus the new "Technicians" tab.
const navItems: BottomNavItem[] = [
  { id: "bookings", label: "Bookings", icon: "📅", color: "text-blue-600" },
  { id: "users", label: "Users", icon: "👤", color: "text-purple-600" },
  { id: "subscribed", label: "Subscribed", icon: "✅", color: "text-green-600" },
  { id: "emails", label: "Emails", icon: "✉️", color: "text-orange-600" },
  { id: "blacklist", label: "Blacklist", icon: "⛔", color: "text-red-600" },
  { id: "calendar", label: "Calendar", icon: "🗓️", color: "text-indigo-600" },
  { id: "techs", label: "Technicians", icon: "🛠️", color: "text-teal-600" },
];

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center py-2 flex-1 transition-colors ${
                isActive ? `${item.color} font-semibold` : "text-gray-500"
              }`}
              title={item.label}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {/* Labels are hidden on very small screens to preserve space. */}
              <span className="text-[10px] leading-none mt-0.5 hidden sm:inline">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}