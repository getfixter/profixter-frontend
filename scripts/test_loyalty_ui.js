/**
 * Loyalty Benefits UI checks.
 *
 *   node scripts/test_loyalty_ui.js
 *
 * Source assertions, matching the harness the other UI suites use — there is no
 * browser runner in this project. They catch the things that would quietly undo
 * the point of the feature: the discount climbing back to being the headline on
 * the cancel screen, a reward name being hardcoded on the client where it could
 * drift from the email, an invented dollar figure, or loyalty being read from
 * anywhere but the per-address endpoint.
 *
 * Rendering and mobile overflow were verified separately with a real browser at
 * 390px and 1280px, and by a production build.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

/**
 * Source with the comments taken out.
 *
 * Assertions about what a CUSTOMER sees have to read the code, not the prose
 * around it — a comment explaining that year-two rules do not exist yet would
 * otherwise fail a check that no year-two rule is promised, which is exactly
 * backwards.
 */
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const service = read("lib", "subscription-service.ts");
const panel = read("app", "components", "account", "LoyaltyBenefitsPanel.tsx");
const planSection = read("app", "components", "account", "PlanSection.tsx");
const plansSection = read("app", "components", "sections", "PlansSection.tsx");
const loyaltyPage = read("app", "membership", "loyalty", "page.tsx");
const loyaltyLayout = read("app", "membership", "loyalty", "layout.tsx");

/* What the customer actually sees, with the explanatory prose stripped out. */
const panelVisible = withoutComments(panel);
const loyaltyPageVisible = withoutComments(loyaltyPage);

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

function section(name) {
  console.log(`\n--- ${name}`);
}

/* ========================================================================== */

section("the customer can actually find it");

test("the account screen loads Loyalty per address", () => {
  assert.match(planSection, /getLoyaltyStatus/, "the account fetches loyalty");
  assert.match(
    planSection,
    /loyaltyByAddress/,
    "keyed by address, because a customer may have several properties"
  );
  assert.match(
    planSection,
    /<LoyaltyBenefitsPanel[\s\S]{0,200}loyaltyByAddress\[String\(subscription\.addressId\)\]/,
    "the panel is rendered on the per-address membership card"
  );
});

test("the endpoint is address-scoped", () => {
  assert.match(
    service,
    /\/api\/subscriptions\/loyalty\/address\/\$\{addressId\}/,
    "one property's progress, never an aggregate across properties"
  );
});

test("the plans page carries a Loyalty treatment and a link", () => {
  assert.match(plansSection, /Loyalty Benefits/);
  assert.match(plansSection, /\/membership\/loyalty/, "links to the explanation");
});

test("the public page exists, is indexable and is canonical", () => {
  assert.match(loyaltyLayout, /canonical: "\/membership\/loyalty"/);
  assert.match(loyaltyLayout, /Loyalty Benefits \| Profixter Membership/);
  assert.ok(loyaltyPage.length > 1000, "the page has real content");
});

/* ========================================================================== */

section("annual is never made to look like the worse deal");

test("the plans page reframes for annual instead of staying silent", () => {
  assert.match(
    plansSection,
    /billing === "annual"[\s\S]{0,400}already built in/,
    "an annual member sees their own framing, not a monthly-only promise"
  );
  assert.match(plansSection, /pay for 10 months and get 12|10 months and get 12/);
});

test("the account panel gives annual members their own answer", () => {
  assert.match(
    panel,
    /annual_membership/,
    "an annual member gets the annual framing, never an empty meter"
  );
});

test("the public page explains why annual is not on the ladder", () => {
  assert.match(loyaltyPage, /annual/i);
  assert.match(loyaltyPage, /10 months and get 12/);
});

/* ========================================================================== */

section("the cancellation screen leads with progress, not a discount");

test("progress is its own cancel screen and comes first", () => {
  assert.match(planSection, /"progress"/, "a progress mode exists");
  assert.match(
    planSection,
    /hasProgressToShow \? "progress"/,
    "progress wins over the offer whenever there is progress to show"
  );
});

test("the discount is reachable only behind progress", () => {
  assert.match(
    planSection,
    /retentionOfferAvailable \? setCancelMode\("offer"\) : handleCancel\(false\)/,
    "continuing from progress goes to the offer only if it is still switched on"
  );
});

test("the cancel screen keeps a plain way out", () => {
  assert.match(
    planSection,
    /cancelMode === "progress"[\s\S]{0,4000}Continue cancellation/,
    "the cancel button is present on the progress screen"
  );
});

test("the consequence is stated factually, including the part that helps them", () => {
  assert.match(
    panel,
    /45 days/,
    "coming back within the window keeps their progress, and we say so"
  );
  assert.doesNotMatch(
    panelVisible,
    /don'?t lose|hurry|act now|last chance|expires soon!/i,
    "no manufactured urgency"
  );
});

/* ========================================================================== */

section("the words come from the server, and no price is invented");

