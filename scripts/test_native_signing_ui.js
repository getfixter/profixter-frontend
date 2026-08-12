/**
 * Native signing UI — behaviour checks.
 *
 * Follows the repo's existing UI-test convention (see
 * test_project_customer_selector_ui.js): assertions against component source.
 *
 * These are regression guards, not a substitute for rendering. They exist to
 * catch the specific mistakes that have actually happened during this build -
 * the legacy Adobe call reappearing, terminology reverting, evidence fields
 * leaking into everyday Admin, an action losing its state guard - all of which
 * are invisible to typecheck and lint.
 *
 *   node scripts/test_native_signing_ui.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = (...parts) => fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");

/**
 * Code with comments removed.
 *
 * Several of these checks assert that something is ABSENT. Comments in this
 * codebase deliberately explain why a thing is not done ("does not redirect to
 * /signin"), so matching raw source would fail on the explanation rather than
 * on real code.
 */
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const contracts = read("app", "components", "admin", "ProjectContracts.tsx");
const changeOrders = read("app", "components", "admin", "ProjectChangeOrders.tsx");
const panel = read("app", "components", "admin", "SignaturePanel.tsx");
const ceremony = read("app", "components", "signing", "SigningCeremony.tsx");
const pad = read("app", "components", "signing", "SignaturePad.tsx");
const inPerson = read("app", "components", "signing", "InPersonSigning.tsx");
const signingClient = read("lib", "signing-service.ts");
const signPage = read("app", "sign", "[token]", "page.tsx");
const signClient = read("app", "sign", "[token]", "SigningClient.tsx");

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

const has = (source, snippet, message) => assert(source.includes(snippet), message);
const lacks = (source, snippet, message) => assert(!source.includes(snippet), message);

/* ---------------- terminology ---------------- */

console.log("\nAgreement terminology");

check("the Agreement UI uses Agreement in customer-facing copy", () => {
  has(contracts, "Agreement Date", "Agreement Date label missing");
  has(contracts, "Agreement draft saved", "draft toast not converted");
  has(contracts, "Agreement emailed", "email toast not converted");
  has(contracts, "Agreement canceled", "cancel toast not converted");
});

check("no user-facing 'Contract' copy remains in the Agreement UI", () => {
  for (const stale of [
    '"Contract Date"',
    '"Contract Price"',
    "Contract draft saved",
    "Contract emailed",
    "Contract canceled",
    "Contract sent for signature",
  ]) {
    lacks(contracts, stale, `stale copy still present: ${stale}`);
  }
});

check("Change Orders reference the underlying document as an Agreement", () => {
  has(changeOrders, "Amends Agreement", "contract selector label not converted");
  has(changeOrders, "Current Agreement", "current value label not converted");
  has(changeOrders, "Add to Agreement", "line direction label not converted");
});

check("Change Orders are still called Change Orders", () => {
  has(changeOrders, "Change Order", "Change Order naming must be preserved");
});

/* ---------------- pending vs executed ---------------- */

console.log("\nChange Order financial language");

check("pending amounts are labelled as projected, not current", () => {
  has(changeOrders, "If pending sign", "projected column label missing");
  has(
    changeOrders,
    "Only executed change orders move the Agreement amount",
    "the projected-vs-executed explanation must remain"
  );
});

/* ---------------- native signing wiring ---------------- */

console.log("\nNative signing wiring");

check("Change Orders no longer call the legacy Adobe send", () => {
  lacks(changeOrders, "sendDocumentForSignature", "legacy Adobe send path has returned");
});

check("Change Orders use the native signing functions", () => {
  for (const fn of [
    "sendForNativeSignature",
    "resendNativeSignature",
    "revokeNativeSignature",
    "downloadNativeDocument",
    "uploadManuallySignedDocument",
  ]) {
    has(changeOrders, fn, `Change Orders should use ${fn}`);
  }
});

check("Agreements use the native signing functions", () => {
  for (const fn of ["sendForNativeSignature", "resendNativeSignature", "revokeNativeSignature"]) {
    has(contracts, fn, `Agreements should use ${fn}`);
  }
});

check("both surfaces offer in-person signing", () => {
  has(contracts, "Sign In Person", "Agreement in-person action missing");
  has(changeOrders, "Sign In Person", "Change Order in-person action missing");
  has(contracts, "InPersonSigning", "Agreement should mount the in-person ceremony");
  has(changeOrders, "InPersonSigning", "Change Order should mount the in-person ceremony");
});

/* ---------------- state-aware actions ---------------- */

console.log("\nState-aware actions");

check("signing actions are hidden once a document is completed", () => {
  has(contracts, 'signature?.status !== "Completed"', "Agreement send must be state guarded");
  has(
    changeOrders,
    'selected.signature?.status !== "Completed"',
    "Change Order send must be state guarded"
  );
});

check("resend and revoke only appear for a live request", () => {
  for (const source of [contracts, changeOrders]) {
    has(source, "Resend Link", "resend action missing");
    has(source, "Revoke Request", "revoke action missing");
    has(
      source,
      '["Completed", "Declined", "Cancelled", "Expired"].includes',
      "live-request guard missing"
    );
  }
});

