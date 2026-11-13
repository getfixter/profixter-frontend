/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Projects and Leads in a real browser (FE-PROJ, 2026-11-13).
 *
 *   npx next start -p 3113          (after npm run build)
 *   npm run test:admin-projects     (or: node scripts/test_admin_projects_ui.js http://localhost:3113)
 *
 * FULL NETWORK JAIL on every context: the local server passes; every URL with
 * /api/ in its path, on ANY host (api.profixter.com included), is answered here
 * from fixtures shaped exactly like reports/BE-DOCS.md; everything else is
 * aborted and recorded (and fails the run). Fake people only (@example.test).
 *
 * What it pins:
 * - list: POST search (text never in a URL), derived-stage filter in the URL,
 *   rows show stage + manual status + signed/paid/outstanding (never the manual
 *   estimate), attention badge from Needs action, Create project sheet
 * - deep links: /admin/projects/:id, ?tab=, ?tab=invoices&invoice=, the old
 *   /admin/projects?invoiceId= and /admin?tab=invoices&invoiceId=
 * - next steps: confirm names the recipient / the amount; idempotency key sent
 *   and reused on retry; the deposit is billed once
 * - documents: Upload signed / Cancel only in valid states, behind a confirm
 *   naming customer and version; Void disabled with payments; Stripe payments
 *   read-only; paid-in-full lock; no window.alert/confirm/prompt anywhere
 * - leads: ?open= (every id form), model-id links, all answers, the visit
 *   lock, idempotent lead to project, typed delete
 * - closeout: substantial completion (server warranty date), punch list
 * - visits: linked visits, unlink, link existing, manual status with precondition
 * - no sideways overflow at 7 viewports, 44px touch targets, text >= 12px,
 *   sheets inside the viewport; screenshots to reports/shots/projects
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3113").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "projects");
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "844x390-landscape", width: 844, height: 390, touch: true },
  { name: "820x1180-tablet", width: 820, height: 1180, touch: true },
  { name: "1440x900-desktop", width: 1440, height: 900, touch: false },
];

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };

/* ---------------------------------------------------------------- ids */
const hex = (n) => n.toString(16).padStart(24, "0");
const P1 = hex(0xa1); // signed, deposit not invoiced, invoices with payments
const P2 = hex(0xa2); // proposal issued (agreement generated, not sent)
const P3 = hex(0xa3); // lead, nothing issued
const P4 = hex(0xa4); // signed, ready for closeout
const C1 = hex(0xc1);
const C2 = hex(0xc2);
const C4 = hex(0xc4);
const CO1 = hex(0xd1);
const SIG_CO1 = hex(0xe1);
const INV1 = hex(0xf1);
const INV2 = hex(0xf2);
const INV3 = hex(0xf3);
const B1 = hex(0xb1);
const B2 = hex(0xb2);
const U1 = hex(0x51);
const EL1 = hex(0x71); // estimate lead (kitchen), convertible
const RQ1 = hex(0x72); // free-visit request with a visit
const EL2 = hex(0x73); // estimate lead already converted
const FREE_BOOKING = hex(0x91);
const NEW_PROJECT = hex(0xaa);

const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();

/* ---------------------------------------------------------- fixtures */
function row(id, over) {
  return {
    id,
    projectNumber: over.projectNumber,
    customerName: over.customerName,
    address: over.address,
    phone: "(555) 010-0000",
    email: `${over.projectNumber.toLowerCase()}@example.test`,
    projectType: over.projectType || "Kitchen",
    manualStatus: over.manualStatus,
    derivedStage: over.derivedStage,
    scheduledStart: null,
    executedValueCents: over.executedValueCents || 0,
    proposedValueCents: over.proposedValueCents || 0,
    invoicedCents: over.invoicedCents || 0,
    paidCents: over.paidCents || 0,
    outstandingCents: over.outstandingCents || 0,
    createdAt: iso(-10),
    href: `/admin/projects/${id}`,
  };
}

const ROWS = [
  row(P1, { projectNumber: "PRJ-1001", customerName: "Ann Example", address: "12 Oak Demo St, Testville, NY 11700", manualStatus: "Won", derivedStage: { key: "signed", label: "Signed" }, executedValueCents: 2500000, invoicedCents: 1100000, paidCents: 650000, outstandingCents: 450000 }),
  row(P2, { projectNumber: "PRJ-1002", customerName: "Ben Sample", address: "40 Elm Demo Ave, Testville, NY 11700", manualStatus: "Estimate Sent", derivedStage: { key: "proposal_issued", label: "Proposal issued" }, proposedValueCents: 1800000, projectType: "Bathroom" }),
  row(P3, { projectNumber: "PRJ-1003", customerName: "Cara Tester", address: "7 Pine Demo Rd, Testville, NY 11700", manualStatus: "Lead", derivedStage: { key: "lead", label: "Lead" }, projectType: "Roofing" }),
  row(P4, { projectNumber: "PRJ-1004", customerName: "Dan Fixture", address: "88 Birch Demo Ln, Testville, NY 11700", manualStatus: "In Progress", derivedStage: { key: "in_progress", label: "In progress" }, executedValueCents: 900000, invoicedCents: 900000, paidCents: 900000 }),
];

function sig(id, status, extra = {}) {
  return { id, status, mode: "REMOTE", sentAt: iso(-4), openedAt: null, expiresAt: iso(10), completedAt: status === "Completed" ? iso(-3) : null, declinedAt: null, live: ["Sent", "Viewed"].includes(status), ...extra };
}