test("no reward name is composed on the client", () => {
  for (const forbidden of [
    /complimentary Plus benefits/,
    /complimentary Premium benefits/,
    /complimentary Elite benefits/,
  ]) {
    assert.doesNotMatch(
      panel,
      forbidden,
      "reward names come from the API so the email and the screen cannot disagree"
    );
  }
  assert.match(panel, /status\.nextReward\?\.headline/, "the headline is read, not built");
});

test("no dollar figure is put on a Loyalty reward", () => {
  assert.doesNotMatch(panelVisible, /\$\d/, "we do not claim a reward is worth $X");
  assert.doesNotMatch(loyaltyPageVisible, /\$\d+ value|worth \$/i);
});

test("the panel never claims the member's own plan changed", () => {
  assert.match(
    loyaltyPage,
    /keep paying your own plan/i,
    "the public page states the paid plan is untouched"
  );
});

/* ========================================================================== */

section("the meter is honest");

test("progress uses a real denominator and a real date", () => {
  assert.match(panel, /countedMonths/);
  assert.match(panel, /nextMilestone/);
  assert.match(panel, /estimatedUnlockDate/, "a date, not a vague promise");
  assert.match(panel, /daysUntilNextMilestone/, "days once the finish line is near");
});

test("a member at zero is told why, not left to assume we lost their history", () => {
  assert.match(
    panel,
    /Loyalty Benefits started on/,
    "the launch date is explained at zero"
  );
  assert.match(panel, /countedMonths === 0/, "and only at zero");
});

test("nothing is promised beyond twelve months", () => {
  assert.match(panel, /ladderComplete/);
  assert.doesNotMatch(
    panelVisible,
    /year two|second year|18 months|24 months/i,
    "year-two rules have not been decided, so nothing hints at them"
  );
});

test("a Loyalty Full Day is described as extra, never as the included one", () => {
  assert.match(panel, /loyaltyFullDaysAvailable/);
  assert.match(panel, /on top of/i, "additive to the Elite Full Day, and it says so");
});

/* ========================================================================== */

section("it degrades safely");

test("loyalty never blocks the membership card from rendering", () => {
  assert.match(
    planSection,
    /Promise\.allSettled/,
    "one failed loyalty lookup must not take the page down"
  );
});

test("the panel renders nothing rather than something wrong", () => {
  assert.match(panel, /if \(!status \|\| !status\.enabled\) return null;/);
  assert.match(panel, /if \(!status\.eligible\) return null;/);
});

/* ========================================================================== */

const modal = read("app", "components", "account", "ManagePlanModal.tsx");
const modalVisible = withoutComments(modal);
const booking = read("app", "components", "sections", "BookingSection.tsx");
const home = read("app", "components", "sections", "HomeMarketing.tsx");
const overview = read("app", "components", "account", "AccountOverview.tsx");

section("Manage Plan opens ProFixter first, and Stripe only on Continue");

/*
 * The behavioural core of this feature. A portal session is a real Stripe
 * object with a live URL; minting one for somebody who glances at the modal and
 * closes it is waste, and it would also mean the modal was not really optional.
 */
test("no Manage Plan button calls Stripe directly any more", () => {
  assert.doesNotMatch(
    withoutComments(overview),
    /onClick=\{openPortal\}/,
    "AccountOverview must open the modal, not the portal"
  );
  assert.match(withoutComments(overview), /onClick=\{openManagePlan\}/);
  assert.match(
    withoutComments(planSection),
    /onClick=\{\(\) => openManagePlan\(subscription\)\}/,
    "PlanSection must open the modal, not the portal"
  );
});

test("opening the modal creates no Stripe session", () => {
  const open = withoutComments(overview).match(
    /const openManagePlan[\s\S]*?\n  \}, \[/
  );
  assert.ok(open, "openManagePlan not found");
  assert.doesNotMatch(
    open[0],
    /createBillingPortalSession/,
    "*** opening the modal must not create a portal session ***"
  );
  assert.match(open[0], /getLoyaltyStatus/, "it loads loyalty for the property instead");
});

test("only Continue creates the session, and it still reaches Stripe", () => {
  const cont = withoutComments(overview).match(/const continueToPortal[\s\S]*?\n  \}, \[/);
  assert.ok(cont, "continueToPortal not found");
  assert.match(cont[0], /createBillingPortalSession/);
  assert.match(cont[0], /window\.location\.href = url/);
  assert.match(
    withoutComments(modal),
    /onClick=\{onContinue\}/,
    "the Continue button is wired to it"
  );
});

