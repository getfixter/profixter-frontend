'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';

export default function AdminHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#0b1220] to-[#1a2332] border-b border-[#2a3442] shadow-lg">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white hover:text-[#306EEC] transition-colors">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"
                  fill="currentColor"
                  opacity="0.3"
                />
                <path
                  d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
                  fill="currentColor"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-white font-bold text-lg">Admin Panel</h1>
              <p className="text-[#94a3b8] text-xs">ProFixter Management</p>
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[#1e293b] rounded-lg">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#306EEC] to-[#1e40af] flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="text-left">
                <div className="text-white text-sm font-medium">
                  {user?.name || 'Admin'}
                </div>
                <div className="text-[#94a3b8] text-xs">{user?.email}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-[#1e293b] hover:bg-[#2d3b4f] text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