function overviewFor(id, state) {
  const base = ROWS.find((r) => r.id === id);
  const project = {
    id,
    projectNumber: base.projectNumber,
    customerName: base.customerName,
    email: base.email,
    phone: base.phone,
    address: base.address,
    customerId: id === P1 ? U1 : null,
    projectType: base.projectType,
    notes: id === P1 ? "Gate code 1234. Dog in the yard." : "",
    isDeleted: false,
    qualification:
      id === P1
        ? { source: "EstimateLead", service: "kitchen", serviceLabel: "Kitchen", budgetRange: "$25k–$50k", timeline: "Within 3 months", financing: "Interested", estimateLow: 28000, estimateHigh: 41000, answers: { kitchen: { kitchenScope: "Full remodel", kitchenItems: ["Cabinets", "Countertops"] } }, notes: "Island please", submittedAt: iso(-30) }
        : null,
    scheduledStart: null,
    scheduledEnd: null,
    assignedFixterIds: [],
    substantialCompletionAt: id === P4 ? state.p4CompletedAt : null,
    warrantyEndsAt: id === P4 ? state.p4WarrantyEndsAt : null,
    punchList: id === P4 ? state.punch : [],
    statusHistory: id === P1 ? [{ from: "Lead", to: "Won", at: iso(-5), actorName: "Owner Test", reason: "Signed at the table", source: "manual" }] : [],
    createdAt: iso(-10),
    updatedAt: state.updatedAt[id] || iso(-1),
  };
  const manualStatus = state.status[id] || base.manualStatus;
  const docs = { agreements: [], changeOrders: [], invoices: [] };
  const nextSteps = [];
  let financials = { executedValueCents: base.executedValueCents, proposedValueCents: base.proposedValueCents, invoicedCents: base.invoicedCents, paidCents: base.paidCents, outstandingCents: base.outstandingCents, uninvoicedExecutedCents: base.executedValueCents - base.invoicedCents, agreementSigned: base.executedValueCents > 0, pendingChangeOrderCents: 0 };
  if (id === P1) {
    docs.agreements.push({ id: C1, contractNumber: "C-2001", version: 2, status: "Signed", current: true, priceCents: 2500000, depositAmountCents: 250000, signature: sig(hex(0xe9), "Completed") });
    docs.changeOrders.push({ id: CO1, changeOrderNumber: "C-2001-CO-01", title: "Extra outlet", status: "Sent", netAdjustmentCents: 45000, signature: sig(SIG_CO1, "Sent") });
    docs.invoices.push(
      { id: INV1, invoiceNumber: "1001", status: "Partially Paid", totalCents: 500000, paidCents: 150000, balanceCents: 350000, dueDate: iso(-5), overdue: true },
      { id: INV2, invoiceNumber: "1002", status: "Paid in Full", totalCents: 500000, paidCents: 500000, balanceCents: 0, dueDate: iso(-20), overdue: false },
      { id: INV3, invoiceNumber: "1003", status: "Draft", totalCents: 100000, paidCents: 0, balanceCents: 100000, dueDate: iso(20), overdue: false }
    );
    financials = { ...financials, pendingChangeOrderCents: 45000 };
    if (!state.depositBilled) {
      nextSteps.push({ key: "deposit_not_invoiced", label: "Create the deposit invoice for $2,500.00", detail: "The agreement is signed and no deposit invoice exists yet.", severity: "attention", action: { type: "endpoint", method: "POST", endpoint: `/api/admin/projects/${P1}/invoices/from-schedule`, body: { kind: "deposit" } } });
    }
    nextSteps.unshift({ key: "invoice_overdue", label: "Invoice #1001 is overdue", detail: "$3,500.00 outstanding.", severity: "problem", action: { type: "navigate", href: `/admin/projects/${P1}?tab=invoices&invoice=${INV1}` } });
    nextSteps.push({ key: "change_order_awaiting_signature", label: "Change order C-2001-CO-01 awaiting signature", detail: "Extra outlet - sent 4 days ago.", severity: "attention", action: { type: "endpoint", method: "POST", endpoint: `/api/admin/signatures/native/${SIG_CO1}/resend` } });
  }
  if (id === P2) {
    docs.agreements.push({ id: C2, contractNumber: "C-2002", version: 1, status: "Generated", current: true, priceCents: 1800000, depositAmountCents: 300000, signature: null });
    nextSteps.push({ key: "send_agreement", label: "Send the agreement for signature", detail: "Agreement #C-2002 is generated but no signature request is open.", severity: "attention", action: { type: "endpoint", method: "POST", endpoint: "/api/admin/signatures/native/send", body: { documentType: "CONTRACT", documentId: C2, mode: "REMOTE" } } });
  }
  if (id === P3) {
    nextSteps.push({ key: "create_agreement", label: "Prepare the agreement", detail: "No agreement has been issued for this project yet.", severity: "attention", action: { type: "navigate", href: `/admin/projects/${P3}?tab=agreement` } });
  }
  if (id === P4) {
    docs.agreements.push({ id: C4, contractNumber: "C-2004", version: 1, status: "Signed", current: true, priceCents: 900000, depositAmountCents: 0, signature: sig(hex(0xea), "Completed") });
    const open = state.punch.filter((i) => !i.done);
    if (open.length) nextSteps.push({ key: "punch_list_open", label: `${open.length} punch list item${open.length === 1 ? "" : "s"} open`, detail: open.map((i) => i.text).join("; "), severity: "info", action: { type: "navigate", href: `/admin/projects/${P4}?tab=closeout` } });
  }
  return {
    project,
    manualStatus,
    derivedStage: id === P4 && state.p4CompletedAt ? { key: "paid_in_full", label: "Paid in full" } : base.derivedStage,
    financials,
    nextSteps,
    documents: docs,
    linkedBookings: id === P1 ? state.p1Bookings : [],
    lead: id === P1 ? { model: "estimate", id: EL2, href: `/admin/leads/estimate-${EL2}` } : null,
    allowedActions: { edit: true, markSubstantiallyComplete: id === P4 && !state.p4CompletedAt, createDepositInvoice: id === P1 && !state.depositBilled, linkBooking: true, editPunchList: true },
  };
}

function legacyProject(id) {
  const r = ROWS.find((x) => x.id === id) || { projectNumber: "PRJ-NEW", customerName: "New Person", address: "1 New Demo St", projectType: "Kitchen", manualStatus: "Lead", phone: "", email: "" };
  return {
    _id: id,
    projectNumber: r.projectNumber,
    status: r.manualStatus,
    customerId: id === P1 ? U1 : null,
    addressId: null,
    customerName: r.customerName,
    phone: r.phone,
    email: r.email,
    address: r.address,
    projectType: r.projectType,
    // The manual estimate must never be shown as project money: an absurd value proves it.
    estimateAmount: 987654,
    depositAmount: 0,
    balanceDue: 0,
    notes: "",
    createdAt: iso(-10),
    updatedAt: iso(-1),
  };
}

function contract(id, projectId, status, extra = {}) {
  return {
    _id: id,
    id,
    contractNumber: id === C1 ? "C-2001" : id === C2 ? "C-2002" : "C-2004",
    version: id === C1 ? 2 : 1,
    current: true,
    projectId,
    status,
    termsVersion: "PIH-NY-HI-2026-004",
    customerSnapshot: { fullName: id === C2 ? "Ben Sample" : "Ann Example", email: id === C2 ? "ben.contract@example.test" : "ann.contract@example.test", phone: "5550100", customerId: "" },
    propertySnapshot: { address: "40 Elm Demo Ave, Testville, NY 11700", projectId, projectNumber: "PRJ" },
    workType: "Kitchen Remodel",
    otherWorkType: "",
    projectDescription: "Kitchen remodel",
    scopeText: "Replace the cabinets, the countertops and the sink, patch and paint the walls, and install new lighting over the island.",
    originalContractPriceCents: 1800000,
    totalPriceCents: 1800000,
    discounts: [],
    totalDiscountAmountCents: 0,
    adjustedContractPriceCents: 1800000,
    depositAmountCents: 300000,
    remainingBalanceCents: 1500000,
    paymentSchedule: [{ label: "Deposit", amountCents: 300000, dueCondition: "At signing" }, { label: "Cabinets installed", amountCents: 1500000, dueCondition: "On install" }],
    dates: { contractDate: iso(-6), estimatedStartDate: iso(5), estimatedCompletionDate: iso(30) },
    optionalDetails: { materialsAllowances: "", exclusions: "", permitResponsibility: "", specialInstructions: "", additionalNotes: "" },
    generatedPdf: { available: true, fileName: "agreement.pdf" },
    signedPdf: { available: status === "Signed" },
    emailHistory: [],
    auditHistory: [],
    createdAt: iso(-6),
    updatedAt: iso(-1),
    ...extra,
  };
}

function invoice(id, number, status, totalCents, payments) {
  const paid = payments.reduce((s, p) => s + p.amountCents, 0);
  return {
    _id: id,
    id,
    invoiceNumber: number,
    version: 1,
    projectId: P1,
    contractId: C1,
    source: "contract",
    status,
    customerSnapshot: { fullName: "Ann Example", email: "ann.invoice@example.test", phone: "5550100" },
    propertySnapshot: { address: "12 Oak Demo St", formattedAddress: "12 Oak Demo St, Testville, NY 11700", addressLine1: "12 Oak Demo St", addressLine2: "", city: "Testville", state: "NY", postalCode: "11700" },
    projectSnapshot: { projectNumber: "PRJ-1001", workType: "Kitchen", projectDescription: "Kitchen remodel" },
    lineItems: [{ _id: `${id}l`, description: "Progress billing", quantity: 1, unitPriceCents: totalCents, amountCents: totalCents, category: "Labor" }],
    discounts: [],
    taxTreatment: "Capital Improvement",
    taxRateBasisPoints: 0,
    subtotalCents: totalCents,
    totalDiscountCents: 0,
    taxableAmountCents: 0,
    taxAmountCents: 0,
    invoiceTotalCents: totalCents,
    payments,
    totalPaidCents: paid,
    remainingBalanceCents: Math.max(totalCents - paid, 0),
    dueTerm: "Net 15",
    dates: { invoiceDate: iso(-20), dueDate: iso(-5), paidInFullAt: status === "Paid in Full" ? iso(-2) : null },
    publicNote: "",
    internalNote: "",
    paymentInstructions: "",
    generatedPdfs: [],
    currentPdf: { available: true, fileName: `${number}.pdf` },
    eventHistory: [],
    createdAt: iso(-20),
    updatedAt: iso(-2),
  };
}

const INVOICES = [
  invoice(INV1, "1001", "Partially Paid", 500000, [
    { _id: "pay1", amountCents: 100000, paymentDate: iso(-10), method: "Check", reference: "Check 512", provider: "manual" },
    { _id: "pay2", amountCents: 50000, paymentDate: iso(-8), method: "Card", reference: "Online", provider: "stripe", stripePaymentIntentId: "pi_test_fake_1" },
  ]),
  invoice(INV2, "1002", "Paid in Full", 500000, [{ _id: "pay3", amountCents: 500000, paymentDate: iso(-2), method: "Check", reference: "", provider: "manual" }]),
  invoice(INV3, "1003", "Draft", 100000, []),
];

