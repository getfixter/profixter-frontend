'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordField } from '../../components/auth/PasswordField';
import { OtpArray } from '../../components/auth/types';
import { requestPasswordReset, verifyOTP, setNewPassword } from '@/lib/auth-service';

// NOTE: Moved into (auth) route group; multi-step flow unchanged.
type Step = 'email' | 'otp' | 'newPassword' | 'success';
type OtpError = 'invalid' | 'expired' | null;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<OtpArray>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<OtpError>(null);
  const [timer, setTimer] = useState(60);
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (step === 'otp' && timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [step, timer]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await requestPasswordReset(email);
      setStep('otp');
      setTimer(60);
    } catch (err: any) {
      console.error('Request password reset failed:', err);
      const message = err.response?.data?.message || 'Failed to send reset code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp] as OtpArray;
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError(null);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');
    
    if (otpValue.length !== 6) {
      setOtpError('invalid');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { token } = await verifyOTP(email, otpValue);
      setResetToken(token);
      setStep('newPassword');
    } catch (err: any) {
      console.error('Verify OTP failed:', err);
      const message = err.response?.data?.message || '';
      if (message.includes('expired')) {
        setOtpError('expired');
      } else {
        setOtpError('invalid');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setTimer(60);
    setOtp(['', '', '', '', '', ''] as OtpArray);
    setOtpError(null);
    setError('');
    
    try {
      await requestPasswordReset(email);
    } catch (err: any) {
      console.error('Resend OTP failed:', err);
      const message = err.response?.data?.message || 'Failed to resend code';
      setError(message);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (password !== repeatPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await setNewPassword(resetToken, password);
      setStep('success');
      // Redirect to signin after 2 seconds
      setTimeout(() => {
        window.location.href = '/signin';
      }, 2000);
    } catch (err: any) {
      console.error('Set new password failed:', err);
      const message = err.response?.data?.message || 'Failed to update password. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStep('email');
    setPassword('');
    setRepeatPassword('');
    setError('');
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')} Sec`;
  };

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-20 pb-12">
      <div
        className="w-full max-w-[440px] rounded-[20px] p-12 backdrop-blur-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(49, 50, 52, 0.4) 0%, rgba(49, 50, 52, 0.2) 50%, rgba(49, 50, 52, 0.3) 100%), rgba(238, 242, 255, 0.1)',
          boxShadow: '0px 0px 80px 0px rgba(0, 0, 0, 0.25)',
        }}
      >
          {step === 'email' && (
            <div className="text-center">
              <h1 className="text-white text-3xl font-semibold mb-8">Forgot password?</h1>
              <div className="flex justify-center mb-8">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="20" y="35" width="40" height="35" rx="5" fill="white" />
                  <path d="M30 35V25C30 19.4772 34.4772 15 40 15C45.5228 15 50 19.4772 50 25V35" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="40" cy="52" r="4" fill="#313234" />
                </svg>
              </div>
              <p className="text-[#C5CBD8] text-base mb-12">We'll send you the updated<br />instructions shortly.</p>
              <form onSubmit={handleEmailSubmit} className="space-y-8">
                <div>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pb-3 bg-transparent border-b border-white text-white placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                    placeholder="Email"
                    aria-label="Email"
                    required
                  />
                </div>
                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Sending...' : 'Reset password'}
                </button>
                <Link href="/signin" className="block text-white text-base hover:underline">
                  Back to login
                </Link>
              </form>
            </div>
          )}
          {step === 'otp' && (
            <div className="text-center">
              <h1 className="text-white text-3xl font-semibold mb-8">Check your Email</h1>
              <div className="flex justify-center mb-8">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="20" y="35" width="40" height="35" rx="5" fill="white" />
                  <path d="M30 35V25C30 19.4772 34.4772 15 40 15C45.5228 15 50 19.4772 50 25V35" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="40" cy="52" r="4" fill="#313234" />
                </svg>
              </div>
              <h2 className="text-white text-xl font-medium mb-2">OTP VERIFICATION</h2>
              <p className="text-[#C5CBD8] text-base mb-8">Enter the OTP sent to {email || 'tar***65.com'}</p>
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className={`w-12 h-12 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-medium rounded-[14px] bg-white/90 text-[#313234] focus:outline-none focus:ring-2 transition-all ${
                        otpError ? 'border-2 border-red-500 ring-2 ring-red-500' : 'focus:ring-[#306EEC]'
                      }`}
                    />
                  ))}
                </div>
                {otpError === 'invalid' && <p className="text-red-500 text-base font-medium">Invalid OTP. Please try again!</p>}
                {otpError === 'expired' && (
                  <p className="text-red-500 text-base font-medium">OTP expired. Please generate<br />a new OTP and try again!</p>
                )}
                {!otpError && timer > 0 && <p className="text-white text-base">{formatTime(timer)}</p>}
                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    {error}
                  </div>
                )}
                <button type="button" onClick={handleResendOtp} disabled={loading} className="text-white text-base hover:underline disabled:opacity-50">
                  Re-send
                </button>
                <button type="submit" disabled={loading} className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Verifying...' : 'Verify code'}
                </button>
                <Link href="/signin" className="block text-white text-base hover:underline">
                  Back to login
                </Link>
              </form>
            </div>
          )}
          {step === 'newPassword' && (
            <div className="text-center">
              <h1 className="text-white text-3xl font-semibold mb-8">New credentials</h1>
              <div className="flex justify-center mb-12">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="20" y="35" width="40" height="35" rx="5" fill="white" />
                  <path d="M30 35V25C30 19.4772 34.4772 15 40 15C45.5228 15 50 19.4772 50 25V35" stroke="white" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="40" cy="52" r="4" fill="#313234" />
                </svg>
              </div>
              <form onSubmit={handleNewPasswordSubmit} className="space-y-8">
                <PasswordField
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  inputClassName="w-full pb-3"
                  required
                />
                <PasswordField
                  id="repeat-password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  placeholder="Repeat password"
                  inputClassName="w-full pb-3"
                  required
                />
                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors mt-12 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Updating...' : 'Submit'}
                </button>
                <button type="button" onClick={handleCancel} className="block w-full text-white text-base hover:underline">
                  Cancel
                </button>
              </form>
            </div>
          )}
          {step === 'success' && (
            <div className="text-center py-8">
              <h1 className="text-white text-3xl font-semibold mb-8">Password updated</h1>
              <div className="flex justify-center mb-8">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <path d="M20 45L35 60L65 25" stroke="#4CAF50" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-[#C5CBD8] text-base mb-12">Your password has been updated</p>
              <Link href="/signin" className="block w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors">
                Sing in
              </Link>
            </div>
          )}
      </div>
    </div>
  );
}
