/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * The sales desk in a real browser: the Telemarketer workspace (/admin/sales-*)
 * and the owner's Sales desk (/admin/sales-desk), plus the Telemarketer role in
 * the Team editor.
 *
 *   npx next start -p 3140          (after npm run build)
 *   node scripts/test_admin_sales_ui.js http://localhost:3140
 *
 * FULL NETWORK JAIL: the local server passes; every /api/ URL on ANY host
 * (local builds call https://api.profixter.com) is answered by a stateful fake
 * shaped like BackEnd routes/sales.js and routes/adminSalesDesk.js; everything
 * else is aborted and must stay empty. Fake people only. Nothing real is called.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3140").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "sales-desk");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", role: "admin", addresses: [] };
const ANA = { _id: "t-ana", userId: "PF-ANA", name: "Ana Torres", firstName: "Ana", email: "ana@example.test", role: "employee", employeePosition: "Telemarketer", isActive: true, permissions: ["sales.own"], adminSections: [], addresses: [] };
// Ben is the second telemarketer: he exists in the fake (names, team rows, reassignment target), never signs in.
const BEN = { _id: "t-ben", userId: "PF-BEN", name: "Ben Ortiz", firstName: "Ben", email: "ben@example.test", role: "employee", employeePosition: "Telemarketer", isActive: true, permissions: ["sales.own"], adminSections: [], addresses: [] };
void BEN;
const GENERAL = { _id: "gf1", userId: "PF-GF", name: "Gina General", email: "gina@example.test", phone: "5550102", role: "employee", employeePosition: "General Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "bookings.assign", "members.read", "schedule.read", "schedule.write", "tips.read"], addresses: [] };
const FIELD = { _id: "fx2", userId: "PF-FX", name: "Fred Field", email: "fred@example.test", phone: "5550104", role: "employee", employeePosition: "Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "tips.read"], addresses: [] };

const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString();

/*
 * ONE fake ledger, built with the real commission rules (BackEnd utils/sales/rules.js):
 *   monthly membership = 50% of the first payment excluding tax;
 *   annual membership  = one month's regular price (Basic $149, Plus $249, Premium $349, Elite $499);
 *   Full Day (price $499) = fixed $100;  bonus = $500 per 20 verified memberships in a bonus month.
 * Statements, payout lines, earnings, metrics and the bonus are all derived from it,
 * so every total on every screen adds up.
 */
const WELCOME = "Welcome offer: 20% off the first month";
const CALC = {
  monthlyWelcome: { regularCents: 14900, discountCents: 2980, discountSource: WELCOME, paidPreTaxCents: 11920, taxCents: 1036, explain: "Monthly Basic: 50% of the first payment excluding tax ($119.20) = $59.60", rule: { key: "membership_monthly", version: 1 } },
  monthlyFull: { regularCents: 14900, discountCents: 0, discountSource: "", paidPreTaxCents: 14900, taxCents: 1296, explain: "Monthly Basic: 50% of the first payment excluding tax ($149.00) = $74.50", rule: { key: "membership_monthly", version: 1 } },
  annualBasic: { regularCents: 149000, discountCents: 0, discountSource: "", paidPreTaxCents: 149000, taxCents: 12963, explain: "Annual Basic: one month's regular price, $149.00", rule: { key: "membership_annual", version: 1 } },
  fullDay: { regularCents: 49900, discountCents: 0, discountSource: "", paidPreTaxCents: 49900, taxCents: 4341, explain: "Full Day sale: fixed $100.00", rule: { key: "full_day", version: 1 } },
};
const AMOUNT = { monthlyWelcome: 5960, monthlyFull: 7450, annualBasic: 14900, fullDay: 10000 };
const PRODUCT = { monthlyWelcome: "membership_monthly", monthlyFull: "membership_monthly", annualBasic: "membership_annual", fullDay: "full_day" };
const day = (d, h = 15) => `${d}T${String(h).padStart(2, "0")}:00:00.000Z`;
const PEOPLE = ["M. A. · Huntington", "J. K. · Commack", "L. S. · Melville", "T. B. · Northport", "C. W. · Babylon", "P. N. · Dix Hills", "E. R. · Smithtown", "G. H. · Islip"];
function ledgerEntry(id, employee, type, paidOn, statementWeek, status, o = {}) {
  return { id, employee, kind: "commission", product: PRODUCT[type], amountCents: AMOUNT[type], customer: PEOPLE[Number(id.replace(/\D/g, "") || 0) % PEOPLE.length], paidAt: day(paidOn), earnedAt: day(paidOn), earnedWeek: statementWeek, statementWeek, late: false, status, countsForBonus: type !== "fullDay", calc: { ...CALC[type] }, reason: "", bonus: null, ...o };
}
const S1_PAID = day("2026-11-13", 15);
const S2_PAID = day("2026-11-13", 18);
const REFUND_AT = day("2026-11-13", 22);
function buildLedger() {
  const L = [];
  // Bonus month 1 (Oct 3 – Nov 2): 20 monthly sales in weeks Oct 23 and Oct 30 (both approved and paid); the 20th earns the $500 bonus.
  for (let i = 1; i <= 10; i += 1) L.push(ledgerEntry(`a${i}`, "t-ana", "monthlyWelcome", `2026-10-${22 + Math.ceil(i / 2)}`, "2026-10-23", "paid"));
  for (let i = 11; i <= 20; i += 1) L.push(ledgerEntry(`a${i}`, "t-ana", "monthlyWelcome", i <= 16 ? `2026-10-${30 + (i % 2)}` : `2026-11-0${1 + (i % 2)}`, "2026-10-30", "paid"));
  L.push({ ...ledgerEntry("b1", "t-ana", "monthlyWelcome", "2026-11-02", "2026-10-30", "paid", { earnedAt: day("2026-11-02", 16) }), kind: "bonus", product: "bonus", amountCents: 50000, countsForBonus: false, customer: "", calc: { regularCents: 0, discountCents: 0, discountSource: "", paidPreTaxCents: 0, taxCents: 0, explain: "20 qualifying memberships in bonus month 1 (2026-10-03 – 2026-11-02): bonus 1 of $500", rule: { key: "bonus_volume", version: 1 } }, bonus: { periodIndex: 0, block: 1, counted: 20 } });
  // Bonus month 2 (Nov 3 – Dec 2): 13 verified so far (en2, p1–p11, en1).
  L.push(ledgerEntry("en2", "t-ana", "annualBasic", "2026-11-05", "2026-11-13", "open", { customer: "O. P. · Dix Hills", late: true, earnedWeek: "2026-10-30", paidAt: day("2026-11-05", 16), earnedAt: day("2026-11-05", 16) }));
  L.push(ledgerEntry("p1", "t-ana", "annualBasic", "2026-11-06", "2026-11-06", "open"));
  L.push(ledgerEntry("p2", "t-ana", "monthlyFull", "2026-11-07", "2026-11-06", "open"));
  for (let i = 3; i <= 11; i += 1) L.push(ledgerEntry(`p${i}`, "t-ana", "monthlyWelcome", `2026-11-${String(6 + Math.ceil(i / 2)).padStart(2, "0")}`, "2026-11-06", "open"));
  L.push(ledgerEntry("en1", "t-ana", "monthlyWelcome", "2026-11-13", "2026-11-13", "open", { customer: "R. D. · Huntington", paidAt: S1_PAID, earnedAt: S1_PAID }));
  // Ben: one Full Day (a Full Day does not start a bonus month).
  L.push(ledgerEntry("f1", "t-ben", "fullDay", "2026-11-09", "2026-11-06", "open", { customer: "K. L. · Commack" }));
  return L;
}
const sumOf = (list) => list.reduce((t, e) => t + e.amountCents, 0);
const WEEKS = { "2026-10-23": ["2026-10-29", "2026-10-30"], "2026-10-30": ["2026-11-05", "2026-11-06"], "2026-11-06": ["2026-11-12", "2026-11-13"], "2026-11-13": ["2026-11-19", "2026-11-20"] };
function lineOf(L, week, employee, employeeName, payment = null) {
  const es = L.filter((e) => e.statementWeek === week && e.employee === employee);
  const by = (k) => sumOf(es.filter((e) => e.kind === k));
  return { employee, employeeName, commissionCents: by("commission"), bonusCents: by("bonus"), adjustmentCents: by("adjustment"), totalCents: sumOf(es), entries: es.map((e) => e.id), payment };
}
/* Ana's pending claims (not earnings): what each would pay if approved. */
const CLAIMS = [
  { type: "credit_request", requestId: "R1", saleId: "s2", label: "Plan change to Plus", paidAt: S2_PAID, proposedCents: 4000, status: "pending", countsForBonus: false },
  { type: "credit_request", requestId: "R2", saleId: "s4", label: "Monthly membership (Basic)", paidAt: day("2026-11-11"), proposedCents: 5960, status: "pending", countsForBonus: true },
  { type: "held_credit", saleId: "s5", label: "Monthly membership (Basic)", paidAt: day("2026-11-10"), proposedCents: 7450, why: "linked_after_sale", countsForBonus: true },
];
function earningsOf(L, employee) {
  const mine = L.filter((e) => e.employee === employee);
  const claims = employee === "t-ana" ? CLAIMS : [];
  const by = (f) => sumOf(mine.filter(f));
  return { earnedCents: by(() => true), commissionCents: by((e) => e.kind === "commission"), bonusCents: by((e) => e.kind === "bonus"), adjustmentCents: by((e) => e.kind === "adjustment"), onOpenStatementsCents: by((e) => e.status === "open"), approvedUnpaidCents: by((e) => e.status === "approved"), paidCents: by((e) => e.status === "paid"), pendingClaimsCents: claims.reduce((t, c) => t + c.proposedCents, 0), pendingClaimsCount: claims.length, claims };
}
/* The single bonusProgress() figure both sides must show, derived from the ledger. */
function bonusOfLedger(L, employee) {
  if (employee !== "t-ana") return { started: false, threshold: 20, amountCents: 50000, pendingCount: 0, allTime: { earnedCents: 0, paidCents: 0, awaitingPaymentCents: 0, count: 0 }, message: "Your first verified membership sale starts your bonus month." };
  const counted = L.filter((e) => e.employee === "t-ana" && e.kind === "commission" && e.countsForBonus && e.paidAt >= "2026-11-03").sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const bonuses = L.filter((e) => e.employee === "t-ana" && e.kind === "bonus");
  const pending = CLAIMS.filter((c) => c.countsForBonus);
  const verified = counted.length;
  const inBlock = verified % 20;
  return {
    started: true,
    anchorDate: "2026-10-03T14:00:00.000Z",
    period: { index: 1, number: 2, firstDay: "2026-11-03", lastDay: "2026-12-02", startsAt: "2026-11-03T05:00:00.000Z", endsAt: "2026-12-03T05:00:00.000Z", msLeft: 18 * 86400000 + 5 * 3600000 },
    threshold: 20,
    amountCents: 50000,
    verifiedCount: verified,
    pendingCount: pending.length,
    pendingItems: pending.map((c) => ({ kind: c.type, paidAt: c.paidAt })),
    inBlock,
    remaining: 20 - inBlock,
    nextBonusAt: verified - inBlock + 20,
    bonusesThisPeriod: 0,
    earnedThisPeriodCents: 0,
    paidThisPeriodCents: 0,
    awaitingPaymentThisPeriodCents: 0,
    milestones: [5, 10, 15, 20].map((m) => ({ at: m, reached: inBlock >= m })),
    countedSales: counted.map((e) => ({ entry: e.id, sale: `sale-${e.id}`, user: `user-${e.id}`, product: e.product, paidAt: e.paidAt })),
    allTime: { earnedCents: sumOf(bonuses), paidCents: sumOf(bonuses.filter((b) => b.status === "paid")), awaitingPaymentCents: sumOf(bonuses.filter((b) => b.status !== "paid")), count: bonuses.length },
    message: "More than halfway to $500.",
  };
}
/* A ledger row as the API sends it (the employee id is not part of entryDto). */
function entryDto(e) {
  const out = { ...e };
  delete out.employee;
  return out;
}

const supp = (on) => (on ? { call: true, sms: true, reasons: [{ channel: "all", source: "telemarketer", reason: "Asked not to be called again", at: iso(-72) }] } : { call: false, sms: false, reasons: [] });

function makeServer(user) {
  const owner = user.role === "admin";
  const tele = user.role === "employee" && user.employeePosition === "Telemarketer" && (user.permissions || []).includes("sales.own");
  const s = {
    calls: [],
    revealed: 0,
    leads: {
      L1: { id: "L1", name: "Rosa Delgado", phone: "+16315550111", town: "Huntington", stage: "contacted", status: "active", source: "owner", linked: true, assignee: "t-ana", credit: "t-ana", tasks: [{ id: "T1", dueAt: iso(-3), kind: "call", note: "Call back after lunch" }], activities: [{ at: iso(-26), kind: "attempt", text: "", by: "Ana Torres", origin: "employee", id: "a1" }], ghlContactId: null },
      L2: { id: "L2", name: "Victor Hale", phone: "+16315550122", town: "Babylon", stage: "lost", status: "active", source: "owner", linked: false, assignee: "t-ana", credit: "t-ana", tasks: [], activities: [], dnc: true },
      L3: { id: "L3", name: "Nina Park", phone: "+16315550133", town: "Commack", stage: "new", status: "active", source: "owner", linked: false, assignee: null, credit: null, tasks: [], activities: [] },
      L4: { id: "L4", name: "Owen Price", phone: "+16315550144", town: "Dix Hills", stage: "interested", status: "active", source: "owner", linked: false, assignee: "t-ana", credit: "t-ana", tasks: [], activities: [] },
      L5: { id: "L5", name: "Carla Mendes", phone: "+16315550155", town: "Melville", stage: "new", status: "active", source: "owner", linked: false, assignee: null, credit: null, tasks: [], activities: [] },
      I1: { id: "I1", name: "Dana Fox", phone: "+16315550166", town: "Northport", stage: "new", status: "intake", source: "employee_intake", sourcedBy: "t-ana", linked: false, assignee: null, credit: null, tasks: [], activities: [], intakeFlags: [{ code: "matches_employee_phone", text: "Self-referral check: this phone number is the employee's own." }] },
    },
    assignments: [],
    requests: [
      { id: "R1", leadId: "L1", saleId: "s2", kind: "upgrade", explanation: "I called Rosa twice and talked her into the Plus plan.", status: "pending", employee: "t-ana", proposed: { amountCents: 4000, method: "upgrade_percent_of_paid_pre_tax", detail: "Plan change payment $80.00 excluding tax; proposed 50% = $40.00. A plan change does not count toward the bonus unless you choose so.", countsForBonusDefault: false }, evidence: [{ id: "ev1", kind: "file", text: "", fileName: "call-log.pdf", size: 20480, addedAt: iso(-5) }, { id: "ev2", kind: "ghl_reference", text: "GHL call Nov 10 2:14 PM", addedAt: iso(-5) }], decisions: [{ action: "submitted", by: "Ana Torres", reason: "", at: iso(-5) }], createdAt: iso(-5) },
      { id: "R2", leadId: "L4", saleId: "s4", kind: "recovery", explanation: "Owen's wife abandoned checkout; I called her back and she finished signing up.", status: "pending", employee: "t-ana", proposed: { amountCents: 5960, method: "membership_monthly", detail: "Monthly Basic: 50% of the first payment excluding tax ($119.20) = $59.60", countsForBonusDefault: true }, evidence: [{ id: "ev3", kind: "ghl_reference", text: "GHL call Nov 11 4:40 PM", addedAt: iso(-30) }], decisions: [{ action: "submitted", by: "Ana Torres", reason: "", at: iso(-30) }], createdAt: iso(-30) },
    ],
    payouts: {},
    adjustments: [],
    adjKeys: new Set(),
    fixters: [{ id: "fx2", firstName: "Fred", lastName: "Field", name: "Fred Field", email: "fred@example.test", phone: "5550104", role: "employee", employeePosition: "Fixter", employeeTitle: "", adminSections: [], isActive: true, mustChangePassword: false, isDefaultFixter: false, employeeAvailabilityStatus: "Available", completedBookingsCount: 12, offDaysSummary: { upcomingCount: 0, pastCount: 0, recent: [] } }],
    posted: { fixters: [], evidence: [] },
    ledger: buildLedger(),
  };
  {
    const L = s.ledger;
    const paid = (paidOn) => ({ status: "paid", paidOn, method: "Payroll", reference: "", recordedByName: "Owner Test", recordedAt: day(paidOn, 20) });
    s.payouts["2026-10-23"] = { week: "2026-10-23", lastDay: WEEKS["2026-10-23"][0], payday: WEEKS["2026-10-23"][1], status: "approved", approvedAt: day("2026-10-30", 14), approvedByName: "Owner Test", lines: [lineOf(L, "2026-10-23", "t-ana", "Ana Torres", paid("2026-10-30"))] };
    s.payouts["2026-10-30"] = { week: "2026-10-30", lastDay: WEEKS["2026-10-30"][0], payday: WEEKS["2026-10-30"][1], status: "approved", approvedAt: day("2026-11-06", 14), approvedByName: "Owner Test", lines: [lineOf(L, "2026-10-30", "t-ana", "Ana Torres", paid("2026-11-06"))] };
    s.payouts["2026-11-06"] = { week: "2026-11-06", lastDay: WEEKS["2026-11-06"][0], payday: WEEKS["2026-11-06"][1], status: "ready", lines: [lineOf(L, "2026-11-06", "t-ana", "Ana Torres"), lineOf(L, "2026-11-06", "t-ben", "Ben Ortiz")] };
    s.payouts["2026-11-13"] = { week: "2026-11-13", lastDay: WEEKS["2026-11-13"][0], payday: WEEKS["2026-11-13"][1], status: "accruing", lines: [lineOf(L, "2026-11-13", "t-ana", "Ana Torres")] };
  }
  const names = { "t-ana": "Ana Torres", "t-ben": "Ben Ortiz" };
  const card = (l) => ({ id: l.id, name: l.name, town: l.town, phoneLast4: l.phone.slice(-4), stage: l.stage, linked: l.linked, assignedAt: iso(-200), creditWithMe: l.credit === "t-ana", doNotCall: Boolean(l.dnc), doNotText: Boolean(l.dnc), lastActivityAt: l.activities[0]?.at || null, nextTask: l.tasks[0] || null });
  const mine = () => Object.values(s.leads).filter((l) => l.assignee === user._id && l.status === "active");
  const reqDto = (r) => ({ ...r, employee: undefined });
  const empSales = (l) =>
    l.id === "L1"
      ? [
          { id: "s1", kind: "membership_first_paid", label: "Monthly membership (Basic)", plan: "Basic", cycle: "monthly", paidAt: S1_PAID, paidPreTaxCents: 11920, status: "credited_to_you", claimable: false },
          { id: "s2", kind: "membership_change_paid", label: "Plan change to Plus", plan: "Plus", cycle: "monthly", paidAt: S2_PAID, paidPreTaxCents: 8000, status: s.requests.find((r) => r.saleId === "s2" && ["pending", "needs_info"].includes(r.status)) ? "your_request_pending" : "plan_change", claimable: false },
          { id: "s3", kind: "full_day_paid", label: "Full Day", plan: null, cycle: null, paidAt: day("2026-11-12"), paidPreTaxCents: 49900, status: s.requests.find((r) => r.saleId === "s3") ? "your_request_pending" : "unattributed", claimable: !s.requests.find((r) => r.saleId === "s3") },
        ]
      : [];
  const timeline = (l, forOwner) => {
    const base = [...l.activities].filter((a) => forOwner || a.kind !== "coaching");
    if (l.linked) base.push({ at: iso(-24 * 30), kind: "registered", text: "Created a Profixter account", origin: "system" }, { at: iso(-24 * 20), kind: "free_visit_unknown", text: "Free visit outcome: Unknown (no outcome recorded)", origin: "unknown" }, { at: S1_PAID, kind: "membership_first_paid", text: "Monthly membership (Basic)", origin: "system" }, { at: S2_PAID, kind: "membership_change_paid", text: "Plan change to Plus", origin: "system" }, { at: REFUND_AT, kind: "refund", text: "Refund $64.78", origin: "system" });
    if (l.ghlContactId) base.push({ at: iso(-48), kind: "ghl_call", text: "Outbound call, 3 min", origin: "ghl" });
    return base.sort((a, b) => new Date(b.at) - new Date(a.at));
  };
  const ghl = (l) => ({ contact: l.ghlContactId ? `https://app.gohighlevel.com/v2/location/LOC/contacts/detail/${l.ghlContactId}` : null, conversation: null, contactId: l.ghlContactId || null });
  const detail = (l) => ({
    id: l.id, name: l.name, town: l.town, phoneLast4: l.phone.slice(-4), stage: l.stage, source: l.source, assignedAt: iso(-200),
    salesCredit: l.credit === user._id ? "Sales credit for this lead is yours." : "Sales credit for this lead stays with another employee (manager's decision at reassignment).",
    suppression: supp(l.dnc), ghl: ghl(l), linked: l.linked,
    journey: l.linked ? { registeredAt: iso(-24 * 30), phoneVerified: true, freeVisits: [{ date: iso(-24 * 20), requestedAt: iso(-24 * 25), status: "unknown", label: "Unknown", detail: "The visit date has passed and no outcome was recorded.", verified: false }], membership: { plan: "Plus", cycle: "monthly", state: "active", startDate: S1_PAID, endsOn: null, endedOn: null }, membershipHistory: [] } : null,
    sales: empSales(l), tasks: l.tasks.filter((t) => !t.done), timeline: timeline(l, false),
  });
  const ownerRow = (l) => ({ id: l.id, name: l.name, phone: l.phone, town: l.town, status: l.status, stage: l.stage, source: l.source, sourcedBy: l.sourcedBy ? names[l.sourcedBy] : "", linked: l.linked, assignee: l.assignee ? { id: l.assignee, name: names[l.assignee], since: iso(-200) } : null, creditHolder: l.credit ? { id: l.credit, name: names[l.credit] } : null, doNotCall: Boolean(l.dnc), doNotText: Boolean(l.dnc), lastActivityAt: null, createdAt: iso(-300), intakeFlags: l.intakeFlags || [] });
  const ownerDetail = (l) => ({
    ...ownerRow(l), email: null, zip: "11743", sourceNote: "", sourcedBy: l.sourcedBy ? names[l.sourcedBy] : null, ghl: ghl(l), link: null, linkedAccount: l.linked ? { id: "u1", name: l.name, userId: "PF-4411", since: iso(-24 * 30) } : null, referral: null, suggestions: l.linked ? [] : [{ id: "u9", name: l.name, userId: "PF-9001", phoneVerified: true, town: l.town, since: iso(-24 * 3) }], suppression: supp(l.dnc),
    assignments: [...(l.history || []), ...(l.assignee ? [{ employee: names[l.assignee], employeeId: l.assignee, creditEmployee: names[l.credit], creditDecision: "first_assignment", startedAt: iso(-200), startedBy: "Owner Test", reason: "New lead", endedAt: null, endReason: null }] : [])],
    journey: null, sales: [], tasks: l.tasks.map((t) => ({ ...t, assignee: l.assignee })), timeline: timeline(l, true),
  });
  /* Period = pay week 2026-11-13: Ana's only sale in it is en1 (half refunded, so still net 1). */
  const metrics = (id) => {
    const ana = id === "t-ana";
    const mine = s.ledger.filter((e) => e.employee === id);
    const inWeek = mine.filter((e) => e.kind === "commission" && e.paidAt >= "2026-11-13T05:00");
    const memberships = inWeek.filter((e) => e.countsForBonus).length;
    const fullDays = inWeek.filter((e) => e.product === "full_day").length;
    return { newLeads: ana ? 6 : 2, assignedInPeriod: ana ? 9 : 3, leadsContacted: ana ? 8 : 1, leadsReached: ana ? 4 : 0, registrations: ana ? 3 : 0, freeVisitsBooked: ana ? 3 : 0, freeVisitsCompleted: ana ? 2 : 0, freeVisitsDue: ana ? 3 : 0, firstPaidMemberships: memberships, annualSales: inWeek.filter((e) => e.product === "membership_annual").length, fullDaySales: fullDays, refunds: ana ? { count: 1, amountCents: 6478 } : { count: 0, amountCents: 0 }, netVerifiedSales: memberships + fullDays, commissionEarnedCents: sumOf(mine.filter((e) => e.earnedAt >= "2026-11-13T05:00")), commissionPayableCents: sumOf(mine.filter((e) => e.status !== "paid")), commissionPaidCents: sumOf(mine.filter((e) => e.status === "paid")), pendingClaims: ana ? CLAIMS.length : 0, followUpsOverdue: ana ? 1 : 0, rates: { contactRate: ana ? 8 / 9 : 1 / 3, reachRate: ana ? 0.5 : 0, showRate: ana ? 2 / 3 : null, closeRate: ana ? memberships / 4 : null } };
  };
  const DEFS = { newLeads: "Leads whose assignment began in the period.", leadsContacted: "Distinct leads with a logged outcome.", leadsReached: "Leads with a reached outcome.", registrations: "Linked accounts created in the period.", freeVisitsBooked: "Free visits booked.", freeVisitsCompleted: "Free visits completed.", firstPaidMemberships: "Approved first membership payments.", annualSales: "Annual subset.", fullDaySales: "Full Days paid.", netVerifiedSales: "Memberships + Full Days minus refunds.", commissionEarned: "Approved ledger entries earned.", pendingClaims: "Waiting for an owner decision. Never earnings.", followUpsOverdue: "Open follow-ups past due." };
  const bonusOf = (id) => bonusOfLedger(s.ledger, id);
  const statementRows = (employee = "t-ana") =>
    Object.keys(WEEKS)
      .sort()
      .reverse()
      .map((week) => {
        const b = s.payouts[week];
        const line = b.lines.find((l) => l.employee === employee);
        const es = s.ledger.filter((e) => e.statementWeek === week && e.employee === employee);
        if (!es.length && week !== "2026-11-13") return null;
        const status = b.status === "approved" ? (line?.payment?.status === "paid" ? "paid" : "approved") : b.status === "ready" ? "awaiting_approval" : "this_week";
        return { week, lastDay: WEEKS[week][0], payday: WEEKS[week][1], status, totalCents: sumOf(es), entries: es.length, paidOn: line?.payment?.status === "paid" ? line.payment.paidOn : null, method: line?.payment?.status === "paid" ? line.payment.method : null };
      })
      .filter(Boolean);
  const statement = (week, employee = "t-ana") => {
    const b = s.payouts[week];
    const line = b ? b.lines.find((l) => l.employee === employee) : null;
    const es = s.ledger.filter((e) => e.statementWeek === week && e.employee === employee).sort((x, y) => x.earnedAt.localeCompare(y.earnedAt));
    const by = (k) => sumOf(es.filter((e) => e.kind === k));
    return { week, lastDay: WEEKS[week][0], payday: WEEKS[week][1], frozen: b?.status === "approved", approvedAt: b?.approvedAt || null, payment: line?.payment?.status === "paid" ? line.payment : null, totals: { commissionCents: by("commission"), bonusCents: by("bonus"), adjustmentCents: by("adjustment"), totalCents: sumOf(es) }, items: es.map(entryDto) };
  };
  const weekView = (week) => {
    const p = s.payouts[week];
    return { ...p, startsAt: `${week}T04:00:00.000Z`, endsAt: `${p.payday}T05:00:00.000Z`, entries: s.ledger.filter((e) => e.statementWeek === week) };
  };
  const en1 = () => entryDto(s.ledger.find((e) => e.id === "en1"));

  function handle(method, p, sp, body, raw) {
    if (p === "/api/auth/me") return [200, user];
    if (p === "/api/admin/needs-action") return [200, { generatedAt: new Date().toISOString(), total: 0, sections: [], items: [] }];

    /* ------------------------------ employee API ------------------------------ */
    if (p.startsWith("/api/sales/")) {
      if (!tele) return [403, { code: "TELEMARKETERS_ONLY", message: "This workspace is for telemarketers." }];
      s.calls.push({ method, p, body });
      if (p === "/api/sales/me") return [200, { me: { id: user._id, name: user.name, firstName: user.firstName }, referral: { code: "ANA4821", url: "https://www.profixter.com/?source=referral&ref=ANA4821" }, day: { tasks: mine().flatMap((l) => l.tasks.filter((t) => !t.done && new Date(t.dueAt) < new Date(Date.now() + 6 * 3600_000)).map((t) => ({ ...t, leadId: l.id, name: l.name, town: l.town, overdue: new Date(t.dueAt) < new Date() }))), overdueCount: 1, newAssignments: [{ leadId: "L4", name: "Owen Price", town: "Dix Hills", assignedAt: iso(-4) }], upcomingVisits: [{ leadId: "L1", name: "Rosa Delgado", date: iso(30), status: "scheduled", label: "Scheduled", verified: true }], leadsCount: mine().length, bonus: bonusOf("t-ana"), earnings: earningsOf(s.ledger, "t-ana") }, goals: { weeklyMemberships: 5, weeklyFreeVisits: 8, note: "Call new leads within the hour." } }];
      if (p === "/api/sales/leads" && method === "GET") return [200, { leads: mine().map(card) }];
      const lm = /^\/api\/sales\/leads\/([^/]+)(\/[a-z]+)?$/.exec(p);
      if (lm) {
        const l = s.leads[lm[1]];
        if (!l || l.assignee !== user._id || l.status !== "active") return [404, { code: "NOT_FOUND", message: "Lead not found." }];
        const rest = lm[2] || "";
        if (!rest) return [200, { lead: detail(l) }];
        if (rest === "/phone") return (s.revealed++, [200, { phone: l.phone }]);
        if (rest === "/activities") {
          if (l.dnc && ["attempt", "voicemail", "reached_interested", "reached_not_interested", "call_back", "wrong_number"].includes(body.kind)) return [409, { code: "SUPPRESSED", message: "Calls are blocked." }];
          l.activities.unshift({ at: new Date().toISOString(), kind: body.kind, text: body.body || "", by: user.name, origin: "employee", id: `a${Date.now()}` });
          if (body.kind === "reached_interested") l.stage = "interested";
          if (body.followUpAt) l.tasks.push({ id: `T${Date.now()}`, dueAt: body.followUpAt, kind: body.followUpKind || "call", note: "" });
          return [201, { activity: l.activities[0] }];
        }
        if (rest === "/tasks") {
          const t = { id: `T${Date.now()}`, dueAt: body.dueAt, kind: body.kind, note: body.note || "" };
          l.tasks.push(t);
          return [201, { task: t }];
        }
        if (rest === "/ghl") {
          const m = /contacts\/detail\/([A-Za-z0-9]{8,40})/.exec(body.contact || "");
          l.ghlContactId = m ? m[1] : body.contact;
          return [200, { ghlContactId: l.ghlContactId, links: ghl(l) }];
        }
      }
      const tm = /^\/api\/sales\/tasks\/([^/]+)$/.exec(p);
      if (tm && method === "PATCH") {
        for (const l of mine()) {
          const t = l.tasks.find((x) => x.id === tm[1]);
          if (t) {
            if (body.status === "done") l.tasks = l.tasks.filter((x) => x !== t);
            if (body.dueAt) t.dueAt = body.dueAt;
            return [200, { task: t }];
          }
        }
        return [404, { code: "NOT_FOUND", message: "Task not found." }];
      }
      if (p === "/api/sales/intake" && method === "GET") return [200, { intake: Object.values(s.leads).filter((l) => l.sourcedBy === user._id).map((l) => ({ id: l.id, name: l.name, town: l.town, phoneLast4: l.phone.slice(-4), status: l.status, submittedAt: iso(-30), decision: null })) }];
      if (p === "/api/sales/intake" && method === "POST") {
        const id = `I${Object.keys(s.leads).length + 1}`;
        s.leads[id] = { id, name: body.name, phone: `+1${String(body.phone).replace(/\D/g, "").slice(-10)}`, town: body.town || "", stage: "new", status: "intake", source: "employee_intake", sourcedBy: user._id, linked: false, assignee: null, credit: null, tasks: [], activities: [] };
        return [201, { lead: { id, name: body.name, town: body.town, status: "intake" } }];
      }
      if (p === "/api/sales/sales") return [200, { sales: [{ saleId: "s1", label: "Monthly membership (Basic)", customer: "R. D. · Huntington", paidAt: S1_PAID, verified: true, attribution: "approved", commission: en1(), amounts: { regularCents: 14900, discountCents: 2980, discountSource: WELCOME, paidPreTaxCents: 11920, taxCents: 1036 }, refunds: [{ kind: "refund", amountCents: 6478, at: REFUND_AT, status: null }] }, { saleId: "s2", label: "Plan change to Plus", customer: "R. D. · Huntington", paidAt: S2_PAID, verified: true, attribution: "request_pending", commission: null, amounts: { regularCents: 8000, discountCents: 0, discountSource: "", paidPreTaxCents: 8000, taxCents: 696 }, refunds: [] }] }];
      if (p === "/api/sales/bonus") return [200, { bonus: bonusOf("t-ana") }];
      if (p === "/api/sales/statements") return [200, { statements: statementRows() }];
      const sm = /^\/api\/sales\/statements\/(\d{4}-\d{2}-\d{2})(\/csv)?$/.exec(p);
      if (sm && sm[2]) return [200, `week_start,total\n${sm[1]},${(statement(sm[1]).totals.totalCents / 100).toFixed(2)}\n`, "text/csv", { "content-disposition": `attachment; filename="statement-${sm[1]}.csv"` }];
      if (sm) return [200, { statement: statement(sm[1]) }];
      if (p === "/api/sales/credit-requests" && method === "GET") return [200, { requests: s.requests.filter((r) => r.employee === user._id).map(reqDto) }];
      if (p === "/api/sales/credit-requests" && method === "POST") {
        const r = { id: `R${s.requests.length + 1}`, leadId: body.leadId, saleId: body.saleId, kind: body.kind, explanation: body.explanation, status: "pending", employee: user._id, proposed: { amountCents: 10000, method: "fixed", detail: "Full Day sale: fixed $100.00", countsForBonusDefault: false }, evidence: [...(body.ghlReferences || []).map((t, i) => ({ id: `g${i}`, kind: "ghl_reference", text: t, addedAt: new Date().toISOString() })), ...(body.note ? [{ id: "n0", kind: "note", text: body.note, addedAt: new Date().toISOString() }] : [])], decisions: [{ action: "submitted", by: user.name, reason: "", at: new Date().toISOString() }], createdAt: new Date().toISOString() };
        s.requests.push(r);
        s.lastRequestBody = body;
        return [201, { request: reqDto(r) }];
      }
      const rm = /^\/api\/sales\/credit-requests\/([^/]+)\/(evidence|reply|withdraw)$/.exec(p);
      if (rm) {
        const r = s.requests.find((x) => x.id === rm[1] && x.employee === user._id);
        if (!r) return [404, { code: "NOT_FOUND", message: "Request not found." }];
        if (rm[2] === "evidence") {
          const text = raw ? raw.toString("latin1") : "";
          const fn = /name="file"; filename="([^"]+)"/.exec(text);
          s.posted.evidence.push({ multipart: /multipart\/form-data/.test(s.lastContentType || ""), field: Boolean(fn), fileName: fn ? fn[1] : null, bytes: raw ? raw.length : 0, hasPng: text.includes("PNG") });
          if (!fn) return [400, { code: "EMPTY", message: "Add a file." }];
          r.evidence.push({ id: `f${r.evidence.length}`, kind: "file", text: "", fileName: fn[1], size: 120, addedAt: new Date().toISOString() });
          return [201, { request: reqDto(r) }];
        }
        if (rm[2] === "withdraw") r.status = "withdrawn";
        if (rm[2] === "reply") {
          r.status = "pending";
          r.decisions.push({ action: "employee_reply", by: user.name, reason: body.text, at: new Date().toISOString() });
        }
        return [200, { request: reqDto(r) }];
      }
      return [404, { code: "NOT_FOUND", message: `no fake for ${method} ${p}` }];
    }

    /* ------------------------------ owner API ------------------------------ */
    if (p.startsWith("/api/admin/sales-desk/")) {
      if (!owner) return [403, { message: "Access denied" }];
      s.calls.push({ method, p, body });
      const q = p.slice("/api/admin/sales-desk".length);
      if (q === "/overview") return [200, { from: "2026-11-13T05:00:00.000Z", to: "2026-11-20T05:00:00.000Z", rows: ["t-ana", "t-ben"].map((id) => ({ employee: { id, name: names[id], active: true }, metrics: metrics(id), bonus: bonusOf(id), openLeads: Object.values(s.leads).filter((l) => l.assignee === id).length })), queues: { unassigned: 2, intake: 1, reviews: 2, requests: s.requests.filter((r) => r.status === "pending").length, leadsWithInactiveEmployee: 0 }, definitions: DEFS }];
      if (q === "/employees") return [200, { employees: [{ id: "t-ana", name: "Ana Torres", active: true }, { id: "t-ben", name: "Ben Ortiz", active: true }] }];
      const ha = /^\/employees\/([^/]+)\/home-address$/.exec(q);
      if (ha) return (s.homeAddress = body), [200, { homeAddress: body }];
      const em = /^\/employees\/([^/]+)(\/goals)?$/.exec(q);
      if (em && em[2]) return (s.goals = body), [200, { goals: body }];
      if (em) return [200, { employee: { id: em[1], name: names[em[1]], active: true, email: "ana@example.test", homeAddress: s.homeAddress || { line1: "", unit: "", city: "", zip: "" } }, metrics: metrics(em[1]), from: "2026-11-13T05:00:00.000Z", to: "2026-11-20T05:00:00.000Z", definitions: DEFS, bonus: bonusOf(em[1]), earnings: earningsOf(s.ledger, em[1]), statements: statementRows(em[1]), sales: [], leads: Object.values(s.leads).filter((l) => l.assignee === em[1]).map(card), goals: { weeklyMemberships: 5, weeklyFreeVisits: 8, note: "Call new leads within the hour." }, coaching: "Call new leads within the hour." }];
      if (q === "/leads" && method === "GET") {
        const view = sp.get("view") || "all";
        let list = Object.values(s.leads);
        if (view === "intake") list = list.filter((l) => l.status === "intake");
        else if (view === "archived") list = list.filter((l) => l.status === "archived");
        else list = list.filter((l) => l.status === "active");
        // L5 shows as unassigned even after the fake assigned it "meanwhile" (a stale list).
        if (view === "unassigned") list = list.filter((l) => !l.assignee || l.id === "L5");
        if (view === "assigned") list = list.filter((l) => l.assignee);
        return [200, { leads: list.map(ownerRow) }];
      }
      if (q === "/leads" && method === "POST") return (s.createdLead = body), [201, { lead: { id: "L9" } }];
      if (q === "/leads/bulk-assign") {
        for (const id of body.leadIds) {
          if (s.leads[id] && !s.leads[id].assignee) {
            s.leads[id].assignee = body.employeeId;
            s.leads[id].credit = body.employeeId;
          }
        }
        return [200, { assigned: body.leadIds, skipped: [] }];
      }
      const dl = /^\/leads\/([^/]+)(\/[a-z]+)?$/.exec(q);
      if (dl) {
        const l = s.leads[dl[1]];
        if (!l) return [404, { code: "NOT_FOUND", message: "Lead not found." }];
        const rest = dl[2] || "";
        if (!rest) return [200, { lead: ownerDetail(l) }];
        if (rest === "/assign") {
          s.assignments.push(body);
          if (l.assignee && !["keep_previous", "new_assignee"].includes(body.creditDecision)) return [409, { code: "CREDIT_DECISION_REQUIRED", message: "Choose who keeps sales credit for this lead.", currentCreditHolder: { id: l.credit, name: names[l.credit] } }];
          if (l.assignee && !String(body.reason || "").trim()) return [400, { code: "REASON_REQUIRED", message: "Give a reason for the reassignment." }];
          const prev = l.assignee;
          if (prev) l.history = [...(l.history || []), { employee: names[prev], employeeId: prev, creditEmployee: names[l.credit], creditDecision: "first_assignment", startedAt: iso(-200), startedBy: "Owner Test", reason: "New lead", endedAt: new Date().toISOString(), endReason: body.reason }];
          l.assignee = body.employeeId;
          if (!prev || body.creditDecision === "new_assignee") l.credit = body.employeeId;
          return [200, { assignment: { creditDecision: body.creditDecision || "first_assignment" } }];
        }
        if (rest === "/notes") return l.activities.unshift({ at: new Date().toISOString(), kind: body.kind, text: body.body, by: "Owner Test", origin: "employee", visibility: body.kind === "coaching" ? "owner" : "team" }), [201, { activity: {} }];
        if (rest === "/unassign") return (l.assignee = null), (l.credit = null), [200, { ok: true }];
        return [200, { ok: true }];
      }
      const im = /^\/intake\/([^/]+)\/decide$/.exec(q);
      if (im) return (s.leads[im[1]].status = body.approve ? "active" : "rejected"), [200, { lead: { id: im[1], status: s.leads[im[1]].status } }];
      if (q === "/customers/search") return [200, { customers: [] }];
      if (q === "/suppressions/lift") return (s.lifted = body), [200, { suppression: {} }];
      if (q === "/reviews") return [200, { reviews: [
        { id: "V1", kind: "refund", summary: "$64.78 (half of $129.56) refunded on a Monthly membership (Basic) paid 2026-11-13.", effects: { found: true, sale: { id: "s1", kind: "membership_first_paid", plan: "Basic", cycle: "monthly", paidAt: S1_PAID, paidPreTaxCents: 11920 }, commissions: [{ id: "en1", employee: "t-ana", amountCents: 5960, status: "open", statementWeek: "2026-11-13" }], bonuses: [], note: "Nothing is deducted automatically. Previously earned commission and bonuses stay as they are unless you record an adjustment." }, status: "open", createdAt: REFUND_AT },
        { id: "V2", kind: "credit_hold", summary: "Monthly membership (Basic) paid 2026-11-10: the lead was linked to the account after the sale. Claims: Ana Torres (assignment).", effects: { holdReasons: ["linked_after_sale"], claimants: [{ employee: "t-ana", basis: "assignment", name: "Ana Torres" }] }, status: "open", createdAt: day("2026-11-10", 20) },
        { id: "V3", kind: "credit_hold", summary: "Basic monthly membership on 2026-11-11: the customer's details match the employee's own (self-referral check). Claims: Ben Ortiz (assignment). Self-referral check: same home address as the employee (possibly a household member). Check before crediting; a genuine customer can still be credited.", effects: { holdReasons: ["self_referral_check"], claimants: [{ employee: "t-ben", basis: "assignment", name: "Ben Ortiz" }], selfReferral: [{ employee: "t-ben", employeeName: "Ben Ortiz", signals: [{ code: "same_home_address", strength: "household", text: "A customer address matches the employee's home address. This can be a household member or a neighbour; a genuine household purchase can still be credited." }] }] }, status: "open", createdAt: day("2026-11-11", 20) },
      ], requests: s.requests.filter((r) => ["pending", "needs_info"].includes(r.status)).map((r) => ({ ...r, employee: { id: r.employee, name: names[r.employee] } })) }];
      const rq = /^\/credit-requests\/([^/]+)(\/decide|\/files\/([^/]+))?$/.exec(q);
      if (rq && rq[3]) return [200, "%PDF-1.4 fake", "application/pdf", { "content-disposition": 'attachment; filename="call-log.pdf"' }];
      if (rq && rq[2] === "/decide") {
        const r = s.requests.find((x) => x.id === rq[1]);
        if (body.action === "approved" && typeof body.countsForBonus !== "boolean") return [400, { code: "BONUS_CHOICE_REQUIRED", message: "For a plan change, say whether it counts toward the 20-membership bonus." }];
        if (body.action === "approved" && s.flagR1 && body.selfReferralCleared !== true) return [409, { code: "SELF_REFERRAL_CHECK", message: "The self-referral check flagged this claim." }];
        r.status = body.action;
        s.decided = body;
        return [200, { request: r, entryId: "enX" }];
      }
      if (rq) {
        const r = s.requests.find((x) => x.id === rq[1]);
        return [200, { request: { ...r, employee: { id: r.employee, name: names[r.employee] }, ...(s.flagR1 ? { selfReferral: [{ code: "same_email", strength: "same_person", text: "The customer's email is the employee's own email." }] } : {}) }, customer: { id: "u1", name: "Rosa Delgado", userId: "PF-4411", since: iso(-24 * 30) }, sale: { id: "s2", kind: "membership_change_paid", label: "Plan change to Plus", plan: "Plus", cycle: "monthly", paidAt: S2_PAID, identity: "stripe_customer", amounts: { regularCents: 8000, discountCents: 0, paidPreTaxCents: 8000, taxCents: 696, amountCents: 8696 }, discount: null, returningCustomer: false, stripe: { invoiceId: "in_fake_1", billingReason: "subscription_update" } }, currentCredit: { status: "none", reason: "plan_change" }, membershipHistory: [{ plan: "Plus", cycle: "monthly", status: "active", startDate: S1_PAID, endedOn: null, complimentary: false }], previousCommissions: [{ id: "en1", employee: "Ana Torres", kind: "commission", product: "membership_monthly", amountCents: 5960, paidAt: S1_PAID, status: "open", explain: CALC.monthlyWelcome.explain }], previousSales: [{ id: "s1", kind: "membership_first_paid", label: "Monthly membership (Basic)", paidAt: S1_PAID, amountCents: 12956 }], bonusEffect: "A plan change counts toward the 20-membership bonus only if you choose so." }];
      }
      if (/^\/reviews\/V[0-9]\/resolve$/.test(q)) return (s.resolved = body), [200, { review: {}, entryId: null }];
      if (q === "/commissions") return [200, { entries: [...s.adjustments, ...[...s.ledger].sort((x, y) => y.earnedAt.localeCompare(x.earnedAt)).map((e) => ({ ...entryDto(e), employee: { id: e.employee, name: names[e.employee] } }))].filter((e) => (!sp.get("employee") || e.employee.id === sp.get("employee")) && (!sp.get("week") || e.statementWeek === sp.get("week"))) }];
      if (q === "/adjustments") {
        const created = !s.adjKeys.has(body.idempotencyKey);
        s.adjKeys.add(body.idempotencyKey);
        const e = { ...entryDto(ledgerEntry(`adj${s.adjustments.length}`, body.employeeId, "monthlyFull", "2026-11-14", "2026-11-13", "open")), kind: "adjustment", product: "adjustment", amountCents: body.amountCents, customer: "", reason: body.reason, countsForBonus: false, calc: { regularCents: 0, discountCents: 0, discountSource: "", paidPreTaxCents: 0, taxCents: 0, explain: body.reason, rule: null }, employee: { id: body.employeeId, name: names[body.employeeId] } };
        if (created) s.adjustments.push(e);
        s.lastAdjustment = body;
        return [created ? 201 : 200, { entry: e }];
      }
      if (q === "/payouts") return [200, { payouts: Object.values(s.payouts).sort((a, b) => b.week.localeCompare(a.week)).map((w) => ({ week: w.week, lastDay: w.lastDay, payday: w.payday, status: w.status, totalCents: w.lines.reduce((t, l) => t + l.totalCents, 0), employees: w.lines.length, unpaid: w.status === "approved" ? w.lines.filter((l) => l.payment?.status !== "paid").length : null })), integrity: s.integrityBad ? { ok: false, approvedWeeks: 1, problems: ["open entry en9 is on week 2026-10-16, on or before the approved week 2026-10-30: it would never be paid"] } : { ok: true, approvedWeeks: 1, problems: [] } }];
      const pm = /^\/payouts\/(\d{4}-\d{2}-\d{2})(\/approve|\/csv|\/lines\/([^/]+)\/paid)?$/.exec(q);
      if (pm) {
        const w = s.payouts[pm[1]];
        if (!w) return [404, { code: "BAD_WEEK", message: "Unknown week." }];
        if (!pm[2]) return [200, { payout: weekView(pm[1]) }];
        if (pm[2] === "/approve") {
          if (w.status !== "ready") return [409, { code: "WEEK_NOT_FINISHED", message: "Not finished." }];
          w.status = "approved";
          w.approvedAt = new Date().toISOString();
          w.approvedByName = "Owner Test";
          w.lines.forEach((l) => {
            l.payment = { status: "unpaid" };
          });
          s.ledger.filter((e) => e.statementWeek === pm[1]).forEach((e) => {
            e.status = "approved";
          });
          return [200, { payout: w }];
        }
        if (pm[2] === "/csv") return w.status === "approved" ? [200, "week_start,employee,total\n", "text/csv", { "content-disposition": `attachment; filename="payout-${pm[1]}.csv"` }] : [409, { code: "NOT_APPROVED", message: "Approve first." }];
        const line = w.lines.find((l) => l.employee === pm[3]);
        line.payment = { status: "paid", paidOn: body.paidOn, method: body.method, reference: body.reference, recordedByName: "Owner Test", recordedAt: new Date().toISOString() };
        s.ledger.filter((e) => e.statementWeek === pm[1] && e.employee === pm[3]).forEach((e) => {
          e.status = "paid";
        });
        s.paid = body;
        return [200, { payout: w }];
      }
      if (q === "/ghl") return [200, { ghl: { enabled: false, signatureKeyConfigured: true, locationConfigured: true, liveVerified: false, liveNote: "Live GHL delivery has not been verified. The account, the webhook subscription and the public key must be confirmed before enabling.", counts: { processed: 14, unmapped: 3, failed: 1 }, lastReceivedAt: iso(-2), failures: [{ _id: "g1", eventId: "evt_1", type: "OutboundMessage", contactId: "abcDEF123456", attempts: 5, lastError: "contact lookup timed out", nextAttemptAt: null, receivedAt: iso(-3) }], unmapped: [{ contactId: "zzzYYY987654", events: 3, lastAt: iso(-4) }] } }];
      const gm = /^\/ghl\/events\/([^/]+)\/retry$/.exec(q);
      if (gm) return (s.retried = gm[1]), [200, { event: { id: gm[1], status: "processed", outcome: "ok", lastError: "" } }];
      return [404, { code: "NOT_FOUND", message: `no fake for ${method} ${p}` }];
    }

    /* ------------------------------ Team editor ------------------------------ */
    if (p === "/api/admin/fixters/access-registry") return owner ? [200, { groups: [{ id: "business", label: "Business" }], sections: [{ id: "customers", group: "business", label: "Customers", description: "Customers", requires: null }], positions: ["Fixter", "General Fixter"], officePositions: ["Telemarketer"], includedByPosition: { Fixter: [], "General Fixter": ["customers"] } }] : [403, { message: "Access denied" }];
    if (p === "/api/admin/fixters" && method === "GET") return owner ? [200, { fixters: s.fixters }] : [403, { message: "Access denied" }];
    if (p === "/api/admin/fixters" && method === "POST") {
      s.posted.fixters.push(body);
      const f = { ...s.fixters[0], id: "new1", firstName: body.firstName, lastName: body.lastName, name: `${body.firstName} ${body.lastName}`, email: body.email, phone: body.phone || "", employeePosition: body.employeePosition, adminSections: body.adminSections };
      s.fixters.push(f);
      return [201, { fixter: f }];
    }
    if (p === "/api/admin/activity-log/summary") return [200, { usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 }];
    return [200, p.includes("summary") || p.includes("settings") ? {} : []];
  }
  return { s, handle };
}

