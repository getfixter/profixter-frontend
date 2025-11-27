# 💳 Payment Links - Інтеграція на Next.js Frontend

## Огляд

Інструкція як підключити 4 Stripe Payment Links до вашого Next.js фронтенду з передачею addressId для автоматичної активації підписок.

---

## 🎯 Що потрібно зробити

У вас є **4 картки з планами** і кнопки "Subscribe" на кожній. Потрібно:
1. Отримати `addressId` користувача (default або обрана адреса)
2. Додати його до Payment Link як `client_reference_id`
3. Зробити редирект на Stripe Payment Page
4. Після оплати webhook створить підписку автоматично

---

## 📦 1. Створити константи з Payment Links

Створіть файл `lib/stripe-links.ts` або `constants/stripe.ts`:

```typescript
// lib/stripe-links.ts
export const PAYMENT_LINKS = {
  basic: "https://buy.stripe.com/eVqfZgeAN2pCgAxb3kawo02",
  plus: "https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03",
  premium: "https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04",
  elite: "https://buy.stripe.com/5kQ28qeANaW8ac93ASawo01",
} as const;

export type PlanType = keyof typeof PAYMENT_LINKS;

export const PLAN_DETAILS = [
  {
    id: "basic" as PlanType,
    name: "Basic",
    price: 149,
    description: "Great for steady small jobs",
    features: [
      "Unlimited requests",
      "Basic improvements",
      "Labor included",
    ],
  },
  {
    id: "plus" as PlanType,
    name: "Plus",
    price: 249,
    description: "More momentum each month",
    features: [
      "White-glove scheduling",
      "Consultation",
      "Standard materials included",
    ],
  },
  {
    id: "premium" as PlanType,
    name: "Premium",
    price: 349,
    description: "Most popular for busy homes",
    recommended: true,
    features: [
      "Renovation consultation",
      "Get 2 pros when needed",
      "24/7 emergency help",
    ],
  },
  {
    id: "elite" as PlanType,
    name: "Elite",
    price: 499,
    description: "For busy homes & properties",
    features: [
      "Property manager perks",
      "Seasonal property inspection",
      "Exclusive discount",
    ],
  },
];
```

---

## 🔧 2. Створити функцію редиректу

Створіть `lib/payment-redirect.ts`:

```typescript
// lib/payment-redirect.ts
import { PAYMENT_LINKS, type PlanType } from "./stripe-links";

interface RedirectToPaymentOptions {
  plan: PlanType;
  addressId: string;
  userEmail?: string;
}

/**
 * Редирект користувача на Stripe Payment Link
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
```

---

## 🎨 3. Компонент з картками планів

### Варіант A: Server Component + Client кнопка

```tsx
// app/subscriptions/page.tsx (Server Component)
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { PLAN_DETAILS } from "@/lib/stripe-links";

export default async function SubscriptionsPage() {
  // Отримати користувача (наприклад, з auth session)
  const user = await getCurrentUser(); // ваша функція
  
  if (!user) {
    redirect("/login");
  }

  const defaultAddress = user.addresses?.find(
    (a) => a._id === user.defaultAddressId
  ) || user.addresses?.[0];

  const addressId = defaultAddress?._id;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-4">
        Choose Your Plan
      </h1>
      <p className="text-center text-gray-600 mb-12">
        Start your 7-day free trial today
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLAN_DETAILS.map((plan) => (
          <SubscriptionCard
            key={plan.id}
            plan={plan}
            addressId={addressId}
            userEmail={user.email}
          />
        ))}
      </div>

      {/* Опціонально: Address picker */}
      {user.addresses && user.addresses.length > 1 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Subscription will be assigned to: <b>{defaultAddress?.line1}</b>
          </p>
          <a href="/account/addresses" className="text-blue-600 hover:underline text-sm">
            Change address
          </a>
        </div>
      )}
    </div>
  );
}
```

### Компонент картки:

```tsx
// components/SubscriptionCard.tsx
"use client";

import { useState } from "react";
import { redirectToPayment } from "@/lib/payment-redirect";
import type { PlanType } from "@/lib/stripe-links";

interface SubscriptionCardProps {
  plan: {
    id: PlanType;
    name: string;
    price: number;
    description: string;
    recommended?: boolean;
    features: string[];
  };
  addressId?: string;
  userEmail?: string;
}

export function SubscriptionCard({
  plan,
  addressId,
  userEmail,
}: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!addressId) {
      alert("Please add an address first");
      window.location.href = "/account/addresses";
      return;
    }

    setLoading(true);

    try {
      // Tracking (опціонально)
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "begin_checkout", {
          value: plan.price,
          currency: "USD",
          items: [{ item_id: plan.id, item_name: plan.name }],
        });
      }

      // Редирект на Stripe
      redirectToPayment({
        plan: plan.id,
        addressId,
        userEmail,
      });
    } catch (error) {
      console.error("Payment redirect error:", error);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className={`
        relative rounded-xl border-2 p-6 bg-white shadow-lg
        ${plan.recommended ? "border-blue-500 shadow-blue-100" : "border-gray-200"}
        hover:shadow-xl transition-all
      `}
    >
      {/* Recommended badge */}
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        {plan.name}
      </h3>

      {/* Price */}
      <div className="mb-4">
        <span className="text-4xl font-bold text-gray-900">
          ${plan.price}
        </span>
        <span className="text-gray-500">/month</span>
      </div>

      {/* Description */}
      <p className="text-gray-600 mb-6">{plan.description}</p>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Subscribe button */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`
          w-full py-3 px-4 rounded-lg font-semibold text-white
          transition-all
          ${
            plan.recommended
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-800 hover:bg-gray-900"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {loading ? "Loading..." : "Start Free Trial"}
      </button>

      <p className="text-xs text-gray-500 text-center mt-3">
        7-day free trial • Cancel anytime
      </p>
    </div>
  );
}
```

---

## 🔄 4. Альтернатива: Address Picker

Якщо користувач має кілька адрес, додайте селектор:

```tsx
// app/subscriptions/page.tsx
"use client";

