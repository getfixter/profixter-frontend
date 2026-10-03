"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/useAuth";
import VisitorPromotionPopup from "@/app/components/promotion/VisitorPromotionPopup";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import KioskReturn from "@/app/components/event/KioskReturn";

export default function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // If Google OAuth is not configured, render children without GoogleOAuthProvider
  if (!clientId) {
    return (
      <AuthProvider>
        {children}
        <VisitorPromotionPopup />
        <InstallAppPrompt />
        <KioskReturn />
      </AuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        {children}
        <VisitorPromotionPopup />
        <InstallAppPrompt />
        <KioskReturn />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
