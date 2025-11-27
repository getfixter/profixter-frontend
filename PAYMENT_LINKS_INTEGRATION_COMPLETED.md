# ✅ Payment Links Integration - Completed

## Що було зроблено

### 1. Створено файл з константами Stripe Links
**Файл:** `/lib/stripe-links.ts`

- Додано PAYMENT_LINKS з посиланнями для 4 планів (basic, plus, premium, elite)
- Створено типи PlanType та PlanDetails
- Експортовано PLAN_DETAILS з повною інформацією про кожен план

### 2. Створено функцію редиректу на Stripe
**Файл:** `/lib/payment-redirect.ts`

Функція `redirectToPayment()` виконує:
- Валідацію плану та addressId
- Додає `client_reference_id` (addressId) до URL
- Додає `prefilled_email` якщо є
- Робить редирект на Stripe Payment Link

### 3. Інтегровано в PlansSection компонент
**Файл:** `/app/components/sections/PlansSection.tsx`

Додано:
- Імпорт `useAuth` для отримання даних користувача
- Імпорт `redirectToPayment` для редиректу
- Функцію `handleSubscribe()` яка:
  - Перевіряє чи користувач залогінений
  - Отримує default address користувача
  - Валідує наявність адреси
  - Викликає redirectToPayment з addressId
- Замінено всі `<a>` кнопки на `<button>` з onClick

## Як це працює

### Користувач НЕ залогінений:
1. Натискає "Get started Free"
2. Редирект на `/signin?redirect=/`
3. Після логіну повертається на головну

### Користувач залогінений БЕЗ адреси:
1. Натискає "Get started Free"
2. Alert: "Please add an address to your account first"
3. Редирект на `/account`

### Користувач залогінений З адресою:
1. Натискає "Get started Free"
2. Система бере default address (або першу)
3. Редирект на Stripe з URL:
   ```
   https://buy.stripe.com/xxx?client_reference_id=ADDRESS_ID&prefilled_email=user@email.com
   ```
4. Користувач оплачує
5. Webhook на бекенді отримує `client_reference_id` (addressId)
6. Підписка автоматично прив'язується до адреси

## Приклад URL редиректу

```
https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04?client_reference_id=67890abcdef12345&prefilled_email=john@example.com
```

## Плани та посилання

| План | Ціна | Stripe Link |
|------|------|-------------|
| Basic | $149/mo | `https://buy.stripe.com/eVqfZgeAN2pCgAxb3kawo02` |
| Plus | $249/mo | `https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03` |
| Premium | $349/mo | `https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04` |
| Elite | $449/mo | `https://buy.stripe.com/5kQ28qeANaW8ac93ASawo01` |

## Що відбувається на бекенді

Webhook `checkout.session.completed` отримує:
```json
{
  "client_reference_id": "67890abcdef12345",
  "customer_email": "john@example.com",
  "subscription": "sub_1234567890"
}
```

І автоматично:
1. Знаходить користувача по email
2. Знаходить address по `client_reference_id`
3. Створює запис у колекції `subscriptions`:
   ```json
   {
     "userId": "12345678",
     "addressId": "67890abcdef12345",
     "plan": "premium",
     "stripeSubscriptionId": "sub_1234567890",
     "status": "active",
     "startDate": "2025-11-26",
     "nextBillingDate": "2025-12-26"
   }
   ```

## Перевірка роботи

1. Відкрийте головну сторінку
2. Натисніть на будь-який план
3. Якщо не залогінені - редирект на логін
4. Якщо залогінені - редирект на Stripe з addressId в URL
5. Перевірте console.log: `🔗 Redirecting to Stripe Payment Link: ...`

## Подальші покращення (опціонально)

### Якщо потрібно вибирати адресу перед оплатою:
Можна додати модальне вікно для вибору адреси перед редиректом на Stripe:

```tsx
const [showAddressSelector, setShowAddressSelector] = useState(false);
const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

const handleSubscribe = (planName: string) => {
  if (!isAuthenticated || !user) {
    window.location.href = '/signin?redirect=/';
    return;
  }

  if (!user.addresses || user.addresses.length === 0) {
    alert('Please add an address to your account first');
    window.location.href = '/account';
    return;
  }

  // Якщо більше 1 адреси - показати selector
  if (user.addresses.length > 1) {
    setSelectedPlan(planName);
    setShowAddressSelector(true);
    return;
  }

  // Інакше одразу редирект
  proceedToPayment(planName, user.addresses[0]._id);
};
```

### Показ підтвердження перед редиректом:
Можна додати toast notification:
```tsx
import { toast } from 'react-hot-toast';

redirectToPayment({
  plan: planType,
  addressId: defaultAddress._id,
  userEmail: user.email,
});

toast.success(`Redirecting to checkout for ${planName} plan...`);
```

## Тестування

1. **Без логіну**: ✅ Редирект на /signin
2. **З логіном без адреси**: ✅ Alert + редирект на /account
3. **З логіном та адресою**: ✅ Редирект на Stripe з addressId в URL
4. **Всі 4 плани**: ✅ Правильні посилання для кожного плану
5. **Email prefill**: ✅ Email передається в URL

---

**Статус:** ✅ Готово до використання
**Дата:** 26 листопада 2025
