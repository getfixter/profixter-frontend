import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import StepsSection from "./components/StepsSection";
import PlansSection from "./components/PlansSection";
import ServicesSection from "./components/ServicesSection";
import BookingSection from "./components/BookingSection";
import HandymenSection from "./components/HandymenSection";
import ProjectsSection from "./components/ProjectsSection";
import Footer from "./components/Footer";
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <div className="absolute top-0 left-0 w-full z-20">
        <Header />
      </div>
      <HeroSection />
      <StepsSection />
      <PlansSection />
      <ServicesSection />
     
      <BookingSection />
      <HandymenSection />
       <ProjectsSection />
      <Footer />

      {/* Global Chat Widget Icon - aligned to right edge of container */}
      <div
        className="fixed bottom-16 sm:bottom-24 z-[999999]"
        style={{ right: 'max(1.5rem, calc((100vw - 1240px)/2 + 20px))' }}
      >
        <button
          className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] bg-[#306eec] hover:bg-[#2558c9] transition-all duration-300 rounded-full shadow-xl flex items-center justify-center hover:scale-110 pointer-events-auto"
          aria-label="Open chat"
        >
          <Image src="/images/icons/messages.svg" alt="Open chat" width={32} height={32} className="sm:w-[40px] sm:h-[40px]" />
        </button>
      </div>
    </div>
  );
}
