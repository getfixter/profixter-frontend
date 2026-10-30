"use client";

import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import HomeMarketing from "@/app/components/sections/HomeMarketing";
import HomeLanding from "@/app/components/home/HomeLanding";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";
import "./home.css";

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
 * Website 3.0: the first screen now leads with the membership itself
 * ("Your home. Your handyman. One membership."), and the booker sits just
 * below; see HomeLanding. A member gets their own short home (HomeMarketing):
 * a greeting and the places they actually go, because an offer they cannot use
 * is noise to them. RoleEntryGate still sends staff to their workspace exactly
 * as before.
 */
export default function HomePageClient() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMember = isAuthenticated && hasActiveMembership(user);

  /* The account is known: show the right homepage (see AUTH_PENDING_SCRIPT). */
  useEffect(() => {
    if (!isLoading) delete document.documentElement.dataset.authPending;
  }, [isLoading]);

  return (
    <RoleEntryGate>
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50">
          <Header />
        </div>
        <div className="hm-gate">
          {isMember ? <HomeMarketing /> : <HomeLanding signedIn={isAuthenticated && !isLoading} />}
        </div>
        {/* Above the 3D layer, like every other piece of real page content. */}
        <div className="relative z-20">
          <Footer />
        </div>
      </div>
    </RoleEntryGate>
  );
}
