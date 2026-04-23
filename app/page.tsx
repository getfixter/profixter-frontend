"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import Header from "./components/sections/Header";
import HeroSection from "./components/sections/HeroSection";
import QuizSection from "./components/sections/QuizSection";
import DepartmentsSection from "./components/sections/DepartmentsSection";
import Footer from "./components/sections/Footer";
import PlansSection from "./components/sections/PlansSection";
import BookingSection from "./components/sections/BookingSection";
import ServicesSection from "./components/sections/ServicesSection";
import HandymenSection from "./components/sections/HandymenSection";
import TrustSection from "./components/sections/TrustSection";
import FinalCTASection from "./components/sections/FinalCTASection";
import PopularTasksSection from "./components/sections/PopularTasksSection";

import { ChatWidget } from "./components/ChatWidget";
import Image from "next/image";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr) => addr.hasActiveSubscription);

  const isRegistered = !!isAuthenticated && !isSubscribed;
  const isVisitor = !isAuthenticated;

  useEffect(() => {
    if (isLoading) return;

    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (isAdmin) {
      router.replace("/admin?tab=bookings");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem("justLoggedIn");
    if (justLoggedIn) {
      sessionStorage.removeItem("justLoggedIn");
      window.location.reload();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main className="relative">
        <HeroSection />

        {/* ========================================= */}
        {/* SUBSCRIBED VERSION                        */}
        {/* Goal: make using the membership easy      */}
        {/* ========================================= */}
        {isSubscribed && (
          <>
            <BookingSection />
            <PlansSection />
            <TrustSection />
            <PopularTasksSection />
            <ServicesSection />
            <HandymenSection />
            <FinalCTASection />
            <Footer />
          </>
        )}

        {/* ========================================= */}
        {/* REGISTERED BUT NOT SUBSCRIBED VERSION     */}
        {/* Goal: push subscription + remove doubts   */}
        {/* ========================================= */}
        {isRegistered && (
          <>
            <PlansSection />
            <TrustSection />
            <PopularTasksSection />
            <BookingSection />
            <QuizSection />
            <ServicesSection />
            <HandymenSection />
            <DepartmentsSection />
            <FinalCTASection />
            <Footer />
          </>
        )}

        {/* ========================================= */}
        {/* VISITOR VERSION                           */}
        {/* Goal: simple, clear, high conversion      */}
        {/* ========================================= */}
        {isVisitor && (
          <>
            <PlansSection />
            <TrustSection />
            <PopularTasksSection />
            <BookingSection />
            <QuizSection />
            <ServicesSection />
            <HandymenSection />
            <DepartmentsSection />
            <FinalCTASection />
            <Footer />
          </>
        )}
      </main>

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
