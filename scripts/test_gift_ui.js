/**
 * Gift membership UI checks.
 *
 *   node scripts/test_gift_ui.js
 *
 * Source assertions, matching the harness the other UI suites use — there is
 * no browser runner in this project. That is worth being honest about: these
 * catch a control being removed, a price being hardcoded, a flag check being
 * dropped or wording drifting back to something that was rejected. They do not
 * prove pixels. Rendering was verified by typecheck, lint and a production
 * build.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const service = read("lib", "gift-service.ts");
const purchase = read("app", "gift", "GiftPurchaseClient.tsx");
const giftPage = read("app", "gift", "page.tsx");
const confirmation = read("app", "gift", "confirmation", "GiftConfirmationClient.tsx");
const claim = read("app", "gift", "claim", "[token]", "GiftClaimClient.tsx");
const claimPage = read("app", "gift", "claim", "[token]", "page.tsx");
const accountGift = read("app", "components", "account", "GiftMembershipSection.tsx");
const entryPoint = read("app", "components", "account", "GiftEntryPoint.tsx");
const planSection = read("app", "components", "account", "PlanSection.tsx");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Source with comments stripped, for assertions about actual behaviour. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/* ========================================================================== */
section("Feature flag");
/* ========================================================================== */

test("visibility is decided by the server, never a public env var", () => {
  /*
   * A NEXT_PUBLIC_ flag is baked in at build time and can drift out of step
   * with the backend, advertising a purchase flow that cannot complete. Every
   * surface asks the API instead.
   */
  for (const [name, source] of [
    ["gift-service", service],
    ["purchase", purchase],
    ["entry point", entryPoint],
    ["account section", accountGift],
  ]) {
    assert.ok(
      !/NEXT_PUBLIC_GIFTS?_ENABLED/.test(code(source)),
      `${name} must not read a public gifts flag`
    );
  }
});

test("a 404 from the API is read as 'feature off', not as an error", () => {
  assert.match(code(service), /status === 404[\s\S]{0,120}FEATURE_OFF/);
});

test("the account entry point hides itself when the feature is off", () => {
  assert.match(code(entryPoint), /getGiftOptions\(\)/);
  assert.match(code(entryPoint), /if \(!available\) return null;/);
  // And any failure keeps it hidden rather than showing a dead link.
  assert.match(code(entryPoint), /catch[\s\S]{0,120}setAvailable\(false\)/);
});

test("the purchase screen renders an unavailable state rather than a form", () => {
  assert.match(code(purchase), /optionsState === "off"/);
  assert.match(purchase, /Gift memberships are not available just yet/);
});

test("the account gift section renders nothing when there is nothing to show", () => {
  assert.match(code(accountGift), /if \(state !== "ready" \|\| !gifts\) return null;/);
  assert.match(code(accountGift), /if \(!gifts\.active && !gifts\.queued\.length\) return null;/);
});

/* ========================================================================== */
section("Pricing comes from the API");
/* ========================================================================== */

test("no plan price is hardcoded anywhere in the gift UI", () => {
  /*
   * The live prices are 149 / 249 / 349 / 499 and their 2-month totals. If any
   * of those appear as literals here, a price change would leave the gift
   * screens quoting a stale figure.
   */
  const forbidden = [149, 249, 349, 499, 298, 498, 698, 998];
  for (const [name, source] of [
    ["purchase", purchase],
    ["gift-service", service],
    ["claim", claim],
    ["account section", accountGift],
    ["confirmation", confirmation],
  ]) {
    for (const price of forbidden) {
      assert.ok(
        !new RegExp(`\\b${price}\\b`).test(code(source)),
        `${name} must not hardcode the price ${price}`
      );
    }
  }
});

test("prices are read from the options endpoint", () => {
  assert.match(code(service), /API\.get\("\/api\/gifts\/options"\)/);
  assert.match(code(purchase), /getGiftOptions/);
  assert.match(code(purchase), /quote\.totalCents/);
  assert.match(code(purchase), /quote\.perMonthCents/);
});

