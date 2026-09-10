/**
 * Digital Gift UI checks.
 *
 *   node scripts/test_digital_gift_ui.js
 *
 * Source assertions, in the same style as the other UI suites here. They
 * catch the things that silently rot: a component being duplicated instead of
 * reused, a raster image swallowing text that should be selectable, an
 * animation losing its reduced-motion escape, a claim token leaking onto a
 * purchaser screen, or an invented logo replacing the real one.
 *
 * What they cannot do is prove it looks good. That was done by rendering the
 * production build at 390x844 and 1440x900 and reading the screenshots.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const card = read("app", "components", "gift", "DigitalGiftCard.tsx");
const hero = read("app", "components", "gift", "DigitalGiftHero.tsx");
const revealer = read("app", "components", "gift", "DigitalGiftReveal.tsx");
const presentation = read("app", "components", "gift", "giftPresentation.ts");
const claim = read("app", "gift", "claim", "[token]", "GiftClaimClient.tsx");
const claimPage = read("app", "gift", "claim", "[token]", "page.tsx");
const purchase = read("app", "gift", "GiftPurchaseClient.tsx");
const confirmation = read("app", "gift", "confirmation", "GiftConfirmationClient.tsx");
const css = read("app", "globals.css");
const layout = read("app", "layout.tsx");
const service = read("lib", "gift-service.ts");
const callout = read("app", "components", "gift", "GiftCallout.tsx");
const architecture = read("lib", "site-architecture.ts");
const homeMarketing = read("app", "components", "sections", "HomeMarketing.tsx");
const plansSection = read("app", "components", "sections", "PlansSection.tsx");

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

const has = (src, snippet, message) => assert(src.includes(snippet), message);
const lacks = (src, snippet, message) => assert(!src.includes(snippet), message);

/*
 * Strip comments before asserting a file does NOT contain something.
 *
 * Without this the suite reads its own documentation as evidence: a comment
 * explaining "this must never touch Stripe" contains the word Stripe, and a
 * comment saying "no price here" contains the word price. Both produced false
 * failures. Assertions about absence have to run against code.
 */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

console.log("\nReal brand assets\n");

check("the card uses the real ProFixter logo file, not an invented mark", () => {
  has(card, '"/images/logo-footer.svg"', "the card must use the repository's logo");
  lacks(card, "<svg", "no hand-drawn logo may be introduced");
  for (const fake of ["placeholder", "logo-gift", "gift-logo"]) {
    lacks(card.toLowerCase(), fake, `a ${fake} asset must not be referenced`);
  }
});

