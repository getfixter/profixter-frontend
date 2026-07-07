import Header from "@/app/components/sections/Header";
import HowItWorksSection from "@/app/components/sections/HowItWorksSection";
import PopularTasksSection from "@/app/components/sections/PopularTasksSection";
import IncludedVisitsSection from "@/app/components/sections/IncludedVisitsSection";
import PlansSection from "@/app/components/sections/PlansSection";
import TrustSection from "@/app/components/sections/TrustSection";
import FAQSection from "@/app/components/sections/FAQSection";
import Footer from "@/app/components/sections/Footer";
import StickyMobileCTA from "@/app/components/StickyMobileCTA";

export default function MembershipInfoPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <HowItWorksSection />
        <PopularTasksSection />
        <IncludedVisitsSection />
        <PlansSection />
        <TrustSection />
        <FAQSection />
        <Footer />
      </main>

      <StickyMobileCTA />
    </div>
  );
}