test("there is no fallback price when the API cannot be reached", () => {
  // A confidently wrong price is worse than a screen that says it cannot load.
  assert.match(code(purchase), /optionsState === "error"/);
  assert.match(purchase, /We could not load gift options/);
});

/* ========================================================================== */
section("Duration");
/* ========================================================================== */

test("the duration offered comes from the API, not a constant", () => {
  assert.match(code(purchase), /options\?\.durations\?\.\[0\]/);
  assert.ok(
    !/durationMonths: 2\b/.test(code(purchase)),
    "the purchase screen must not hardcode a 2-month gift"
  );
});

test("no disabled future durations are rendered", () => {
  // Launch shows one length. Greyed-out 3/6/12 options would advertise
  // something that cannot be bought.
  for (const months of ["3 months", "6 months", "12 months", "1 month"]) {
    assert.ok(!purchase.includes(months), `must not render a "${months}" option`);
  }
});

/* ========================================================================== */
section("Purchase flow");
/* ========================================================================== */

test("the flow has plan, length, recipient and review steps", () => {
  // Length became its own step once gifts stopped being two months only.
  assert.match(code(purchase), /type Step = "plan" \| "length" \| "recipient" \| "review"/);
  assert.match(purchase, /How long should it run/);
  assert.match(purchase, /Review your gift/);
});

test("the one-time nature is stated plainly, before payment", () => {
  assert.match(purchase, /One-time payment/);
  assert.match(purchase, /does not automatically renew/);
});