check("the hero uses an approved photograph already in the repository", () => {
  has(hero, "/images/pass-bg.webp", "the background must be an approved asset");
  assert(
    fs.existsSync(path.join(ROOT, "public", "images", "pass-bg.webp")),
    "the referenced photograph must actually exist"
  );
  assert(!/https?:\/\//.test(hero), "no external image may be pulled into production");
});

check("only real ProFixter colours are used", () => {
  // The warm gold is a real token: it is used across a dozen existing
  // components, not invented for this feature.
  const accountOverview = read("app", "components", "account", "OverviewSection.tsx");
  has(accountOverview, "#D4A574", "the gold must be an existing brand colour");
  for (const token of ["#0B1628", "#306EEC", "#EEF2FF", "#D4A574"]) {
    assert(card.includes(token) || css.includes(token), `${token} should appear in the card system`);
  }
});

check("the display face is scoped to gift surfaces, not made global", () => {
  has(layout, "Cormorant_Garamond", "the display face is loaded through next/font");
  has(layout, "--font-gift-display", "it must be exposed as its own variable");
  lacks(
    css,
    "body {\n  font-family: var(--font-gift-display)",
    "it must not replace the site font"
  );
  has(card, "var(--font-gift-display)", "the card opts into it explicitly");
});

console.log("\nOne component, reused\n");

check("the recipient page and the purchase preview use the same component", () => {
  has(claim, "DigitalGiftHero", "the recipient sees the hero");
  has(purchase, "DigitalGiftCard", "the purchaser previews the real card");
  has(confirmation, "DigitalGiftCard", "the confirmation shows the real card");
  has(hero, "DigitalGiftCard", "the hero composes the card rather than redrawing it");
});

check("the visual components hold no business logic", () => {
  /*
   * Two different rules, because these files have two different jobs.
   *
   * The CARD is pure presentation and must stay that way: props in, markup
   * out, no hooks at all, so it can be rendered anywhere including a server
   * component. The HERO and the REVEAL legitimately hold presentation state
   * — a phase, a replay counter — but must still never reach the network or
   * handle money.
   */
  const cardCode = codeOnly(card);
  for (const forbidden of ["useState", "useEffect", "useRef", "use client"]) {
    lacks(cardCode, forbidden, `the card must stay stateless: found ${forbidden}`);
  }

  for (const [name, src] of [
    ["card", cardCode],
    ["hero", codeOnly(hero)],
    ["reveal", codeOnly(revealer)],
  ]) {
    for (const forbidden of [
      "createGiftCheckoutSession",
      "claimGift",
      "API.post",
      "API.get",
      "fetch(",
      "amountPaidCents",
      "totalCents",
      "stripe.",
    ]) {
      lacks(src, forbidden, `the ${name} must not know about ${forbidden}`);
    }
  }
});

check("the card takes its content as props, including the action", () => {
  for (const prop of [
    "occasion",
    "plan",
    "durationMonths",
    "recipientFirstName",
    "from",
    "personalMessage",
    "action",
  ]) {
    has(card, prop, `the card should accept ${prop}`);
  }
});

console.log("\nOccasion, message and data\n");

check("every occasion is presentation only", () => {
  for (const key of [
    "neutral",
    "new_home",
    "congratulations",
    "birthday",
    "thank_you",
    "just_because",
  ]) {
    has(presentation, key, `${key} must exist in the presentation registry`);
  }
  // Nothing in the registry may carry a price, a length or an entitlement.
  const registry = presentation.slice(
    presentation.indexOf("export const OCCASIONS"),
    presentation.indexOf("export const OCCASION_ORDER")
  );
  for (const forbidden of ["cents", "price", "durationMonths", "stripe", "plan"]) {
    lacks(
      codeOnly(registry).toLowerCase(),
      forbidden.toLowerCase(),
      `occasions must not carry ${forbidden}`
    );
  }
});

check("an unknown occasion falls back rather than throwing", () => {
  has(presentation, "OCCASIONS[key] || OCCASIONS.neutral", "unknown keys must degrade to neutral");
});

check("the message is rendered as text and never as HTML", () => {
  lacks(card, "dangerouslySetInnerHTML", "the personal message must never be injected as HTML");
  lacks(hero, "dangerouslySetInnerHTML", "nor anywhere else on the gift surfaces");
  has(card, "whitespace-pre-line", "line breaks should survive without HTML");
});

check("the purchase flow caps the message at the server's limit", () => {
  has(purchase, "MESSAGE_MAX_LENGTH", "the cap must come from the shared constant");
  has(purchase, "maxLength={MESSAGE_MAX_LENGTH}", "the field must enforce it");
  has(presentation, "export const MESSAGE_MAX_LENGTH = 200", "and match the server's 200");
});

check("plan and duration come from real gift data, never hardcoded", () => {
  lacks(card, '"Plus"', "the plan must not be hardcoded in the card");
  lacks(card, "2 Months of", "the duration must not be hardcoded in the card");
  has(card, "planLabel(plan)", "the plan is derived from the prop");
  has(card, "monthsLabel(durationMonths)", "the duration is derived from the prop");
});

console.log("\nMotion and accessibility\n");

check("the reveal is CSS, with no animation library added", () => {
  has(css, "@keyframes gift-rise", "the entrance is a CSS keyframe");
  const pkg = JSON.parse(read("package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const lib of ["framer-motion", "gsap", "react-spring", "animejs", "lottie-react"]) {
    assert(!deps[lib], `${lib} must not be added just for this`);
  }
});

check("reduced motion leaves the page fully visible", () => {
  // There is more than one reduced-motion block; find the one that governs
  // the reveal rather than assuming it is the last.
  /*
   * Take each media query's ACTUAL body by matching braces. Splitting on the
   * at-rule text runs each segment into the next one, so a block was credited
   * with rules that belong to whatever follows it — which is how this
   * assertion passed against the wrong block the first time.
   */
  const bodies = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf("@media (prefers-reduced-motion: reduce)", from);
    if (at === -1) break;
    const open = css.indexOf("{", at);
    let depth = 0;
    let i = open;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(css.slice(open, i + 1));
    from = i + 1;
  }

  const block = bodies.find((b) => b.includes("gift-reveal"));
  assert(block, "no reduced-motion block covers the gift reveal");
  for (const cls of ["gift-reveal", "gift-reveal-step", "gift-sheen"]) {
    assert(block.includes(cls), `${cls} must be disabled under reduced motion`);
  }
  assert(block.includes("opacity: 1 !important"), "elements must end visible, not hidden");
  assert(block.includes("transform: none !important"), "and unshifted");
});

check("the sheen runs once and never loops", () => {
  const rule = css.slice(css.indexOf(".gift-sheen {"), css.indexOf(".gift-sheen {") + 220);
  assert(/\s1\s+both;/.test(rule), "a looping shimmer looks cheap; it must run once");
  assert(!rule.includes("infinite"), "the sheen must not loop");
});

check("the card is semantic and labelled, not a picture of text", () => {
  has(card, "<article", "the card is a real element");
  has(card, "aria-label", "and is labelled for assistive tech");
  // The occasion renders through a dynamic tag so the recipient page can make
  // it the h1 while the preview and confirmation keep it an h2.
  has(card, 'headingLevel?: "h1" | "h2"', "the heading level must be constrained");
  has(card, "const Heading = headingLevel;", "and resolved to a real element");
  has(card, "<Heading", "the occasion is a heading, not a styled paragraph");
  has(hero, 'headingLevel="h1"', "on the recipient page the occasion is the h1");
  has(card, "<dl", "to/from is a description list");
  has(card, "<blockquote", "the message is quoted markup");
  // Decorative layers must be hidden from assistive technology.
  const decorative = (card.match(/aria-hidden="true"/g) || []).length;
  assert(decorative >= 3, "decorative layers should be aria-hidden");
});

check("the claim CTA is a real focusable control with a visible focus ring", () => {
  has(claim, 'href="#claim"', "the hero CTA moves to the claim section");
  has(css, ".gift-cta:focus-visible", "the CTA must show focus");
  has(css, "outline: 3px solid", "and the ring must be visible against gold");
  has(claim, 'id="claim"', "the target section must exist");
});

check("the background photograph is decorative, with an empty alt", () => {
  const srcAt = hero.indexOf('src="/images/pass-bg.webp"');
  assert(srcAt > 0, "the background image element could not be found");
  const imgBlock = hero.slice(srcAt, srcAt + 200);
  assert(/alt=""/.test(imgBlock), "a decorative background must have an empty alt");
});

console.log("\nThe reveal\n");

check("the reveal never gates the gift", () => {
  // The card is rendered in every phase — hidden by the sleeve, not absent.
  // A reveal that adds the content afterwards would put the gift behind an
  // animation for anybody whose JavaScript, timers or motion settings differ.
  has(revealer, "{children}", "the card is always rendered");
  const waiting = revealer.indexOf("gift-card-waiting");
  const childrenAt = revealer.indexOf("{children}");
  assert(waiting > 0 && childrenAt > waiting, "the card sits inside the phase wrapper");
  // Nothing about claiming lives in here.
  lacks(revealer, "Claim", "the reveal must not own the claim control");
});

check("the closed sleeve is a real, labelled, focusable control", () => {
  has(revealer, "<button", "the sleeve must be a button, not a clickable div");
  has(revealer, 'aria-label="Open your gift"');
  has(css, ".gift-sleeve:focus-visible", "and it must show keyboard focus");
});

check("the reveal is CSS, still with no animation dependency", () => {
  for (const frame of [
    "@keyframes gift-ribbon-part-left",
    "@keyframes gift-ribbon-part-right",
    "@keyframes gift-sleeve-away",
    "@keyframes gift-card-rise",
  ]) {
    has(css, frame, `${frame} must exist`);
  }
  const pkg = JSON.parse(read("package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const lib of ["framer-motion", "gsap", "react-spring", "animejs", "lottie-react", "motion"]) {
    assert(!deps[lib], `${lib} must not be added for this`);
  }
});

check("the reveal is about a second and a half, not an intro", () => {
  const hold = Number(/const HOLD_MS = (\d+)/.exec(revealer)?.[1]);
  const total = Number(/const REVEAL_MS = (\d+)/.exec(revealer)?.[1]);
  assert(hold > 0 && hold <= 1200, `the closed hold should be brief, got ${hold}ms`);
  assert(total >= 1000 && total <= 1600, `the reveal should be 1-1.5s, got ${total}ms`);
});

check("reduced motion skips the reveal outright", () => {
  has(
    revealer,
    'window.matchMedia?.("(prefers-reduced-motion: reduce)").matches',
    "the plan must consult the motion preference"
  );
  const plan = revealer.slice(revealer.indexOf("export function planGiftReveal"));
  assert(/reduce\)"\)\.matches\) return "skip"/.test(plan), "reduced motion must return skip");

  // And the stylesheet removes the sleeve even if a phase were ever entered.
  const bodies = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf("@media (prefers-reduced-motion: reduce)", from);
    if (at === -1) break;
    const open = css.indexOf("{", at);
    let depth = 0;
    let i = open;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(css.slice(open, i + 1));
    from = i + 1;
  }
  const sleeveBlock = bodies.find((b) => b.includes(".gift-sleeve"));
  assert(sleeveBlock, "a reduced-motion block must cover the sleeve");
  assert(sleeveBlock.includes("display: none !important"), "the sleeve must be removed entirely");
});

check("the opened flag is presentation only, and fails open", () => {
  // Every failure path returns "play": a repeated animation is a far smaller
  // failure than a gift that never appears.
  const plan = revealer.slice(
    revealer.indexOf("export function planGiftReveal"),
    revealer.indexOf("export type DigitalGiftRevealProps")
  );
  assert(/return "play";\s*}/.test(plan), "the fallback must be play");
  assert((plan.match(/catch/g) || []).length >= 2, "both storage and matchMedia must be guarded");
  // Writing it can throw too, and that must not break the reveal.
  const write = revealer.slice(revealer.indexOf("sessionStorage.setItem"));
  assert(write.slice(0, 220).includes("catch"), "the write must be guarded");
});

