'use client';

import React from 'react';
import { ADMIN_TABS, type AdminTabItem } from './admin-tabs-config';

interface AdminTabsProps {
  active: string;
  onChange: (tab: string) => void;
  tabs?: AdminTabItem[];
}

export default function AdminTabs({ active, onChange, tabs = ADMIN_TABS }: AdminTabsProps) {
  return (
    <div className="hidden md:block">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => {
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                  {tab.shortLabel}
                </div>
                <div className="mt-1 text-sm font-semibold">{tab.label}</div>
                <div className={`mt-1 text-xs ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                  {tab.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