test("closing the modal does nothing but close", () => {
  assert.match(withoutComments(overview), /onClose=\{\(\) => \{[\s\S]{0,120}setManagePlanOpen\(false\)/);
  assert.doesNotMatch(
    withoutComments(modal),
    /createBillingPortalSession/,
    "the modal itself never touches Stripe"
  );
});

test("Continue is never hidden, disabled-by-default, or buried", () => {
  assert.match(modalVisible, /Continue to Manage Plan/);
  // Only the in-flight state may disable it.
  assert.match(modalVisible, /disabled=\{busy\}/);
  assert.doesNotMatch(modalVisible, /disabled=\{true\}/);
  assert.match(modalVisible, /Stay on My Account/, "and there is a plain way out");
});

/* The portal must not regain the cancellation we deliberately turned off. */
test("nothing here re-enables Stripe portal cancellation", () => {
  for (const source of [modal, overview, planSection]) {
    assert.doesNotMatch(withoutComments(source), /subscription_cancel/);
  }
});

section("the modal covers every membership state");

test("it handles annual without showing monthly progress", () => {
  assert.match(modalVisible, /annual_membership/);
  assert.match(modalVisible, /status\.annual\.headline/);
});

test("it shows an active temporary upgrade with its end date", () => {
  assert.match(modalVisible, /Active Loyalty Benefit/);
  assert.match(modalVisible, /benefit\.effectiveUntil/);
  assert.match(modalVisible, /Available through/);
});

test("it shows Elite's extra Full Days, not a plan upgrade", () => {
  assert.match(modalVisible, /loyaltyFullDaysAvailable/);
  assert.match(modalVisible, /extra Full Day/);
  assert.match(modalVisible, /nextLoyaltyFullDayExpiresAt/);
});

test("it makes a pending free month prominent and calls it applied", () => {
  assert.match(modalVisible, /pendingFreeMonth/);
  assert.match(modalVisible, /Your next month is on us/);
  assert.match(modalVisible, /Already applied/);
  assert.doesNotMatch(modalVisible, /coupon/i);
});

test("zero progress reads as a start, not a disappointment", () => {
  assert.match(modalVisible, /countedMonths === 0/);
  assert.match(modalVisible, /Your Loyalty journey has started/);
});

test("a completed ladder promises nothing beyond twelve months", () => {
  assert.match(modalVisible, /ladderComplete/);
  assert.doesNotMatch(modalVisible, /year two|second year/i);
});

test("nothing in the modal is hardcoded", () => {
  for (const forbidden of [/2 of 3/, /18 days/, /complimentary Plus benefits/, /October 14/]) {
    assert.doesNotMatch(modalVisible, forbidden);
  }
  assert.match(modalVisible, /status\.nextReward\.headline/, "the reward is read, not written");
  assert.match(modalVisible, /status\.countedMonths/);
  assert.match(modalVisible, /status\.nextMilestone/);
});

test("it degrades safely when loyalty is unavailable", () => {
  assert.match(modalVisible, /if \(!status \|\| !status\.enabled\) return null;/);
  assert.match(withoutComments(overview), /catch \{[\s\S]{0,120}setManagePlanLoyalty\(null\)/);
});

/* Guilt is not the mechanism. The reward is. */
test("the modal uses no loss or pressure language", () => {
  assert.doesNotMatch(
    modalVisible,
    /you'?ll lose|don'?t lose|are you sure|don'?t leave|mistake|last chance|hurry/i
  );
});

section("multi-property members see the right property");

test("the modal is given the subscription whose button was pressed", () => {
  assert.match(
    withoutComments(planSection),
    /openManagePlan = \(subscription: ManagedSubscription\)/,
    "PlanSection passes the card's own subscription"
  );
  assert.match(
    withoutComments(planSection),
    /loyaltyByAddress\[String\(subscription\.addressId\)\]/,
    "and that address's loyalty"
  );
});

test("booking reinforcement follows the address being booked against", () => {
  assert.match(withoutComments(booking), /getLoyaltyStatus\(addressId\)/);
  assert.match(withoutComments(booking), /setLoyalty\(null\)/, "cleared when there is no membership");
});

section("the light-touch surfaces stay light");

test("the homepage mentions Loyalty once, with a link", () => {
  const visible = withoutComments(home);
  assert.match(visible, /Membership gets better the longer you stay/);
  assert.match(visible, /\/membership\/loyalty/);
  assert.equal(
    (visible.match(/membership\/loyalty/g) || []).length,
    1,
    "exactly one Loyalty link on the homepage"
  );
});

test("the plans page states Loyalty before the cards, not after", () => {
  const visible = withoutComments(plansSection);
  const loyaltyAt = visible.indexOf("Loyalty Benefits");
  const gridAt = visible.indexOf("CompactPlanComparison /> :");
  assert.ok(loyaltyAt > 0 && gridAt > 0);
  assert.ok(loyaltyAt < gridAt, "Loyalty must appear above the plan grid");
});

test("booking reinforcement is one compact row and never blocks the form", () => {
  const visible = withoutComments(booking);
  assert.match(visible, /variant="compact"/);
  assert.doesNotMatch(visible, /await getLoyaltyStatus/, "booking must not wait on it");
  assert.match(visible, /\.catch\(\(\) => setLoyalty\(null\)\)/);
});

test("the compact strip has no meter, no small print, no annual framing", () => {
  const compact = panelVisible.match(/function CompactStrip[\s\S]*?\n\}/);
  assert.ok(compact, "CompactStrip not found");
  assert.doesNotMatch(compact[0], /ProgressMeter|Loyalty Benefits started on|45 days/);
});

/* ========================================================================== */

console.log(`\nLoyalty UI: ${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const { name, error } of failures) {
    console.error(`\n--- ${name} ---\n${error.stack || error.message}`);
  }
  process.exit(1);
}
process.exit(0);