check("the stored key is never derived from the claim token", () => {
  // The token is a credential. Not in storage, not hashed into storage.
  const revealCode = codeOnly(revealer);
  for (const leak of ["claimToken", "claimUrl", "/gift/claim/", "location.pathname", "useParams"]) {
    lacks(revealCode, leak, `the reveal must not touch ${leak}`);
  }
  const call = hero.slice(hero.indexOf("giftFingerprint(["), hero.indexOf("]);"));
  for (const part of ["occasion", "plan", "durationMonths", "recipientFirstName", "from"]) {
    has(call, part, `the fingerprint should use ${part}, which is already on screen`);
  }
});

check("replay is optional, and only offered to somebody who saw the reveal", () => {
  has(hero, "canReplay", "replay must be conditional");
  has(hero, 'revealMode === "play" && opened', "and only after a reveal that actually played");
  has(hero, "Replay");
});

console.log("\nThe gold\n");

check("the full-height gold band is gone from the card", () => {
  // It was a 21px satin band inset from the right, which at 390px cut through
  // the To/From row and the message.
  lacks(card, "right-[10%]", "the inset vertical band must be gone");
  lacks(card, "w-[17px]", "and its width");
  lacks(card, "pr-[16%]", "and the gutter it forced on every line of content");
  lacks(card, "pr-[17%]");
});

