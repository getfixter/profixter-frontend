"use client";

import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import HomeMarketing from "@/app/components/sections/HomeMarketing";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";

export default function HomePage() {
  return (
    <RoleEntryGate>
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50">
          <Header />
        </div>
        <HomeMarketing />
        <Footer />
      </div>
    </RoleEntryGate>
  );
}
