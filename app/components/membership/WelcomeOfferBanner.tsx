"use client";

import { formatCountdown, type WelcomeOffer } from "@/lib/welcome-offer";
import "./welcome-offer.css";

/*
 * "Welcome Offer - 20% Off Your First Month", with the real time left. Shown
 * only while the server says this customer is eligible (lib/welcome-offer),
 * and gone the second the time is up. The countdown is not announced every
 * second to screen readers; the time left is readable on demand.
 */
/** `monthlyOnly` where only monthly billing is on offer (Book a Handyman). */
export default function WelcomeOfferBanner({ offer, className = "", monthlyOnly = false }: { offer: WelcomeOffer; className?: string; monthlyOnly?: boolean }) {
  if (!offer.active) return null;
  return (
    <div className={`wo-banner ${className}`.trim()} data-welcome-offer>
      <div className="wo-banner__text">
        <b>
          {offer.label} &mdash; {offer.percentOff}% Off Your First {monthlyOnly ? "Month" : "Payment"}
        </b>
        <span>{monthlyOnly ? "Monthly plans. Applied automatically at checkout." : "Any plan, monthly or annual. Applied automatically at checkout."}</span>
      </div>
      <span className="wo-banner__clock" role="timer" aria-live="off" aria-label={`${formatCountdown(offer.remainingMs)} left on the ${offer.label.toLowerCase()}`} data-welcome-countdown>
        {formatCountdown(offer.remainingMs)}
      </span>
    </div>
  );
}