test("no coupon field is built, and none is promised", () => {
  /*
   * Building a coupon input would either duplicate Stripe's validation badly
   * or lie about what it had accepted, so this looks for state and inputs
   * rather than for the word.
   *
   * Telling the customer WHERE to enter a code is right; Stripe Checkout
   * owns the field, the validation and the arithmetic.
   */
  const body = code(purchase);
  assert.ok(!/\[(promo|coupon)[A-Za-z]*, set/i.test(body), "no coupon state");
  assert.ok(!/id="(promo|coupon)/i.test(body), "no coupon input");
  assert.ok(!/allow_promotion_codes/.test(body), "Stripe config belongs on the server");
  // Gift checkout accepts codes through Stripe's own field, so pointing the
  // customer at it is right; building an input here would not be.
  assert.match(purchase, /enter it on the next screen/i);
});

test("recipient fields are validated before review", () => {
  assert.match(code(purchase), /validateRecipient/);
  for (const field of ["firstName", "lastName", "email", "line1", "city", "zip"]) {
    assert.ok(code(purchase).includes(`next.${field}`), `${field} should be validated`);
  }
});

test("self-gifting is caught in the UI and surfaced from the server", () => {
  assert.match(code(purchase), /cleanEmail === String\(user\.email\)/);
  assert.match(code(purchase), /SELF_GIFT_NOT_ALLOWED/);
  // The server's refusal is shown on the field that caused it.
  assert.match(code(purchase), /setStep\("recipient"\)/);
});

test("double submission cannot create two checkout sessions", () => {
  /*
   * State alone is not enough: two clicks in the same tick both read the old
   * value. The ref is written synchronously, so the second click sees it.
   */
  assert.match(code(purchase), /submitLock = useRef\(false\)/);
  assert.match(code(purchase), /if \(submitLock\.current\) return;/);
  assert.match(code(purchase), /submitLock\.current = true;/);
  assert.match(code(purchase), /disabled=\{submitting\}/);
});

test("the button shows a loading state while checkout opens", () => {
  assert.match(code(purchase), /aria-busy=\{submitting\}/);
  assert.match(purchase, /Opening checkout/);
});

/* ========================================================================== */
section("Authentication preserves the destination");
/* ========================================================================== */

test("a signed-out purchaser is returned to /gift after signing in", () => {
  assert.match(purchase, /\/signin\?next=%2Fgift/);
  assert.match(purchase, /\/signup\?next=%2Fgift/);
});

test("THE CLAIM TOKEN SURVIVES SIGN-IN AND REGISTRATION", () => {
  /*
   * The single most important redirect in the feature: losing the token means
   * the recipient has to find the email again.
   */
  assert.match(code(claim), /const returnTo = `\/gift\/claim\/\$\{encodeURIComponent\(token\)\}`/);
  assert.match(code(claim), /\/signin\?next=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(code(claim), /\/signup\?next=\$\{encodeURIComponent\(returnTo\)\}/);
});

test("an existing recipient is offered sign-in, a new one registration", () => {
  assert.match(code(claim), /gift\.hasAccount/);
  assert.match(claim, /Sign in to claim/);
  assert.match(claim, /Create an account to claim/);
});

/* ========================================================================== */
section("Claim states");
/* ========================================================================== */

test("AN EXPIRED LINK IS NEVER DESCRIBED AS AN EXPIRED GIFT", () => {
  /*
   * The wording rule Taras set. The link expires; the money does not. Nothing
   * on this screen may suggest the purchaser lost anything.
   */
  assert.match(claim, /This invitation link has expired/);
  assert.match(claim, /but your gift has not/);
  assert.ok(!/[Yy]our gift (has )?expired/.test(claim), "must not say the gift expired");
  assert.match(claim, /we can send you a fresh invitation/);
});

test("every failure has customer-facing copy", () => {
  for (const state of [
    "LINK_EXPIRED",
    "LINK_SUPERSEDED",
    "ALREADY_CLAIMED",
    "RECIPIENT_MISMATCH",
    "CANCELLED",
    "INVALID",
    "FEATURE_OFF",
    "NETWORK",
    "UNKNOWN",
  ]) {
    assert.ok(code(claim).includes(state), `${state} needs a handled state`);
  }
});

test("no raw API error reaches the customer", () => {
  // Everything is mapped through GiftError and a copy table.
  assert.match(code(claim), /errorPhase/);
  assert.ok(!/JSON\.stringify\(error/.test(code(claim)));
  assert.ok(!/error\.response/.test(code(claim)), "the screen must not read axios internals");
});

test("a wrong account is refused without leaking who the gift is for", () => {
  assert.match(claim, /This gift was sent to a different account/);
  // The masked address is only shown BEFORE sign-in, from the public preview.
  assert.match(code(claim), /showSignOut/);
  assert.match(claim, /Sign out and use a different account/);
});

test("claiming cannot be double-submitted", () => {
  assert.match(code(claim), /claimLock = useRef\(false\)/);
  assert.match(code(claim), /if \(claimLock\.current\) return;/);
  assert.match(code(claim), /disabled=\{claiming\}/);
});

test("the claim page is noindex and never prerendered", () => {
  assert.match(claimPage, /robots: \{ index: false, follow: false/);
  assert.match(claimPage, /export const dynamic = "force-dynamic"/);
});

/* ========================================================================== */
section("Property confirmation");
/* ========================================================================== */

test("the recipient chooses from their OWN saved properties", () => {
  assert.match(code(claim), /addresses\.map/);
  assert.match(code(claim), /name="addressId"/);
  assert.match(code(claim), /claimGift\(token, addressId\)/);
});

test("the purchaser's address is a suggestion, not an authority", () => {
  assert.match(code(claim), /addressSnapshot/);
  // JSX interpolation sits between the words and the phrase wraps across
  // source lines, so the window is wide and the gap allows any whitespace.
  assert.match(claim, /The person who sent it had[\s\S]{0,200}in\s+mind/);
});

test("a recipient with no property is sent to the existing address flow", () => {
  // Rather than a second, competing address form built here.
  assert.match(claim, /You do not have a property saved yet/);
  assert.match(code(claim), /\/account\?tab=personal/);
  const claimBody = code(claim);
  assert.ok(
    !/type="text"/.test(claimBody),
    "the claim screen must not build its own address form"
  );
  assert.ok(
    /type="radio"/.test(claimBody),
    "it should choose from existing properties instead"
  );
});

/* ========================================================================== */
section("Claim success");
/* ========================================================================== */

test("a QUEUED gift is never described as active", () => {
  /*
   * Saying "active" about a membership that starts in three weeks is a lie the
   * customer discovers when they try to book.
   */
  assert.match(code(claim), /result\.queued \? "Your gift is ready" : "Your gift membership is active"/);
  assert.match(claim, /when your current membership ends/);
});

test("the dates shown are the authoritative ones from the API", () => {
  assert.match(code(claim), /formatGiftDate\(result\.startAt\)/);
  assert.match(code(claim), /formatGiftDate\(result\.endAt\)/);
  assert.match(code(claim), /result\.activeThrough/);
});

test("an active claim offers booking; a queued one does not", () => {
  assert.match(code(claim), /result\.queued \?[\s\S]{0,400}View your membership/);
  assert.match(code(claim), /Book your Fixter/);
});

/* ========================================================================== */
section("Account: a gift must not look like a subscription");
/* ========================================================================== */

test("NO BILLING CONTROL IS RENDERED FOR A GIFT", () => {
  /*
   * The safety requirement, at the UI layer. The server refuses all of these
   * independently and a gift carries no Stripe customer, so this is a courtesy
   * — but a customer should never be invited to try.
   */
  const forbidden = [
    "Cancel Membership",
    "Cancel membership",
    "Resume",
    "Reactivate",
    "Change Plan",
    "Change plan",
    "Manage Billing",
    "Manage billing",
    "Update Payment",
    "billing portal",
    "createBillingPortalSession",
    "cancelSubscription",
    "reactivateSubscription",
    "changeSubscriptionPlan",
    "RetentionOffer",
  ];
  for (const control of forbidden) {
    assert.ok(
      !code(accountGift).includes(control),
      `the gift card must not offer "${control}"`
    );
  }
});

test("the gift card offers Continue Membership instead", () => {
  assert.match(accountGift, /Continue membership/);
  // Which goes to the ORDINARY membership flow, paid by the recipient.
  assert.match(code(accountGift), /href="\/membership"/);
});

test("no gift path attempts to renew or resume the gift itself", () => {
  for (const [name, source] of [
    ["account section", accountGift],
    ["claim", claim],
    ["purchase", purchase],
    ["gift-service", service],
  ]) {
    assert.ok(!/resumeGift|renewGift|reactivateGift/i.test(source), `${name} must not try to renew a gift`);
  }
});

test("the card states there is no card on file", () => {
  assert.match(accountGift, /nothing to pay and no card on file/i);
});

test("an active gift shows plan, giver and end date", () => {
  assert.match(code(accountGift), /planLabel\(gift\.plan\)/);
  assert.match(accountGift, /Gifted by/);
  assert.match(accountGift, /Active through/);
  assert.match(code(accountGift), /Book Fixter/);
});

test("queued gifts are listed separately and in order", () => {
  assert.match(code(accountGift), /gifts\.queued\.map/);
  assert.match(accountGift, /Coming next|Ready to start/);
  // The API returns them ordered by start date; the UI does not re-sort.
  assert.match(accountGift, /Starts|Then/);
});

test("multiple queued gifts are counted rather than crowding the page", () => {
  assert.match(code(accountGift), /gifts\.queued\.length > 1/);
  assert.match(accountGift, /gifts queued/);
});

test("a gift suppresses the 'No active membership' upsell", () => {
  // Telling somebody they have no membership while a gift is running would be
  // plainly wrong.
  assert.match(code(planSection), /!activeSubscriptions\.length && !hasActiveGift/);
  assert.match(code(planSection), /onActiveGiftChange=\{setHasActiveGift\}/);
});

test("a failed gift lookup does not change what the account says", () => {
  assert.match(code(accountGift), /catch[\s\S]{0,200}setState\("error"\)/);
  assert.ok(
    !/catch[\s\S]{0,200}onActiveGiftChange\?\.\(false\)/.test(code(accountGift)),
    "a failure must not assert there is no gift"
  );
});

/* ========================================================================== */
section("Confirmation");
/* ========================================================================== */

test("the confirmation does not imply recurring billing", () => {
  assert.match(confirmation, /You will not be charged again/);
  assert.match(confirmation, /one-time payment/);
  assert.ok(!/renew/i.test(confirmation.replace(/will not repeat/gi, "")));
});

test("it names the recipient, the plan and the length", () => {
  assert.match(code(confirmation), /gift\.recipientEmail/);
  assert.match(code(confirmation), /planLabel\(gift\.plan\)/);
  assert.match(code(confirmation), /monthsLabel\(gift\.durationMonths\)/);
});

test("it does not claim to have activated anything", () => {
  /*
   * The gift is created by the webhook, not by this page loading. If the
   * webhook has not landed yet the copy still has to be true.
   */
  assert.match(confirmation, /finishing up/);
  assert.ok(!/activated/i.test(confirmation));
});

/* ========================================================================== */
section("Accessibility and responsiveness");
/* ========================================================================== */

test("every input has a real label", () => {
  assert.match(code(purchase), /htmlFor=\{id\}/);
  assert.match(code(purchase), /<label htmlFor="state"/);
  assert.match(code(claim), /<legend className="sr-only">/);
});

test("errors are announced, not just coloured", () => {
  assert.match(code(purchase), /role="alert"/);
  assert.match(code(purchase), /aria-invalid/);
  assert.match(code(purchase), /aria-describedby/);
  assert.match(code(claim), /role="alert"/);
});

test("loading states are announced", () => {
  for (const [name, source] of [
    ["purchase", purchase],
    ["claim", claim],
    ["confirmation", confirmation],
  ]) {
    assert.ok(code(source).includes('role="status"'), `${name} needs a status role`);
    assert.ok(code(source).includes("aria-label"), `${name} needs a label on its spinner`);
  }
});

test("tap targets meet the 44px minimum", () => {
  for (const [name, source] of [
    ["purchase", purchase],
    ["claim", claim],
    ["account section", accountGift],
    ["entry point", entryPoint],
  ]) {
    assert.ok(/min-h-\[4[4-9]px\]|min-h-\[5\dpx\]/.test(source), `${name} needs 44px+ tap targets`);
  }
});

test("layouts stack on mobile and open out on desktop", () => {
  // Mobile-first: base classes stack, sm: opens them out.
  assert.match(purchase, /grid gap-3 sm:grid-cols-2/);
  assert.match(purchase, /flex-col gap-3 sm:flex-row/);
  assert.match(accountGift, /flex-col gap-2\.5 sm:flex-row/);
  assert.ok(
    /flex-col/.test(entryPoint) && /sm:flex-row/.test(entryPoint),
    "the entry point should stack on mobile and open out on desktop"
  );
});

test("desktop is not merely a stretched phone layout", () => {
  // Real desktop sizing, not one width scaled up.
  assert.match(purchase, /sm:text-\[32px\]/);
  assert.match(purchase, /max-w-3xl/);
  assert.match(claim, /max-w-lg/);
});

test("long names, emails and addresses cannot break the layout", () => {
  for (const [name, source] of [
    ["purchase", purchase],
    ["claim", claim],
    ["account section", accountGift],
    ["confirmation", confirmation],
  ]) {
    assert.ok(
      /break-words|break-all/.test(source),
      `${name} must wrap long unbroken text`
    );
  }
});

/* ========================================================================== */
section("Routes");
/* ========================================================================== */

test("the gift landing page exists and is indexable", () => {
  assert.match(giftPage, /Gift a Membership \| ProFixter/);
  assert.ok(!/robots/.test(giftPage), "the landing page should be indexable");
});

test("the confirmation page is noindex", () => {
  const page = read("app", "gift", "confirmation", "page.tsx");
  assert.match(page, /robots: \{ index: false/);
});

test("search params are read inside a Suspense boundary", () => {
  // Required by the app router, and the pattern the signin page already uses.
  const page = read("app", "gift", "confirmation", "page.tsx");
  assert.match(page, /<Suspense/);
});

/* ========================================================================== */

console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const { name, error } of failures) {
    console.error(`\n--- ${name} ---\n${error.stack || error.message}`);
  }
  process.exit(1);
}
process.exit(0);
