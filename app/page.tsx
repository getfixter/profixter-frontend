"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import Header from "./components/sections/Header";
import HeroSection from "./components/sections/HeroSection";
import StepsSection from "./components/sections/StepsSection";
import PlansSection from "./components/sections/PlansSection";
import ServicesSection from "./components/sections/ServicesSection";
import BookingSection from "./components/sections/BookingSection";
import HandymenSection from "./components/sections/HandymenSection";
import ProjectsSection from "./components/sections/ProjectsSection";
import Footer from "./components/sections/Footer";
import { ChatWidget } from "./components/ChatWidget";
import Image from "next/image";
import ServiceInfoSection from "./components/sections/ServiceInfoSection";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const router = useRouter();
  const { user, isLoading } = useAuth();

  // ✅ Redirect admin to admin panel on home load
  useEffect(() => {
    if (isLoading) return;

    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (isAdmin) {
      router.replace("/admin?tab=bookings");
    }
  }, [isLoading, user, router]);

  // Existing logic
  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem("justLoggedIn");
    if (justLoggedIn) {
      sessionStorage.removeItem("justLoggedIn");
      window.location.reload();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ✅ Use sticky instead of absolute for consistent layout */}
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main className="relative">
        <HeroSection />
        <ServiceInfoSection />
        <BookingSection />
        <StepsSection />
        <PlansSection />
        <ServicesSection />
        <HandymenSection />
        <ProjectsSection />
        <Footer />
      </main>

      {/* ✅ Chat button */}
      <div className="fixed bottom-16 sm:bottom-24 right-6 sm:right-8 z-[999999]">
        <button
          onClick={() => setIsChatOpen((v) => !v)}
          className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] bg-[#306eec] hover:bg-[#2558c9] transition-all duration-300 rounded-full shadow-xl flex items-center justify-center hover:scale-110"
          aria-label="Open chat"
        >
          <Image
            src="/images/icons/messages.svg"
            alt="Open chat"
            width={32}
            height={32}
            className="sm:w-[40px] sm:h-[40px]"
          />
        </button>
      </div>

      <ChatWidget isOpen={isChatOpen} onToggle={() => setIsChatOpen((v) => !v)} />
    </div>
  );
}
