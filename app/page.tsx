"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import Header from "./components/sections/Header";
import NewHeroSection from "./components/sections/NewHeroSection";
import QuizSection from "./components/sections/QuizSection";
import ValuePropsSection from "./components/sections/ValuePropsSection";
import DepartmentsSection from "./components/sections/DepartmentsSection";
import TestimonialsSection from "./components/sections/TestimonialsSection";
import Footer from "./components/sections/Footer";

import HeroSection from "./components/sections/HeroSection";
import StepsSection from "./components/sections/StepsSection";
import ServiceInfoSection from "./components/sections/ServiceInfoSection";
import PlansSection from "./components/sections/PlansSection";
import BookingSection from "./components/sections/BookingSection";
import ServicesSection from "./components/sections/ServicesSection";
import HandymenSection from "./components/sections/HandymenSection";
import ProjectsSection from "./components/sections/ProjectsSection";

import { ChatWidget } from "./components/ChatWidget";
import Image from "next/image";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!(
      (user?.subscription && user.subscription !== "") ||
      user?.addresses?.some((addr) => addr.hasActiveSubscription)
    );

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
        {/* ========================================= */}
        {/* SUBSCRIBED VERSION                        */}
        {/* Goal: make using the membership easy      */}
        {/* ========================================= */}
        {isSubscribed && (
          <>  
            <BookingSection />
            <ServiceInfoSection />
            <PlansSection />
            <ServicesSection />
            <HandymenSection />
            <Footer />
          </>
        )}

        {/* ========================================= */}
        {/* REGISTERED BUT NOT SUBSCRIBED VERSION     */}
        {/* Goal: push subscription + remove doubts   */}
        {/* ========================================= */}
        {isRegistered && (
          <>
            <QuizSection />
                        <ServiceInfoSection />
<ServicesSection />
            <PlansSection />
            
            
            
            <HandymenSection />
            <ProjectsSection />
            <DepartmentsSection />
            <Footer />
          </>
        )}

        {/* ========================================= */}
        {/* VISITOR VERSION                           */}
        {/* Goal: simple, clear, high conversion      */}
        {/* ========================================= */}
        {isVisitor && (
          <>
            <ServiceInfoSection />
            <QuizSection />
            <ServicesSection />

            {/* <ValuePropsSection /> */}
            <PlansSection />
            <HandymenSection />
            <DepartmentsSection />
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