const results = [];
function check(name, pass, detailText = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText && !pass ? "  :: " + detailText : ""}`);
}

async function open(browser, user, { width = 390, height = 844 } = {}) {
  const mobile = width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce", timezoneId: "America/New_York", acceptDownloads: true });
  await ctx.addInitScript(() => {
    if (location.pathname.startsWith("/admin")) localStorage.setItem("token", "ui-token");
  });
  const server = makeServer(user);
  const external = [];
  const local = new URL(BASE);
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname.includes("/api/")) {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "Content-Disposition" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
      let body = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      const headers = req.headers();
      if (headers["idempotency-key"]) external.push("HEADER idempotency-key (CORS would refuse it)");
      if (!/^Bearer ui-token$/.test(headers.authorization || "") && p !== "/api/auth/me") external.push(`NO AUTH ${p}`);
      server.s.lastContentType = headers["content-type"] || "";
      const raw = req.postDataBuffer();
      const [status, json, type, extra] = server.handle(req.method(), p, u.searchParams, body, raw);
      return route.fulfill({ status, contentType: type || "application/json", headers: { ...cors, ...(extra || {}) }, body: typeof json === "string" ? json : JSON.stringify(json) });
    }
    if (u.origin === local.origin) return route.continue();
    if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    external.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, server, external, errors };
}

async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));
  await page.waitForTimeout(150);
}

/** No page-level horizontal scroll, and nothing sticks out of the viewport (ignoring content inside its own scroll box). */
async function overflow(page) {
  await settle(page);
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed") bad.push(`${el.tagName}.${String(el.className).slice(0, 40)} ${Math.round(r.left)}-${Math.round(r.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth > vw + 1, bad: bad.slice(0, 5) };
  });
}

