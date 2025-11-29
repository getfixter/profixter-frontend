'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { PasswordField } from '../../components/auth/PasswordField';
import { login } from '@/lib/auth-service';
import { getPostLoginRedirect } from '@/lib/auth-helpers';

// NOTE: Structure moved into (auth) route group. Visual styles intentionally unchanged.
export default function SignInPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token, user } = await login({ email: email.toLowerCase().trim(), password });

      // Save token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Remember email if checked
      if (keepSignedIn) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Redirect based on email (admin -> /admin, user -> /account)
// Determine redirect path
const redirectPath = getPostLoginRedirect(user.email.toLowerCase());

// Admin → follow admin redirect
if (redirectPath === '/admin') {
  router.push('/admin');
return;

}

// Regular user → MAIN dashboard
router.push('/');
return;






    } catch (err: any) {
      console.error('Login failed:', err);
      const message = err.response?.data?.message || 'Invalid email or password';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-20">
      <div
        className="w-full max-w-[440px] rounded-[20px] p-12 backdrop-blur-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(49, 50, 52, 0.3) 0%, rgba(49, 50, 52, 0.2) 50%, rgba(49, 50, 52, 0.5) 100%), rgba(238, 242, 255, 0.1)',
          boxShadow: '0px 0px 80px 0px rgba(0, 0, 0, 0.25)',
        }}
      >
          <div className="flex gap-8 mb-12">
            <button
              onClick={() => setActiveTab('signin')}
              className={`text-2xl font-medium pb-2 transition-colors relative ${
                activeTab === 'signin' ? 'text-white' : 'text-white/60'
              }`}
            >
              Sign in
              {activeTab === 'signin' && (
                <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#306EEC]" />
              )}
            </button>
            <Link href="/signup" className="text-2xl font-medium pb-2 text-white/60 hover:text-white transition-colors">
              Sign up
            </Link>
          </div>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <GoogleButton className="w-full max-w-[318px]" spanClassName="text-base" />
            <div>
              <input
                type="text"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input w-full pb-3 bg-transparent border-b border-white text-white placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                placeholder="Email"
                aria-label="Email"
              />
            </div>
            <div>
              <PasswordField
  id="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  placeholder="Password"
  inputClassName="glass-input w-full pb-3"
/>

            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-white rounded flex items-center justify-center peer-checked:bg-transparent peer-checked:border-white">
                    {keepSignedIn && (
                      <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                        <path d="M1 5.5L5 9.5L13 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-white text-base">Keep me signed in</span>
              </label>
              <Link href="/forgot-password" className="text-white text-base hover:underline">
                Forgot password?
              </Link>
            </div>
            {error && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors mt-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
      </div>
    </div>
  );
}
