// lib/payment-redirect.ts
import { PAYMENT_LINKS, type PlanType } from "./stripe-links";

interface RedirectToPaymentOptions {
  plan: PlanType;
  addressId: string;
  userEmail?: string;
}

/**
 * Редирект користувача на Stripe Payment Link з передачею addressId
 * @param plan - Тип плану (basic, plus, premium, elite)
 * @param addressId - ID адреси для прив'язки підписки
 * @param userEmail - Email користувача (опціонально, для pre-fill)
 */
export function redirectToPayment({
  plan,
  addressId,
  userEmail,
}: RedirectToPaymentOptions): void {
  const baseUrl = PAYMENT_LINKS[plan];

  if (!baseUrl) {
    console.error("❌ Invalid plan:", plan);
    throw new Error(`Payment link not found for plan: ${plan}`);
  }

  if (!addressId) {
    console.error("❌ Missing addressId");
    throw new Error("Address ID is required for subscription");
  }

  // Будуємо URL з параметрами
  const url = new URL(baseUrl);
  
  // Передаємо addressId через client_reference_id (ОБОВ'ЯЗКОВО!)
  url.searchParams.set("client_reference_id", addressId);
  
  // Pre-fill email якщо є
  if (userEmail) {
    url.searchParams.set("prefilled_email", userEmail);
  }

  console.log("🔗 Redirecting to Stripe Payment Link:", url.toString());

  // Редирект
  window.location.href = url.toString();
}