async function go(page, route, ready) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  if (ready) await page.locator(ready).first().waitFor({ timeout: 25000 });
}
const navItems = (page, where) => page.locator(`[data-adm-${where}] a[data-nav]`).evaluateAll((as) => as.map((a) => a.getAttribute("data-nav")));
const shot = async (page, name) => {
  await settle(page);
  await page.screenshot({ path: path.join(SHOTS, name) });
};
const sizes = [
  { tag: "390x844", width: 390, height: 844 },
  { tag: "1440x900", width: 1440, height: 900 },
];

(async () => {
  const browser = await chromium.launch();
  const allExternal = [];
  const allErrors = [];
  const track = (o) => {
    allExternal.push(...o.external);
    allErrors.push(...o.errors);
  };
  try {
    /* 1. access: the telemarketer sees only the sales workspace */
    {
      const o = await open(browser, ANA);
      const { page } = o;
      await go(page, "/admin", "[data-section=sales-today]");
      check("telemarketer: /admin lands on Today", new URL(page.url()).pathname === "/admin/sales-today", page.url());
      const bar = await navItems(page, "bottomnav");
      check("telemarketer phone bar: Today · Leads · Earnings · More, nothing else", bar.join(",") === "sales-today,sales-leads,sales-earnings,more", bar.join(","));
      await go(page, "/admin/more", "[data-section=more]");
      const more = await page.locator("[data-section=more] a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      check("telemarketer More: only Credit requests and Submitted leads", more.join(",") === "/admin/sales-requests,/admin/sales-intake", more.join(","));
      for (const r of ["/admin/customers", "/admin/jobs", "/admin/leads", "/admin/team", "/admin/sales-desk", "/admin/overview"]) {
        await go(page, r, "[data-permission-state]");
        check(`telemarketer: direct URL ${r} is refused`, (await page.locator("[data-permission-state]").count()) === 1);
      }
      check("telemarketer: no owner or admin APIs were requested", !o.server.s.calls.some((c) => c.p.startsWith("/api/admin/")), o.server.s.calls.map((c) => c.p).join(" "));
      check("telemarketer: no global customer search in the header", (await page.locator("[data-global-search], [data-global-search-open]").count()) === 0);
      track(o);
      await o.ctx.close();
      const d = await open(browser, ANA, { width: 1440, height: 900 });
      await go(d.page, "/admin/sales-today", "[data-section=sales-today]");
      const side = await navItems(d.page, "sidebar");
      check("telemarketer sidebar: the five sales screens only", side.join(",") === "sales-today,sales-leads,sales-earnings,sales-requests,sales-intake", side.join(","));
      track(d);
      await d.ctx.close();
    }
    for (const [label, user] of [["general Fixter", GENERAL], ["field Fixter", FIELD]]) {
      const o = await open(browser, user, { width: 1440, height: 900 });
      await go(o.page, "/admin/more", "[data-adm-sidebar]");
      const side = await navItems(o.page, "sidebar");
      check(`${label}: no sales workspace or Sales desk in the navigation`, !side.some((x) => x.startsWith("sales")), side.join(","));
      await go(o.page, "/admin/sales-today", "[data-permission-state]");
      check(`${label}: /admin/sales-today is refused`, (await o.page.locator("[data-permission-state]").count()) === 1);
      await go(o.page, "/admin/sales-desk", "[data-permission-state]");
      check(`${label}: /admin/sales-desk is refused, and no sales API was called`, (await o.page.locator("[data-permission-state]").count()) === 1 && !o.server.s.calls.length);
      track(o);
      await o.ctx.close();
    }
    {
      const o = await open(browser, OWNER, { width: 1440, height: 900 });
      await go(o.page, "/admin/more", "[data-adm-sidebar]");
      const side = await navItems(o.page, "sidebar");
      check("owner: Sales desk in the navigation, no telemarketer workspace", side.includes("sales-desk") && !side.some((x) => /^sales-(today|leads|earnings|requests|intake)$/.test(x)), side.join(","));
      await go(o.page, "/admin/sales-today", "[data-permission-state]");
      check("owner: the telemarketer workspace is not theirs", (await o.page.locator("[data-permission-state]").count()) === 1);
      track(o);
      await o.ctx.close();
    }

    /* 2. Today: bonus card shows the server's numbers exactly */
    for (const size of sizes) {
      const o = await open(browser, ANA, size);
      const { page } = o;
      await go(page, "/admin/sales-today", "[data-today-bonus] [data-bonus]");
      const b = await page.locator("[data-today-bonus]").innerText();
      {
        const ov = await overflow(page);
        check(`Today ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
        await shot(page, `today-${size.tag}.png`);
      }
      if (size.width === 390) {
        check("Today bonus: 13 of 20 memberships", /13\s*of\s*20\s*memberships/.test(b), b);
        check("Today bonus: 7 more for your next $500", /7 more for your next \$500/.test(b), b);
        check("Today bonus: verified 13 and pending 2 shown separately", /Verified this bonus month\s*13/.test(b) && /Pending review \(not counted yet\)\s*2/.test(b), b);
        check("Today bonus: period dates and time remaining", /Bonus month 2: Nov 3 – Dec 2, 2026/.test(b) && /18 days 5 hours left/.test(b), b);
        check("Today bonus: the server's message", b.includes("More than halfway to $500."), b);
        const e = await page.locator("[data-today-earnings]").innerText();
        check("Today earnings: statement money vs pending claims, labelled ($968.50 open, $0.00 approved, $1,692.00 paid, $174.10 in 3 claims)", /On statements not yet approved\s*\$968\.50/.test(e) && /Approved, awaiting payment\s*\$0\.00/.test(e) && /Paid to date\s*\$1,692\.00/.test(e) && /Pending claims · not earnings\s*\$174\.10\s*\(3\)/.test(e), e);
        const f = await page.locator("[data-followups]").innerText();
        check("Today: overdue follow-up listed with its lead", /Rosa Delgado/.test(f) && /Overdue/.test(f), f);
        check("Today: referral link and goals", /ref=ANA4821/.test(await page.locator("[data-referral-url]").innerText()) && /5 memberships a week/.test(await page.locator("[data-goals]").innerText()));
        await page.locator("[data-copy-referral]").click();
        await page.locator("text=Referral link copied.").or(page.locator("text=Couldn't copy")).first().waitFor();
        check("Today: copy referral link gives feedback", true);
      }
      if (size.width === 390) {
        await page.locator("[data-followups] a").first().click();
        await page.locator("[role=dialog][data-sheet=sales-lead] [data-sales-lead=L1]").waitFor();
        check("Today: tapping a follow-up opens its lead", new URL(page.url()).pathname === "/admin/sales-leads/L1");
      }
      track(o);
      await o.ctx.close();
    }

    /* 3. Leads list, add lead (intake), submitted leads */
    for (const size of sizes) {
      const o = await open(browser, ANA, size);
      const { page, server } = o;
      await go(page, "/admin/sales-leads", "[data-lead-list]");
      const rows = await page.locator("[data-lead-list]").innerText();
      if (size.width === 390) {
        check("Leads: name, town, last 4, stage chip and next task", /Rosa Delgado/.test(rows) && /Huntington · ••••0111/.test(rows) && /Contacted/.test(rows) && /Next: Call/.test(rows), rows);
        check("Leads: do-not-call and do-not-text badges", (await page.locator("[data-lead-list] [data-dnc=call]").count()) === 1 && (await page.locator("[data-lead-list] [data-dnc=sms]").count()) === 1);
        check("Leads: full numbers are never in the list", !/555-?0111|5550111/.test(rows));
        await page.locator("input[type=search], input[aria-label='Search your leads']").first().fill("owen");
        check("Leads: search filters in the browser", (await page.locator("[data-lead-list] li").count()) === 1 && !server.s.calls.some((c) => /[?&]q=/.test(c.p)));
        await page.locator("input[aria-label='Search your leads']").fill("");
      }
      const ov = await overflow(page);
      check(`Leads ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `leads-${size.tag}.png`);
      if (size.width === 390) {
        await page.locator("[data-add-lead]").click();
        await page.locator("[role=dialog][data-sheet=sales-intake]").waitFor();
        check("Add lead: explains it waits for the owner's approval", /waits for the owner.s approval/.test(await page.locator("[role=dialog][data-sheet=sales-intake]").innerText()));
        await page.fill("input[name=intake-name]", "Eli Brooks");
        await page.fill("input[name=intake-phone]", "(631) 555-0177");
        await page.fill("input[name=intake-town]", "Smithtown");
        await page.locator("[data-intake-submit]").click();
        await page.locator("[data-intake-done]").waitFor();
        check("Add lead: POST /api/sales/intake with the typed lead", server.s.calls.some((c) => c.method === "POST" && c.p === "/api/sales/intake" && c.body.name === "Eli Brooks" && c.body.town === "Smithtown"));
        await page.goto(`${BASE}/admin/sales-intake`);
        await page.locator("[data-intake-list]").waitFor();
        const il = await page.locator("[data-intake-list]").innerText();
        check("Submitted leads: shows waiting-for-approval entries", /Eli Brooks/.test(il) && /Dana Fox/.test(il) && /Waiting for approval/.test(il), il);
      }
      track(o);
      await o.ctx.close();
    }

    /* 4. Lead detail: phone reveal, log outcome + follow-up, tasks, GHL, do-not-contact */
    for (const size of sizes) {
      const o = await open(browser, ANA, size);
      const { page, server } = o;
      await go(page, "/admin/sales-leads/L1", "[data-sales-lead=L1]");
      const dlg = page.locator("[role=dialog][data-sheet=sales-lead]");
      {
        const ov = await overflow(page);
        check(`Lead detail ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
        await shot(page, `lead-detail-${size.tag}.png`);
      }
      if (size.width === 390) {
        const head = await dlg.innerText();
        check("Lead: masked number, stage and sales-credit sentence", /••••0111/.test(head) && /Sales credit for this lead is yours\./.test(head) && !/555-?0111/.test(head), head.slice(0, 300));
        await dlg.locator("[data-show-number]").click();
        await dlg.locator("[data-phone-full]").waitFor();
        check("Lead: Show number calls POST /phone once and shows the number", server.s.revealed === 1 && /0111/.test(await dlg.locator("[data-phone-full]").innerText()));
        check("Lead: timeline origin badges (System, Logged by, Unknown)", /System/.test(await dlg.locator("[data-timeline]").innerText()) && /Logged by Ana Torres/.test(await dlg.locator("[data-timeline]").innerText()) && (await dlg.locator("[data-timeline] [data-origin=unknown]").count()) >= 1 && /Unknown/.test(await dlg.locator("[data-timeline] [data-origin=unknown]").first().innerText()));
        check("Lead: a past visit with no recorded outcome reads 'Unknown' (plain chip, no cross or check), never 'Estimated'", /Unknown/.test(await dlg.locator("[data-free-visit=unknown]").innerText()) && (await dlg.locator("[data-free-visit=unknown] [data-unknown]").count()) === 1 && (await dlg.locator("[data-free-visit=unknown] [data-unknown] svg").count()) === 0 && !/estimat/i.test(await dlg.innerText()));
        await dlg.locator("[data-outcome=reached_interested]").click();
        await dlg.locator("[data-quick-follow='Tomorrow 10 AM']").click();
        await dlg.locator("textarea[name=outcome-note]").fill("Wants the Plus plan, call tomorrow");
        await dlg.locator("[data-outcome-save]").click();
        await page.locator("text=Logged.").waitFor();
        const act = server.s.calls.find((c) => c.method === "POST" && c.p === "/api/sales/leads/L1/activities");
        const fu = act && new Date(act.body.followUpAt);
        const nyHour = fu && Number(fu.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }));
        check("Log outcome: kind, note and a follow-up at 10 AM New York", act && act.body.kind === "reached_interested" && act.body.body === "Wants the Plus plan, call tomorrow" && nyHour === 10 && act.body.followUpKind === "call", JSON.stringify(act?.body));
        await dlg.locator("[data-task]").nth(1).waitFor();
        check("Log outcome: the follow-up appears in the lead's tasks", (await dlg.locator("[data-task]").count()) === 2);
        await dlg.locator("[data-task-done=T1]").click();
        await page.locator("text=Follow-up done.").waitFor();
        check("Task done: PATCH /api/sales/tasks/T1 {status: done}", server.s.calls.some((c) => c.method === "PATCH" && c.p === "/api/sales/tasks/T1" && c.body.status === "done"));
        await dlg.locator("input[name=ghl-contact]").fill("https://app.gohighlevel.com/v2/location/LOC/contacts/detail/AbCdEf123456");
        await dlg.locator("[data-ghl-save]").click();
        await dlg.locator("[data-ghl-contact]").waitFor();
        check("GHL: pasted link sent to PUT /ghl and Open contact appears", server.s.calls.some((c) => c.method === "PUT" && c.p === "/api/sales/leads/L1/ghl" && /AbCdEf123456/.test(c.body.contact)));
      }
      track(o);
      await o.ctx.close();
    }
    {
      const o = await open(browser, ANA);
      const { page } = o;
      await go(page, "/admin/sales-leads/L2", "[data-sales-lead=L2]");
      const dlg = page.locator("[role=dialog][data-sheet=sales-lead]");
      const banner = await dlg.locator("[data-suppression-banner]").innerText();
      check("Do-not-contact: banner names calls and texts with the reason", /Do not call or text this person\./.test(banner) && /Asked not to be called again/.test(banner), banner);
      const disabled = await dlg.locator("[data-outcome=attempt], [data-outcome=voicemail], [data-outcome=reached_interested], [data-outcome=call_back], [data-outcome=wrong_number]").evaluateAll((bs) => bs.every((b) => b.disabled));
      check("Do-not-contact: call outcome buttons are disabled; Note stays available", disabled && !(await dlg.locator("[data-outcome=note]").isDisabled()) && (await dlg.locator("[data-calls-blocked]").count()) === 1);
      await shot(page, "lead-dnc-390x844.png");
      track(o);
      await o.ctx.close();
    }

    /* 5. Request sales credit with a file (multipart reaches the fake) */
    for (const size of sizes) {
      const o = await open(browser, ANA, size);
      const { page, server } = o;
      await go(page, "/admin/sales-leads/L1", "[data-sales-lead=L1]");
      const dlg = page.locator("[role=dialog][data-sheet=sales-lead]");
      check(`${size.tag}: only the unclaimed sale offers Request sales credit`, (await dlg.locator("[data-request-credit]").count()) === 1 && (await dlg.locator("[data-request-credit=s3]").count()) === 1);
      await dlg.locator("[data-request-credit=s3]").click();
      await dlg.locator("[data-credit-form=s3]").waitFor();
      await dlg.locator("[data-credit-kind=missed_link]").click();
      await dlg.locator("textarea[name=credit-explanation]").fill("I booked Rosa's Full Day on the phone on Nov 12; the checkout was not linked to me.");
      await dlg.locator("input[name=credit-ref-0]").fill("GHL call Nov 12 11:05 AM");
      await dlg.locator("[data-credit-add-ref]").click();
      await dlg.locator("input[name=credit-ref-1]").fill("GHL text Nov 12 11:20 AM");
      await dlg.locator("input[name=credit-note]").fill("She asked for me by name");
      await dlg.locator("input[name=credit-file]").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from([0x89]), Buffer.from("PNG\r\n\x1a\nfake-image-bytes")]) });
      const ov = await overflow(page);
      check(`Request credit ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `request-credit-${size.tag}.png`);
      if (size.width === 390) {
        await dlg.locator("input[name=credit-file]").setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 10) });
        check("Request credit: a file over 5 MB is refused before sending", (await dlg.locator("[data-credit-submit]").isDisabled()) && /up to 5 MB/.test(await dlg.innerText()));
        await dlg.locator("input[name=credit-file]").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from([0x89]), Buffer.from("PNG\r\n\x1a\nfake-image-bytes")]) });
      }
      await dlg.locator("[data-credit-submit]").click();
      await dlg.locator("[data-credit-upload=done]").waitFor();
      const b = server.s.lastRequestBody;
      check(`${size.tag}: request carries kind, explanation, both GHL references and the note`, b && b.kind === "missed_link" && b.saleId === "s3" && b.leadId === "L1" && b.ghlReferences.length === 2 && b.note === "She asked for me by name", JSON.stringify(b));
      const ev = server.s.posted.evidence[0];
      check(`${size.tag}: the file reached the fake as multipart field "file"`, ev && ev.multipart && ev.field && ev.fileName === "proof.png" && ev.hasPng, JSON.stringify(ev));
      const res = await dlg.locator("[data-credit-result]").innerText();
      check(`${size.tag}: shows the server's proposed amount and bonus eligibility`, /\$100\.00/.test(res) && /Full Day sale: fixed \$100\.00/.test(res) && /does not count toward the bonus/.test(res), res);
      if (size.width === 390) await shot(page, "request-credit-sent-390x844.png");
      track(o);
      await o.ctx.close();
    }
    {
      const o = await open(browser, ANA);
      const { page } = o;
      await go(page, "/admin/sales-requests", "[data-request-list]");
      const t = await page.locator("[data-request=R1]").innerText();
      check("Credit requests: status, proposed amount and claim wording", /Waiting for the owner/.test(t) && /\$40\.00/.test(t) && /A claim, not earnings/.test(t), t);
      await page.locator("[data-request=R1] [data-request-withdraw]").click();
      await page.locator("[data-confirm]").click();
      await page.locator("[data-request=R1][data-request-status=withdrawn]").waitFor();
      check("Credit requests: Withdraw posts and updates", o.server.s.calls.some((c) => c.p === "/api/sales/credit-requests/R1/withdraw"));
      track(o);
      await o.ctx.close();
    }

    /* 6. Earnings: bonus view, sales breakdown, statements with a late line + CSV */
    for (const size of sizes) {
      const o = await open(browser, ANA, size);
      const { page, server } = o;
      await go(page, "/admin/sales-earnings?tab=bonus", "[data-bonus-view]");
      const bt = await page.locator("[data-bonus-view]").innerText();
      if (size.width === 390) {
        check("Bonus view: same figures (13 of 20, 7 more, 13 verified, 2 pending)", /13\s*of\s*20\s*memberships/.test(bt) && /7 more for your next \$500/.test(bt) && /Verified this bonus month\s*13/.test(bt) && /Pending review \(not counted yet\)\s*2/.test(bt), bt);
        check("Bonus view: milestones every 5 with 5/10 reached", (await page.locator("[data-bonus-milestones] li[data-reached=true]").count()) === 2 && (await page.locator("[data-bonus-milestones] li").count()) === 4);
        check("Bonus view: counted sales list of 13", (await page.locator("[data-counted] li").count()) === 13);
        check("Bonus view: no colleague comparison", !/Ben Ortiz|leaderboard|rank/i.test(bt));
      }
      let ov = await overflow(page);
      check(`Bonus ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `bonus-${size.tag}.png`);
      if (size.width === 390) {
        await go(page, "/admin/sales-earnings?tab=sales", "[data-sales-list]");
        const st = await page.locator("[data-sale=s1]").innerText();
        check("Sales: verified sale with price, discount + source, paid excl. tax, commission and refund", /Verified payment/.test(st) && /Regular price\s*\$149\.00/.test(st) && /Welcome offer: 20% off the first month/.test(st) && /Paid, excluding tax\s*\$119\.20/.test(st) && /Your commission\s*\$59\.60/.test(st) && /Refund \$64\.78/.test(st) && /Nothing is deducted automatically/.test(st), st);
      }
      await go(page, "/admin/sales-earnings?tab=statements&week=2026-11-13", "[data-statement='2026-11-13']");
      const sd = await page.locator("[role=dialog][data-sheet=sales-statement]").innerText();
      if (size.width === 390) {
        check("Statements: the late line is labelled Late: paid <date>", /Late: paid Nov 5, 2026/.test(sd) && (await page.locator("[data-entry=en2][data-late=true]").count()) === 1, sd);
        check("Statements: Fri–Thu week and payday", /Fri, Nov 13 – Thu, Nov 19/.test(sd) && /Payday Fri, Nov 20/.test(sd), sd);
        check("Statements: total = its lines ($59.60 + $149.00 = $208.60) and the annual line follows the rule", /Total\s*\$208\.60/.test(sd) && /Annual Basic: one month's regular price, \$149\.00/.test(sd), sd);
        const dl = page.waitForEvent("download");
        await page.locator("[data-statement-csv]").click();
        const file = await dl;
        check("Statements: CSV downloads through an authenticated fetch", file.suggestedFilename() === "statement-2026-11-13.csv" && server.s.calls.some((c) => c.p === "/api/sales/statements/2026-11-13/csv"), file.suggestedFilename());
      }
      ov = await overflow(page);
      check(`Statements ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `statements-${size.tag}.png`);
      track(o);
      await o.ctx.close();
    }

    /* 7. Owner: Team row shows the same bonus figures */
    for (const size of sizes) {
      const o = await open(browser, OWNER, size);
      const { page } = o;
      await go(page, "/admin/sales-desk?tab=team", "[data-queues]");
      const row = await page.locator(`[data-team-${size.width === 390 ? "cards" : "table"}] [data-team-bonus=t-ana]`).innerText();
      {
        const ov = await overflow(page);
        check(`Team ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
        if (size.width === 1440) check("Team 1440: the KPI table fits without its own sideways scroll", await page.locator("[data-team-table]").evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        await shot(page, `owner-team-${size.tag}.png`);
      }
      check(`Team ${size.tag}: Ana's bonus is 13 of 20 · 7 to $500, 13 verified · 2 pending (same as her view)`, /13 of 20 · 7 to \$500/.test(row) && /13 verified · 2 pending/.test(row), row);
      if (size.width === 1440) {
        check("Team: KPI definitions are available as info tips", (await page.locator("[data-team-table] [data-info-tip]").count()) >= 10);
        await page.locator("[data-team-table] [data-info-tip='Pending claims']").click();
        check("Team: an info tip shows the server's definition", /Never earnings/.test(await page.locator("[role=tooltip]").innerText()));
        await page.keyboard.press("Escape");
        check("Team: queues are shown", /Unassigned leads/.test(await page.locator("[data-queues]").innerText()));
      }
      if (size.width === 1440) {
        await page.locator("[data-team-table] tr[data-team-row=t-ana]").click();
        await page.locator("[data-desk-employee=t-ana]").waitFor();
        const eb = await page.locator("[data-employee-bonus]").innerText();
        check("Employee detail: bonus panel matches (13 of 20, 7 more for the next $500)", /13\s*of\s*20\s*memberships/.test(eb) && /7 more for the next \$500/.test(eb), eb);
        await page.fill("input[name=goal-memberships]", "6");
        await page.fill("textarea[name=goal-note]", "Great week, keep calling within the hour.");
        await page.locator("[data-goals-save]").click();
        await page.locator("text=Goals saved.").waitFor();
        check("Goals: PUT with weeklyMemberships, weeklyFreeVisits and the coaching note", o.server.s.goals && o.server.s.goals.weeklyMemberships === 6 && o.server.s.goals.weeklyFreeVisits === 8 && /keep calling/.test(o.server.s.goals.note), JSON.stringify(o.server.s.goals));
      }
      track(o);
      await o.ctx.close();
    }

    /* 8. Owner: reassignment forces a credit choice; 409 path; intake approve */
    for (const size of sizes) {
      const o = await open(browser, OWNER, size);
      const { page, server } = o;
      await go(page, "/admin/sales-desk?tab=leads&view=assigned&lead=L4", "[data-desk-lead-detail=L4]");
      const dlg = page.locator("[role=dialog][data-sheet=desk-lead]");
      if (size.width === 390) check("Owner lead: full phone and current credit holder", /\(631\) 555-0144/.test(await dlg.innerText()) && /Ana Torres/.test(await dlg.locator("[data-credit-holder]").innerText()));
      await dlg.locator("[data-assign-open]").click();
      await dlg.locator("[data-assign-step]").waitFor();
      await dlg.locator("select[name=assign-employee]").selectOption("t-ben");
      const holder = await dlg.locator("[data-current-credit-holder]").innerText();
      check(`${size.tag}: reassign shows who holds credit now`, /Sales credit is with Ana Torres now/.test(holder), holder);
      await dlg.locator("input[name=assign-reason]").fill("Ana is on vacation");
      check(`${size.tag}: Reassign is disabled until keep/move is chosen`, await dlg.locator("[data-assign-submit]").isDisabled());
      const ov = await overflow(page);
      check(`Owner lead + reassign ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `owner-lead-reassign-${size.tag}.png`);
      await dlg.locator("[data-credit-decision=keep_previous]").check();
      await dlg.locator("[data-assign-submit]").click();
      await page.locator("text=Reassigned to Ben Ortiz.").waitFor();
      const a = server.s.assignments.at(-1);
      check(`${size.tag}: reassign sends employee, reason and creditDecision keep_previous`, a && a.employeeId === "t-ben" && a.creditDecision === "keep_previous" && a.reason === "Ana is on vacation", JSON.stringify(a));
      if (size.width === 390) {
        // L5 looks unassigned in the list, but the server assigned it to Ana meanwhile.
        await go(page, "/admin/sales-desk?tab=leads&view=unassigned&lead=L5", "[data-desk-lead-detail=L5]");
        server.s.leads.L5.assignee = "t-ana";
        server.s.leads.L5.credit = "t-ana";
        await dlg.locator("[data-assign-open]").click();
        await dlg.locator("select[name=assign-employee]").selectOption("t-ben");
        check("409 path: with no known assignment, Assign can be sent without a credit choice", !(await dlg.locator("[data-assign-submit]").isDisabled()) && (await dlg.locator("[data-credit-choice]").count()) === 0);
        await dlg.locator("[data-assign-submit]").click();
        await dlg.locator("[data-sales-error=CREDIT_DECISION_REQUIRED]").waitFor();
        const h = await dlg.locator("[data-current-credit-holder]").innerText();
        check("409 path: the server's credit holder comes back and a choice is required", /Ana Torres/.test(h) && (await dlg.locator("[data-assign-submit]").isDisabled()) && server.s.assignments.at(-1).creditDecision === undefined, h);
        await dlg.locator("[data-credit-decision=new_assignee]").check();
        await dlg.locator("input[name=assign-reason]").fill("Ben takes Melville");
        await dlg.locator("[data-assign-submit]").click();
        await page.locator("text=Reassigned to Ben Ortiz.").waitFor();
        check("409 path: second send with new_assignee succeeds", server.s.assignments.at(-1).creditDecision === "new_assignee" && server.s.leads.L5.credit === "t-ben");
        await go(page, "/admin/sales-desk?tab=leads&view=intake&lead=I1", "[data-intake-decision]");
        await dlg.locator("select[name=intake-assign]").selectOption("t-ben");
        await dlg.locator("input[name=intake-reason]").fill("Good lead");
        await dlg.locator("[data-intake-approve]").click();
        await page.locator("text=Lead approved.").waitFor();
        check("Intake: approve sends {approve:true, reason, assignTo}", server.s.calls.some((c) => c.p === "/api/admin/sales-desk/intake/I1/decide" && c.body.approve === true && c.body.assignTo === "t-ben" && c.body.reason === "Good lead"));
        await go(page, "/admin/sales-desk?tab=leads&view=assigned&lead=L2", "[data-desk-lead-detail=L2]");
        await dlg.locator("[data-lift-open]").click();
        await dlg.locator("textarea[name=lift-reason]").fill("Customer emailed on Nov 12 asking us to call again");
        check("Lift do-not-contact: blocked until LIFT is typed", await dlg.locator("[data-lift-submit]").isDisabled());
        await dlg.locator("input[name=lift-typed]").fill("LIFT");
        await dlg.locator("[data-lift-submit]").click();
        await page.locator("text=Do-not-contact lifted.").waitFor();
        check("Lift do-not-contact: phone, channel and reason sent", server.s.lifted && server.s.lifted.phone === "+16315550122" && server.s.lifted.channel === "all" && /emailed/.test(server.s.lifted.reason));
        await go(page, "/admin/sales-desk?tab=leads&view=unassigned", "[data-desk-lead-list=unassigned]");
        await page.locator("[data-bulk-pick=L3]").check();
        await page.locator("select[name=bulk-employee]").selectOption("t-ana");
        await page.locator("[data-bulk-submit]").click();
        await page.locator("text=1 assigned").waitFor();
        check("Bulk assign: POST /leads/bulk-assign with the picked lead", server.s.calls.some((c) => c.p === "/api/admin/sales-desk/leads/bulk-assign" && c.body.leadIds.join() === "L3" && c.body.employeeId === "t-ana"));
      }
      track(o);
      await o.ctx.close();
    }

    /* 9. Owner: approve a plan-change credit request (bonus choice required) */
    for (const size of sizes) {
      const o = await open(browser, OWNER, size);
      const { page, server } = o;
      await go(page, "/admin/sales-desk?tab=reviews&request=R1", "[data-request-detail=R1]");
      const dlg = page.locator("[role=dialog][data-sheet=desk-request]");
      const t = await dlg.innerText();
      if (size.width === 390) check("Review: verified identity, discount source, history, proposed amount and bonus effect", /Verified: the customer's own Stripe customer/.test(t) && /Discount source\s*None/.test(t) && /Previous commissions/.test(t) && /\$40\.00/.test(t) && /only if you choose so/.test(t), t.slice(0, 600));
      await dlg.locator("[role=group][aria-label=Decision] button", { hasText: "Approve" }).click();
      await dlg.locator("input[name=decide-amount]").fill("40");
      await dlg.locator("textarea[name=decide-reason]").fill("GHL calls confirm the upgrade conversation");
      check(`${size.tag}: plan change: Approve stays disabled until counts-for-bonus is chosen`, await page.locator("[data-decide-submit]").isDisabled());
      const ov = await overflow(page);
      check(`Owner review ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await dlg.locator("[data-decision]").scrollIntoViewIfNeeded();
      await shot(page, `owner-review-${size.tag}.png`);
      if (size.width === 390) {
        const dl = page.waitForEvent("download");
        await dlg.locator("[data-evidence-file=ev1]").click();
        const f = await dl;
        check("Review: evidence file downloads via authenticated fetch", f.suggestedFilename() === "call-log.pdf" && server.s.calls.some((c) => c.p === "/api/admin/sales-desk/credit-requests/R1/files/ev1"));
      }
      await dlg.locator("[data-counts-for-bonus=no]").check();
      check(`${size.tag}: the button states the amount`, /Approve \$40\.00/.test(await page.locator("[data-decide-submit]").innerText()));
      await page.locator("[data-decide-submit]").click();
      await page.locator("text=Approved: the commission").waitFor();
      check(`${size.tag}: decide sends approved, 4000 cents, countsForBonus false and the reason`, server.s.decided && server.s.decided.action === "approved" && server.s.decided.amountCents === 4000 && server.s.decided.countsForBonus === false && /GHL calls/.test(server.s.decided.reason), JSON.stringify(server.s.decided));
      if (size.width === 390) {
        await go(page, "/admin/sales-desk?tab=reviews&review=V1", "[data-review-detail=V1]");
        const rv = page.locator("[role=dialog][data-sheet=desk-review]");
        check("Refund review: shows the touched commission and 'nothing deducted automatically'", /Ana Torres: \$59\.60/.test(await rv.innerText()) && /Nothing is deducted automatically/.test(await rv.innerText()));
        await rv.locator("button", { hasText: "Adjustment" }).click();
        await rv.locator("select[name=review-employee]").selectOption("t-ana");
        await rv.locator("input[name=review-amount]").fill("-29.80");
        await rv.locator("textarea[name=review-reason]").fill("Half the payment was refunded, so half the commission comes back");
        await page.locator("[data-review-submit]").click();
        await page.locator("text=Review resolved.").waitFor();
        check("Refund review: adjustment sends action adjust, −2980 cents, employee and reason", server.s.resolved && server.s.resolved.action === "adjust" && server.s.resolved.amountCents === -2980 && server.s.resolved.employeeId === "t-ana");
        await go(page, "/admin/sales-desk?tab=commissions", "[data-commission-list]");
        await page.locator("[data-adjust-open]").click();
        await page.locator("select[name=adjust-employee]").selectOption("t-ben");
        await page.fill("input[name=adjust-amount]", "25");
        await page.fill("textarea[name=adjust-reason]", "Spiff for the Saturday shift");
        await page.locator("[data-adjust-submit]").click();
        await page.locator("text=Adjustment added").waitFor();
        const adj = server.s.lastAdjustment;
        check("Adjustment: idempotencyKey in the body (never a header), 2500 cents", adj && /^[A-Za-z0-9_-]{8,80}$/.test(adj.idempotencyKey) && adj.amountCents === 2500 && adj.employeeId === "t-ben");
      }
      track(o);
      await o.ctx.close();
    }

    /* 10. Owner: payout week approve + record payment + CSV */
    for (const size of sizes) {
      const o = await open(browser, OWNER, size);
      const { page, server } = o;
      await go(page, "/admin/sales-desk?tab=payouts&week=2026-11-06", "[data-payout='2026-11-06']");
      const dlg = page.locator("[role=dialog][data-sheet=desk-payout]");
      check(`${size.tag}: ready week shows Approve, lines per employee`, (await dlg.locator("[data-approve-open]").count()) === 1 && (await dlg.locator("[data-payout-line]").count()) === 2);
      {
        const ana = await dlg.locator("[data-payout-line=t-ana]").innerText();
        const ben = await dlg.locator("[data-payout-line=t-ben]").innerText();
        check(`${size.tag}: payout lines equal their entries (Ana $759.90 in 11 lines, Ben one Full Day $100.00)`, /\$759\.90/.test(ana) && /11 lines/.test(ana) && /\$100\.00/.test(ben) && /· 1 line$/.test(ben), `${ana} | ${ben}`);
      }
      let ov = await overflow(page);
      check(`Payout week ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `owner-payout-week-${size.tag}.png`);
      await dlg.locator("[data-approve-open]").click();
      const ap = await dlg.locator("[data-approve-step]").innerText();
      check(`${size.tag}: approve explains it freezes the statement and pays nobody`, /freezes these statements/.test(ap) && /does not pay anyone/.test(ap) && /\$859\.90 for 2 employees/.test(ap), ap);
      await dlg.locator("[data-approve-confirm]").click();
      await dlg.locator("[data-payout-status=approved]").waitFor();
      check(`${size.tag}: POST /approve, then Record payment per line`, server.s.calls.some((c) => c.p === "/api/admin/sales-desk/payouts/2026-11-06/approve") && (await dlg.locator("[data-record-payment]").count()) === 2);
      await dlg.locator("[data-record-payment=t-ana]").click();
      check(`${size.tag}: payment step says Profixter does not move money`, /Profixter does not send money/.test(await dlg.locator("[data-pay-step=t-ana]").innerText()));
      await dlg.locator("input[name=paid-on]").fill("2026-11-13");
      await dlg.locator("input[name=paid-method]").fill("Payroll");
      await dlg.locator("input[name=paid-reference]").fill("ADP-7781");
      await dlg.locator("[data-pay-submit]").click();
      await dlg.locator("[data-payout-line=t-ana][data-paid=true]").waitFor();
      check(`${size.tag}: record payment sends paidOn, method, reference`, server.s.paid && server.s.paid.paidOn === "2026-11-13" && server.s.paid.method === "Payroll" && server.s.paid.reference === "ADP-7781");
      if (size.width === 1440) {
        const dl = page.waitForEvent("download");
        await dlg.locator("[data-payout-csv]").click();
        check("Payout CSV for an approved week downloads", (await dl).suggestedFilename() === "payout-2026-11-06.csv");
        await shot(page, "owner-payout-week-approved-1440x900.png");
      }
      ov = await overflow(page);
      check(`Payout approved ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      track(o);
      await o.ctx.close();
    }

    /* 10b. Self-referral flags, home address, ledger check */
    for (const size of sizes) {
      const o = await open(browser, OWNER, size);
      const { page, server } = o;
      // A household-flagged hold: the signal is shown, and the owner can still credit it.
      await go(page, "/admin/sales-desk?tab=reviews&review=V3", "[data-review-detail=V3]");
      const rv = page.locator("[role=dialog][data-sheet=desk-review]");
      const rt = await rv.locator("[data-self-referral]").innerText();
      check(`${size.tag}: hold review shows the self-referral signal as a flag, not a verdict`, /Possible household member/.test(rt) && /home address/.test(rt) && /can be a genuine customer/.test(rt) && /Nothing was refused automatically/.test(rt), rt);
      let ov = await overflow(page);
      check(`Self-referral review ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `owner-self-referral-hold-${size.tag}.png`);
      if (size.width === 390) {
        await rv.locator("[data-hold-claimant=t-ben]").check();
        await rv.locator("textarea[name=review-reason]").fill("His sister, separate budget; genuine sale");
        await page.locator("[data-review-submit]").click();
        await page.locator("text=Review resolved.").waitFor();
        check("Self-referral hold: the owner credits the household member (decision credit, Ben, reason)", server.s.resolved && server.s.resolved.decision === "credit" && server.s.resolved.employeeId === "t-ben" && /genuine/.test(server.s.resolved.reason), JSON.stringify(server.s.resolved));
      }
      // A flagged credit request: approve stays disabled until the owner confirms the check.
      server.s.flagR1 = true;
      await go(page, "/admin/sales-desk?tab=reviews&request=R1", "[data-request-detail=R1]");
      const dlg = page.locator("[role=dialog][data-sheet=desk-request]");
      await dlg.locator("[data-self-referral]").waitFor();
      check(`${size.tag}: flagged request shows the signal above the claim`, /The customer's email is the employee's own email/.test(await dlg.locator("[data-self-referral]").innerText()) && /May be the employee/.test(await dlg.locator("[data-self-referral]").innerText()));
      await dlg.locator("[role=group][aria-label=Decision] button", { hasText: "Approve" }).click();
      await dlg.locator("textarea[name=decide-reason]").fill("Checked: her aunt's account");
      await dlg.locator("[data-counts-for-bonus=no]").check();
      check(`${size.tag}: Approve disabled until 'I checked the self-referral signals' is ticked`, await page.locator("[data-decide-submit]").isDisabled());
      await dlg.locator("[data-self-referral-confirm] input").check();
      check(`${size.tag}: ticking it enables Approve`, !(await page.locator("[data-decide-submit]").isDisabled()));
      await dlg.locator("[data-self-referral-confirm]").scrollIntoViewIfNeeded();
      ov = await overflow(page);
      check(`Flagged request ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `owner-self-referral-request-${size.tag}.png`);
      await page.locator("[data-decide-submit]").click();
      await page.locator("text=Approved: the commission").waitFor();
      check(`${size.tag}: decide sends selfReferralCleared true`, server.s.decided && server.s.decided.selfReferralCleared === true, JSON.stringify(server.s.decided));
      server.s.flagR1 = false;
      if (size.width === 390) {
        // Intake: flagged lead is listed with a badge and still approvable.
        await go(page, "/admin/sales-desk?tab=leads&view=intake", "[data-intake-flag]");
        await go(page, "/admin/sales-desk?tab=leads&view=intake&lead=I1", "[data-intake-decision]");
        const n = await page.locator("[data-intake-flags]").innerText();
        check("Intake: the employee's own number is flagged, with 'you can still approve it'", /this phone number is the employee's own/.test(n) && /you can still approve it/.test(n) && (await page.locator("[data-intake-approve]").isEnabled()), n);
        // Home address (owner only), on the employee detail.
        await go(page, "/admin/sales-desk?employee=t-ana", "[data-home-address-form]");
        await page.fill("input[name=home-line1]", "12 Oak Street");
        await page.fill("input[name=home-unit]", "3");
        await page.fill("input[name=home-city]", "Huntington");
        await page.fill("input[name=home-zip]", "11743");
        await page.locator("[data-home-address-save]").click();
        await page.locator("text=Home address saved.").waitFor();
        check("Home address: PUT with street, unit, town and ZIP", server.s.homeAddress && server.s.homeAddress.line1 === "12 Oak Street" && server.s.homeAddress.unit === "3" && server.s.homeAddress.zip === "11743", JSON.stringify(server.s.homeAddress));
        await page.locator("[data-home-address-form]").scrollIntoViewIfNeeded();
        await shot(page, "owner-home-address-390x844.png");
      }
      // Ledger check on the payouts tab: passed, then a problem.
      await go(page, "/admin/sales-desk?tab=payouts", "[data-ledger-check=ok]");
      check(`${size.tag}: payouts show the ledger check passed`, /Ledger check passed/.test(await page.locator("[data-ledger-check=ok]").innerText()));
      server.s.integrityBad = true;
      await page.reload();
      await page.locator("[data-sales-error=ledger_check]").waitFor();
      check(`${size.tag}: a ledger problem is shown and says not to record payments`, /Do not record payments until it is fixed/.test(await page.locator("[data-sales-error=ledger_check]").innerText()));
      await shot(page, `owner-ledger-check-problem-${size.tag}.png`);
      server.s.integrityBad = false;
      track(o);
      await o.ctx.close();
    }

    /* 11. GHL panel */
    for (const size of sizes) {
      const o = await open(browser, OWNER, size);
      const { page, server } = o;
      await go(page, "/admin/sales-desk?tab=ghl", "[data-desk-tab=ghl] [data-ghl-counts]");
      const t = await page.locator("[data-desk-tab=ghl]").innerText();
      check(`GHL ${size.tag}: prominent Live verification pending`, (await page.locator("[data-ghl-live=pending]").count()) === 1 && /Live verification pending/.test(t));
      if (size.width === 390) {
        check("GHL: enabled / signature key / location, failures and unmapped contacts", /Sync enabled\s*No/.test(t) && /Signature key configured\s*Yes/.test(t) && /contact lookup timed out/.test(t) && /zzzYYY987654/.test(t), t);
        await page.locator("[data-ghl-retry=g1]").click();
        await page.locator("text=Retried: processed.").waitFor();
        check("GHL: Retry posts for the failed event", server.s.retried === "g1");
      }
      const ov = await overflow(page);
      check(`GHL ${size.tag}: no horizontal overflow`, !ov.scroll && !ov.bad.length, JSON.stringify(ov));
      await shot(page, `owner-ghl-${size.tag}.png`);
      track(o);
      await o.ctx.close();
    }

    /* 12. Team editor: the Telemarketer role */
    {
      const o = await open(browser, OWNER, { width: 1440, height: 900 });
      const { page, server } = o;
      await go(page, "/admin/team", "[data-team]");
      await page.getByRole("button", { name: "Add employee" }).first().click();
      await page.locator("[data-role=Telemarketer]").click();
      check("Team editor: Telemarketer hides the Admin section switches", (await page.locator("[data-sealed-access]").count()) === 1 && (await page.locator("[role=dialog] [role=switch]").count()) === 0);
      const phoneLabel = await page.locator("[role=dialog] label", { hasText: "Phone" }).first().innerText();
      check("Team editor: phone is optional for a Telemarketer", /optional/.test(phoneLabel), phoneLabel);
      const inputs = page.locator("[role=dialog] form input");
      await inputs.nth(0).fill("Tess");
      await inputs.nth(1).fill("Caller");
      await inputs.nth(2).fill("tess@example.test");
      await page.getByRole("button", { name: "Save employee" }).click();
      await page.locator("text=temporary password").waitFor();
      const posted = server.s.posted.fixters[0];
      check("Team editor: saves employeePosition Telemarketer with no sections and no phone", posted && posted.employeePosition === "Telemarketer" && posted.adminSections.length === 0 && !posted.phone, JSON.stringify(posted));
      check("Team editor: the list says sales workspace only", /Telemarketer · sales workspace only/.test(await page.locator("[data-team]").innerText()));
      track(o);
      await o.ctx.close();
    }
  } catch (error) {
    check("suite ran to the end", false, error.stack || String(error));
  } finally {
    await browser.close();
  }
  check("no outside requests (full jail), no idempotency header, every API call authenticated", allExternal.length === 0, allExternal.slice(0, 8).join(" | "));
  check("no page errors", allErrors.length === 0, allErrors.slice(0, 5).join(" | "));
  const failedCount = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failedCount}/${results.length} passed`);
  process.exit(failedCount ? 1 : 0);
})();
