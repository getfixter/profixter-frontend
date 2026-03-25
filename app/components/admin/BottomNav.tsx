'use client';

import React from 'react';
import { ADMIN_TABS } from './admin-tabs-config';

interface BottomNavProps {
  active: string;
  onChange: (tab: string) => void;
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div className="md:hidden">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {ADMIN_TABS.map((tab) => {
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                title={tab.label}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${
                    isActive
                      ? 'border-white/10 bg-white/10 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {tab.shortLabel}
                </span>
                {isActive && <span>{tab.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
