"use client";

import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import HomeMarketing from "@/app/components/sections/HomeMarketing";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import StartScreen from "@/app/components/start/StartScreen";

/**
 * The homepage, with a front door in front of it.
 *
 * A visitor who is not logged in gets one full screen first: the room, four
 * words, and Get Started. Everything below it is the homepage exactly as it
 * was — same route, same components, same order, same metadata and canonical
 * URL, so nothing about the detailed site or its search presence moved.
 *
 * The two are one document on purpose. "Scroll to explore" is not a link to
 * somewhere else; scrolling down *is* the navigation, which is why the front
 * door can be this bare without hiding anything.
 *
 * A member never sees it. StartScreen removes itself before first paint when
 * there is a session — see the inline check in that file — so Home stays Home
 * for the people who already pay for it, and RoleEntryGate keeps sending staff
 * to their workspace exactly as before.
 */
export default function HomePage() {
  return (
    <RoleEntryGate>
      <div className="min-h-screen bg-white">
        <StartScreen />

        <div className="sticky top-0 z-50">
          <Header />
        </div>
        <HomeMarketing />
        {/* Above the 3D layer, like every other piece of real page content. */}
        <div className="relative z-20">
          <Footer />
        </div>
      </div>
    </RoleEntryGate>
  );
}
