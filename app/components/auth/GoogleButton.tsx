"use client";

import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import type { TokenResponse } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import { getAutomaticEntryPath } from "@/lib/auth-routing";
import { useAuth } from "@/lib/useAuth";

interface GoogleButtonProps {
  className?: string;
  spanClassName?: string;
  onSuccess?: () => void;
}

type AuthTokenResponse = {
  token: string;
};

type WindowWithGtag = Window & {
  gtag?: (event: string, action: string, params: Record<string, string>) => void;
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Google login failed";
}

function GoogleButtonInner({
  className = "",
  spanClassName = "",
  onSuccess,
}: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login: authLogin } = useAuth();
  const router = useRouter();

  const login = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse: TokenResponse) => {
      setLoading(true);
      setError("");

      try {
        const { data } = await API.post<AuthTokenResponse>("/api/auth/google", {
          accessToken: tokenResponse.access_token,
        });

        const verifiedUser = await authLogin(data.token);
        if (!verifiedUser) {
          throw new Error("We could not verify your Google account. Please try again.");
        }

        const browserWindow = window as WindowWithGtag;
        browserWindow.gtag?.("event", "login", { method: "Google" });

        onSuccess?.();
        router.replace(getAutomaticEntryPath(verifiedUser));
      } catch (loginError: unknown) {
        console.error("Google login failed:", loginError);
        setError(errorMessage(loginError));
        setLoading(false);
      }
    },
    onError: () => {
      console.error("Google login error");
      setError("Google login was cancelled or failed");
    },
  });

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => login()}
        disabled={loading}
        className="w-full h-16 bg-white rounded-[8px] flex items-center justify-start gap-3 px-6 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="flex-shrink-0"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>

        <span className={`text-[#3C4043] font-medium ${spanClassName}`}>
          {loading ? "Signing in..." : "Continue with Google"}
        </span>
      </button>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}

export function GoogleButton(props: GoogleButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  return <GoogleButtonInner {...props} />;
}