check("completed documents expose the three artifacts", () => {
  for (const source of [contracts, changeOrders]) {
    has(source, "Signature Certificate", "certificate action missing");
    has(source, 'handleNativeDownload("executed")', "executed download missing");
    has(source, 'handleNativeDownload("frozen")', "original download missing");
  }
});

check("manual upload is available on both surfaces", () => {
  has(contracts, "Upload Signed Agreement", "Agreement manual upload missing");
  has(changeOrders, "Upload Signed Change Order", "Change Order manual upload missing");
  has(contracts, "uploadManuallySignedDocument", "Agreement manual upload not wired");
});

/* ---------------- configuration error ---------------- */

console.log("\nConfiguration error copy");

check("both surfaces translate SIGNING_NOT_CONFIGURED into plain copy", () => {
  for (const [source, word] of [
    [contracts, "Agreement"],
    [changeOrders, "Change Order"],
  ]) {
    has(source, "SIGNING_NOT_CONFIGURED", "config code not handled");
    has(
      source,
      `Company signature needs to be configured before this ${word} can be sent for signing.`,
      `clean ${word} config copy missing`
    );
  }
});

check("no server internals leak through the config error", () => {
  for (const source of [contracts, changeOrders]) {
    lacks(source, "COMPANY_SIGNATURE_S3_KEY", "env var name exposed to the UI");
    lacks(source, "private/admin/signatures", "storage key exposed to the UI");
  }
});

/* ---------------- signature details ---------------- */

console.log("\nSignature details");

check("the panel reports signing method for every mode", () => {
  has(panel, '"In Person"', "in-person label missing");
  has(panel, '"Manual Upload"', "manual upload label missing");
  has(panel, '"Remote"', "remote label missing");
});

check("a manual upload is labelled and never claims native evidence", () => {
  has(panel, "Signed — Manual Upload", "manual upload status label missing");
  has(
    panel,
    // Wrapped across lines by the formatter, so match the distinctive phrase.
    "carry electronic signature evidence",
    "manual upload must state it has no native evidence"
  );
});

check("historical Adobe records stay readable", () => {
  has(panel, "adobe_sign", "provider awareness removed");
  has(panel, "Adobe Acrobat Sign (historical)", "legacy provider label missing");
});

check("the disclosure version is surfaced for native signatures", () => {
  has(panel, "PIH-ESIGN-DISCLOSURE-2026-001", "disclosure version missing");
});

check("evidence-only fields are never rendered in everyday Admin", () => {
  for (const noise of [
    "sha256",
    "executedSha256",
    "frozenDocument.sha256",
    "userAgent",
    "signingToken",
    "providerAgreementId",
  ]) {
    lacks(panel, noise, `${noise} must not appear in the Admin panel`);
  }
  // An IP address must not be rendered either.
  assert(!/\bsignature\.consent\?\.ip\b/.test(panel), "IP address must not be rendered");
});

/* ---------------- ceremony ---------------- */

console.log("\nSigning ceremony");

check("the ceremony runs review, disclosure, sign, done", () => {
  has(ceremony, '"review"', "review step missing");
  has(ceremony, '"disclosure"', "disclosure step missing");
  has(ceremony, '"sign"', "sign step missing");
  has(ceremony, '"done"', "completion step missing");
});

check("consent cannot be skipped", () => {
  has(ceremony, "disabled={!consent}", "continue must be blocked without consent");
  has(ceremony, "consentAccepted: consent", "consent must be sent with the signature");
  has(ceremony, "Agree to continue", "the blocked state should say why");
});

check("consent is never pre-checked", () => {
  has(ceremony, "useState(false)", "consent must default to false");
  lacks(ceremony, "defaultChecked", "consent must not be pre-checked");
});

check("a blank signature cannot be submitted", () => {
  has(ceremony, "disabled={!hasSignature", "submit must require a signature");
  has(ceremony, "Please draw your signature", "blank submission needs an explanation");
  has(pad, "strokesRef.current.length === 0", "the pad must detect a genuinely empty canvas");
});

check("the decline path exists and is recorded", () => {
  has(ceremony, "declineSignature", "decline must call the backend");
  has(ceremony, "Decline to sign?", "decline confirmation missing");
});

check("terminal states are handled without revealing whether a token exists", () => {
  for (const state of ["completed", "declined", "expired", "revoked", "invalid", "error"]) {
    has(signClient, `${state}:`, `terminal state ${state} not handled`);
  }
});

/* ---------------- signature pad ---------------- */

console.log("\nSignature pad");

check("the pad supports finger, pencil and stylus through pointer events", () => {
  has(pad, "onPointerDown", "pointer events required for stylus support");
  has(pad, "setPointerCapture", "stroke must stay captured");
});

check("drawing does not scroll the page", () => {
  has(pad, 'touchAction: "none"', "touch-action none is required on mobile");
  has(pad, "event.preventDefault()", "default touch behaviour must be prevented");
});

check("the canvas renders at device resolution", () => {
  has(pad, "devicePixelRatio", "high-DPI backing store required");
});

