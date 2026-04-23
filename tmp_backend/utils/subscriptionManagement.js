const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Subscription = require("../models/Subscription");
const User = require("../models/User");

const PLAN_PRICES = {
  basic: 149,
  plus: 249,
  premium: 349,
  elite: 499,
};

const PRICE_MAP = {
  monthly: {
    basic: "price_1RUdq2Bw0RtvSZjMnnI6uRgn",
    plus: "price_1RUds8Bw0RtvSZjMFS1BoQEU",
    premium: "price_1RUdtWBw0RtvSZjMOo8Q1as9",
    elite: "price_1RUduRBw0RtvSZjMy6ySmgHk",
  },
  annual: {
    basic: "price_1T1FWUBw0RtvSZjMFXMTrt9o",
    plus: "price_1T1FXiBw0RtvSZjMTmqGIl2d",
    premium: "price_1T1FYPBw0RtvSZjMEYMourmW",
    elite: "price_1T1FZGBw0RtvSZjMSoBGm4p6",
  },
};

const PRICE_LOOKUP = Object.entries(PRICE_MAP).reduce((acc, [billingCycle, plans]) => {
  for (const [plan, priceId] of Object.entries(plans)) {
    acc[priceId] = { plan, billingCycle };
  }
  return acc;
}, {});

function normalizePlanType(raw) {
  const plan = String(raw || "").trim().toLowerCase();
  return ["basic", "plus", "premium", "elite"].includes(plan) ? plan : null;
}

function normalizeBillingCycle(raw, fallback = "monthly") {
  return String(raw || "").trim().toLowerCase() === "annual" ? "annual" : fallback;
}

function getPriceId(plan, billingCycle = "monthly") {
  const normalizedPlan = normalizePlanType(plan);
  const normalizedCycle = normalizeBillingCycle(billingCycle);
  if (!normalizedPlan) return null;
  return PRICE_MAP[normalizedCycle]?.[normalizedPlan] || null;
}

function getPlanAndBillingFromPrice(priceId) {
  return PRICE_LOOKUP[String(priceId || "")] || { plan: null, billingCycle: "monthly" };
}