check("gold on the opened card is a hairline, and cannot creep back", () => {
  has(card, "right-0", "the gilt edge sits flush to the card edge");

  // Width, parsed rather than string-matched, so a future tweak is measured
  // against the rule instead of merely differing from a remembered literal.
  const edge = card.slice(card.indexOf("THE GOLD, AFTER REVIEW"), card.indexOf("The navy face"));
  const widths = [...edge.matchAll(/w-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1]));
  if (edge.includes("w-px")) widths.push(1);
  assert(widths.length > 0, "the gilt edge must declare a width");
  for (const w of widths) {
    assert(w <= 2, `the opened card's gold edge must stay at 1-2px, found ${w}px`);
  }

  // And no near-white stop: on a 2px edge a satin highlight reads as a
  // glowing bar rather than gilding, which is what the review flagged.
  assert(/const GILT =/.test(card), "the edge uses its own quiet recipe");
  const gilt = card.slice(card.indexOf("const GILT ="), card.indexOf("export default"));
  for (const bright of ["#FBEEDB", "#FFF", "#fff", "255,255,255"]) {
    lacks(gilt, bright, `the gilt recipe must contain no near-white (${bright})`);
  }
  lacks(edge, "boxShadow", "and no shadow bloom around it");

  // The ribbon moved to the sleeve, where taking it off is the gesture.
  has(css, ".gift-ribbon-half", "the ribbon lives on the sleeve now");
  has(revealer, "gift-ribbon-left");
  has(revealer, "gift-ribbon-right");
});

