"use client";

import { useState } from "react";
import "./confirm-email-offer.css";
import { useAuth } from "@/lib/useAuth";
import { useContactCompletion } from "./ContactCompletion";

/**
 * After a purchase made with one code (2026-11-20): the email they typed is a
 * receipt address until they prove it. Receipts and billing notices already go
 * there; visit details, private links and sign-in by email wait for this code
 * (BackEnd utils/communications emailPolicy). Optional - nothing waits on it.
 */
export default function ConfirmEmailOffer({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { editContact, contactSheet } = useContactCompletion();
  const [confirmed, setConfirmed] = useState(false);

  if (!user?.email || user.emailIsAppleRelay) return null;
  if (user.emailVerified && !confirmed) return null;

  if (confirmed) {
    return (
      <div className={`bk-confirm-email ${className}`} data-confirm-email="done" role="status">
        <p className="bk-confirm-email__title">Email confirmed</p>
        <p className="bk-confirm-email__text">Visit details will come to {user.email} too, and you can sign in with it.</p>
      </div>
    );
  }

  return (
    <div className={`bk-confirm-email ${className}`} data-confirm-email="offer">
      <p className="bk-confirm-email__title">Confirm your email</p>
      <p className="bk-confirm-email__text">
        Your receipt goes to <b>{user.email}</b>. Confirm it with a quick code to get visit details by email and sign in with it. Not right? Change it in the same step.
      </p>
      <button
        type="button"
        className="ui-btn ui-btn--secondary ui-btn--block"
        data-confirm-email-start
        onClick={async () => {
          if (await editContact("email")) setConfirmed(true);
        }}
      >
        Confirm my email
      </button>
      {contactSheet}
    </div>
  );
}
