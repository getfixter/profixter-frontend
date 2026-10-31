"use client";

import { formatCountdown, type WelcomeOffer } from "@/lib/welcome-offer";
import "./welcome-offer.css";

/*
 * "Welcome Offer - 20% Off Your First Month", with the real time left. Shown
 * only while the server says this customer is eligible (lib/welcome-offer),
 * and gone the second the time is up. The countdown is not announced every
 * second to screen readers; the time left is readable on demand.
 */
export default function WelcomeOfferBanner({ offer, className = "" }: { offer: WelcomeOffer; className?: string }) {
  if (!offer.active) return null;
  return (
    <div className={`wo-banner ${className}`.trim()} data-welcome-offer>
      <div className="wo-banner__text">
        <b>Welcome Offer &mdash; {offer.percentOff}% Off Your First Month</b>
        <span>Monthly plans. Applied automatically at checkout.</span>
      </div>
      <span className="wo-banner__clock" role="timer" aria-live="off" aria-label={`${formatCountdown(offer.remainingMs)} left on the welcome offer`} data-welcome-countdown>
        {formatCountdown(offer.remainingMs)}
      </span>
    </div>
  );
}