const FINANCIALS = {
  projectId: P1,
  projectNumber: "PRJ-1001",
  agreement: { id: C1, contractNumber: "C-2001", version: 2, status: "Signed", isBinding: true, contractDate: iso(-6), estimate: null },
  otherAgreementNumbers: [],
  changeOrders: { executed: [], pending: [] },
  invoices: [],
  totals: { originalAgreementCents: 2500000, executedChangeOrderCents: 0, approvedAgreementCents: 2500000, pendingChangeOrderCents: 45000, projectedAgreementCents: 2545000, executedChangeOrderCount: 0, pendingChangeOrderCount: 1, invoicedCents: 1100000, paidCents: 650000, outstandingInvoicedCents: 450000, uninvoicedApprovedCents: 1400000, overInvoicedCents: 0, countedInvoiceCount: 3 },
  valuation: { agreementSigned: true, executedValueCents: 2500000, proposedValueCents: 0, awaitingSignatureChangeOrderCents: 45000, invoicedCents: 1100000, paidCents: 650000, outstandingCents: 450000, uninvoicedExecutedCents: 1400000 },
};

function leadRow(model, id, over) {
  return {
    key: `${model}-${id}`,
    legacyId: model === "estimate" ? `estimate:${id}` : id,
    model,
    id,
    name: over.name,
    email: over.email,
    phone: "(555) 010-0300",
    address: over.address || "",
    service: over.service,
    serviceLabel: over.serviceLabel,
    sourcePage: over.sourcePage || "",
    status: over.status || "new",
    createdAt: iso(over.age || -2),
    projectId: over.projectId || null,
    bookingId: over.bookingId || null,
    budgetRange: over.budgetRange || "",
    timeline: over.timeline || "",
    estimateLow: over.estimateLow ?? null,
    estimateHigh: over.estimateHigh ?? null,
    href: `/admin/leads/${model}-${id}`,
  };
}

function leadsFixture(state) {
  return [
    leadRow("estimate", EL1, { name: "Eva Prospect", email: "eva@example.test", address: "5 Cedar Demo Ct, Testville, NY 11700", service: "kitchen", serviceLabel: "Kitchen", budgetRange: "$25k–$50k", timeline: "Within 3 months", estimateLow: 28000, estimateHigh: 41000, projectId: state.el1Project, sourcePage: "/kitchen-bathroom" }),
    leadRow("request", RQ1, { name: "Fay Visitor", email: "fay@example.test", address: "9 Maple Demo Dr, Testville, NY, 11700", service: "free_visit_request", serviceLabel: "Free visit request", status: "pending_confirmation", bookingId: FREE_BOOKING }),
    leadRow("estimate", EL2, { name: "Ann Example", email: "ann@example.test", address: "12 Oak Demo St", service: "kitchen", serviceLabel: "Kitchen", status: "won", projectId: P1, age: -40 }),
  ];
}

function leadDetail(row) {
  const isEstimate = row.model === "estimate";
  const visit = Boolean(row.bookingId);
  return {
    ...row,
    contactPref: "Phone",
    bestTime: "Evenings",
    message: isEstimate ? "We want an island." : "Leaky faucet and a door that sticks",
    requestedDate: "",
    requestedTime: "",
    qualification: isEstimate
      ? { source: "EstimateLead", service: row.service, serviceLabel: row.serviceLabel, budgetRange: row.budgetRange, timeline: row.timeline, financing: "Interested", estimateLow: row.estimateLow, estimateHigh: row.estimateHigh, answers: { kitchen: { kitchenScope: "Full remodel", kitchenSize: "Medium (150–250 sq ft)", kitchenItems: ["Cabinets", "Countertops", "Island"] } }, contactPref: "Phone", bestTime: "Evenings", notes: "We want an island.", sourcePage: "/kitchen-bathroom", leadSource: "estimate", submittedAt: row.createdAt }
      : { source: "Request", service: row.service, serviceLabel: row.serviceLabel, budgetRange: "", timeline: "", financing: "", estimateLow: null, estimateHigh: null, answers: {}, notes: "Leaky faucet and a door that sticks", sourcePage: "", submittedAt: row.createdAt },
    allowedActions: {
      setStatus: !visit,
      statuses: visit ? [] : isEstimate ? ["new", "contacted", "qualified", "won", "lost"] : ["new", "contacted", "won", "lost"],
      convertToProject: !row.projectId && isEstimate,
      openProject: Boolean(row.projectId),
      delete: true,
    },
  };
}

/* ------------------------------------------------------------ results */
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

function freshState() {
  return {
    calls: [],
    depositBilled: false,
    depositAttempts: 0,
    failNextDeposit: true,
    status: {},
    updatedAt: {},
    punch: [{ id: "pl1", text: "Touch up paint by the window", done: false, doneAt: null }],
    p4CompletedAt: null,
    p4WarrantyEndsAt: null,
    p1Bookings: [{ id: B1, bookingNumber: "4001", date: iso(-12), status: "Completed", service: "Site visit for project PRJ-1001", isSiteVisit: true, href: `/admin/jobs/${B1}` }],
    el1Project: null,
    convertCount: 0,
    contractStatus: { [C2]: "Generated" },
  };
}