import { useState } from "react";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { PLAN_DETAILS } from "@/lib/stripe-links";

export default function SubscriptionsPage({ user }) {
  const [selectedAddressId, setSelectedAddressId] = useState(
    user.defaultAddressId || user.addresses?.[0]?._id || ""
  );

  const selectedAddress = user.addresses?.find(
    (a) => a._id === selectedAddressId
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-4">
        Choose Your Plan
      </h1>

      {/* Address selector */}
      {user.addresses && user.addresses.length > 0 && (
        <div className="max-w-md mx-auto mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Address
          </label>
          <select
            value={selectedAddressId}
            onChange={(e) => setSelectedAddressId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {user.addresses.map((addr) => (
              <option key={addr._id} value={addr._id}>
                {addr.label || "Address"} — {addr.line1}, {addr.city}, {addr.state}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLAN_DETAILS.map((plan) => (
          <SubscriptionCard
            key={plan.id}
            plan={plan}
            addressId={selectedAddressId}
            userEmail={user.email}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## ✅ 5. Checklist для інтеграції

- [ ] Створити `lib/stripe-links.ts` з константами
- [ ] Створити `lib/payment-redirect.ts` з функцією редиректу
- [ ] Створити компонент `SubscriptionCard.tsx`
- [ ] Створити сторінку `/subscriptions` або `/pricing`
- [ ] Отримати `addressId` користувача (з auth session або API)
- [ ] Додати tracking (Google Analytics, Facebook Pixel) - опціонально
- [ ] Протестувати редирект з правильними параметрами
- [ ] Перевірити що `client_reference_id` передається в URL

---

## 🧪 6. Тестування

### Перевірити URL перед редиректом:

Додайте `console.log` в `payment-redirect.ts`:

```typescript
console.log("🔗 Payment URL:", url.toString());
// Має бути:
// https://buy.stripe.com/...?client_reference_id=673abc123&prefilled_email=user@example.com
```

### Тестова картка Stripe:

- **Номер:** 4242 4242 4242 4242
- **CVV:** 123
- **Дата:** Будь-яка майбутня (12/25)

### Перевірити webhook логи:

Після тестової оплати в backend логах має бути:

```
🔔 Checkout session completed: cs_test_...
📦 Detected plan from price_id: premium
📍 Found address from client_reference_id: 673abc123
✅ Subscription created: premium for user@example.com
```

---

## 🎨 7. Додаткові покращення

### Success Page

Створіть `/subscription/success/page.tsx`:

```tsx
// app/subscription/success/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SubscriptionSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Дати час webhook спрацювати (2-5 секунд)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 Payment Successful!
          </h2>
          <p className="text-gray-600">Activating your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Subscription Activated!
        </h1>
        <p className="text-gray-600 mb-8">
          Your account has been upgraded successfully. You can now schedule your first service.
        </p>
        <a
          href="/dashboard"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
```

### Налаштувати Success URL в Stripe

В Stripe Dashboard для кожного Payment Link:
- **Success URL:** `https://profixter.com/subscription/success?session_id={CHECKOUT_SESSION_ID}`
- **Cancel URL:** `https://profixter.com/subscriptions`

---

## 🛡️ 8. Безпека

### ✅ Що захищено:

- `client_reference_id` передається через URL (публічний, не sensitive)
- Webhook верифікує signature (`STRIPE_WEBHOOK_SECRET`)
- Backend перевіряє що користувач з таким email існує
- Backend перевіряє що addressId належить користувачу

### ⚠️ Важливо:

- **НЕ** передавайте sensitive дані (паролі, токени) в URL
- **Завжди** верифікуйте webhook signature на backend
- **Перевіряйте** що addressId належить користувачу перед створенням підписки

---

## 📊 9. Моніторинг

### Google Analytics 4:

```typescript
// В SubscriptionCard.tsx
window.gtag?.("event", "begin_checkout", {
  value: plan.price,
  currency: "USD",
  items: [{ item_id: plan.id, item_name: plan.name }],
});
```

### Facebook Pixel:

```typescript
// В SubscriptionCard.tsx
window.fbq?.("track", "InitiateCheckout", {
  value: plan.price,
  currency: "USD",
  content_name: plan.name,
});
```

---

## 🚀 Готово!

Тепер у вас є:
- ✅ 4 картки з планами
- ✅ Кнопки "Subscribe" з редиректом на Stripe
- ✅ Автоматична передача `addressId` через `client_reference_id`
- ✅ Pre-fill email користувача
- ✅ Backend webhook готовий обробляти платежі
- ✅ Success page для гарного UX

**Можна приймати платежі!** 🎉
