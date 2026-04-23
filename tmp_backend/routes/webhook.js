const crypto = require("crypto");
const User = require("../models/User");
const RepAttribution = require("../models/RepAttribution");
const { normalizeEmail, normalizePhone } = require("../utils/identity");
const { syncGhlConversion } = require("../utils/ghlSync");
const mail = require("../utils/emailService");
const { createOrUpdateContact, addTag } = require("../utils/ghlContact");
const {
  stripe,
  getPlanPrice,
  upsertSubscriptionFromStripe,
  syncLegacyUserSubscription,
} = require("../utils/subscriptionManagement");

const PAYMENT_FAILURE_STATUSES = new Set(["past_due", "unpaid", "incomplete_expired"]);

function sha256(value) {
  if (!value) return undefined;
  return crypto
    .createHash("sha256")
    .update(String(value).trim().toLowerCase())
    .digest("hex");
}

function normPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "1" + digits;
  return digits;
}

function cleanObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (entry) => entry !== undefined && entry !== null && String(entry).trim() !== ""
      );
      if (!filtered.length) continue;
      out[key] = filtered;
      continue;
    }
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

function buildUserData({ email, phone, externalId, fbp, fbc, clientIp, userAgent }) {
  return cleanObject({
    external_id: externalId ? [sha256(externalId)] : undefined,
    em: email ? [sha256(email)] : undefined,
    ph: phone ? [sha256(normPhone(phone))] : undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    client_ip_address: clientIp || undefined,
    client_user_agent: userAgent || undefined,
  });
}