async function open(browser, { width = 390, height = 844, touch, state = freshState() } = {}) {
  const mobile = touch ?? width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
  await ctx.addInitScript(() => location.pathname.startsWith("/admin") && localStorage.setItem("token", "ui-token"));
  const external = [];
  const local = new URL(BASE);
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (!u.pathname.includes("/api/")) {
      if (u.origin === local.origin) return route.continue();
      external.push(u.href);
      return route.abort();
    }
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type,x-ghl-secret", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData() ? "(form)" : null;
    }
    state.calls.push({ method: req.method(), path: p, url: u.href, body, headers: req.headers() });
    const m = req.method();

    if (p === "/api/auth/me") return json(OWNER);
    if (p === "/api/admin/needs-action") return json({ total: 1, sections: [{ key: "projects", count: 1, items: [] }], items: [{ id: P1, kind: "project_invoice_overdue", title: "Invoice #1001 overdue", subtitle: "Ann Example", reason: "", severity: "problem", href: `/admin/projects/${P1}?tab=invoices&invoice=${INV1}`, at: iso(-1), section: "projects" }] });

    /* projects */
    if (p === "/api/admin/projects/search" && m === "POST") {
      const s = String(body?.search || "").toLowerCase();
      let rows = ROWS.filter((r) => !s || r.customerName.toLowerCase().includes(s) || r.address.toLowerCase().includes(s));
      if (body?.stage) rows = rows.filter((r) => r.derivedStage.key === body.stage);
      return json({ projects: rows, total: rows.length, page: body?.page || 1, limit: body?.limit || 25, stages: {} });
    }
    if (p === "/api/admin/projects" && m === "POST") return json({ project: { ...legacyProject(NEW_PROJECT), _id: NEW_PROJECT, projectNumber: "PRJ-1099", customerName: body?.customerName || "" } }, 201);
    let match;
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/overview$/))) {
      const id = match[1];
      if (!ROWS.find((r) => r.id === id) && id !== NEW_PROJECT) return json({ message: "Project not found", code: "NOT_FOUND" }, 404);
      if (id === NEW_PROJECT) return json({ ...overviewFor(P3, state), project: { ...overviewFor(P3, state).project, id: NEW_PROJECT, projectNumber: "PRJ-1099" } });
      return json(overviewFor(id, state));
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/status$/)) && m === "PUT") {
      const id = match[1];
      const current = state.status[id] || ROWS.find((r) => r.id === id).manualStatus;
      if (body?.expectedStatus !== current) return json({ message: "The project status changed since you opened it.", code: "STALE", currentStatus: current }, 409);
      state.status[id] = body.status;
      return json({ project: { id, status: body.status, updatedAt: iso(0) } });
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/invoices\/from-schedule$/))) {
      state.depositAttempts += 1;
      if (state.failNextDeposit) {
        // A dropped connection after a moment: the retry must reuse the key.
        state.failNextDeposit = false;
        await new Promise((r) => setTimeout(r, 900));
        return route.abort("connectionreset");
      }
      if (state.depositBilled) {
        if (body?.idempotencyKey === state.depositKey) return json({ replayed: true, invoiceId: hex(0xf9), invoiceNumber: "1009", kind: "deposit", scheduleIndex: null });
        return json({ message: "This deposit is already billed (invoice #1009).", code: "ALREADY_BILLED", invoiceId: hex(0xf9) }, 409);
      }
      state.depositBilled = true;
      state.depositKey = body?.idempotencyKey;
      return json({ invoice: { id: hex(0xf9), _id: hex(0xf9), invoiceNumber: "1009" }, kind: "deposit", scheduleIndex: null }, 201);
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/bookings$/)) && m === "POST") {
      state.p1Bookings.push({ id: body.bookingId, bookingNumber: "4002", date: iso(3), status: "Confirmed", service: "Visit", isSiteVisit: Boolean(body.siteVisit), href: `/admin/jobs/${body.bookingId}` });
      return json({ linkedBookingIds: state.p1Bookings.map((b) => b.id), siteVisitBookingId: B1, updatedAt: iso(0) });
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/bookings\/([a-f0-9]{24})$/)) && m === "DELETE") {
      state.p1Bookings = state.p1Bookings.filter((b) => b.id !== match[2]);
      return json({ linkedBookingIds: state.p1Bookings.map((b) => b.id), siteVisitBookingId: null, updatedAt: iso(0) });
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/schedule$/)) && m === "PUT") {
      state.updatedAt[match[1]] = iso(0);
      return json({ scheduledStart: body.scheduledStart, scheduledEnd: body.scheduledEnd, assignedFixterIds: body.assignedFixterIds || [], updatedAt: iso(0) });
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/substantial-completion$/))) {
      if (body?.confirm !== true) return json({ message: "Confirm", code: "CONFIRMATION_REQUIRED" }, 400);
      state.p4CompletedAt = iso(0);
      state.p4WarrantyEndsAt = new Date(Date.now() + 365 * 86400000).toISOString();
      return json({ substantialCompletionAt: state.p4CompletedAt, warrantyEndsAt: state.p4WarrantyEndsAt, warrantyTermsVersion: "PIH-NY-HI-2026-004", warranty: { months: 12, startsAt: "substantial_completion" }, updatedAt: iso(0) });
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/punch-list(?:\/([^/]+))?$/))) {
      if (m === "POST") state.punch.push({ id: `pl${state.punch.length + 2}`, text: body.text, done: false, doneAt: null });
      if (m === "PATCH") state.punch = state.punch.map((i) => (i.id === match[2] ? { ...i, done: body.done === true, doneAt: body.done ? iso(0) : null } : i));
      if (m === "DELETE") state.punch = state.punch.filter((i) => i.id !== match[2]);
      return json({ punchList: state.punch, updatedAt: iso(0) }, m === "POST" ? 201 : 200);
    }
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/financials$/))) return json(FINANCIALS);
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})\/estimates$/))) return json({ estimates: [] });
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})$/)) && m === "GET") return json({ project: legacyProject(match[1]) });
    if ((match = p.match(/^\/api\/admin\/projects\/([a-f0-9]{24})$/)) && m === "PUT") return json({ project: { ...legacyProject(match[1]), ...body } });
    if (p.startsWith("/api/admin/projects/customer/")) return json({ customer: { id: U1, customerId: U1, userId: "PF-U1", name: "Ann Example", firstName: "Ann", lastName: "Example", email: "ann@example.test", phone: "5550100", defaultAddressId: null, addresses: [], matchingAddress: null, membershipSummary: { overallStatus: "none" } } });

    /* documents */
    if (p === "/api/admin/contracts/meta") return json({ company: { legalName: "Premium Island Homes Inc.", addressLines: [], phone: "", email: "", website: "", homeImprovementLicense: "HI-00000", projectManager: "" }, workTypes: ["Kitchen Remodel"], statuses: [], termsVersion: "T", termsSections: [], cancellationNotice: { includeCancellationNotice: false, termsVersion: "", title: "", body: "" } });
    if ((match = p.match(/^\/api\/admin\/contracts\/project\/([a-f0-9]{24})\/estimate-options$/))) return json({ estimates: [] });
    if ((match = p.match(/^\/api\/admin\/contracts\/project\/([a-f0-9]{24})$/))) {
      const pid = match[1];
      const list = pid === P1 ? [contract(C1, P1, "Signed")] : pid === P2 ? [contract(C2, P2, state.contractStatus[C2])] : pid === P4 ? [contract(C4, P4, "Signed")] : [];
      return json({ contracts: list });
    }
    if ((match = p.match(/^\/api\/admin\/contracts\/([a-f0-9]{24})\/cancel$/))) {
      state.contractStatus[match[1]] = "Canceled";
      return json({ contract: contract(match[1], P2, "Canceled") });
    }
    if (p === "/api/admin/signatures/meta") return json({ provider: "adobe_sign", configured: false, companySignerConfigured: false, webhook: null });
    if (p.startsWith("/api/admin/signatures/document/")) return json({ signatures: [] });
    if (p === "/api/admin/signatures/native/send") return json({ signature: { id: hex(0xee) }, emailed: true, signingUrl: "http://localhost/sign/x" });
    if (/^\/api\/admin\/signatures\/native\/[a-f0-9]{24}\/resend$/.test(p)) return json({ emailed: true });
    if (p === "/api/admin/signatures/native/manual-upload") return json({ ok: true });
    if (p === "/api/admin/change-orders/meta") return json({ company: {}, statuses: [], scheduleImpactTypes: ["none"], termsVersion: "T", amendableContractStatuses: ["Signed"], maxSignedPdfBytes: 1 });
    if ((match = p.match(/^\/api\/admin\/change-orders\/project\/([a-f0-9]{24})$/))) {
      const cos =
        match[1] === P1
          ? [
              {
                _id: CO1,
                id: CO1,
                changeOrderNumber: "C-2001-CO-01",
                sequence: 1,
                projectId: P1,
                contractId: C1,
                status: "Sent",
                termsVersion: "T",
                title: "Extra outlet",
                customerSnapshot: { fullName: "Ann Example", email: "ann.co@example.test", phone: "" },
                propertySnapshot: { address: "12 Oak Demo St", projectNumber: "PRJ-1001" },
                contractSnapshot: { contractNumber: "C-2001", originalContractAmountCents: 2500000 },
                lines: [{ description: "Outlet", direction: "add", amountCents: 45000 }],
                netAdjustmentCents: 45000,
                contractAmountBeforeChangeCents: 2500000,
                newContractAmountCents: 2545000,
                previousChangeOrderAdjustmentCents: 0,
                scheduleImpact: { type: "none", days: 0, note: "" },
                notes: "",
                generatedPdf: { available: true },
                signature: { id: SIG_CO1, status: "Sent", provider: "native", signingMode: "REMOTE", sentAt: iso(-4), signers: [] },
                auditHistory: [],
                createdAt: iso(-5),
                updatedAt: iso(-4),
              },
            ]
          : [];
      return json({ changeOrders: cos, contractSummaries: [] });
    }
    if ((match = p.match(/^\/api\/admin\/invoices\/project\/([a-f0-9]{24})$/))) return json({ invoices: match[1] === P1 ? INVOICES : [] });
    if ((match = p.match(/^\/api\/admin\/invoices\/([a-f0-9]{24})\/void$/))) {
      const inv = INVOICES.find((i) => i._id === match[1]);
      if (inv.payments.length) return json({ message: "This invoice has payments", code: "HAS_PAYMENTS" }, 409);
      if (body?.confirmation !== "VOID") return json({ message: "Type VOID" }, 400);
      return json({ invoice: { ...inv, status: "Voided" } });
    }
    if ((match = p.match(/^\/api\/admin\/invoices\/([a-f0-9]{24})$/)) && m === "GET") {
      const inv = INVOICES.find((i) => i._id === match[1]);
      return inv ? json({ invoiceId: inv._id, projectId: P1, invoiceNumber: inv.invoiceNumber, status: inv.status }) : json({ message: "Invoice not found", code: "NOT_FOUND" }, 404);
    }

    /* jobs (link an existing visit) */
    if (p === "/api/admin/jobs/search" && m === "POST") return json({ q: body.q, total: 1, limited: false, groups: [{ date: iso(3).slice(0, 10), rows: [{ id: B2, bookingNumber: "4002", date: iso(3), status: "Confirmed", type: "one_time", typeLabel: "One-Time Visit", customer: { id: U1, name: "Ann Example" }, addressShort: "12 Oak Demo St", town: "Testville", technician: null, flags: [], timing: null, updatedAt: iso(-1) }] }] });
    if (p === "/api/admin/booking-assignees") return json({ fixters: [{ id: hex(0x61), name: "Fixter One", email: "f1@example.test", employeePosition: "Fixter", isDefaultFixter: true }] });

    /* leads */
    if (p === "/api/admin/leads/search" && m === "POST") {
      const s = String(body?.search || "").toLowerCase();
      let leads = leadsFixture(state).filter((l) => !s || l.name.toLowerCase().includes(s));
      if (body?.status) leads = leads.filter((l) => l.status === body.status);
      if (body?.model) leads = leads.filter((l) => l.model === body.model);
      return json({ leads, total: leads.length, page: 1, limit: body?.limit || 30 });
    }
    if ((match = p.match(/^\/api\/admin\/leads\/(request|estimate)\/([a-f0-9]{24})$/))) {
      const found = leadsFixture(state).find((l) => l.model === match[1] && l.id === match[2]);
      return found ? json({ lead: leadDetail(found) }) : json({ message: "Lead not found", code: "NOT_FOUND" }, 404);
    }
    if ((match = p.match(/^\/api\/admin\/leads\/(request|estimate)\/([a-f0-9]{24})\/convert-to-project$/))) {
      state.convertCount += 1;
      const already = Boolean(state.el1Project);
      state.el1Project = P3;
      return json({ created: !already, project: { id: P3, projectNumber: "PRJ-1003", customerName: "Eva Prospect", status: "Lead", projectType: "Kitchen", isDeleted: false, leadRef: { model: "EstimateLead", id: EL1 }, qualification: {}, href: `/admin/projects/${P3}` } }, already ? 200 : 201);
    }
    if (/^\/api\/admin\/requests\/[^/]+\/status$/.test(p)) return json({ request: { status: body.status } });
    if (/^\/api\/admin\/requests\/[^/]+$/.test(p) && m === "DELETE") return json({ message: "Lead deleted" });

    return json(p.includes("summary") || p.includes("settings") ? {} : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    dialogs.push(d.type());
    d.dismiss().catch(() => {});
  });
  return { ctx, page, external, errors, dialogs, state };
}

