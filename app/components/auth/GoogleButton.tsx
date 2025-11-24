'use client';

import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import API from '@/lib/api';
import { getPostLoginRedirect } from '@/lib/auth-helpers';

interface GoogleButtonProps {
  className?: string;
  spanClassName?: string;
  onSuccess?: () => void;
}

// Custom styled Google OAuth button
export function GoogleButton({ className = '', spanClassName = '', onSuccess }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      
      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        // Send to backend
        const { data } = await API.post('/api/auth/google', {
          idToken: tokenResponse.access_token,
          email: userInfo.email,
          name: userInfo.name,
          googleId: userInfo.sub,
        });

        // Save JWT token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'login', { method: 'Google' });
        }

        // Redirect based on user role (admin -> /admin, user -> /account)
        const redirectPath = getPostLoginRedirect(data.user.email);
        window.location.href = redirectPath;
        
        if (onSuccess) {
          onSuccess();
        }

      } catch (error: any) {
        console.error('Google login failed:', error);
        const message = error.response?.data?.message || 'Google login failed';
        setError(message);
        setLoading(false);
      }
    },
    onError: () => {
      console.error('Google login error');
      setError('Google login was cancelled or failed');
    },
  });

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => login()}
        disabled={loading}
        className="w-full h-16 bg-white rounded-[14px] flex items-center justify-start gap-3 px-6 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span className={`text-[#3C4043] font-medium ${spanClassName}`}>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </span>
      </button>
      
      {error && (
        <p className="text-red-500 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
