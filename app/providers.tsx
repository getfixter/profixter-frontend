"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/useAuth";
import VisitorPromotionPopup from "@/app/components/promotion/VisitorPromotionPopup";

export default function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // If Google OAuth is not configured, render children without GoogleOAuthProvider
  if (!clientId) {
    return (
      <AuthProvider>
        {children}
        <VisitorPromotionPopup />
      </AuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        {children}
        <VisitorPromotionPopup />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