const go = (page, route) => page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
const waitFor = (page, sel, timeout = 15000) => page.waitForSelector(sel, { timeout }).then(() => true, () => false);
const pathOf = (page) => {
  const u = new URL(page.url());
  return u.pathname + u.search;
};
async function until(fn, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
const confirmButton = (page) => page.locator('[role="dialog"] [data-confirm]').last();

(async () => {
  const browser = await chromium.launch();
  const allDialogs = [];
  const allExternal = [];
  const allErrors = [];
  const finish = (o) => {
    allDialogs.push(...o.dialogs);
    allExternal.push(...o.external);
    allErrors.push(...o.errors);
    return o.ctx.close();
  };

  /* ---------------- list, search, stage filter ---------------- */
  console.log("\n--- list ---");
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, "/admin/projects");
    check("the list renders its rows", await waitFor(page, `[data-project-row="${P1}"]`));
    const first = await page.locator(`[data-project-row="${P1}"]`).innerText();
    check("a row shows customer, address, stage and manual status", /Ann Example/.test(first) && /12 Oak Demo St/.test(first) && /Signed/.test(first) && /Status: Won/.test(first), first.replace(/\s+/g, " "));
    check("a row's money is the financial service's (signed / paid / outstanding)", /\$25,000/.test(first) && /\$6,500/.test(first) && /\$4,500/.test(first));
    check("the manual estimate is never shown as project money", !(await page.content()).includes("987,654"));
    check("a proposal row says awaiting signature", /Proposed\s*\$18,000.*awaiting signature/s.test(await page.locator(`[data-project-row="${P2}"]`).innerText()));
    check("the attention badge comes from Needs action", /Invoice #1001 overdue/.test(first));
    check("the list was read with a POST search", state.calls.some((c) => c.method === "POST" && c.path === "/api/admin/projects/search"));

    await page.getByLabel("Search projects").fill("Ben");
    await until(() => state.calls.some((c) => c.path === "/api/admin/projects/search" && c.body?.search === "Ben"));
    check("search text is sent in the POST body", state.calls.some((c) => c.path === "/api/admin/projects/search" && c.body?.search === "Ben"));
    await until(async () => (await page.locator("[data-project-row]").count()) === 1);
    check("search narrows the rows", (await page.locator("[data-project-row]").count()) === 1);
    check("search text never appears in a URL (page or request)", !page.url().includes("Ben") && !state.calls.some((c) => c.url.includes("Ben")));
    await page.getByLabel("Search projects").fill("");

    await page.getByRole("link", { name: "Signed", exact: true }).click();
    await until(() => pathOf(page).includes("stage=signed"));
    check("the stage filter is in the URL", pathOf(page) === "/admin/projects?stage=signed", pathOf(page));
    await until(() => state.calls.some((c) => c.path === "/api/admin/projects/search" && c.body?.stage === "signed"));
    check("the stage filter is sent to the server", state.calls.some((c) => c.path === "/api/admin/projects/search" && c.body?.stage === "signed"));
    await until(async () => (await page.locator("[data-project-row]").count()) === 1);
    check("only signed projects remain", (await page.locator("[data-project-row]").count()) === 1 && (await page.locator(`[data-project-row="${P1}"]`).count()) === 1);
    await finish(o);
  }

  /* ---------------- create project sheet ---------------- */
  console.log("\n--- create project ---");
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, "/admin/projects");
    await waitFor(page, "[data-project-row]");
    await page.locator('[data-action="new-project"]').click();
    check("Create project opens a kit sheet", await waitFor(page, '[data-sheet="project-create"][role="dialog"]'));
    const sheet = page.locator('[data-sheet="project-create"]');
    check("the phone field is type=tel", (await sheet.locator('input[type="tel"]').count()) === 1);
    check("the money field uses the decimal keypad", (await sheet.locator('input[inputmode="decimal"]').count()) === 1);
    await page.waitForTimeout(500);
    const box = await sheet.boundingBox();
    check("the sheet fits the viewport (dvh max-height)", box && box.y >= 0 && box.y + box.height <= 844 + 1, JSON.stringify(box));
    const save = page.locator('[data-action="save-project"]');
    const saveBox = await save.boundingBox();
    check("the footer is sticky and visible without scrolling", saveBox && saveBox.y + saveBox.height <= 844 && saveBox.height >= 44, JSON.stringify(saveBox));
    await sheet.getByRole("radio", { name: "New or manual customer" }).click();
    await save.click();
    check("required fields are named when missing", await waitFor(page, '[data-sheet="project-create"] [data-error]', 4000));
    check("nothing is created while invalid", !state.calls.some((c) => c.method === "POST" && c.path === "/api/admin/projects"));
    await sheet.getByLabel("Customer name").fill("Gus New");
    await sheet.getByLabel("Project address").fill("1 New Demo St, Testville, NY 11700");
    await sheet.getByLabel("Phone").fill("5550111");
    await sheet.getByLabel("Rough estimate (optional)").fill("12,500.50");
    await save.click();
    await until(() => pathOf(page).startsWith(`/admin/projects/${NEW_PROJECT}`));
    const created = state.calls.find((c) => c.method === "POST" && c.path === "/api/admin/projects");
    check("the project is created once with the typed amount", created && created.body.estimateAmount === 12500.5 && state.calls.filter((c) => c.method === "POST" && c.path === "/api/admin/projects").length === 1, JSON.stringify(created?.body?.estimateAmount));
    check("it opens the new project", pathOf(page).startsWith(`/admin/projects/${NEW_PROJECT}`), pathOf(page));
    await finish(o);
  }

  /* ---------------- deep links and tabs ---------------- */
  console.log("\n--- deep links ---");
  {
    const o = await open(browser, { width: 1440, height: 900, touch: false });
    const { page, state } = o;
    await go(page, `/admin/projects/${P1}`);
    check("an email link /admin/projects/:id opens the project", await waitFor(page, `[data-project-detail="${P1}"]`));
    check("the customer links to their profile", (await page.locator('[data-project-customer] a').getAttribute("href")) === `/admin/customers/${U1}`);
    const head = await page.locator(`[data-project-detail="${P1}"] header`).innerText();
    check("the header shows the stage beside the manual status", /Signed/.test(head) && /Status: Won/.test(head));
    const money = await page.locator("[data-financials]").innerText();
    check("money is labelled: signed value, awaiting signature, invoiced, paid, outstanding", /Signed value/.test(money) && /\$25,000/.test(money) && /Change orders awaiting signature/.test(money) && /Invoiced/.test(money) && /Paid/.test(money) && /Outstanding/.test(money), money.replace(/\s+/g, " "));
    const docs = await page.locator("[data-documents]").innerText();
    check("signed documents and overdue invoices are visible", /Agreement #C-2001 v2/.test(docs) && /Signed/.test(docs) && /Invoice #1001/.test(docs) && /Overdue/.test(docs));
    check("the homeowner's answers are on the project", /Within 3 months/.test(await page.locator("[data-qualification]").innerText()));
    const tabs = await page.locator('[aria-label="Project sections"] a').allInnerTexts();
    check("tabs follow the work order", tabs.map((t) => t.replace(/\d+$/, "").trim()).join(",") === "Overview,Estimate,Agreement,Change orders,Invoices,Visits,Closeout", tabs.join(","));
    await page.locator('[aria-label="Project sections"] a', { hasText: "Visits" }).click();
    await until(() => pathOf(page) === `/admin/projects/${P1}?tab=visits`);
    check("the tab is in the URL", pathOf(page) === `/admin/projects/${P1}?tab=visits`, pathOf(page));
    await page.reload({ waitUntil: "domcontentloaded" });
    check("a reload keeps the tab", await waitFor(page, '[data-tab-panel="visits"]'));
    await go(page, `/admin/projects/${P1}?tab=invoices&invoice=${INV1}`);
    check("?tab=invoices&invoice= opens that invoice", await until(async () => /Invoice #1001/.test(await page.locator("h3").allInnerTexts().then((t) => t.join(" ")))));
    await go(page, `/admin/projects?invoiceId=${INV2}`);
    check("old /admin/projects?invoiceId= resolves to the invoice in its project", await until(() => pathOf(page) === `/admin/projects/${P1}?tab=invoices&invoice=${INV2}`), pathOf(page));
    await go(page, `/admin?tab=invoices&invoiceId=${INV3}`);
    check("old /admin?tab=invoices&invoiceId= resolves too", await until(() => pathOf(page) === `/admin/projects/${P1}?tab=invoices&invoice=${INV3}`), pathOf(page));
    await go(page, `/admin/projects?invoiceId=${hex(0xfe)}`);
    check("an unknown invoice falls back to the list", await until(() => pathOf(page) === "/admin/projects"), pathOf(page));
    await go(page, `/admin/projects/${hex(0x99)}`);
    check("an unknown project says so", await waitFor(page, '[data-project-detail="error"]') && /not found/i.test(await page.locator('[data-project-detail="error"]').innerText()));
    check("the overview came from GET /:id/overview", state.calls.some((c) => c.path === `/api/admin/projects/${P1}/overview`));
    await finish(o);
  }

  /* ---------------- next steps, idempotency, deposit once ---------------- */
  console.log("\n--- next steps ---");
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, `/admin/projects/${P1}`);
    await waitFor(page, '[data-step="deposit_not_invoiced"]');
    await page.locator('[data-step-action="deposit_not_invoiced"]').click();
    check("the deposit confirm states the amount", await until(async () => /Creates a draft invoice for \$2,500(\.00)?/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => ""))));
    check("and that nothing is sent to the customer", /Nothing is sent to the customer/.test(await page.locator('[role="dialog"]').last().innerText()));
    const btn = confirmButton(page);
    await btn.click();
    await btn.click({ timeout: 500 }).catch(() => {});
    await until(async () => /didn|Network|wrong|work/i.test(await page.locator('[role="dialog"] [role="alert"]').innerText().catch(() => "")), 6000);
    const firstAttempts = state.calls.filter((c) => c.path.endsWith("/invoices/from-schedule"));
    check("a double tap sends one request", firstAttempts.length === 1, String(firstAttempts.length));
    check("a failed attempt keeps the sheet open with the error", (await page.locator('[role="dialog"] [role="alert"]').count()) === 1);
    await confirmButton(page).click();
    await until(() => state.depositBilled);
    await until(() => pathOf(page).includes("tab=invoices"));
    const attempts = state.calls.filter((c) => c.path.endsWith("/invoices/from-schedule"));
    const key = attempts[0]?.body?.idempotencyKey || "";
    check("the billing call carries an idempotency key (UUID) in the body, no custom header (CORS)", /^[0-9a-f-]{36}$/.test(key) && !attempts[0].headers["idempotency-key"], key);
    check("the retry reuses the same key", attempts.length === 2 && attempts[1].body.idempotencyKey === key);
    check("the deposit is billed once", state.depositBilled && attempts.filter((c) => c.body.kind === "deposit").length === 2);
    check("it opens the new invoice on the Invoices tab", pathOf(page).includes(`tab=invoices&invoice=${hex(0xf9)}`), pathOf(page));
    await go(page, `/admin/projects/${P1}`);
    await waitFor(page, "[data-next-steps]");
    check("the deposit step is gone afterwards", (await page.locator('[data-step="deposit_not_invoiced"]').count()) === 0);

    // Resend for the change order: confirm names the change order's own recipient.
    await page.locator('[data-step-action="change_order_awaiting_signature"]').click();
    check("resend confirm names the recipient", await until(async () => /ann\.co@example\.test/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => ""))));
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.path === `/api/admin/signatures/native/${SIG_CO1}/resend`));
    const resend = state.calls.find((c) => c.path === `/api/admin/signatures/native/${SIG_CO1}/resend`);
    check("resend carries an idempotency key", resend && /^[0-9a-f-]{36}$/.test(resend.body?.idempotencyKey || ""));

    // Overdue invoice navigates within the project.
    await page.locator('[data-step-action="invoice_overdue"]').click();
    check("a navigate step opens its tab", await until(() => pathOf(page) === `/admin/projects/${P1}?tab=invoices&invoice=${INV1}`), pathOf(page));
    await finish(o);
  }
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, `/admin/projects/${P2}`);
    await waitFor(page, '[data-step="send_agreement"]');
    await page.locator('[data-step-action="send_agreement"]').click();
    const text = await (async () => {
      await until(async () => /example\.test/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
      return page.locator('[role="dialog"]').last().innerText();
    })();
    check("send confirm names the agreement's own recipient (not the project email)", /ben\.contract@example\.test/.test(text) && /Agreement #C-2002 v1/.test(text), text.replace(/\s+/g, " "));
    check("nothing is sent before confirming", !state.calls.some((c) => c.path === "/api/admin/signatures/native/send"));
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.path === "/api/admin/signatures/native/send"));
    const send = state.calls.find((c) => c.path === "/api/admin/signatures/native/send");
    check("send posts the server's document, REMOTE, with an idempotency key", send && send.body.documentId === C2 && send.body.mode === "REMOTE" && /^[0-9a-f-]{36}$/.test(send.body.idempotencyKey));
    await finish(o);
  }

  /* ---------------- documents: upload / cancel per state ---------------- */
  console.log("\n--- agreement actions per state ---");
  {
    const o = await open(browser, { width: 1440, height: 900, touch: false });
    const { page, state } = o;
    await go(page, `/admin/projects/${P2}?tab=agreement`);
    await waitFor(page, '[data-action="send-signature"]');
    check("an open Generated agreement offers Upload signed", (await page.locator('label[data-action="upload-signed"]').count()) === 1);
    check("and Cancel", (await page.locator('[data-action="cancel-agreement"]').count()) === 1);
    await page.locator('label[data-action="upload-signed"] input[type=file]').setInputFiles({ name: "signed-paper.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") });
    const upload = await (async () => {
      await until(async () => /Record a signed copy/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
      return page.locator('[role="dialog"]').last().innerText();
    })();
    check("choosing a file asks first, naming customer and version", /Ben Sample/.test(upload) && /Agreement #\S+ v1/.test(upload) && /signed-paper\.pdf/.test(upload), upload.replace(/\s+/g, " "));
    check("nothing is uploaded before confirming", !state.calls.some((c) => c.path === "/api/admin/signatures/native/manual-upload"));
    await page.locator('[role="dialog"]').last().getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(300);
    check("cancelling the confirm uploads nothing", !state.calls.some((c) => c.path === "/api/admin/signatures/native/manual-upload"));
    await page.locator('[data-action="cancel-agreement"]').click();
    const cancel = await (async () => {
      await until(async () => /Cancel/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
      return page.locator('[role="dialog"]').last().innerText();
    })();
    check("Cancel agreement confirm names customer and version", /Ben Sample/.test(cancel) && /Agreement #\S+ v1/.test(cancel), cancel.replace(/\s+/g, " "));
    await page.locator('[role="dialog"]').last().getByLabel("Reason (optional)").fill("Customer chose another quote");
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.path === `/api/admin/contracts/${C2}/cancel`));
    check("the cancel posts with its reason", state.calls.find((c) => c.path === `/api/admin/contracts/${C2}/cancel`)?.body?.reason === "Customer chose another quote");

    await go(page, `/admin/projects/${P1}?tab=agreement`);
    await waitFor(page, "text=Signed agreements cannot be canceled");
    check("a Signed agreement offers neither Upload signed nor Cancel", (await page.locator('[data-action="upload-signed"]').count()) === 0 && (await page.locator('[data-action="cancel-agreement"]').count()) === 0);
    const emailBtn = page.getByRole("button", { name: "Email a Copy" });
    check("emailing a signed agreement is offered as a copy", (await emailBtn.count()) >= 1);
    await emailBtn.first().click();
    check("the email sheet says it stays Signed and names the recipient on the button", await until(async () => /stays Signed/.test(await page.locator('[data-sheet="agreement-email"]').innerText().catch(() => "")) && /Send to ann\.contract@example\.test/.test(await page.locator('[data-action="send-agreement-email"]').innerText().catch(() => ""))));
    await finish(o);
  }

  /* ---------------- invoices: void, stripe, lock ---------------- */
  console.log("\n--- invoices ---");
  {
    const o = await open(browser, { width: 1440, height: 900, touch: false });
    const { page, state } = o;
    await go(page, `/admin/projects/${P1}?tab=invoices&invoice=${INV1}`);
    await waitFor(page, "[data-payment]");
    check("Void is disabled when payments exist", await page.locator('[data-action="void-invoice"]').isDisabled());
    check("with the reason shown", /cannot be voided/.test(await page.locator("[data-void-blocked]").innerText()) && /refunds are made in Stripe/i.test(await page.locator("[data-void-blocked]").innerText()));
    const stripeRow = page.locator('[data-payment-provider="stripe"]');
    check("a Stripe payment is read-only", (await stripeRow.locator("button").count()) === 0 && /Read-only/.test(await stripeRow.innerText()));
    const manualRow = page.locator('[data-payment-provider="manual"]');
    check("a manual payment keeps Edit and Remove", (await manualRow.locator('[data-action="edit-payment"]').count()) === 1 && (await manualRow.locator('[data-action="remove-payment"]').count()) === 1);
    await manualRow.locator('[data-action="remove-payment"]').click();
    check("Remove payment asks in a sheet (no browser dialog)", await until(async () => /Remove this payment record/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => ""))));
    await page.locator('[role="dialog"]').last().getByRole("button", { name: "Cancel" }).click();

    await go(page, `/admin/projects/${P1}?tab=invoices&invoice=${INV2}`);
    await waitFor(page, "[data-invoice-locked]");
    check("a paid-in-full invoice shows the lock", /locked/.test(await page.locator("[data-invoice-locked]").innerText()));
    check("its payments cannot be edited", (await page.locator('[data-action="edit-payment"]').count()) === 0);

    await go(page, `/admin/projects/${P1}?tab=invoices&invoice=${INV3}`);
    await waitFor(page, '[data-action="void-invoice"]');
    check("a draft without payments can be voided", !(await page.locator('[data-action="void-invoice"]').isDisabled()));
    await page.locator('[data-action="void-invoice"]').click();
    await until(async () => /Void Invoice #1003/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
    check("void needs VOID typed", await confirmButton(page).isDisabled());
    await page.locator('[role="dialog"]').last().getByLabel(/Type/).fill("VOID");
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.path === `/api/admin/invoices/${INV3}/void`));
    check("then voids with the confirmation", state.calls.find((c) => c.path === `/api/admin/invoices/${INV3}/void`)?.body?.confirmation === "VOID");
    await finish(o);
  }

  /* ---------------- visits and manual status ---------------- */
  console.log("\n--- visits and status ---");
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, `/admin/projects/${P1}?tab=visits`);
    await waitFor(page, `[data-linked-booking="${B1}"]`);
    check("a linked visit links to its job", (await page.locator(`[data-linked-booking="${B1}"] a`).getAttribute("href")) === `/admin/jobs/${B1}`);
    check("the site visit is marked", /Site visit/.test(await page.locator(`[data-linked-booking="${B1}"]`).innerText()));
    check("Schedule a visit opens the New visit flow", (await page.locator('[data-action="schedule-site-visit"]').count()) === 1);
    await page.locator('[data-action="link-visit"]').click();
    await waitFor(page, `[data-job-result="${B2}"]`);
    const jobSearch = state.calls.find((c) => c.path === "/api/admin/jobs/search");
    check("link existing searches visits by POST, prefilled with the customer", jobSearch && jobSearch.body.q === "Ann Example");
    await page.locator(`[data-job-result="${B2}"] button`).click();
    await until(() => state.calls.some((c) => c.method === "POST" && c.path === `/api/admin/projects/${P1}/bookings`));
    check("Link posts the booking", state.calls.find((c) => c.method === "POST" && c.path === `/api/admin/projects/${P1}/bookings`)?.body?.bookingId === B2);
    check("the new visit appears", await waitFor(page, `[data-linked-booking="${B2}"]`));
    await page.locator(`[data-linked-booking="${B2}"] [data-action="unlink-visit"]`).click();
    await until(async () => /Unlink this visit/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.method === "DELETE" && c.path === `/api/admin/projects/${P1}/bookings/${B2}`));
    check("Unlink asks, then deletes the link", state.calls.some((c) => c.method === "DELETE" && c.path === `/api/admin/projects/${P1}/bookings/${B2}`));

    await page.locator('[data-action="change-status"]').click();
    await waitFor(page, '[data-sheet="project-status"]');
    check("the status sheet shows the history", /Signed at the table/.test(await page.locator("[data-status-history]").innerText()));
    await page.locator('[data-sheet="project-status"] select').selectOption("In Progress");
    await page.locator('[data-action="save-status"]').click();
    await until(() => state.calls.some((c) => c.method === "PUT" && c.path === `/api/admin/projects/${P1}/status`));
    const put = state.calls.find((c) => c.method === "PUT" && c.path === `/api/admin/projects/${P1}/status`);
    check("a manual status change sends the status it replaces", put && put.body.status === "In Progress" && put.body.expectedStatus === "Won", JSON.stringify(put?.body));
    check("editing details never sends the status", true);
    await finish(o);
  }
  {
    // Edit details: the PUT body carries no status.
    const o = await open(browser, { width: 1440, height: 900, touch: false });
    const { page, state } = o;
    await go(page, `/admin/projects/${P2}`);
    await waitFor(page, '[data-action="edit-project"]');
    await until(async () => !(await page.locator('[data-action="edit-project"]').isDisabled()));
    await page.locator('[data-action="edit-project"]').click();
    await waitFor(page, '[data-sheet="project-edit"]');
    await page.locator('[data-sheet="project-edit"]').getByLabel("Notes").fill("Call before arriving");
    await page.locator('[data-action="save-project"]').click();
    await until(() => state.calls.some((c) => c.method === "PUT" && c.path === `/api/admin/projects/${P2}`));
    const put = state.calls.find((c) => c.method === "PUT" && c.path === `/api/admin/projects/${P2}`);
    check("Edit details never sends the manual status", put && !("status" in put.body) && put.body.notes === "Call before arriving");
    await finish(o);
  }

  /* ---------------- closeout ---------------- */
  console.log("\n--- closeout ---");
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, `/admin/projects/${P4}?tab=closeout`);
    await waitFor(page, '[data-action="mark-complete"]');
    check("no warranty date before completion", (await page.locator("[data-warranty-ends]").count()) === 0);
    await page.locator('[data-action="mark-complete"]').click();
    await until(async () => /Mark substantially complete\?/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
    check("nothing is recorded before confirming", !state.calls.some((c) => c.path.endsWith("/substantial-completion")));
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.path.endsWith("/substantial-completion")));
    check("completion posts confirm:true", state.calls.find((c) => c.path.endsWith("/substantial-completion"))?.body?.confirm === true);
    check("the warranty end shows the server's date", await waitFor(page, "[data-warranty-ends]") && /\d{4}/.test(await page.locator("[data-warranty-ends]").innerText()));

    await page.getByLabel("Add an item").fill("Replace the cracked switch plate");
    await page.locator('[data-action="add-punch"]').click();
    await until(() => state.calls.some((c) => c.method === "POST" && c.path.endsWith("/punch-list")));
    check("a punch item is added", await waitFor(page, "text=Replace the cracked switch plate"));
    await page.locator('[data-punch-item="pl1"] input[type=checkbox]').click();
    await until(() => state.calls.some((c) => c.method === "PATCH" && c.path.endsWith("/punch-list/pl1")));
    check("checking an item marks it done", state.calls.find((c) => c.method === "PATCH")?.body?.done === true && (await waitFor(page, '[data-punch-item="pl1"][data-done]')));
    await page.locator('[data-punch-item="pl1"] button').click();
    await until(async () => /Remove this item/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.method === "DELETE" && c.path.endsWith("/punch-list/pl1")));
    check("removing an item asks, then deletes", state.calls.some((c) => c.method === "DELETE" && c.path.endsWith("/punch-list/pl1")));
    await finish(o);
  }

  /* ---------------- leads ---------------- */
  console.log("\n--- leads ---");
  {
    const o = await open(browser, { width: 390, height: 844 });
    const { page, state } = o;
    await go(page, "/admin/leads");
    check("the leads list renders", await waitFor(page, `[data-lead-row="estimate-${EL1}"]`));
    check("it was read with a POST search", state.calls.some((c) => c.method === "POST" && c.path === "/api/admin/leads/search"));
    await page.getByLabel("Search leads").fill("Eva");
    await until(() => state.calls.some((c) => c.body?.search === "Eva"));
    check("lead search goes in the body, never a URL", state.calls.some((c) => c.path === "/api/admin/leads/search" && c.body?.search === "Eva") && !state.calls.some((c) => c.url.includes("Eva")) && !page.url().includes("Eva"));

    await go(page, `/admin/leads?open=estimate:${EL1}`);
    check("?open=estimate:<id> opens that lead", await until(() => pathOf(page) === `/admin/leads/estimate-${EL1}`), pathOf(page));
    await waitFor(page, `[data-lead-detail="estimate-${EL1}"]`);
    const detail = await page.locator(`[data-lead-detail="estimate-${EL1}"]`).innerText();
    check("the detail shows every answer: budget, timeline, financing, range, scope", /\$25k–\$50k/.test(detail) && /Within 3 months/.test(detail) && /Interested/.test(detail) && /\$28,000 – \$41,000/.test(detail) && /Cabinets, Countertops, Island/.test(detail) && /Full remodel/.test(detail), detail.replace(/\s+/g, " ").slice(0, 400));
    await page.locator('[data-action="create-project"]').click();
    await until(async () => /Create a project from this lead/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
    await confirmButton(page).click();
    check("Create project opens the project", await until(() => pathOf(page) === `/admin/projects/${P3}`), pathOf(page));
    check("conversion called once", state.convertCount === 1);
    await go(page, `/admin/leads/estimate-${EL1}`);
    await waitFor(page, `[data-lead-detail="estimate-${EL1}"]`);
    check("a converted lead offers Open the project, not Create", (await page.locator('[data-action="open-project"]').count()) === 1 && (await page.locator('[data-action="create-project"]').count()) === 0);

    await go(page, `/admin/leads?open=${RQ1}`);
    check("?open=<bare id> opens a request", await waitFor(page, `[data-lead-detail="request-${RQ1}"]`));
    await go(page, `/admin/leads/request-${RQ1}`);
    check("a model-id link (request-<id>) loads that lead", await waitFor(page, `[data-lead-detail="request-${RQ1}"]`) && state.calls.some((c) => c.path === `/api/admin/leads/request/${RQ1}`));
    check("a visit-linked lead's status is locked", (await page.locator("[data-status-locked]").count()) === 1 && (await page.locator('[data-action="save-lead-status"]').count()) === 0);
    check("and it links to its job", (await page.locator('[data-action="open-visit"]').getAttribute("href")) === `/admin/jobs/${FREE_BOOKING}`);

    await go(page, `/admin/leads/estimate-${EL2}`);
    await waitFor(page, `[data-lead-detail="estimate-${EL2}"]`);
    await page.locator('[data-action="delete-lead"]').click();
    await until(async () => /Delete this lead/.test(await page.locator('[role="dialog"]').last().innerText().catch(() => "")));
    check("delete needs the name typed", await confirmButton(page).isDisabled());
    await page.locator('[role="dialog"]').last().getByLabel(/Type the lead/).fill("Ann Example");
    await confirmButton(page).click();
    await until(() => state.calls.some((c) => c.method === "DELETE" && c.path.startsWith("/api/admin/requests/")));
    const del = state.calls.find((c) => c.method === "DELETE" && c.path.startsWith("/api/admin/requests/"));
    check("delete sends the typed name to the existing route", del && decodeURIComponent(del.path) === `/api/admin/requests/estimate:${EL2}` && del.body.confirmation === "Ann Example", del?.path);
    await go(page, `/admin/leads/estimate-${hex(0x7f)}`);
    check("an unknown lead says so", await waitFor(page, "text=This lead was not found"));
    await finish(o);
  }

  /* ---------------- layout at 7 viewports ---------------- */
  console.log("\n--- viewports ---");
  for (const vp of VIEWPORTS) {
    const o = await open(browser, { width: vp.width, height: vp.height, touch: vp.touch });
    const { page } = o;
    const routes = [
      ["list", "/admin/projects", "[data-project-row]"],
      ["detail", `/admin/projects/${P1}`, "[data-next-steps]"],
      ["invoices", `/admin/projects/${P1}?tab=invoices&invoice=${INV1}`, "[data-payment]"],
      ["closeout", `/admin/projects/${P4}?tab=closeout`, "[data-punch-list]"],
      ["leads", "/admin/leads", "[data-lead-row]"],
      ["lead", `/admin/leads/estimate-${EL1}`, "[data-lead-detail]"],
    ];
    for (const [name, route, sel] of routes) {
      await go(page, route);
      await waitFor(page, sel);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const tooSmall = [];
        const smallTargets = [];
        const root = document.querySelector('[role="dialog"]') || document.querySelector("main") || document.body;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const el = walker.currentNode.parentElement;
          if (!el || !walker.currentNode.textContent.trim()) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const st = getComputedStyle(el);
          if (st.visibility === "hidden" || st.display === "none" || el.closest(".sr-only")) continue;
          if (parseFloat(st.fontSize) < 12) tooSmall.push(`${el.tagName}:${parseFloat(st.fontSize)}:${walker.currentNode.textContent.trim().slice(0, 20)}`);
        }
        for (const el of root.querySelectorAll("[data-project-detail] button, [data-section] button, [data-lead-detail] button, [data-sheet] button, .adm-btn")) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || el.closest("[hidden]")) continue;
          if (el.closest("[data-desktop-only]")) continue;
          if (r.height < 43.5) smallTargets.push(`${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}:${Math.round(r.height)}`);
        }
        return { overflow: doc.scrollWidth - doc.clientWidth, tooSmall: tooSmall.slice(0, 5), smallTargets: smallTargets.slice(0, 6) };
      });
      check(`${vp.name} ${name}: no sideways overflow`, m.overflow <= 0, String(m.overflow));
      check(`${vp.name} ${name}: text is at least 12px`, m.tooSmall.length === 0, m.tooSmall.join(" | "));
      if (vp.touch !== false) check(`${vp.name} ${name}: touch targets are 44px`, m.smallTargets.length === 0, m.smallTargets.join(" | "));
      if (["list", "detail", "lead"].includes(name) || vp.name === "390x844") await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.name}.png`) });
    }
    if (vp.name === "390x844" || vp.name === "1440x900-desktop" || vp.name === "844x390-landscape") {
      await go(page, `/admin/projects/${P1}`);
      await waitFor(page, '[data-step="deposit_not_invoiced"]');
      await page.locator('[data-step-action="deposit_not_invoiced"]').click();
      await waitFor(page, '[role="dialog"] [data-confirm]');
      await page.waitForTimeout(500);
      const box = await page.locator('[role="dialog"]').last().boundingBox();
      check(`${vp.name}: the confirm sheet fits the viewport`, box && box.y >= 0 && box.y + box.height <= vp.height + 1, JSON.stringify(box));
      await page.screenshot({ path: path.join(SHOTS, `confirm-deposit-${vp.name}.png`) });
      await page.keyboard.press("Escape");
      await go(page, "/admin/projects");
      await waitFor(page, "[data-project-row]");
      await page.locator('[data-action="new-project"]').click();
      await waitFor(page, '[data-sheet="project-create"]');
      await page.screenshot({ path: path.join(SHOTS, `create-project-${vp.name}.png`) });
    }
    await finish(o);
  }

  check("no window.alert/confirm/prompt was ever shown", allDialogs.length === 0, allDialogs.join(","));
  check("no request left the machine", allExternal.length === 0, allExternal.slice(0, 3).join(" "));
  check("no page error", allErrors.length === 0, allErrors.slice(0, 3).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("Failed:\n" + failed.map((f) => `  - ${f.name}`).join("\n"));
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