console.log("\nThe payment breakdown\n");

check("the confirmation shows Stripe's own figures, and derives none", () => {
  for (const field of ["amountSubtotalCents", "discountCents", "taxCents", "amountPaidCents"]) {
    has(confirmation, `gift.${field}`, `the breakdown should show ${field}`);
  }
  has(confirmation, "Sales tax");
  has(confirmation, "Total paid");
  // No arithmetic that could invent a figure: the only sum present is the
  // reconciliation check that decides whether a breakdown is trustworthy.
  const sums = codeOnly(confirmation).match(/[*/]\s*0?\.\d|taxRate|\*\s*1\.0/g) || [];
  assert.deepStrictEqual(sums, [], "the client must never compute tax");
});

check("a gift with no recorded breakdown shows the total alone", () => {
  has(confirmation, "hasBreakdown", "the breakdown must be conditional");
  has(
    confirmation,
    "gift.amountSubtotalCents + gift.taxCents - gift.discountCents === gift.amountPaidCents",
    "and only shown when the figures reconcile"
  );
});

console.log("\nDiscoverability\n");

check("gifting is reachable without knowing the URL", () => {
  // Main navigation and the footer product list, so a visitor who has never
  // heard of it can still find it.
  has(architecture, '{ label: "Gift", href: "/gift" }', "gifting belongs in the main nav");
  has(architecture, '{ label: "Gift a Membership", href: "/gift" }', "and in the footer");
});

check("the homepage and the plan comparison both offer it", () => {
  has(homeMarketing, "<GiftCallout />", "the homepage carries the full band");
  has(plansSection, 'GiftCallout variant="inline"', "the comparison carries one quiet line");
  // /membership renders PlansSection with `compact`, so a !compact gate here
  // would hide the gift line on the very page most likely to prompt the idea.
  const inlineAt = plansSection.indexOf('<GiftCallout variant="inline" />');
  assert.ok(inlineAt > 0, "the inline callout should be rendered");
  const preceding = plansSection.slice(Math.max(0, inlineAt - 220), inlineAt);
  assert.ok(
    !preceding.includes("!compact &&"),
    "the gift line must not be gated on the non-compact layout"
  );
  // Not before the primary call to action: gifting must not outrank booking.
  const bookAt = homeMarketing.lastIndexOf("BookFree");
  const giftAt = homeMarketing.indexOf("<GiftCallout />");
  assert(giftAt > bookAt, "the gift band sits after the closing call to action");
});

check("the callout speaks to real occasions, not just realtors", () => {
  for (const audience of ["New homeowners", "Birthdays", "Thank-yous", "Family and friends", "Clients"]) {
    has(callout, audience, `${audience} should be named`);
  }
  assert.ok(!/realtor/i.test(callout), "the product is not realtor-specific");
  has(callout, "Give ProFixter as a", "the approved headline direction");
  has(callout, "add a personal message", "and the approved description");
});

check("the public callout costs the homepage no API call", () => {
  // The account entry point gates itself on the API; this one must not, or
  // every homepage view pays for a request just to decide whether to draw.
  const code = codeOnly(callout);
  for (const forbidden of ["useEffect", "useState", "getGiftOptions", "API."]) {
    lacks(code, forbidden, `the marketing callout must not ${forbidden}`);
  }
  has(callout, 'href="/gift"');
});

