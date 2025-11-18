'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

type Step = 'email' | 'otp' | 'newPassword' | 'success';
type OtpError = 'invalid' | 'expired' | null;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState<OtpError>(null);
  const [timer, setTimer] = useState(60);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown
  useEffect(() => {
    if (step === 'otp' && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, timer]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('otp');
    setTimer(60);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError(null);

    // Auto-focus next input
    if (value && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate validation
    const otpValue = otp.join('');
    if (otpValue === '6666') {
      setOtpError('invalid');
    } else if (timer === 0) {
      setOtpError('expired');
    } else {
      setStep('newPassword');
    }
  };

  const handleResendOtp = () => {
    setTimer(60);
    setOtp(['', '', '', '']);
    setOtpError(null);
  };

  const handleNewPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('success');
  };

  const handleCancel = () => {
    setStep('email');
    setPassword('');
    setRepeatPassword('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')} Sec`;
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/pass-bg.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Logo */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 lg:top-12 lg:left-12 z-20">
        <Link href="/">
          <Image src="/images/logo.svg" alt="ProFixter" width={80} height={32} />
        </Link>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-20 pb-12">
        <div 
          className="w-full max-w-[440px] rounded-[20px] p-12 backdrop-blur-[10px]"
          style={{
            background: 'linear-gradient(180deg, rgba(49, 50, 52, 0.4) 0%, rgba(49, 50, 52, 0.2) 50%, rgba(49, 50, 52, 0.3) 100%), rgba(238, 242, 255, 0.1)',
            boxShadow: '0px 0px 80px 0px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Step 1: Email Input */}
          {step === 'email' && (
            <div className="text-center">
              <h1 className="text-white text-3xl font-semibold mb-8">Forgot password?</h1>
              
              {/* Lock Icon */}
              <div className="flex justify-center mb-8">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="20" y="35" width="40" height="35" rx="5" fill="white"/>
                  <path d="M30 35V25C30 19.4772 34.4772 15 40 15C45.5228 15 50 19.4772 50 25V35" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                  <circle cx="40" cy="52" r="4" fill="#313234"/>
                </svg>
              </div>

              <p className="text-[#C5CBD8] text-base mb-12">
                We'll send you the updated<br />instructions shortly.
              </p>

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

                <button
                  type="submit"
                  className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors"
                >
                  Reset password
                </button>

                <Link 
                  href="/signin" 
                  className="block text-white text-base hover:underline"
                >
                  Back to login
                </Link>
              </form>
            </div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'otp' && (
            <div className="text-center">
              <h1 className="text-white text-3xl font-semibold mb-8">Check your Email</h1>
              
              {/* Lock Icon */}
              <div className="flex justify-center mb-8">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="20" y="35" width="40" height="35" rx="5" fill="white"/>
                  <path d="M30 35V25C30 19.4772 34.4772 15 40 15C45.5228 15 50 19.4772 50 25V35" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                  <circle cx="40" cy="52" r="4" fill="#313234"/>
                </svg>
              </div>

              <h2 className="text-white text-xl font-medium mb-2">OTP VERIFICATION</h2>
              <p className="text-[#C5CBD8] text-base mb-8">
                Enter the OTP sent to {email || 'tar***65.com'}
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* OTP Input */}
                <div className="flex justify-center gap-4 mb-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputRefs.current[index] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className={`w-16 h-16 text-center text-2xl font-medium rounded-[14px] bg-white/90 text-[#313234] focus:outline-none focus:ring-2 transition-all ${
                        otpError ? 'border-2 border-red-500 ring-2 ring-red-500' : 'focus:ring-[#306EEC]'
                      }`}
                    />
                  ))}
                </div>

                {/* Error Messages */}
                {otpError === 'invalid' && (
                  <p className="text-red-500 text-base font-medium">
                    Invalid OTP. Please try again!
                  </p>
                )}
                {otpError === 'expired' && (
                  <p className="text-red-500 text-base font-medium">
                    OTP expired. Please generate<br />a new OTP and try again!
                  </p>
                )}

                {/* Timer */}
                {!otpError && timer > 0 && (
                  <p className="text-white text-base">
                    {formatTime(timer)}
                  </p>
                )}

                {/* Resend Button */}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-white text-base hover:underline"
                >
                  Re-send
                </button>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors"
                >
                  Verify code
                </button>

                <Link 
                  href="/signin" 
                  className="block text-white text-base hover:underline"
                >
                  Back to login
                </Link>
              </form>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 'newPassword' && (
            <div className="text-center">
              <h1 className="text-white text-3xl font-semibold mb-8">New credentials</h1>
              
              {/* Lock Icon */}
              <div className="flex justify-center mb-12">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="20" y="35" width="40" height="35" rx="5" fill="white"/>
                  <path d="M30 35V25C30 19.4772 34.4772 15 40 15C45.5228 15 50 19.4772 50 25V35" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                  <circle cx="40" cy="52" r="4" fill="#313234"/>
                </svg>
              </div>

              <form onSubmit={handleNewPasswordSubmit} className="space-y-8">
                {/* Create Password */}
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pb-3 bg-transparent border-b border-white text-white placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors pr-10"
                      placeholder="Create password"
                      aria-label="Create password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 bottom-3 text-white/60 hover:text-white transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Repeat Password */}
                <div>
                  <div className="relative">
                    <input
                      type={showRepeatPassword ? 'text' : 'password'}
                      id="repeat-password"
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      className="w-full pb-3 bg-transparent border-b border-white text-white placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors pr-10"
                      placeholder="Repeat password"
                      aria-label="Repeat password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                      className="absolute right-0 bottom-3 text-white/60 hover:text-white transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showRepeatPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors mt-12"
                >
                  Submit
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  className="block w-full text-white text-base hover:underline"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <h1 className="text-white text-3xl font-semibold mb-8">Password updated</h1>
              
              {/* Success Icon */}
              <div className="flex justify-center mb-8">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <path d="M20 45L35 60L65 25" stroke="#4CAF50" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <p className="text-[#C5CBD8] text-base mb-12">
                Your password has been updated
              </p>

              <Link
                href="/signin"
                className="block w-full py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors"
              >
                Sing in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
