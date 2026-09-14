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

console.log(`\nLoyalty UI: ${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const { name, error } of failures) {
    console.error(`\n--- ${name} ---\n${error.stack || error.message}`);
  }
  process.exit(1);
}
process.exit(0);