function getPlanPrice(plan) {
  return PLAN_PRICES[String(plan || "").toLowerCase()] || 0;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeSubscription(subscription, address = null) {
  return {
    _id: String(subscription._id),
    addressId: subscription.addressId ? String(subscription.addressId) : null,
    address: address
      ? {
          _id: String(address._id),
          label: address.label,
          line1: address.line1,
          city: address.city,
          state: address.state,
          zip: address.zip,
          county: address.county || "",
        }
      : null,
    addressSnapshot: subscription.addressSnapshot || null,
    subscriptionType: String(subscription.subscriptionType || "").toLowerCase(),
    status: subscription.status,
    billingCycle: subscription.billingCycle || "monthly",
    startDate: subscription.startDate || null,
    latestPaymentDate: subscription.latestPaymentDate || null,
    nextPaymentDate: subscription.nextPaymentDate || null,
    currentPeriodEnd: subscription.currentPeriodEnd || subscription.nextPaymentDate || null,
    cancelAtPeriodEnd: !!subscription.cancelAtPeriodEnd,
    cancellationDate: subscription.cancellationDate || null,
    cancellationReason: subscription.cancellationReason || null,
    planPrice: subscription.planPrice ?? null,
    stripeManaged: !!subscription.stripeSubscriptionId,
  };
}

async function syncLegacyUserSubscription(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const activeSubs = await Subscription.find({
    user: user._id,
    status: { $in: ["active", "trialing"] },
  }).sort({ currentPeriodEnd: 1, nextPaymentDate: 1, updatedAt: -1 });

  let chosen = null;
  if (user.defaultAddressId) {
    chosen =
      activeSubs.find((sub) => String(sub.addressId) === String(user.defaultAddressId)) || null;
  }
  if (!chosen) chosen = activeSubs[0] || null;

  if (!chosen) {
    user.subscription = null;
    user.subscriptionStart = null;
    user.subscriptionExpiry = null;
  } else {
    user.subscription = String(chosen.subscriptionType || "").toLowerCase();
    user.subscriptionStart = chosen.startDate || null;
    user.subscriptionExpiry =
      chosen.currentPeriodEnd || chosen.nextPaymentDate || chosen.cancellationDate || null;
    if (chosen.stripeCustomerId && !user.stripeCustomerId) {
      user.stripeCustomerId = chosen.stripeCustomerId;
    }
  }

  await user.save();
  return user;
}

async function resolveUserStripeCustomerId(user) {
  if (user?.stripeCustomerId) return user.stripeCustomerId;
  if (!user?.email) return null;

  const customers = await stripe.customers.list({
    email: String(user.email).toLowerCase(),
    limit: 10,
  });

  const customer = customers.data?.[0] || null;
  if (!customer) return null;

  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

async function resolveStripeSubscriptionForRecord({ subscription, user }) {
  if (subscription?.stripeSubscriptionId) {
    return stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });
  }

  const customerIds = new Set();
  if (subscription?.stripeCustomerId) customerIds.add(subscription.stripeCustomerId);
  if (user?.stripeCustomerId) customerIds.add(user.stripeCustomerId);

  if (!customerIds.size && user) {
    const resolvedCustomerId = await resolveUserStripeCustomerId(user);
    if (resolvedCustomerId) customerIds.add(resolvedCustomerId);
  }

  const candidates = [];
  for (const customerId of customerIds) {
    const result = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    });
    candidates.push(...result.data);
  }

  const targetPlan = normalizePlanType(subscription?.subscriptionType);
  const targetCycle = normalizeBillingCycle(subscription?.billingCycle, "monthly");
  const targetAddressId = subscription?.addressId ? String(subscription.addressId) : "";
  const targetNextPayment = subscription?.nextPaymentDate
    ? toDate(subscription.nextPaymentDate)?.getTime() || 0
    : 0;

  const scored = candidates
    .map((candidate) => {
      const item = candidate.items?.data?.[0];
      const priceId = item?.price?.id || "";
      const derived = getPlanAndBillingFromPrice(priceId);
      const metadata = candidate.metadata || {};
      const hasLocalMatch =
        !!metadata.localSubscriptionId &&
        String(metadata.localSubscriptionId) === String(subscription._id);
      const hasAddressMatch =
        !!targetAddressId && !!metadata.addressId && String(metadata.addressId) === targetAddressId;
      let score = 0;

      if (hasLocalMatch) {
        score += 300;
      }
      if (hasAddressMatch) {
        score += 200;
      }
      if (targetPlan && derived.plan === targetPlan) score += 40;
      if (targetCycle && derived.billingCycle === targetCycle) score += 20;
      if (subscription?.stripeCustomerId && String(candidate.customer) === String(subscription.stripeCustomerId)) {
        score += 15;
      }
      if (user?.stripeCustomerId && String(candidate.customer) === String(user.stripeCustomerId)) {
        score += 15;
      }

      if (targetNextPayment && candidate.current_period_end) {
        const delta = Math.abs(candidate.current_period_end * 1000 - targetNextPayment);
        if (delta < 3 * 24 * 60 * 60 * 1000) score += 10;
      }

      return { candidate, score, hasLocalMatch, hasAddressMatch };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestEntry = scored[0] || null;
  const secondEntry = scored[1] || null;
  if (!bestEntry) return null;

  if (secondEntry && bestEntry.score === secondEntry.score) {
    return null;
  }

  if (!bestEntry.hasLocalMatch && !bestEntry.hasAddressMatch && scored.length > 1) {
    return null;
  }

  const best = bestEntry.candidate;

  if (String(best.customer || "").trim() && !user?.stripeCustomerId && user) {
    user.stripeCustomerId = String(best.customer);
    await user.save();
  }

  return best;
}

async function upsertSubscriptionFromStripe({
  stripeSubscription,
  user,
  addressIdHint = null,
  stripeCheckoutSessionId = null,
}) {
  if (!stripeSubscription || !user) return null;

  const item = stripeSubscription.items?.data?.[0] || null;
  const priceId = item?.price?.id || null;
  const { plan, billingCycle } = getPlanAndBillingFromPrice(priceId);

  if (!plan) {
    throw new Error(`Unable to map Stripe price to local plan: ${priceId || "missing price id"}`);
  }

  const metadata = stripeSubscription.metadata || {};
  let subscription =
    (await Subscription.findOne({ stripeSubscriptionId: stripeSubscription.id })) ||
    null;

  if (!subscription && metadata.localSubscriptionId) {
    subscription = await Subscription.findOne({
      _id: metadata.localSubscriptionId,
      user: user._id,
    });
  }

  const addressId = metadata.addressId || addressIdHint || subscription?.addressId || null;
  const address = addressId ? user.addresses?.id(addressId) : null;
  if (!address) {
    throw new Error("Unable to resolve subscription address for Stripe subscription");
  }

  if (!subscription) {
    subscription =
      (await Subscription.findOne({
        user: user._id,
        addressId: address._id,
        status: { $in: ["active", "trialing", "past_due", "unpaid", "incomplete"] },
      }).sort({ updatedAt: -1 })) || null;
  }

  if (!subscription) {
    subscription = new Subscription({
      user: user._id,
      userId: user.userId,
      addressId: address._id,
      startDate: toDate(stripeSubscription.start_date) || new Date(),
      latestPaymentDate: toDate(stripeSubscription.current_period_start) || new Date(),
      nextPaymentDate: toDate(stripeSubscription.current_period_end) || new Date(),
    });
  }

  subscription.user = user._id;
  subscription.userId = user.userId;
  subscription.subscriptionType = plan;
  subscription.addressId = address._id;
  subscription.addressSnapshot = {
    line1: address.line1,
    city: address.city,
    state: address.state,
    zip: address.zip,
    county: address.county || "",
  };
  subscription.stripeCustomerId = String(stripeSubscription.customer || user.stripeCustomerId || "");
  subscription.stripeSubscriptionId = stripeSubscription.id;
  subscription.stripeSubscriptionItemId = item?.id || null;
  subscription.stripePriceId = priceId;
  subscription.stripeCheckoutSessionId =
    stripeCheckoutSessionId || subscription.stripeCheckoutSessionId || null;
  subscription.billingCycle = billingCycle;
  subscription.startDate = toDate(stripeSubscription.start_date) || subscription.startDate || new Date();
  subscription.latestPaymentDate =
    toDate(stripeSubscription.current_period_start) ||
    subscription.latestPaymentDate ||
    subscription.startDate ||
    new Date();
  subscription.nextPaymentDate =
    toDate(stripeSubscription.current_period_end) ||
    subscription.nextPaymentDate ||
    subscription.latestPaymentDate ||
    new Date();
  subscription.currentPeriodEnd =
    toDate(stripeSubscription.current_period_end) || subscription.currentPeriodEnd || null;
  subscription.status = stripeSubscription.status || subscription.status || "active";
  subscription.cancelAtPeriodEnd = !!stripeSubscription.cancel_at_period_end;
  subscription.cancellationDate = subscription.cancelAtPeriodEnd
    ? toDate(stripeSubscription.current_period_end)
    : toDate(stripeSubscription.canceled_at) || null;
  if (["active", "trialing"].includes(String(subscription.status || "").toLowerCase())) {
    subscription.cancellationReason = null;
  }
  subscription.planPrice = getPlanPrice(plan);
  subscription.paymentMethod = "card";

  await subscription.save();

  if (!user.stripeCustomerId && subscription.stripeCustomerId) {
    user.stripeCustomerId = subscription.stripeCustomerId;
    await user.save();
  }

  await syncLegacyUserSubscription(user._id);
  return subscription;
}

async function getOwnedSubscriptionForAddress({ userId, addressId, statuses = null }) {
  const query = {
    user: userId,
    addressId,
  };

  if (Array.isArray(statuses) && statuses.length) {
    query.status = { $in: statuses };
  }

  return Subscription.findOne(query).sort({ updatedAt: -1 });
}

module.exports = {
  stripe,
  PLAN_PRICES,
  PRICE_MAP,
  PRICE_LOOKUP,
  normalizePlanType,
  normalizeBillingCycle,
  getPriceId,
  getPlanAndBillingFromPrice,
  getPlanPrice,
  toDate,
  serializeSubscription,
  syncLegacyUserSubscription,
  resolveUserStripeCustomerId,
  resolveStripeSubscriptionForRecord,
  upsertSubscriptionFromStripe,
  getOwnedSubscriptionForAddress,
};
