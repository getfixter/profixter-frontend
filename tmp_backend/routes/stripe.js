const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const {
  stripe,
  getPriceId,
  normalizeBillingCycle,
  resolveUserStripeCustomerId,
} = require("../utils/subscriptionManagement");

const CLIENT_URL = process.env.CLIENT_URL || "https://www.profixter.com";

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return String(forwardedFor).split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || "";
  const parts = cookie.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(name + "="));
  return found ? decodeURIComponent(found.split("=").slice(1).join("=")) : null;
}

router.post("/create-checkout-session", async (req, res) => {
  const { plan, email, addressId, code, billingCycle } = req.body;
  const cycle = normalizeBillingCycle(billingCycle, "monthly");
  const priceId = getPriceId(plan, cycle);

  if (!plan || !email || !priceId) {
    return res.status(400).json({
      message: "Missing or invalid plan/email/billingCycle",
      details: {
        planProvided: !!plan,
        emailProvided: !!email,
        billingCycle: cycle,
        priceFound: !!priceId,
      },
    });
  }

  if (!addressId || !mongoose.isValidObjectId(addressId)) {
    return res.status(400).json({ message: "Missing or invalid addressId" });
  }

  try {
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(400).json({ message: "Address not found for this user" });

    const activeSub = await Subscription.findOne({
      addressId: new mongoose.Types.ObjectId(addressId),
      status: { $in: ["active", "trialing"] },
    });

    if (activeSub) {
      return res.status(409).json({
        message: "This address already has an active plan.",
        code: "ADDRESS_ALREADY_SUBSCRIBED",
      });
    }

    let discounts = [];
    if (code) {
      const promo = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });
      if (promo.data[0]) {
        discounts = [{ promotion_code: promo.data[0].id }];
      }
    }

    const fbp = getCookie(req, "_fbp");
    const fbc = getCookie(req, "_fbc");
    const sourceUrl = req.headers.referer || `${CLIENT_URL}/`;
    const clientIp = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";
    const eventId = `px_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          lastPurchase: {
            eventId,
            fbp: fbp || null,
            fbc: fbc || null,
            sourceUrl,
            clientIp,
            userAgent,
            phone: user.phone || null,
            updatedAt: new Date(),
          },
        },
      }
    );

    const stripeCustomerId = await resolveUserStripeCustomerId(user);
    const sessionPayload = {
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: String(addressId),
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      discounts,
      metadata: {
        plan,
        billingCycle: cycle,
        email,
        userId: String(user.userId || user._id || ""),
        addressId: String(addressId),
        fbp: fbp || "",
        fbc: fbc || "",
        source_url: sourceUrl || "",
        eventId: eventId || "",
      },
      subscription_data: {
        metadata: {
          plan,
          billingCycle: cycle,
          email,
          userId: String(user.userId || user._id || ""),
          addressId: String(addressId),
        },
      },
      automatic_tax: { enabled: true },
      success_url: `${CLIENT_URL}/confirmationpage?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/?canceled=true&plan=${plan}&billingCycle=${cycle}`,
    };

    if (stripeCustomerId) {
      sessionPayload.customer = stripeCustomerId;
    } else {
      sessionPayload.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);
    return res.status(200).json({ url: session.url, eventId });
  } catch (error) {
    console.error("Stripe Session Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
