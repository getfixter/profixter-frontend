'use client';

import React from 'react';
import { ADMIN_TABS } from './admin-tabs-config';

interface AdminTabsProps {
  active: string;
  onChange: (tab: string) => void;
}

export default function AdminTabs({ active, onChange }: AdminTabsProps) {
  return (
    <div className="hidden md:block">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2 lg:gap-3">
          {ADMIN_TABS.map((tab) => {
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`group relative min-w-[152px] rounded-2xl border px-4 py-3 text-left transition-all ${
                  isActive
                    ? `border-transparent bg-gradient-to-r ${tab.colorClass} text-white shadow-[0_10px_30px_rgba(37,99,235,0.22)]`
                    : 'border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        isActive ? 'text-white/70' : 'text-slate-400'
                      }`}
                    >
                      {tab.shortLabel}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{tab.label}</div>
                    <div
                      className={`mt-1 text-xs ${
                        isActive ? 'text-white/80' : 'text-slate-500'
                      }`}
                    >
                      {tab.description}
                    </div>
                  </div>
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold ${
                      isActive
                        ? 'border-white/20 bg-white/10 text-white'
                        : `border-transparent ${tab.badgeClass}`
                    }`}
                  >
                    {tab.shortLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