async function sendMetaCapi(body) {
  try {
    if (typeof fetch !== "function") {
      console.warn("Meta CAPI skipped: fetch not available");
      return;
    }

    const pixelId = process.env.FB_PIXEL_ID;
    const token = process.env.FB_ACCESS_TOKEN;
    if (!pixelId || !token) return;

    const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${token}`;
    const payload = { data: [cleanObject(body)] };
    if (process.env.FB_TEST_CODE) {
      payload.test_event_code = process.env.FB_TEST_CODE;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let json;
    try {
      json = await response.json();
    } catch {
      json = { raw: await response.text() };
    }

    if (!response.ok) {
      console.warn("Meta CAPI failed:", response.status, json);
    }
  } catch (error) {
    console.warn("Meta CAPI (webhook) failed:", error.message);
  }
}

async function findBestLeadMatch({ user }) {
  let doc = null;

  if (user?._id) {
    doc = await RepAttribution.findOne({ matchedUserId: user._id }).sort({
      assignedAt: -1,
      createdAt: -1,
    });
  }

  if (!doc) {
    const phoneNormalized = normalizePhone(user?.phone);
    if (phoneNormalized) {
      doc = await RepAttribution.findOne({
        phoneNormalized,
        status: { $in: ["active", "registered", "subscribed"] },
      }).sort({ assignedAt: -1, createdAt: -1 });
    }
  }

  if (!doc) {
    const emailNormalized = normalizeEmail(user?.email);
    if (emailNormalized) {
      doc = await RepAttribution.findOne({
        emailNormalized,
        status: { $in: ["active", "registered", "subscribed"] },
      }).sort({ assignedAt: -1, createdAt: -1 });
    }
  }

  return doc;
}

async function markLeadSubscribed({ user, subscription, plan, billingCycle, value }) {
  try {
    const match = await findBestLeadMatch({ user });
    if (!match) {
      console.log("No cold-lead match found on subscription for:", user.email);
      return;
    }

    match.matchedUserId = user._id;
    match.matchedSubscriptionId = subscription._id;
    match.emailRaw = user.email || match.emailRaw;
    match.emailNormalized = normalizeEmail(user.email) || match.emailNormalized;
    match.phoneRaw = user.phone || match.phoneRaw;
    match.phoneNormalized = normalizePhone(user.phone) || match.phoneNormalized;

    if (!match.fullName && user.name) match.fullName = user.name;
    if (!match.cityAtAssignment && user.city) match.cityAtAssignment = user.city;
    if (!match.stateAtAssignment && user.state) match.stateAtAssignment = user.state;

    match.status = "subscribed";
    match.conversionType = "subscribed";
    if (!match.registeredAt) match.registeredAt = new Date();
    if (!match.subscribedAt) match.subscribedAt = new Date();

    match.subscriptionPlan = plan || null;
    match.subscriptionBillingCycle = billingCycle || null;
    match.subscriptionValue = Number(value) || 0;
    match.commissionAmount = Number(value || 0) * Number(match.commissionRate || 0.5);
    match.lastSyncedAt = new Date();

    await match.save();

    try {
      await syncGhlConversion({
        repAttributionId: match._id,
        event: "subscribed",
      });
    } catch (syncErr) {
      console.error("GHL subscribed sync failed:", syncErr.message);
    }
  } catch (error) {
    console.error("markLeadSubscribed failed:", error.message);
  }
}

async function findUserForStripeObject(stripeObject) {
  const metadata = stripeObject?.metadata || {};

  if (stripeObject?.customer) {
    const byCustomer = await User.findOne({ stripeCustomerId: String(stripeObject.customer) });
    if (byCustomer) return byCustomer;
  }

  const metadataUserId = String(metadata.userId || "").trim();
  if (metadataUserId) {
    const byPublicId = await User.findOne({ userId: metadataUserId });
    if (byPublicId) return byPublicId;
  }

  const metadataEmail = String(metadata.email || "").trim().toLowerCase();
  if (metadataEmail) {
    const byEmail = await User.findOne({ email: metadataEmail });
    if (byEmail) return byEmail;
  }

  if (stripeObject?.customer) {
    try {
      const customer = await stripe.customers.retrieve(stripeObject.customer);
      const customerEmail = String(customer?.email || "").trim().toLowerCase();
      if (customerEmail) {
        const byCustomerEmail = await User.findOne({ email: customerEmail });
        if (byCustomerEmail) return byCustomerEmail;
      }
    } catch (error) {
      console.warn("Unable to retrieve Stripe customer during webhook:", error.message);
    }
  }

  return null;
}

async function handleCheckoutCompleted(session) {
  let email = session.customer_email || session?.customer_details?.email || null;

  if (!email && session.customer) {
    const customer = await stripe.customers.retrieve(session.customer);
    email = customer?.email || null;
  }

  if (!email) {
    console.warn("No email found in checkout session:", session.id);
    return;
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    console.warn("User not found for checkout session email:", email);
    return;
  }

  if (session.customer && !user.stripeCustomerId) {
    user.stripeCustomerId = String(session.customer);
    await user.save();
  }

  const stripeSubscriptionId = session.subscription ? String(session.subscription) : null;
  if (!stripeSubscriptionId) {
    console.warn("Checkout session missing subscription id:", session.id);
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price"],
  });

  const subscription = await upsertSubscriptionFromStripe({
    stripeSubscription,
    user,
    addressIdHint: session.metadata?.addressId || session.client_reference_id || null,
    stripeCheckoutSessionId: session.id,
  });

  const plan = String(subscription.subscriptionType || "").toLowerCase();
  const billingCycle = subscription.billingCycle || "monthly";
  const value = subscription.planPrice || getPlanPrice(plan);
  const currency = "USD";
  const now = new Date();

  await markLeadSubscribed({
    user,
    subscription,
    plan,
    billingCycle,
    value,
  });

  try {
    const contactId = await createOrUpdateContact({
      name: user.name,
      email: user.email,
      phone: user.phone,
    });
    if (contactId) {
      await addTag(contactId, "subscription_purchased");
    }
  } catch (error) {
    console.error("Stripe purchase GHL sync failed:", error.message);
  }

  const prevLP = user.lastPurchase || {};
  const confirmationToken = crypto.randomUUID();

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        stripeCustomerId: session.customer ? String(session.customer) : user.stripeCustomerId || null,
        lastPurchase: {
          ...prevLP,
          token: confirmationToken,
          stripeSessionId: session.id,
          plan,
          value,
          currency,
          createdAt: now,
          addressId: subscription.addressId || null,
          billingCycle,
        },
      },
    }
  );

  const userData = buildUserData({
    email: String(email).toLowerCase(),
    phone: prevLP.phone || user.phone || "",
    externalId: user.userId || String(user._id),
    fbp: prevLP.fbp || session.metadata?.fbp,
    fbc: prevLP.fbc || session.metadata?.fbc,
    clientIp: prevLP.clientIp,
    userAgent: prevLP.userAgent,
  });

  const hasStrongId = !!(
    userData.external_id ||
    userData.em ||
    userData.ph ||
    userData.fbp ||
    userData.fbc
  );

  if (hasStrongId) {
    await sendMetaCapi({
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: prevLP.eventId || `sess_${session.id}`,
      action_source: "website",
      event_source_url:
        prevLP.sourceUrl ||
        session.metadata?.source_url ||
        process.env.CLIENT_URL ||
        "https://www.profixter.com",
      custom_data: { currency, value, plan, billingCycle },
      user_data: userData,
    });
  }

  await mail.sendTx(
    "subscription_started",
    user.email,
    {
      name: user.name || email.split("@")[0],
      plan: (plan || "").replace(/^./, (char) => char.toUpperCase()),
    },
    { bccAdmin: false }
  );

  await mail.sendPromo(process.env.MAIL_ADMIN || "getfixter@gmail.com", {
    subject: `New Subscription: ${plan.toUpperCase()} - ${user.name || email}`,
    html: `
      <h2>New Subscription Activated</h2>
      <p><strong>Plan:</strong> ${plan.toUpperCase()} ($${value})</p>
      <p><strong>Billing:</strong> ${billingCycle.toUpperCase()}</p>
      <p><strong>Name:</strong> ${user.name || ""}</p>
      <p><strong>Phone:</strong> ${user.phone || "-"}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>User ID:</strong> ${user.userId}</p>
      <p><strong>Address:</strong> ${
        subscription.addressSnapshot
          ? `${subscription.addressSnapshot.line1}, ${subscription.addressSnapshot.city}, ${subscription.addressSnapshot.state} ${subscription.addressSnapshot.zip}`
          : "No address assigned"
      }</p>
    `,
  });
}

async function syncStripeSubscriptionRecord(stripeSubscription) {
  const user = await findUserForStripeObject(stripeSubscription);
  if (!user) {
    console.warn("No local user found for Stripe subscription event:", stripeSubscription.id);
    return null;
  }

  const status = String(stripeSubscription?.status || "").toLowerCase();
  if (PAYMENT_FAILURE_STATUSES.has(status)) {
    return endSubscriptionForPaymentFailure({ stripeSubscription, user });
  }

  return upsertSubscriptionFromStripe({
    stripeSubscription,
    user,
    addressIdHint: stripeSubscription.metadata?.addressId || null,
  });
}

async function endSubscriptionForPaymentFailure({ stripeSubscription, user }) {
  let terminalStripeSubscription = stripeSubscription;

  if (String(stripeSubscription?.status || "").toLowerCase() !== "canceled") {
    await stripe.subscriptions.cancel(String(stripeSubscription.id), {
      prorate: false,
    });
    terminalStripeSubscription = await stripe.subscriptions.retrieve(String(stripeSubscription.id), {
      expand: ["items.data.price"],
    });
  }

  const subscription = await upsertSubscriptionFromStripe({
    stripeSubscription: terminalStripeSubscription,
    user,
    addressIdHint:
      terminalStripeSubscription.metadata?.addressId ||
      stripeSubscription.metadata?.addressId ||
      null,
  });

  if (!subscription) return null;

  subscription.status = "canceled";
  subscription.cancelAtPeriodEnd = false;
  subscription.cancellationDate = subscription.cancellationDate || new Date();
  subscription.cancellationReason = "payment_failed";
  await subscription.save();
  await syncLegacyUserSubscription(user._id);
  return subscription;
}

async function handleInvoicePaid(invoice) {
  if (!invoice?.subscription) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(String(invoice.subscription), {
    expand: ["items.data.price"],
  });

  const subscription = await syncStripeSubscriptionRecord(stripeSubscription);
  if (!subscription) return;

  subscription.latestPaymentDate = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date(invoice.created * 1000);
  await subscription.save();
}

async function handleInvoicePaymentFailed(invoice) {
  if (!invoice?.subscription) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(String(invoice.subscription), {
    expand: ["items.data.price"],
  });

  const billingReason = String(invoice.billing_reason || "").toLowerCase();
  if (billingReason === "subscription_cycle") {
    const user = await findUserForStripeObject(stripeSubscription);
    if (!user) {
      console.warn("No local user found for failed recurring invoice:", invoice.id);
      return;
    }

    await endSubscriptionForPaymentFailure({ stripeSubscription, user });
    return;
  }

  await syncStripeSubscriptionRecord(stripeSubscription);
}

module.exports = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = req.rawBody ? req.rawBody : req.body;
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await syncStripeSubscriptionRecord(event.data.object);
        break;

      case "customer.subscription.deleted":
        await syncStripeSubscriptionRecord(event.data.object);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        break;
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).send("Server error");
  }
};
