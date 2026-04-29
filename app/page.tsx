"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import Header from "./components/sections/Header";
import EntryHeroSection from "./components/sections/EntryHeroSection";
import PathSplitSection from "./components/sections/PathSplitSection";
import Footer from "./components/sections/Footer";
import { ChatWidget } from "./components/ChatWidget";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function EntryPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Admin shortcut
  useEffect(() => {
    if (isLoading) return;
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      router.replace("/admin?tab=bookings");
    }
  }, [isLoading, user, router]);

  // Clear post-login flag
  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem("justLoggedIn");
    if (justLoggedIn) {
      sessionStorage.removeItem("justLoggedIn");
      window.location.reload();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#080F1E] overflow-x-hidden">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <EntryHeroSection />
        <PathSplitSection />
        <Footer />
      </main>

      <ChatWidget />
    </div>
  );
}
