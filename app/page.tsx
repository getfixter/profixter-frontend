"use client";

import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import HomeMarketing from "@/app/components/sections/HomeMarketing";
import HomeLanding from "@/app/components/home/HomeLanding";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";

/**
 * The homepage.
 *
 * Anyone who is not a member lands on the booker: the first screen states the
 * offer in a line and lets them describe the job, pick a real time and book
 * their First Free Visit before they have an account. Signup comes last.
 *
 * It replaced a full-screen front door whose only button was "Get Started" to
 * /signup - a registration wall on the very first tap.
 *
 * A member keeps the home they already know (HomeMarketing, with its member
 * CTA), because an offer they cannot use is noise to them. RoleEntryGate still
 * sends staff to their workspace exactly as before.
 */
export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const isMember = isAuthenticated && hasActiveMembership(user);

  return (
    <RoleEntryGate>
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50">
          <Header />
        </div>
        {isMember ? <HomeMarketing /> : <HomeLanding />}
        {/* Above the 3D layer, like every other piece of real page content. */}
        <div className="relative z-20">
          <Footer />
        </div>
      </div>
    </RoleEntryGate>
  );
}