check("undo and clear are available", () => {
  has(pad, "Undo", "undo control missing");
  has(pad, "Clear", "clear control missing");
});

/* ---------------- public signing security ---------------- */

console.log("\nPublic signing security");

check("the public client carries no admin bearer token", () => {
  const code = codeOnly(signingClient);
  lacks(code, "localStorage", "public client must not read stored tokens");
  lacks(code, "Authorization", "public client must not send a bearer token");
});

check("the customer signing page never redirects to admin login", () => {
  // Match the quoted route, not the bare string: "signin" is a substring of
  // "signing", so /signin matches every signing import path.
  const redirectsToLogin = (source) => /["'`]\/signin["'`]/.test(codeOnly(source));
  assert(!redirectsToLogin(signingClient), "public client must not redirect to the admin login");
  assert(!redirectsToLogin(signClient), "signing page must not redirect to the admin login");
  assert(!redirectsToLogin(ceremony), "ceremony must not redirect to the admin login");
});

check("the signing token is never stored or logged", () => {
  for (const [name, source] of [
    ["signing client", signingClient],
    ["ceremony", ceremony],
    ["in-person", inPerson],
    ["signing page", signClient],
  ]) {
    assert(!/localStorage\.setItem|sessionStorage\.setItem/.test(source), `${name} stores a token`);
    assert(!/console\.(log|info|warn|error)\s*\(\s*token/.test(source), `${name} logs the token`);
  }
});

check("the signing page is excluded from indexing and caching", () => {
  has(signPage, "index: false", "signing page must be noindex");
  has(signPage, "follow: false", "signing page must be nofollow");
  has(signPage, "force-dynamic", "a credential URL must not be prerendered");
});

check("only consent and the signature are sent to the server", () => {
  has(signingClient, "consentAccepted: payload.consentAccepted", "consent must be sent");
  has(signingClient, "signatureImage: payload.signatureImage", "signature must be sent");

  // Inspect the POST body itself rather than the whole file: the payload type
  // legitimately describes fields the SERVER returns, which are not sent.
  const body = signingClient.slice(
    signingClient.indexOf("/sign`, {"),
    signingClient.indexOf("/sign`, {") + 260
  );
  for (const forbidden of ["price", "version", "sha256", "completedAt", "documentId"]) {
    assert(!body.includes(`${forbidden}:`), `client must not send ${forbidden}`);
  }
});

check("no storage URL is ever constructed client-side", () => {
  for (const source of [signingClient, ceremony, panel, contracts, changeOrders]) {
    lacks(source, "s3.amazonaws", "an S3 URL must never be built in the browser");
  }
});

/* ---------------- signed document access ---------------- */

console.log("\nSigned document access");

check("the executed document has its own route, separate from the frozen one", () => {
  has(signingClient, "/executed", "a route for the signed document must exist");
  has(signingClient, "export function signedDocumentUrl", "and a helper to build it");
  // The frozen-document route reports the terminal state once signing is done,
  // so it can never be the completion screen's link.
  has(signingClient, "/document", "the frozen-document route still exists for review");
});

check("the completion screen links to the executed PDF, not the signing endpoint", () => {
  const done = ceremony.slice(ceremony.indexOf('step === "done"'), ceremony.indexOf("ceremony ----"));
  has(done, "signedDocumentUrl(token)", "View must open the executed document");
  assert(
    !/href=\{signingDocumentUrl\(token\)\}/.test(done),
    "the completion screen must not link to the frozen/signing document route"
  );
  has(done, "View Signed", "the primary action keeps its wording");
  has(done, "Download PDF", "a download action is offered");
  has(done, "download: true", "download must request the attachment variant");
});

check("the signed document is only offered when the server says it exists", () => {
  has(ceremony, "executedDocumentAvailable", "never link to a document that is not there");
  has(signClient, "executedDocumentAvailable", "the same rule when returning to a used link");
});

check("a customer returning to a completed link can still read what they signed", () => {
  has(signClient, "signedDocumentUrl(token)", "the terminal screen offers the signed copy");
  has(signClient, "Download PDF");
});

check("the download link is a plain anchor so mobile hands off to the OS", () => {
  const done = ceremony.slice(ceremony.indexOf('step === "done"'), ceremony.indexOf("ceremony ----"));
  has(done, "download\n", "an anchor download attribute, not a fetch-and-blob");
  lacks(done, "createObjectURL", "no blob juggling: it breaks in in-app browsers");
});

/* ---------------- in-person isolation ---------------- */

console.log("\nIn-person isolation");

check("the ceremony covers the Admin completely", () => {
  has(inPerson, "fixed inset-0", "in-person must render full screen");
  has(inPerson, 'document.body.style.overflow = "hidden"', "admin content must not scroll behind");
});

check("the admin can exit back to the project", () => {
  has(inPerson, "onExit", "exit control required");
  has(inPerson, "Back to Project", "exit path missing for an unusable session");
});

/* ---------------- summary ---------------- */

console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const failure of failures) console.error(`\n${failure.name}\n${failure.error.stack}`);
  process.exit(1);
}
process.exit(0);
