'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import API from '@/lib/api';

export default function AdminHeader() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  return (
    <header className="bg-gradient-to-r from-[#0b1220] to-[#1a2332] border-b border-[#2a3442] shadow-lg">
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
              onClick={() => setShowPassword(true)}
              className="px-3 py-2 bg-[#1e293b] hover:bg-[#2d3b4f] text-white rounded-lg font-medium text-sm"
            >
              Password
            </button>
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
      {showPassword && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPasswordMessage('');
              try {
                await API.post('/api/auth/change-password', { currentPassword, newPassword });
                await refreshUser();
                setPasswordMessage('Password updated.');
                setCurrentPassword('');
                setNewPassword('');
              } catch (error) {
                const response = error as { response?: { data?: { message?: string } } };
                setPasswordMessage(response.response?.data?.message || 'Password update failed.');
              }
            }}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-slate-950">Change Password</h2>
            <input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3" />
            <input type="password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (8+ characters)" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3" />
            {passwordMessage && <p className="mt-3 text-sm text-slate-600">{passwordMessage}</p>}
            <div className="mt-4 flex gap-2">
              <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Update</button>
              <button type="button" onClick={() => setShowPassword(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Close</button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
