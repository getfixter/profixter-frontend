"use client";

import React, { useMemo, useState } from "react";
import { ADMIN_TABS, PRIMARY_MOBILE_TABS } from "./admin-tabs-config";

interface BottomNavProps {
  active: string;
  onChange: (tab: string) => void;
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => PRIMARY_MOBILE_TABS.includes(tab.id)),
    []
  );

  const secondaryTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => !PRIMARY_MOBILE_TABS.includes(tab.id)),
    []
  );

  const activeSecondary = secondaryTabs.find((tab) => tab.id === active);

  return (
    <>
      {menuOpen && (
        <button
          type="button"
          aria-label="Close admin menu"
          className="fixed inset-0 z-40 bg-slate-950/30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div
        className={`fixed inset-x-3 bottom-3 z-50 rounded-[28px] border border-slate-200/80 bg-white/95 p-2 shadow-[0_22px_60px_rgba(15,23,42,0.2)] backdrop-blur md:hidden ${
          menuOpen ? "ring-4 ring-sky-100" : ""
        }`}
      >
        {menuOpen && (
          <div className="mb-2 rounded-[22px] border border-slate-200 bg-slate-50 p-2">
            <div className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              More admin areas
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondaryTabs.map((tab) => {
                const isActive = active === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      onChange(tab.id);
                      setMenuOpen(false);
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                      isActive
                        ? `border-transparent bg-gradient-to-r ${tab.colorClass} text-white`
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      {tab.shortLabel}
                    </div>
                    <div className="mt-1 text-xs font-semibold">{tab.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <nav className="grid grid-cols-5 gap-1">
          {primaryTabs.map((tab) => {
            const isActive = active === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onChange(tab.id);
                }}
                className={`flex flex-col items-center justify-center rounded-[22px] px-2 py-2.5 transition-all ${
                  isActive ? "bg-slate-950 text-white shadow-md" : "text-slate-500"
                }`}
                title={tab.label}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[10px] font-bold ${
                    isActive ? "border-white/10 bg-white/10 text-white" : tab.badgeClass
                  }`}
                >
                  {tab.shortLabel}
                </span>
                <span className="mt-1 text-[10px] font-semibold">{tab.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className={`flex flex-col items-center justify-center rounded-[22px] px-2 py-2.5 transition-all ${
              menuOpen || activeSecondary ? "bg-slate-100 text-slate-900" : "text-slate-500"
            }`}
            title="More"
          >
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[10px] font-bold ${
                activeSecondary ? activeSecondary.badgeClass : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {activeSecondary ? activeSecondary.shortLabel : "•••"}
            </span>
            <span className="mt-1 text-[10px] font-semibold">
              {activeSecondary ? activeSecondary.label : "More"}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}
