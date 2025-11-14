import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import StepsSection from "./components/StepsSection";
import PlansSection from "./components/PlansSection";
import ServicesSection from "./components/ServicesSection";
import BookingSection from "./components/BookingSection";
import HandymenSection from "./components/HandymenSection";
import ProjectsSection from "./components/ProjectsSection";
import Footer from "./components/Footer";

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
    </div>
  );
}
