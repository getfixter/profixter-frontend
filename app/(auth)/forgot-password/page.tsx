'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import AuthScreen, {
  AuthHeading,
  AuthInput,
  AuthPassword,
  AuthSubmit,
} from '@/app/components/auth/AuthScreen';
import { OtpArray } from '../../components/auth/types';
import { requestPasswordReset, verifyOTP, setNewPassword } from '@/lib/auth-service';

// NOTE: Moved into (auth) route group; multi-step flow unchanged.
type Step = 'email' | 'otp' | 'newPassword' | 'success';
type OtpError = 'invalid' | 'expired' | null;
type ApiError = { response?: { data?: { message?: string } } };

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
    } catch (err: unknown) {
      console.error('Request password reset failed:', err);
      const message = (err as ApiError).response?.data?.message || 'Failed to send reset code. Please try again.';
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
    } catch (err: unknown) {
      console.error('Verify OTP failed:', err);
      const message = (err as ApiError).response?.data?.message || '';
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
    } catch (err: unknown) {
      console.error('Resend OTP failed:', err);
      const message = (err as ApiError).response?.data?.message || 'Failed to resend code';
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
    } catch (err: unknown) {
      console.error('Set new password failed:', err);
      const message = (err as ApiError).response?.data?.message || 'Failed to update password. Please try again.';
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

  /*
   * One shell, four states.
   *
   * This page used to be its own small design: a translucent grey card, an
   * 80px padlock drawn four times, headings at a different size to the rest of
   * auth, and underline inputs found nowhere else on the site. A customer who
   * forgot their password left a light blue product and arrived somewhere
   * else. Same shell, same input, same button as sign in now.
   */
  return (
    <AuthScreen altLabel="Log In" altHref="/signin">
      {step === 'email' && (
        <>
          <AuthHeading sub="We'll email you a code.">Reset your password</AuthHeading>
          <form onSubmit={handleEmailSubmit} className="auth-fields" noValidate>
            <AuthInput
              id="email"
              label="Email address"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
            {error && <p className="auth-error auth-error--form">{error}</p>}
            <AuthSubmit disabled={loading} loading={loading}>
              {loading ? 'Sending' : 'Send code'}
            </AuthSubmit>
          </form>
        </>
      )}

      {step === 'otp' && (
        <>
          <AuthHeading sub={`Sent to ${email}.`}>Enter your code</AuthHeading>
          <form onSubmit={handleVerifyOtp} className="auth-fields" noValidate>
            <div className="flex justify-between gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpInputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1}`}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="auth-input h-[58px] flex-1 px-0 text-center text-[22px] font-bold"
                  aria-invalid={otpError ? true : undefined}
                />
              ))}
            </div>
            {otpError === 'invalid' && <p className="auth-error">That code is not right.</p>}
            {otpError === 'expired' && <p className="auth-error">That code has expired.</p>}
            {!otpError && timer > 0 && (
              <p className="text-[13px] font-medium text-[#6B7688]">Expires in {formatTime(timer)}</p>
            )}
            {error && <p className="auth-error auth-error--form">{error}</p>}
            <AuthSubmit disabled={loading} loading={loading}>
              {loading ? 'Checking' : 'Continue'}
            </AuthSubmit>
          </form>
          <p className="auth-alt">
            <button type="button" onClick={handleResendOtp} disabled={loading} className="auth-inline-link disabled:opacity-50">
              Send a new code
            </button>
          </p>
        </>
      )}

      {step === 'newPassword' && (
        <>
          <AuthHeading sub="At least 8 characters.">Choose a new password</AuthHeading>
          <form onSubmit={handleNewPasswordSubmit} className="auth-fields" noValidate>
            <AuthPassword
              id="new-password"
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
            />
            {/*
              The confirmation stays HERE and only here. On sign up a typo is
              recoverable - this page is the recovery. On this page a typo would
              lock somebody out of the thing they came to fix.
            */}
            <AuthPassword
              id="repeat-password"
              label="Repeat new password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              required
            />
            {error && <p className="auth-error auth-error--form">{error}</p>}
            <AuthSubmit disabled={loading} loading={loading}>
              {loading ? 'Saving' : 'Save password'}
            </AuthSubmit>
          </form>
          <p className="auth-alt">
            <button type="button" onClick={handleCancel} className="auth-inline-link">
              Cancel
            </button>
          </p>
        </>
      )}

      {step === 'success' && (
        <>
          <AuthHeading>Password updated</AuthHeading>
          <p className="auth-sub">You can sign in with it now.</p>
          <Link href="/signin" className="auth-submit mt-6">
            Log In
          </Link>
        </>
      )}
    </AuthScreen>
  );
}