check("prices are visible before anyone creates an account", () => {
  // The options route is public now, so gating the fetch on a session would
  // only withhold the same figures the membership pages already print - and
  // it would cost us the person who came to price a present.
  const code = codeOnly(purchase);
  has(code, "if (authLoading) return undefined;", "the fetch waits for auth to settle, not to succeed");
  lacks(code, "if (authLoading || !isAuthenticated) return undefined;", "the signed-out gate is gone");
  // And the signed-out screen actually renders them.
  has(purchase, "const preview = options?.plans ?? []", "the intro reads the plans");
  has(purchase, "entry.quotes[0]?.perMonthCents", "and prices each one");
});

check("buying still requires an account", () => {
  // Discovery is public; purchase is not. A gift needs a purchaser on record
  // and a recipient address behind it, so the sign-in step stays.
  has(purchase, "if (!isAuthenticated)", "the signed-out branch still exists");
  has(purchase, 'href="/signin?next=%2Fgift"', "and brings them back here afterwards");
  has(purchase, 'href="/signup?next=%2Fgift"');
});

console.log("\nLength selection\n");

check("the purchase flow asks for a length as its own step", () => {
  has(purchase, 'type Step = "plan" | "length" | "recipient" | "review"');
  has(purchase, '"plan", "length", "recipient", "review"', "the rail shows four steps");
  has(purchase, 'step === "length"', "and the step renders");
  has(purchase, "setChosenDuration", "the length is a choice");
});

check("the default length comes from the server, not the client", () => {
  has(
    purchase,
    "chosenDuration ?? options?.defaultDurationMonths",
    "the server nominates the starting length"
  );
  has(service, "defaultDurationMonths", "and the type carries it");
  // No hardcoded default anywhere in the client.
  const code = codeOnly(purchase);
  assert.ok(
    !/durationMonths\s*=\s*1\b/.test(code),
    "the client must not hardcode a default length"
  );
});

check("every offered length is rendered, with its own total", () => {
  has(purchase, "options?.durations ?? []", "the list comes from the server");
  has(purchase, "quoteForDuration", "each length shows its own quote");
  has(purchase, "formatMoneyCents(quote.totalCents)", "and its own total");
  // The total must be visible before checkout.
  has(purchase, "before tax");
});

check("months are labelled singular or plural correctly", () => {
  const presentation = read("app", "components", "gift", "giftPresentation.ts");
  has(presentation, 'value === 1 ? "1 Month"', "one month is singular");
  has(presentation, "`${value} Months`", "and the rest are plural");
  // The card renders through that helper rather than its own string.
  has(card, "monthsLabel(durationMonths)");
});

console.log("\nSecurity and the feature flag\n");

check("no claim token is exposed on any purchaser surface", () => {
  const tokenish = ["claimToken", "claimUrl", "/gift/claim/"];
  for (const [name, src] of [
    ["confirmation", confirmation],
    ["purchase", purchase],
    ["card", card],
    ["hero", hero],
  ]) {
    for (const t of tokenish) {
      assert(!src.includes(t), `${name} must not expose ${t}`);
    }
  }
});

check("the claim page stays out of search results", () => {
  has(claimPage, "noindex", "claim pages must remain noindex");
  has(claimPage, "force-dynamic", "and must not be cached as static");
});

check("the feature flag still hides every gift surface", () => {
  has(service, "FEATURE_OFF", "the 404 mapping must remain");
  has(service, "status === 404 && !data?.code", "and must still distinguish a real 404");
  has(
    purchase,
    'optionsState === "off"',
    "the purchase page must render an off state derived from the server"
  );
  // The chain is: server 404 -> FEATURE_OFF -> getGiftOptions returns null ->
  // the page shows the unavailable state. Assert the two ends of it.
  has(service, 'code === "FEATURE_OFF"', "the service must translate the 404");
  has(purchase, 'setOptionsState("off")', "and the page must act on it");
  has(claim, "FEATURE_OFF", "so must the claim page");
});

check("the preview is marked as a preview", () => {
  has(purchase, "previewNote", "the purchaser must be told it is presentation only");
  has(purchase, "What they will receive", "and what they are looking at");
  has(card, "previewNote", "the card supports the note");
});

console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const { name, error } of failures) {
    console.error(`\n--- ${name} ---\n${error.stack || error.message}`);
  }
  process.exit(1);
}
process.exit(0);
