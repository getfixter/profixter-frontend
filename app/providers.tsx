"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/useAuth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  }

  return (
    <GoogleOAuthProvider clientId={clientId ?? ""}>
      <AuthProvider>{children}</AuthProvider>
    </GoogleOAuthProvider>
  );
}
