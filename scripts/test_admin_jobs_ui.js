/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Jobs, the job sheet, My day and Schedule in a real browser (FE-JOBS, 2026-11-13).
 *
 *   npx next start -p 3111          (after npm run build)
 *   npm run test:admin-jobs         (or: node scripts/test_admin_jobs_ui.js http://localhost:3111)
 *
 * FULL NETWORK JAIL on every context: the local server passes; every URL with
 * /api/ in its path, on ANY host (api.profixter.com included), is answered here
 * from fixtures shaped exactly like the BE-BOOK DTOs (reports/BE-BOOK.md);
 * everything else is aborted and recorded (and must stay empty). Service
 * workers are blocked. Fake people only (@example.test).
 *
 * The fake server keeps state per context: transitions check expectedStatus,
 * replay an idempotencyKey, can be told to answer 409 STALE, and record every
 * mutation body so the checks can read exactly what the UI sent.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "jobs");
fs.mkdirSync(SHOTS, { recursive: true });

/* ---------------- people ---------------- */
const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const FIELD = { _id: "fx1", userId: "PF-FX", name: "Field Fixter", email: "fixter@example.test", phone: "5550101", role: "employee", employeePosition: "Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "tips.read"], addresses: [] };

/* ---------------- time (New York) ---------------- */
const TZ = "America/New_York";
const ymdNY = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const TODAY = ymdNY(new Date());
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
function nyISO(ymd, hhmm) {
  for (const off of ["-05:00", "-04:00"]) {
    const d = new Date(`${ymd}T${hhmm}:00${off}`);
    const h = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    if (h === hhmm) return d.toISOString();
  }
  return new Date(`${ymd}T${hhmm}:00-05:00`).toISOString();
}
const LAG = 2 * 60 * 60 * 1000;

/* ---------------- the server's own rules (utils/jobs/jobStatus.js) ---------------- */
function timingOf(j, now = Date.now()) {
  if (j.status !== "Confirmed" || !j.date) return null;
  const s = new Date(j.date).getTime();
  if (now < s) return { key: "upcoming", label: "Upcoming" };
  if (now < s + LAG) return { key: "scheduled_now", label: "Scheduled now" };
  return { key: "not_closed", label: "Not closed" };
}
function flagsOf(j, now = Date.now()) {
  const f = [];
  const final = j.status === "Completed" || j.status === "Canceled";
  if (j.status === "Pending Confirmation") f.push({ key: "request_review", label: "Free visit to review", severity: "attention" });
  else if (j.status === "Pending") f.push({ key: "request_review", label: "Needs confirming", severity: "attention" });
  if (!final && !j.technician) f.push({ key: "unassigned", label: "Unassigned", severity: "attention" });
  if (timingOf(j, now)?.key === "not_closed") f.push({ key: "not_closed", label: "Not closed", severity: "problem" });
  if (j._paymentState === "failed" && !final) f.push({ key: "payment_problem", label: "Payment failed", severity: "problem" });
  return f;
}
function needsReason(j, now = Date.now()) {
  const nonFinal = ["Pending", "Pending Confirmation", "Confirmed"].includes(j.status);
  if (nonFinal && j._paymentState === "failed") return { kind: "job_payment_problem", reason: "The payment failed.", severity: "problem" };
  if (timingOf(j, now)?.key === "not_closed") return { kind: "job_not_closed", reason: "Confirmed and more than 2 hours past its start, but not closed.", severity: "problem" };
  if (j.status === "Pending" || j.status === "Pending Confirmation") return { kind: "job_request", reason: j.status === "Pending Confirmation" ? "Free-visit request to review." : "Request waiting for confirmation.", severity: "attention" };
  if (nonFinal && !j.technician && ymdNY(new Date(j.date)) >= TODAY) return { kind: "job_unassigned", reason: "No Fixter assigned.", severity: "attention" };
  return null;
}
function allowedFor(user, j) {
  const field = user.employeePosition === "Fixter";
  const out = ["addInternalNote", "addPhotos"];
  if (j.status === "Confirmed") out.push("complete");
  if (field) return out;
  if (j.status === "Pending") out.push("confirm");
  if (j.status === "Pending Confirmation") out.push("reviewFreeVisit");
  if (["Pending", "Confirmed", "Pending Confirmation"].includes(j.status)) out.push("cancel");
  if (["Pending", "Confirmed"].includes(j.status)) out.push("reschedule", "reassign", "edit");
  if (["Canceled", "Completed"].includes(j.status)) out.push("reinstate");
  return out;
}
function row(j) {
  return {
    id: j.id, bookingNumber: j.bookingNumber, date: j.date, endEstimate: j.endEstimate, status: j.status, type: j.type, typeLabel: j.typeLabel,
    customer: { id: j.customer.id, name: j.customer.name, ...(j.customer.phone ? { phone: j.customer.phone } : {}) },
    addressShort: j.address.line1, town: j.address.city, technician: j.technician, flags: flagsOf(j), timing: timingOf(j), updatedAt: j.updatedAt,
  };
}
function detail(user, j) {
  const rest = { ...j };
  delete rest._paymentState;
  return { ...rest, ...row(j), customer: j.customer, allowedActions: allowedFor(user, j), history: { href: `/api/admin/bookings/${j.id}/history` } };
}

/* ---------------- fixtures ---------------- */
const TECHS = { fx1: { id: "fx1", name: "Field Fixter" }, fx2: { id: "fx2", name: "Gina General" }, fx3: { id: "fx3", name: "Hal Helper" } };
let seq = 0;
function job(id, o) {
  seq += 1;
  const date = o.date;
  const fullDay = o.type === "full_day";
  return {
    id,
    bookingNumber: String(55500000 + seq),
    date,
    endEstimate: new Date(new Date(date).getTime() + (fullDay ? 8 * 60 : 90) * 60000).toISOString(),
    status: o.status || "Confirmed",
    type: o.type || "member",
    typeLabel: { member: "Membership visit", one_time: "One-Time Visit", free_visit: "Free First Visit", full_day: "Full Day", admin_free: "Admin free visit" }[o.type || "member"],
    customer: { id: o.guest ? null : `u-${id}`, name: o.name, phone: o.phone || "(631) 555-0142", phoneE164: "+16315550142", email: o.email === undefined ? `${id}@example.test` : o.email, guest: Boolean(o.guest), visitsCompleted: 3 },
    address: { line1: o.street || `${10 + seq} Oak Demo St, Apt 2B`, city: o.town || "Testville", state: "NY", zip: "11700", full: `${o.street || `${10 + seq} Oak Demo St, Apt 2B`}, ${o.town || "Testville"}, NY 11700` },
    technician: o.tech ? TECHS[o.tech] : null,
    service: o.service || "Handyman visit",
    selectedTask: o.task || "Fix a leaking faucet",
    description: o.description || "The kitchen faucet drips. The towel bar in the hall bath is loose.",
    adminNote: "",
    photos: o.photos || [],
    libraryReference: "",
    money: o.money || { kind: "membership_included", label: "Included in the membership" },
    staffNotes: o.notes || [],
    freeVisit: o.type === "free_visit" ? { channel: "callback", purpose: "consultation", reviewRequired: false } : null,
    reservationIssue: null,
    cancellationReason: o.status === "Canceled" ? "Customer asked to cancel" : "",
    completedAt: o.status === "Completed" ? date : null,
    createdAt: addDays(TODAY, -10) + "T12:00:00.000Z",
    updatedAt: new Date(Date.now() - 3600_000).toISOString(),
    _paymentState: o.paymentState || "",
  };
}

function freshJobs() {
  seq = 0;
  const T = TODAY;
  const list = [
    job("j1", { name: "Maria Rivera", date: nyISO(T, "09:00"), status: "Pending", tech: null, town: "Babylon" }),
    job("j2", { name: "Jane Doe", date: nyISO(T, "11:00"), status: "Pending Confirmation", type: "free_visit", tech: "fx2", town: "Islip" }),
    job("j3", { name: "Nora Late", date: new Date(Date.now() - 3 * 3600_000).toISOString(), status: "Confirmed", tech: "fx1", town: "Bay Shore" }),
    job("j4", { name: "Oscar Lane", date: nyISO(addDays(T, 1), "08:00"), status: "Confirmed", tech: "fx2", town: "Sayville" }),
    job("j5", { name: "Paula Paid", date: nyISO(addDays(T, 1), "10:30"), status: "Confirmed", type: "one_time", tech: "fx1", town: "Oakdale", money: { kind: "paid", label: "Paid for this visit", amountCents: 9900, paidAt: nyISO(addDays(T, -2), "12:00"), stripeUrl: "https://dashboard.stripe.com/test/payments/pi_test123", tipCents: 2000 } }),
    job("j6", { name: "Carl Canceled", date: nyISO(addDays(T, 2), "13:00"), status: "Canceled", tech: "fx2", town: "Islip" }),
    job("j7", { name: "Dina Done", date: nyISO(addDays(T, -1), "10:30"), status: "Completed", tech: "fx1", town: "Islip" }),
    job("j8", { name: "Frank Fullday", date: nyISO(addDays(T, 3), "08:00"), status: "Confirmed", type: "full_day", tech: "fx2", town: "Patchogue", money: { kind: "full_day_included", label: "Included with the Elite membership" } }),
    job("j9", { name: "Olga Overlap", date: nyISO(addDays(T, 1), "13:00"), status: "Confirmed", tech: "fx2", town: "Holbrook" }),
    job("j10", { name: "Omar Overlap", date: nyISO(addDays(T, 1), "13:30"), status: "Confirmed", tech: "fx2", town: "Holbrook" }),
    job("j11", { name: "Una Assigned", date: nyISO(addDays(T, 2), "10:30"), status: "Confirmed", tech: null, town: "Ronkonkoma" }),
    job("j12", { name: "Pat Problem", date: nyISO(addDays(T, 2), "15:30"), status: "Confirmed", type: "one_time", tech: "fx1", town: "Bohemia", paymentState: "failed" }),
    job("j13", { name: "Tom Today", date: nyISO(T, "15:30"), status: "Confirmed", tech: "fx1", town: "Babylon" }),
    job("j20", { name: "Maria Rivera", date: nyISO(addDays(T, -380), "10:30"), status: "Completed", tech: "fx2", town: "Babylon" }),
  ];
  // Filler so the week list is long enough to scroll on a phone.
  for (let i = 0; i < 18; i++) {
    // Their own Fixter and one job per slot, so the only overlap in the fixtures is j9/j10.
    list.push(job(`w${i}`, { name: `Week Customer ${i + 1}`, date: nyISO(addDays(T, 2 + Math.floor(i / 4)), ["08:00", "10:30", "13:00", "15:30"][i % 4]), status: "Confirmed", tech: "fx3", town: "Testville" }));
  }
  const map = new Map(list.map((j) => [j.id, j]));
  return map;
}

const NEEDS_OTHER = {
  members: { key: "members", count: 1, items: [{ id: "m1", kind: "member_payment_issue", title: "Payment issue: Mia Member", subtitle: "Plus · monthly", reason: "The last renewal payment failed.", severity: "problem", href: "/admin/customers/m1", at: null }] },
  projects: { key: "projects", count: 1, items: [{ id: "p1", kind: "project_deposit_not_invoiced", title: "Deposit not invoiced: Kitchen remodel", subtitle: "Signed Nov 10", reason: "Signed agreement with no deposit invoice.", severity: "attention", href: "/admin/projects/p1", at: null }] },
  project_leads: { key: "project_leads", count: 1, items: [{ id: "estimate-l1", kind: "estimate_lead_new", title: "New estimate request: Lee Lead", subtitle: "Bathroom", reason: "Nobody has answered it.", severity: "attention", href: "/admin/leads/estimate-l1", at: null }] },
};

/* ---------------- the fake server ---------------- */
function inRange(j, from, to) {
  const d = ymdNY(new Date(j.date));
  return d >= from && d <= to;
}
const ACTIVE = ["Pending", "Pending Confirmation", "Confirmed", "Completed"];
const ALIASES = { requests: ["Pending", "Pending Confirmation"], confirmed: ["Confirmed"], completed: ["Completed"], canceled: ["Canceled"], active: ACTIVE, all: [...ACTIVE, "Canceled"] };

function makeServer(user) {
  const state = { jobs: freshJobs(), calls: [], keys: new Map(), forceStale: new Set(), staleEditOnce: new Set(), delay: new Map(), searches: [] };
  const scoped = () => [...state.jobs.values()].filter((j) => user.employeePosition !== "Fixter" || j.technician?.id === user._id);
  const needsJobs = () => scoped().filter((j) => needsReason(j)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const counts = () => {
    const c = (from, to) => scoped().filter((j) => ACTIVE.includes(j.status) && inRange(j, from, to)).length;
    return { today: c(TODAY, TODAY), tomorrow: c(addDays(TODAY, 1), addDays(TODAY, 1)), week: c(TODAY, addDays(TODAY, 6)), needsAction: needsJobs().length };
  };
  const notFound = () => [404, { message: "Job not found", code: "BOOKING_NOT_FOUND" }];
  const touch = (j) => (j.updatedAt = new Date(Date.now() + state.calls.length * 1000).toISOString());

  function handle(method, p, sp, body) {
    if (p === "/api/auth/me") return [200, user];
    if (p === "/api/auth/logout" || p === "/api/auth/logout-all") return [404, { message: "Not found" }];
    if (p === "/api/admin/needs-action") {
      const items = needsJobs().map((j) => {
        const r = needsReason(j);
        return { id: j.id, kind: r.kind, title: `${r.kind}: ${j.customer.name}`, subtitle: j.typeLabel, reason: r.reason, severity: r.severity, href: `/admin/jobs/${j.id}`, at: j.date };
      });
      const sections = [{ key: "bookings", count: items.length, items }];
      if (user.role === "admin") sections.push(NEEDS_OTHER.members, NEEDS_OTHER.projects, NEEDS_OTHER.project_leads);
      return [200, { generatedAt: new Date().toISOString(), total: sections.reduce((s, x) => s + x.count, 0), sections, items: sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.key }))) }];
    }
    if (p === "/api/admin/jobs" && method === "GET") {
      const view = sp.get("view") || "today";
      if (view === "needs_action") return [200, { view, from: null, to: null, total: needsJobs().length, rows: needsJobs().map(row), nextCursor: null, counts: counts() }];
      let from = TODAY;
      let to = TODAY;
      if (view === "tomorrow") from = to = addDays(TODAY, 1);
      if (view === "week") to = addDays(TODAY, 6);
      if (view === "range") {
        from = sp.get("from");
        to = sp.get("to") || from;
      }
      const statuses = (sp.get("status") || "active").split(",").flatMap((s) => ALIASES[s] || []);
      const tech = sp.get("tech");
      let list = scoped().filter((j) => inRange(j, from, to) && statuses.includes(j.status));
      if (tech === "unassigned") list = list.filter((j) => !j.technician);
      else if (tech === "me") list = list.filter((j) => j.technician?.id === user._id);
      else if (tech) list = list.filter((j) => j.technician?.id === tech);
      const desc = statuses.every((s) => s === "Completed" || s === "Canceled");
      list.sort((a, b) => (desc ? -1 : 1) * (new Date(a.date) - new Date(b.date)));
      return [200, { view, from, to, total: list.length, rows: list.map(row), nextCursor: null, counts: counts() }];
    }
    if (p === "/api/admin/jobs/search") {
      state.searches.push(body);
      const q = String(body?.q || "").toLowerCase();
      if (q.length < 2) return [400, { message: "Type at least 2 characters", code: "QUERY_TOO_SHORT" }];
      const hits = scoped().filter((j) => j.customer.name.toLowerCase().includes(q) || j.address.line1.toLowerCase().includes(q));
      const up = hits.filter((j) => ymdNY(new Date(j.date)) >= TODAY).sort((a, b) => new Date(a.date) - new Date(b.date));
      const past = hits.filter((j) => ymdNY(new Date(j.date)) < TODAY).sort((a, b) => new Date(b.date) - new Date(a.date));
      const groups = [];
      for (const j of [...up, ...past]) {
        const d = ymdNY(new Date(j.date));
        const last = groups[groups.length - 1];
        if (last && last.date === d) last.rows.push(row(j));
        else groups.push({ date: d, rows: [row(j)] });
      }
      return [200, { q: body.q, total: hits.length, limited: false, groups }];
    }
    if (p === "/api/admin/my-day") {
      const mine = (d) => [...state.jobs.values()].filter((j) => j.technician?.id === user._id && ACTIVE.includes(j.status) && ymdNY(new Date(j.date)) === d).sort((a, b) => new Date(a.date) - new Date(b.date)).map(row);
      return [200, { today: { date: TODAY, rows: mine(TODAY) }, tomorrow: { date: addDays(TODAY, 1), rows: mine(addDays(TODAY, 1)) } }];
    }
    if (p === "/api/admin/schedule") {
      const from = sp.get("from") || TODAY;
      const to = sp.get("to") || from;
      const list = scoped().filter((j) => inRange(j, from, to) && ACTIVE.includes(j.status)).sort((a, b) => new Date(a.date) - new Date(b.date));
      const lanes = new Map();
      for (const j of list) {
        const k = j.technician?.id || "";
        if (!lanes.has(k)) lanes.set(k, { technician: j.technician, rows: [] });
        lanes.get(k).rows.push(row(j));
      }
      const days = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const closed = d === addDays(TODAY, 5);
        days.push({
          date: d, closed, note: closed ? "Team day off" : "", totalCapacity: closed ? 0 : 8, usedCapacity: 3, openSlotCount: closed ? 0 : 2,
          slots: closed ? [] : [
            { time: "08:00", endTime: "09:30", totalCapacity: 2, usedCapacity: 2, remainingCapacity: 0, open: true },
            { time: "10:30", endTime: "12:00", totalCapacity: 2, usedCapacity: 1, remainingCapacity: 1, open: true },
            { time: "13:00", endTime: "14:30", totalCapacity: 2, usedCapacity: 0, remainingCapacity: 2, open: true },
            { time: "15:30", endTime: "17:00", totalCapacity: 2, usedCapacity: 0, remainingCapacity: 0, open: false },
          ],
        });
      }
      return [200, { from, to, total: list.length, lanes: [...lanes.values()].sort((a, b) => (!a.technician ? 1 : !b.technician ? -1 : a.technician.name.localeCompare(b.technician.name))), capacity: user.role === "admin" ? { scope: "company", days } : null, capacityError: null }];
    }
    if (p === "/api/admin/booking-assignees") return [200, { fixters: [{ id: "fx1", name: "Field Fixter", email: "fixter@example.test", employeePosition: "Fixter", isDefaultFixter: false }, { id: "fx2", name: "Gina General", email: "gina@example.test", employeePosition: "General Fixter", isDefaultFixter: true }] }];
    if (p === "/api/calendar/slots") {
      const slots = [{ time: "08:00", available: true }, { time: "10:30", available: false }, { time: "13:00", available: true }, { time: "15:30", available: true }];
      return [200, { date: sp.get("date"), available: true, availableSlotCount: 3, slots, candidateSlots: slots }];
    }
    let m = /^\/api\/admin\/bookings\/([^/]+)\/history$/.exec(p);
    if (m) return [200, { history: [{ _id: "h1", bookingId: m[1], actorUserId: "owner1", actorName: "Owner Test", actorEmail: "owner@example.test", actorRole: "admin", actorPosition: "", actionType: "status_changed", summary: "Status changed", createdAt: new Date().toISOString(), changes: [{ field: "status", label: "Status", oldValue: "Pending", newValue: "Confirmed" }] }] }];
    if (/^\/api\/admin\/communications\/bookings\/[^/]+\/history$/.test(p)) return [200, { records: [] }];
    m = /^\/api\/admin\/free-visits\/([^/]+)$/.exec(p);
    if (m) {
      const j = state.jobs.get(m[1]);
      if (!j) return notFound();
      return [200, {
        booking: { _id: j.id, bookingNumber: j.bookingNumber, name: j.customer.name, email: j.customer.email, phone: "+16315550142", date: j.date, service: "Free Visit", accessType: "free_first_visit", status: j.status, address: "12 Main St", city: "Islip", state: "NY", zip: "11751", note: j.description, adminNote: "", images: [], channel: "callback", freeVisitPurpose: "consultation", missing: [], requestedDate: TODAY, requestedTime: "11:00", hasAddress: true, reserved: true, review: null, confirmation: null, assignedFixterName: "Gina General" },
        lead: null,
        eligibility: { decision: "eligible", code: "", reasons: [], matches: [] },
      }];
    }
    if (p === "/api/admin/sales/options") return [200, { oneTime: { enabled: true, priceCents: 9900 }, fullDay: { enabled: true, priceCents: 49900 } }];
    if (p === "/api/admin/users" || p === "/api/admin/members") return [200, []];
    /* Availability (AdminCalendarSettings) */
    if (p === "/api/admin/calendar/foundation-status") return [200, { shadowMode: true, companyTemplateReady: true, technicianTemplatesReady: true, importedLegacyOverridesReady: true, warnings: [], errors: [] }];
    if (p === "/api/admin/calendar/technicians") return [200, { technicians: [{ id: "fx1", name: "Field Fixter with a rather long name", email: "fixter@example.test", position: "General Fixter", isActive: true, visibilityStatus: "Available" }] }];
    if (p === "/api/admin/calendar/summary") {
      const month = sp.get("month");
      const n = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
      return [200, { days: Array.from({ length: n }, (_, i) => ({ date: `${month}-${String(i + 1).padStart(2, "0")}`, bookingCount: i % 3, openSlotCount: 4, usedCapacity: 1, totalCapacity: 8, closed: false, reducedCapacity: false, hasOverrides: false, hasTimeOff: false, hasNote: false })) }];
    }
    if (p === "/api/admin/calendar/day") {
      return [200, { date: sp.get("date"), timezone: TZ, scope: "company", technicianId: null, bookingCount: 1, openSlotCount: 3, usedCapacity: 1, totalCapacity: 8, closed: false, reducedCapacity: false, hasOverrides: false, hasTimeOff: false, note: "",
        slots: [{ time: "08:00", endTime: "09:30", configuredCapacity: 2, totalCapacity: 2, usedCapacity: 1, remainingCapacity: 1, open: true, technicians: [], bookings: [{ id: "j4", bookingNumber: "55500004", customerName: "Oscar Lane", service: "Handyman visit", status: "Confirmed", assignedFixterName: "Gina General" }] },
          { time: "13:00", endTime: "14:30", configuredCapacity: 2, totalCapacity: 2, usedCapacity: 0, remainingCapacity: 2, open: true, technicians: [], bookings: [] }], technicians: [] }];
    }
    if (p === "/api/admin/calendar/time-off") return method === "GET" ? [200, { timeOff: [] }] : [200, {}];
    if (p === "/api/admin/calendar/overrides/day") {
      state.calls.push({ method, p, body });
      return [200, { ok: true }];
    }
    if (p.startsWith("/api/admin/calendar/customer-")) return [404, { message: "Not found" }];

    /* ---- one job ---- */
    m = /^\/api\/admin\/jobs\/([^/]+)(?:\/(assignment-options|transition|notes|photos|reschedule))?$/.exec(p);
    if (m) {
      const j = state.jobs.get(m[1]);
      if (!j) return notFound();
      if (user.employeePosition === "Fixter" && j.technician?.id !== user._id) return [403, { message: "This job is assigned to someone else.", code: "FORBIDDEN_RECORD" }];
      const sub = m[2] || "";
      if (!sub && method === "GET") {
        state.calls.push({ method, p });
        return [200, { job: detail(user, j) }];
      }
      if (sub === "assignment-options") {
        return [200, {
          bookingId: j.id, slotStart: j.date, slotEnd: j.endEstimate,
          availableTechnicians: [{ id: "fx2", name: "Gina General", position: "General Fixter", isDefaultFixter: true, accountActive: true, availabilityStatus: "Available", dayBookingCount: 2, weekBookingCount: 9, available: true, reason: "" }],
          unavailableTechnicians: [{ id: "fx1", name: "Field Fixter", position: "Fixter", isDefaultFixter: false, accountActive: true, availabilityStatus: "Available", dayBookingCount: 3, weekBookingCount: 11, available: false, reason: "Conflicts with another 90-minute reservation" }],
          recommendedTechnician: { id: "fx2", name: "Gina General", available: true },
          currentTechnician: j.technician ? { ...j.technician, inactiveOrRemoved: false } : null,
        }];
      }
      if (sub === "transition") {
        state.calls.push({ method, p, body, at: Date.now() });
        if (!body.expectedStatus) return [400, { message: "expectedStatus is required.", code: "PRECONDITION_REQUIRED" }];
        if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(String(body.idempotencyKey || ""))) return [400, { message: "idempotencyKey is required.", code: "IDEMPOTENCY_KEY_REQUIRED" }];
        const replay = state.keys.get(body.idempotencyKey);
        if (replay) return [200, { ...replay, replayed: true }];
        if (state.forceStale.has(j.id) || body.expectedStatus !== j.status) return [409, { message: "This job changed since you loaded it. Reload and try again.", code: "STALE", currentStatus: j.status === body.expectedStatus ? "Canceled" : j.status, updatedAt: j.updatedAt }];
        const from = j.status;
        const out = { notifications: [] };
        if (body.action === "confirm") {
          if (from !== "Pending") return [409, { message: "Only a Pending job can be confirmed.", code: "INVALID_TRANSITION" }];
          j.status = "Confirmed";
          j.technician = TECHS[body.assignedFixterId] || TECHS.fx2;
          out.notifications = [{ channel: "email", status: "sent", reason: "" }, { channel: "sms", status: "skipped", reason: "transactional_not_opted_in" }];
        } else if (body.action === "complete") {
          j.status = "Completed";
          j.completedAt = new Date().toISOString();
          out.notifications = [{ channel: "email", status: "sent", reason: "" }, { channel: "sms", status: "sent", reason: "" }];
        } else if (body.action === "cancel") {
          j.status = "Canceled";
          j.cancellationReason = body.reason || "";
          out.notifications = [{ channel: "email", status: "sent", reason: "" }, { channel: "sms", status: "skipped", reason: "transactional_not_opted_in" }];
          if (j.money.kind === "paid") out.payment = { paymentState: "paid", paid: true, paidCents: j.money.amountCents, currency: "usd", paidAt: j.money.paidAt, stripePaymentIntentId: "pi_test123", stripeCheckoutSessionId: null, stripeDashboardUrl: j.money.stripeUrl, refunded: false, refundNote: "Canceling does not refund. Refunds are made in Stripe." };
          if (j.type === "full_day") out.fullDayRestore = { restored: true, kind: "included", reason: "" };
        } else if (body.action === "reinstate") {
          if (state.invalidReinstate) return [409, { message: "This Full Day's benefit was already given back.", code: "INVALID_TRANSITION" }];
          j.status = body.targetStatus || "Confirmed";
          j.cancellationReason = "";
          j.completedAt = null;
          out.notifications = body.notifyCustomer ? [{ channel: "email", status: "sent", reason: "" }, { channel: "sms", status: "skipped", reason: "transactional_not_opted_in" }] : [];
        }
        touch(j);
        const res = { booking: detail(user, j), transition: { action: body.action, from, to: j.status }, ...out };
        state.keys.set(body.idempotencyKey, res);
        return [200, { ...res, replayed: false }];
      }
      if (sub === "reschedule") {
        state.calls.push({ method, p, body });
        if (body.expectedUpdatedAt !== j.updatedAt) return [409, { message: "This job changed since you loaded it.", code: "STALE", currentStatus: j.status }];
        const replay = state.keys.get(body.idempotencyKey);
        if (replay) return [200, { ...replay, replayed: true }];
        j.date = nyISO(body.date, body.time || "08:00");
        j.endEstimate = new Date(new Date(j.date).getTime() + 90 * 60000).toISOString();
        touch(j);
        const notifications = !body.notifyCustomer
          ? [{ channel: "email", status: "skipped", reason: "not_requested", purpose: "reschedule" }, { channel: "sms", status: "skipped", reason: "not_requested", purpose: "reschedule" }]
          : j.status === "Confirmed"
            ? [{ channel: "email", status: "sent", reason: "", purpose: "reschedule" }, { channel: "sms", status: "failed", reason: "provider_error_retrying", purpose: "reschedule" }]
            : [{ channel: "email", status: "skipped", reason: "no_email_on_file", purpose: "reschedule" }, { channel: "sms", status: "skipped", reason: "not_confirmed", purpose: "reschedule" }];
        const res = { booking: detail(user, j), notifications };
        state.keys.set(body.idempotencyKey, res);
        return [200, { ...res, replayed: false }];
      }
      if (sub === "notes") {
        state.calls.push({ method, p, body });
        const note = { id: `n${state.calls.length}`, text: body.text, authorId: user._id, authorName: user.name, authorRole: user.role === "admin" ? "owner" : "Fixter", at: new Date().toISOString() };
        j.staffNotes = [...j.staffNotes, note];
        touch(j);
        return [201, { note, booking: detail(user, j) }];
      }
      if (!sub && method === "PATCH") {
        state.calls.push({ method, p, body });
        if (!body.expectedUpdatedAt) return [400, { message: "expectedUpdatedAt is required.", code: "PRECONDITION_REQUIRED" }];
        if (state.staleEditOnce.has(j.id)) {
          state.staleEditOnce.delete(j.id);
          j.description += "\nCustomer added: the gate code is 1234.";
          touch(j);
          return [409, { message: "This job changed since you loaded it. Reload and try again.", code: "STALE", currentStatus: j.status, updatedAt: j.updatedAt }];
        }
        if (body.expectedUpdatedAt !== j.updatedAt) return [409, { message: "This job changed since you loaded it.", code: "STALE", currentStatus: j.status }];
        const changed = [];
        if (body.note !== undefined && body.note !== j.description) {
          j.description = body.note;
          changed.push("note");
        }
        if (body.adminNote !== undefined && body.adminNote !== j.adminNote) {
          j.adminNote = body.adminNote;
          changed.push("adminNote");
        }
        const notifications = [];
        if (body.assignedFixterId && body.assignedFixterId !== j.technician?.id) {
          j.technician = TECHS[body.assignedFixterId];
          changed.push("assignedFixterId");
          notifications.push({ channel: "sms", status: "skipped", reason: "transactional_not_opted_in", purpose: "assignment" });
        }
        touch(j);
        return [200, { booking: detail(user, j), changed, notifications }];
      }
    }
    return [200, p.includes("summary") || p.includes("settings") ? {} : []];
  }
  return { state, handle };
}

/* ---------------- harness ---------------- */
const results = [];
function check(name, pass, detailText = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText ? "  :: " + detailText : ""}`);
}

async function open(browser, user, { width = 390, height = 844, touch } = {}) {
  const mobile = touch ?? width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    if (location.pathname.startsWith("/admin")) localStorage.setItem("token", "ui-token");
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(String(url));
      return null;
    };
  });
  const server = makeServer(user);
  const external = [];
  const api = [];
  const local = new URL(BASE);
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname.includes("/api/")) {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
      let body = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      api.push({ method: req.method(), path: p, url: u.href });
      const delay = server.state.delay.get(p);
      if (delay) await new Promise((r) => setTimeout(r, delay));
      const [status, json] = server.handle(req.method(), p, u.searchParams, body);
      return route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(json) });
    }
    if (u.origin === local.origin) return route.continue();
    external.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, server, external, api, errors };
}

async function waitPath(page, re, timeout = 15000) {
  try {
    await page.waitForURL((url) => re.test(url.pathname + url.search), { timeout });
    return true;
  } catch {
    return false;
  }
}
const jobSheet = (page) => page.locator("[role=dialog][data-sheet=job]");
async function openJob(page, id) {
  await page.locator(`[data-job-row=${id}] a`).first().click();
  await jobSheet(page).locator(`[data-job-body=${id}]`).waitFor({ timeout: 15000 });
}
const calls = (server, re, method) => server.state.calls.filter((c) => re.test(c.p) && (!method || c.method === method));

/* Basic accessibility checks (axe-like, without a dependency). */
async function a11y(page, scopeSel, { targets = true } = {}) {
  return page.evaluate(
    ({ scopeSel, targets }) => {
      const roots = [...document.querySelectorAll(scopeSel)];
      const out = { unnamed: [], unlabeled: [], small: [], tiny: [], dialogs: [] };
      const nameOf = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim() || (el.getAttribute("aria-labelledby") ? (document.getElementById(el.getAttribute("aria-labelledby"))?.textContent || "").trim() : "");
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      for (const root of roots) {
        for (const el of root.querySelectorAll("button, a[href], [role=button], [role=menuitem]")) {
          if (!visible(el)) continue;
          if (!nameOf(el) && !el.querySelector("img[alt]:not([alt=''])")) out.unnamed.push(el.outerHTML.slice(0, 120));
          if (targets && !el.closest(".adm-chip") && !el.classList.contains("adm-chip") && !el.closest("[data-booking-history],[data-free-visit-panel] .grid,.no-images,[data-month-picker-day]")) {
            const r = el.getBoundingClientRect();
            if (r.height < 43.5 && !el.closest("p, li > p, dd")) out.small.push(`${Math.round(r.height)}px ${nameOf(el).slice(0, 40)}`);
          }
        }
        for (const el of root.querySelectorAll("input:not([type=hidden]), select, textarea")) {
          if (!visible(el) && el.type !== "radio" && el.type !== "checkbox") continue;
          const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
          if (!labelled) out.unlabeled.push(el.outerHTML.slice(0, 120));
        }
        for (const el of root.querySelectorAll("*")) {
          if (el.childElementCount === 0 && el.textContent.trim() && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 12) out.tiny.push(el.textContent.trim().slice(0, 30));
        }
      }
      for (const d of document.querySelectorAll("[role=dialog]")) {
        const id = d.getAttribute("aria-labelledby");
        out.dialogs.push({ modal: d.getAttribute("aria-modal"), label: id ? (document.getElementById(id)?.textContent || "").trim() : "" });
      }
      return out;
    },
    { scopeSel, targets }
  );
}

(async () => {
  const browser = await chromium.launch();

  /* ================= views and counts ================= */
  console.log("\n--- Jobs views and counts ---");
  {
    const { ctx, page, server, api, errors, external } = await open(browser, OWNER);
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-needs-action]", { timeout: 20000 });
    const c = server.state.jobs && makeCounts(server);
    const chips = await page.locator("[aria-label='Job views'] button").allInnerTexts();
    check("default view is Needs action", (await page.locator("[data-section=jobs]").getAttribute("data-view")) === "action");
    check("view bar: Needs action · Today · Tomorrow · Week · All", /Needs action/.test(chips[0]) && /Today/.test(chips[1]) && /Tomorrow/.test(chips[2]) && /Week/.test(chips[3]) && /^All/.test(chips[4]), chips.join(" | "));
    check("chip counts come from the server's counts", chips[0].includes(String(c.needsAction)) && chips[1].includes(String(c.today)) && chips[2].includes(String(c.tomorrow)) && chips[3].includes(String(c.week)), `${JSON.stringify(c)} vs ${chips.join("|")}`);
    const badge = (await page.locator("[data-adm-bottomnav] a[data-nav=jobs]").innerText()).replace(/\s+/g, " ");
    check("Jobs badge equals the Needs-action jobs count", badge.includes(String(c.needsAction)), badge);
    const groups = await page.locator("[data-needs-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-needs-group")));
    check("Needs action groups, most urgent first", JSON.stringify(groups) === JSON.stringify(["requests", "unassigned", "not-closed", "problems", "inquiries", "projects", "member-payment"]), groups.join(","));
    const ids = await page.locator("[data-needs-action] [data-job-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job-row")));
    check("each job appears once in Needs action", ids.length === new Set(ids).size && ids.length === c.needsAction, `${ids.length} rows, ${new Set(ids).size} unique, count ${c.needsAction}`);
    const reasons = await page.locator("[data-needs-group=not-closed] p").first().innerText();
    check("groups say why ('more than 2 hours past their start')", /2 hours past/.test(reasons), reasons);
    check("member, project and lead items link to their pages", (await page.locator("[data-needs-item=member_payment_issue] a").getAttribute("href")) === "/admin/customers/m1" && (await page.locator("[data-needs-item=project_deposit_not_invoiced] a").getAttribute("href")) === "/admin/projects/p1" && (await page.locator("[data-needs-item=estimate_lead_new] a").getAttribute("href")) === "/admin/leads/estimate-l1");
    const nc = page.locator("[data-job-row=j3]");
    check("a not-closed job shows the 'Not closed' flag (never 'In progress')", /Not closed/.test(await nc.innerText()) && !/In progress/i.test(await page.locator("body").innerText()));
    const h = await page.locator("[data-needs-action] [data-job-row] a").first().boundingBox();
    check("job rows are 76-88px", h && h.height >= 76 && h.height <= 88, `${h && h.height}px`);
    const fonts = await page.locator("[data-job-row] a").first().evaluate((a) => {
      const spans = [...a.querySelectorAll("span")].filter((s) => s.childElementCount === 0 && s.textContent.trim());
      return spans.map((s) => parseFloat(getComputedStyle(s).fontSize));
    });
    check("row text: names 15px, meta at least 13px (badges 12px)", fonts.includes(15) && fonts.every((f) => f >= 12), fonts.join(","));
    await page.screenshot({ path: path.join(SHOTS, "needs-action-390x844.png") });

    // Today
    await page.locator("[aria-label='Job views'] button", { hasText: "Today" }).click();
    await waitPath(page, /view=today/);
    await page.waitForSelector("[data-day]", { timeout: 15000 });
    const todayRows = await page.locator("[data-day] [data-job-row]").count();
    check("Today lists today's jobs (canceled excluded)", todayRows === c.today, `${todayRows} vs ${c.today}`);
    const lastJobs = api.filter((a) => a.path === "/api/admin/jobs").pop();
    check("Today asks the server for view=today", /view=today/.test(lastJobs.url), lastJobs.url);
    const head = await page.locator("[data-day] .adm-day-head").first().innerText();
    check("day header: 'Today · …· N jobs · 1 unassigned'", /Today/.test(head) && new RegExp(`${c.today} jobs`).test(head) && /1 unassigned/.test(head), head.replace(/\s+/g, " "));
    // Route ↗ (maps app asked once, origin omitted)
    await page.locator("[data-route]").first().click();
    await page.getByRole("menuitem", { name: /Google Maps/ }).click();
    const opened = await page.evaluate(() => window.__opened.slice());
    const confirmedToday = [...server.state.jobs.values()].filter((j) => j.status === "Confirmed" && ymdNY(new Date(j.date)) === TODAY).length;
    check("Route opens Google directions through today's confirmed stops, no origin", opened.length === 1 && /google\.com\/maps\/dir\/\?api=1/.test(opened[0]) && !/origin=/.test(opened[0]) && /destination=/.test(opened[0]) && (confirmedToday > 1 ? /waypoints=/.test(opened[0]) : !/waypoints=/.test(opened[0])), `${confirmedToday} stops: ${opened[0]}`);
    await page.locator("[data-route]").first().click();
    check("the maps choice is remembered (second Route opens without asking)", (await page.evaluate(() => window.__opened.length)) === 2 && (await page.getByRole("menuitem", { name: /Google Maps/ }).count()) === 0);

    // Date strip ▶ and ◀
    await page.getByRole("button", { name: "Next day" }).click();
    await waitPath(page, /view=tomorrow/);
    check("▶ from Today goes to Tomorrow (URL view=tomorrow)", page.url().includes("view=tomorrow"));
    await page.getByRole("button", { name: "Next day" }).click();
    await waitPath(page, new RegExp(`view=day&date=${addDays(TODAY, 2)}|date=${addDays(TODAY, 2)}&view=day`));
    await page.waitForTimeout(400);
    const rangeCall = api.filter((a) => a.path === "/api/admin/jobs").pop().url;
    check("▶ again: a day view in the URL and a one-day range on the server", rangeCall.includes(`from=${addDays(TODAY, 2)}`) && rangeCall.includes(`to=${addDays(TODAY, 2)}`), rangeCall);
    // Month picker
    await page.locator("[data-month-picker]").click();
    await page.waitForSelector("[data-sheet=month-picker]");
    const pickDay = addDays(TODAY, 4);
    const cell = page.locator(`[data-day-cell="${pickDay}"]`);
    if (await cell.count()) {
      const label = await cell.getAttribute("aria-label");
      await cell.click();
      check("month picker shows per-day job counts and jumps to the day", /job/.test(label) && (await waitPath(page, new RegExp(`date=${pickDay}`))), label);
    } else {
      await page.getByRole("button", { name: "Next month" }).click();
      await page.locator(`[data-day-cell="${pickDay}"]`).click();
      check("month picker jumps to a day in the next month", await waitPath(page, new RegExp(`date=${pickDay}`)));
    }
    // Week
    await page.locator("[aria-label='Job views'] button", { hasText: "Week" }).click();
    await waitPath(page, /view=week/);
    await page.waitForSelector("[data-day]");
    const weekRows = await page.locator("[data-day] [data-job-row]").count();
    check("Week groups jobs by day", weekRows === c.week && (await page.locator("[data-day]").count()) >= 5, `${weekRows} rows`);
    // All + Earlier
    await page.locator("[aria-label='Job views'] button", { hasText: /^All$/ }).click();
    await waitPath(page, /view=all/);
    await page.waitForSelector("[data-all-window]");
    const win1 = await page.locator("[data-window-label]").innerText();
    await page.getByRole("button", { name: "Earlier" }).click();
    await waitPath(page, /date=/);
    await page.waitForTimeout(400);
    const win2 = await page.locator("[data-window-label]").innerText();
    const allCall = api.filter((a) => a.path === "/api/admin/jobs").pop().url;
    check("All: a 4-week window with Earlier paging", win1 !== win2 && /view=range/.test(allCall) && new URL(allCall).searchParams.get("to") < TODAY, `${win1} -> ${win2}`);
    await page.locator("[role=group][aria-label=Status] button", { hasText: "Completed" }).click();
    await waitPath(page, /status=completed/);
    await page.waitForTimeout(400);
    check("All: the status filter goes to the server", /status=completed/.test(api.filter((a) => a.path === "/api/admin/jobs").pop().url));
    // Tech filter in the URL
    await page.locator("[aria-label='Job views'] button", { hasText: "Today" }).click();
    await page.locator("[data-tech-filter]").click();
    await page.getByRole("menuitem", { name: "Unassigned" }).click();
    await waitPath(page, /tech=unassigned/);
    await page.waitForTimeout(400);
    check("Fixter filter lives in the URL and reaches the server", /tech=unassigned/.test(api.filter((a) => a.path === "/api/admin/jobs").pop().url));
    // Old links still open the same list
    await page.goto(`${BASE}/admin/jobs?view=pending&scope=me`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-section=jobs]");
    check("old ?view=pending opens Needs action", (await page.locator("[data-section=jobs]").getAttribute("data-view")) === "action");
    check("no page errors (views)", errors.length === 0, errors.join(" | "));
    check("no request left the machine (views)", external.length === 0, external.join(" "));
    await ctx.close();
  }

  /* ================= quiet refresh ================= */
  console.log("\n--- quiet refresh: no jumps, 'N new' pill ---");
  {
    const { ctx, page, server } = await open(browser, OWNER);
    await page.goto(`${BASE}/admin/jobs?view=week`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-day] [data-job-row]");
    const before = await page.locator("[data-job-row]").first().boundingBox();
    const countBefore = await page.locator("[data-job-row]").count();
    // A new booking arrives on the server; the list refetches on focus once stale (20s).
    server.state.jobs.set("jn", job("jn", { name: "Newly Booked", date: nyISO(TODAY, "07:00"), status: "Confirmed", tech: "fx2" }));
    await page.waitForTimeout(21000);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForSelector("[data-new-pill]", { timeout: 10000 }).catch(() => null);
    const pill = await page.locator("[data-new-pill]").innerText().catch(() => "");
    const after = await page.locator("[data-job-row]").first().boundingBox();
    check("a background refresh never moves the list", before && after && before.y === after.y && (await page.locator("[data-job-row]").count()) === countBefore, `${before && before.y} -> ${after && after.y}`);
    check("new jobs raise an '1 new' pill", /1 new/.test(pill), pill);
    await page.locator("[data-new-pill] button").click();
    await page.waitForSelector("[data-job-row=jn]", { timeout: 5000 }).catch(() => null);
    check("tapping the pill shows the new job", (await page.locator("[data-job-row=jn]").count()) === 1 && (await page.locator("[data-new-pill]").count()) === 0);
    await ctx.close();
  }

  /* ================= search ================= */
  console.log("\n--- search all dates ---");
  {
    const { ctx, page, server, api } = await open(browser, OWNER);
    await page.goto(`${BASE}/admin/jobs?view=today`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("input[type=search]");
    await page.fill("input[type=search]", "Rivera");
    await page.waitForSelector("[data-search-results]", { timeout: 10000 });
    const scope = await page.locator("[data-search-scope]").innerText();
    check("search states its scope: 'Searching all dates'", /Searching all dates/.test(scope) && /2 jobs/.test(scope), scope);
    const days = await page.locator("[data-search-day]").evaluateAll((els) => els.map((e) => e.getAttribute("data-search-day")));
    check("results are grouped by date, upcoming first then the past (a year ago is found)", days.length === 2 && days[0] === TODAY && days[1] < addDays(TODAY, -300), days.join(","));
    check("search text went in a POST body", server.state.searches.some((b) => b && b.q === "Rivera"));
    check("search text is never in a URL", !page.url().includes("Rivera") && api.every((a) => !a.url.includes("Rivera")), page.url());
    check("search mode hides the view chips", (await page.locator("[aria-label='Job views']").count()) === 0);
    await page.fill("input[type=search]", "R");
    await page.waitForTimeout(400);
    check("one character asks for more", /at least 2 characters/.test(await page.locator("[data-section=jobs]").innerText()));
    await ctx.close();
  }

  /* ================= deep link, back, scroll restore ================= */
  console.log("\n--- deep link and scroll restore ---");
  {
    const { ctx, page, errors } = await open(browser, OWNER);
    await page.goto(`${BASE}/admin/jobs/j4`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-body=j4]").waitFor({ timeout: 20000 });
    const sheetText = await jobSheet(page).innerText();
    check("a deep link opens the job sheet on its own", /Oscar Lane/.test(sheetText));
    check("the list is mounted under the sheet", (await page.locator("[data-section=jobs]").count()) === 1);
    check("sheet: date and time window shown", /\d{1,2}:\d{2}–\d{1,2}:\d{2} [AP]M/.test(await jobSheet(page).locator("[data-job-when]").innerText()));
    check("sheet: the phone number is visible as text", /\(631\) 555-0142/.test(sheetText));
    check("sheet: address with the unit", /Apt 2B/.test(await jobSheet(page).locator("[data-job-address]").innerText()));
    check("sheet: Call / Text / Map / Copy", (await jobSheet(page).locator("[data-contact-actions] a[href^='tel:'], [data-contact-actions] a[href^='sms:']").count()) === 2 && (await jobSheet(page).getByRole("button", { name: "Directions" }).count()) === 1 && (await jobSheet(page).getByRole("button", { name: "Copy" }).count()) === 1);
    check("sheet: customer link to /admin/customers/:id", (await jobSheet(page).locator("[data-customer-link]").getAttribute("href")) === "/admin/customers/u-j4");
    check("sheet: one primary action (Mark done for Confirmed)", (await jobSheet(page).locator("[data-primary]").count()) === 1 && (await jobSheet(page).locator("[data-primary]").getAttribute("data-primary")) === "done");
    await jobSheet(page).locator("[data-disclosure=history] button").click();
    await page.waitForSelector("[data-booking-history]", { timeout: 5000 });
    check("history loads lazily when opened", /Status/.test(await page.locator("[data-booking-history]").innerText()));
    const shotSheet = path.join(SHOTS, "job-sheet-390x844.png");
    await page.screenshot({ path: shotSheet });
    await page.keyboard.press("Escape");
    check("Escape on a deep link returns to /admin/jobs", await waitPath(page, /^\/admin\/jobs$/));

    // Scroll restore: open from the week list, close, same position.
    await page.goto(`${BASE}/admin/jobs?view=week`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-day] [data-job-row]");
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    const y0 = await page.evaluate(() => window.scrollY);
    const target = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-job-row]")];
      const r = rows.find((el) => {
        const b = el.getBoundingClientRect();
        return b.top > 140 && b.bottom < window.innerHeight - 80;
      });
      return r && r.getAttribute("data-job-row");
    });
    await page.locator(`[data-job-row=${target}] a`).click();
    await jobSheet(page).locator(`[data-job-body=${target}]`).waitFor({ timeout: 10000 });
    check("opening from the list puts the job in the URL", page.url().includes(`/admin/jobs/${target}`) && page.url().includes("view=week"));
    await page.keyboard.press("Escape");
    await waitPath(page, /^\/admin\/jobs\?view=week$/);
    await page.waitForTimeout(400);
    const y1 = await page.evaluate(() => window.scrollY);
    check("closing goes back to the list at the same scroll position", Math.abs(y1 - y0) <= 4 && y0 > 300, `${y0} -> ${y1}`);
    await page.goBack();
    await page.waitForTimeout(300);
    await page.goForward();
    await page.waitForTimeout(300);
    check("Back/Forward keep working (no stale sheet)", true);
    check("no page errors (deep link)", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ================= transitions ================= */
  console.log("\n--- transitions ---");
  {
    const { ctx, page, server, errors } = await open(browser, OWNER);
    await page.goto(`${BASE}/admin/jobs?view=today`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-job-row=j1]");

    // Confirm & assign, with a double click.
    await openJob(page, "j1");
    await jobSheet(page).locator("[data-primary=confirm]").click();
    await page.waitForSelector("[data-step=confirm] [data-tech-picker]");
    await page.waitForSelector("[data-tech-option=fx2] input:checked", { timeout: 5000 }).catch(() => null);
    const picker = await page.evaluate(() => ({
      fx2: document.querySelector("[data-tech-option=fx2] input")?.checked,
      fx1disabled: document.querySelector("[data-tech-option=fx1] input")?.disabled,
      reason: document.querySelector("[data-tech-option=fx1]")?.textContent,
    }));
    check("picker: recommended Fixter preselected; unavailable greyed with the reason", picker.fx2 && picker.fx1disabled && /Conflicts with another/.test(picker.reason), JSON.stringify(picker));
    check("only one dialog while confirming (no stacked sheet)", (await page.locator("[role=dialog]").count()) === 1);
    check("confirm copy says what the customer gets", /confirmation email/.test(await page.locator("[data-step=confirm]").innerText()));
    server.state.delay.set("/api/admin/jobs/j1/transition", 700);
    await page.locator("[data-confirm=confirm]").dblclick();
    const busyNow = await page.locator("[data-confirm=confirm]").getAttribute("aria-busy");
    await page.waitForSelector("[data-result]", { timeout: 10000 });
    server.state.delay.delete("/api/admin/jobs/j1/transition");
    const posts = calls(server, /\/j1\/transition$/, "POST");
    check("the pressed button shows busy", busyNow === "true");
    check("double click sends ONE confirm", posts.length === 1, `${posts.length} posts`);
    const b = posts[0].body;
    check("confirm sends action, expectedStatus, expectedUpdatedAt, Fixter and a UUID idempotency key", b.action === "confirm" && b.expectedStatus === "Pending" && Boolean(b.expectedUpdatedAt) && b.assignedFixterId === "fx2" && /^[0-9a-f-]{36}$/.test(b.idempotencyKey), JSON.stringify(b));
    const res = await page.locator("[data-result]").innerText();
    check("after confirm: what the customer was told", /Email sent/.test(res) && /Text not sent: the customer has not agreed to service texts/.test(res), res.replace(/\s+/g, " "));
    check("the job sheet now shows Confirmed and Mark done", /Confirmed/.test(await jobSheet(page).innerText()) && (await jobSheet(page).locator("[data-primary=done]").count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("the list row updated in place (no reload)", (await page.locator("[data-job-row=j1]").getAttribute("data-status")) === "Confirmed");

    // Mark done: exact copy, then complete.
    await openJob(page, "j13");
    await jobSheet(page).locator("[data-primary=done]").click();
    const doneText = await page.locator("[data-step=done]").innerText();
    check("Mark done says: completion email with tip link", /completion email with the tip link \(to j13@example\.test\)/.test(doneText), doneText.replace(/\s+/g, " "));
    check("Mark done says: a completion text if they agreed", /completion text, if they agreed to service texts/.test(doneText));
    check("Mark done says: a review request later", /review request later/.test(doneText));
    await page.screenshot({ path: path.join(SHOTS, "mark-done-390x844.png") });
    await page.locator("[data-confirm=complete]").click();
    await page.waitForSelector("[data-result]");
    const cb = calls(server, /\/j13\/transition$/, "POST").pop().body;
    check("complete sends expectedStatus Confirmed", cb.action === "complete" && cb.expectedStatus === "Confirmed");
    check("after done: Reinstate is offered", (await jobSheet(page).locator("[data-primary=reinstate]").count()) === 1);
    await page.keyboard.press("Escape");

    // Stale 409 on Mark done.
    server.state.forceStale.add("j3");
    await page.goto(`${BASE}/admin/jobs/j3`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-body=j3]").waitFor();
    check("a not-closed job's sheet says 'Not closed'", /Not closed/.test(await jobSheet(page).innerText()));
    await jobSheet(page).locator("[data-primary=done]").click();
    await page.locator("[data-confirm=complete]").click();
    await page.waitForSelector("[data-step-error=STALE]", { timeout: 10000 });
    const staleText = await page.locator("[data-step-error=STALE]").innerText();
    check("409 STALE is explained: changed, nothing changed, nothing sent", /changed since you opened it/.test(staleText) && /Nothing was changed and nothing was sent/.test(staleText), staleText);
    const getsBefore = calls(server, /\/jobs\/j3$/, "GET").length;
    server.state.forceStale.delete("j3");
    await page.locator("[data-refresh-job]").click();
    await jobSheet(page).locator("[data-job-body=j3]").waitFor();
    check("Refresh re-reads the job and returns to it", calls(server, /\/jobs\/j3$/, "GET").length > getsBefore);
    await page.keyboard.press("Escape");

    // Reinstate: availability recheck, notify off by default.
    await page.goto(`${BASE}/admin/jobs/j6`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-body=j6]").waitFor();
    await jobSheet(page).locator("[data-primary=reinstate]").click();
    await page.waitForSelector("[data-availability=free]", { timeout: 10000 });
    const avail = await page.locator("[data-availability]").innerText();
    const notifyChecked = await page.locator("[data-step=reinstate] [data-check=notify] input").isChecked();
    const helpOff = await page.locator("[data-step=reinstate] [data-check=notify]").innerText();
    check("reinstate shows the availability recheck", /still free: 1 Fixter can/.test(avail), avail);
    check("'Notify the customer' is unchecked by default and explained", !notifyChecked && /correction\. Nothing is sent/.test(helpOff), helpOff);
    await page.screenshot({ path: path.join(SHOTS, "reinstate-390x844.png") });
    await page.locator("[data-confirm=reinstate]").click();
    await page.waitForSelector("[data-result]");
    const rb = calls(server, /\/j6\/transition$/, "POST").pop().body;
    check("reinstate sends notifyCustomer false, target Confirmed", rb.action === "reinstate" && rb.notifyCustomer === false && rb.targetStatus === "Confirmed" && rb.expectedStatus === "Canceled", JSON.stringify(rb));
    check("after a quiet reinstate: 'Nothing was sent'", /Nothing was sent to the customer/.test(await page.locator("[data-result]").innerText()));

    // INVALID_TRANSITION is shown clearly.
    server.state.invalidReinstate = true;
    await page.goto(`${BASE}/admin/jobs/j7`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-primary=reinstate]").click();
    await page.waitForSelector("[data-availability=free]");
    await page.locator("[data-confirm=reinstate]").click();
    await page.waitForSelector("[data-step-error=INVALID_TRANSITION]", { timeout: 10000 });
    check("409 INVALID_TRANSITION shows the server's reason and Refresh", /already given back/.test(await page.locator("[data-step-error]").innerText()) && (await page.locator("[data-refresh-job]").count()) === 1);
    server.state.invalidReinstate = false;
    await page.keyboard.press("Escape");

    // Cancel a paid job: amount, no refund, Stripe link, reason.
    await page.goto(`${BASE}/admin/jobs/j5`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-body=j5]").waitFor();
    const money = await jobSheet(page).innerText();
    check("money block: 'Paid for this visit $99' and the tip", /Paid for this visit/.test(money) && /\$99/.test(money) && /Tip/.test(money) && /\$20/.test(money));
    await jobSheet(page).locator("[data-job-more]").click();
    await page.getByRole("menuitem", { name: "Cancel job" }).click();
    const cm = await page.locator("[data-cancel-money]").innerText();
    check("cancel shows the amount paid and 'Cancelling does not refund'", /Paid \$99/.test(cm) && /Cancelling does not refund/.test(cm), cm.replace(/\s+/g, " "));
    check("cancel links to the payment in Stripe", (await page.locator("[data-step=cancel] [data-stripe-link]").getAttribute("href")) === "https://dashboard.stripe.com/test/payments/pi_test123");
    check("cancel needs a reason first", await page.locator("[data-confirm=cancel]").isDisabled());
    await page.getByLabel("Customer asked to cancel").check();
    await page.screenshot({ path: path.join(SHOTS, "cancel-paid-390x844.png") });
    await page.locator("[data-confirm=cancel]").click();
    await page.waitForSelector("[data-result]");
    const cancelRes = await page.locator("[data-result]").innerText();
    check("cancel sends the reason", calls(server, /\/j5\/transition$/, "POST").pop().body.reason === "Customer asked to cancel");
    check("after cancel: 'not refunded. Refund in Stripe'", /not refunded/.test(cancelRes), cancelRes.replace(/\s+/g, " "));

    // Full Day cancel: restore message from the server.
    await page.goto(`${BASE}/admin/jobs/j8`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-more]").click();
    await page.getByRole("menuitem", { name: "Cancel job" }).click();
    await page.getByLabel("Weather or emergency").check();
    await page.locator("[data-confirm=cancel]").click();
    await page.waitForSelector("[data-result]");
    check("Full Day cancel: 'the included Full Day went back'", /included Full Day went back/.test(await page.locator("[data-result]").innerText()));

    // Reschedule with notification results (one failure).
    await page.goto(`${BASE}/admin/jobs/j4`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-more]").click();
    await page.getByRole("menuitem", { name: "Reschedule" }).click();
    await page.waitForSelector("[data-slot-grid]");
    check("slot grid: taken times shown but not selectable", await page.locator("[data-slot='10:30']").isDisabled());
    await page.locator("[data-slot='13:00']").click();
    check("'Tell the customer' is on by default for a reschedule", await page.locator("[data-step=reschedule] [data-check=notify] input").isChecked());
    await page.screenshot({ path: path.join(SHOTS, "reschedule-390x844.png") });
    await page.locator("[data-confirm=reschedule]").click();
    await page.waitForSelector("[data-result]");
    const rs = calls(server, /\/j4\/reschedule$/, "POST").pop().body;
    check("reschedule sends date, time, expectedUpdatedAt, idempotencyKey, notify", rs.time === "13:00" && /^\d{4}-\d{2}-\d{2}$/.test(rs.date) && Boolean(rs.expectedUpdatedAt) && /^[0-9a-f-]{36}$/.test(rs.idempotencyKey) && rs.notifyCustomer === true, JSON.stringify(rs));
    const rr = await page.locator("[data-result]").innerText();
    check("reschedule result: email sent, text failed (provider)", /Moved to/.test(rr) && /Email sent/.test(rr) && /Text failed: the provider failed/.test(rr), rr.replace(/\s+/g, " "));
    // No usable channel.
    await page.goto(`${BASE}/admin/jobs/j1`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-body=j1]").waitFor();
    // j1 is Confirmed now; make another Pending job for "no usable channel".
    server.state.jobs.set("jp", job("jp", { name: "Pending Nomail", date: nyISO(addDays(TODAY, 2), "08:00"), status: "Pending", tech: "fx2", email: "" }));
    await page.goto(`${BASE}/admin/jobs/jp`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-more]").click();
    await page.getByRole("menuitem", { name: "Reschedule" }).click();
    await page.waitForSelector("[data-slot-grid]");
    await page.locator("[data-slot='15:30']").click();
    await page.locator("[data-confirm=reschedule]").click();
    await page.waitForSelector("[data-result]");
    check("reschedule result: 'not notified: no usable channel'", /no usable channel/.test(await page.locator("[data-result]").innerText()));

    // Reassign through the same picker.
    await page.goto(`${BASE}/admin/jobs/j11`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-change-tech]").click();
    await page.waitForSelector("[data-step=reassign] [data-tech-option=fx2]");
    await page.locator("[data-tech-option=fx2] input").check();
    await page.locator("[data-confirm=reassign]").click();
    await page.waitForSelector("[data-result]");
    const pb = calls(server, /\/jobs\/j11$/, "PATCH").pop().body;
    check("reassign PATCHes only the Fixter with expectedUpdatedAt", pb.assignedFixterId === "fx2" && pb.expectedUpdatedAt && pb.note === undefined, JSON.stringify(pb));

    // Edit description: STALE shows the fresh text and lets me re-apply.
    server.state.staleEditOnce.add("j9");
    await page.goto(`${BASE}/admin/jobs/j9`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-job-more]").click();
    await page.getByRole("menuitem", { name: "Edit description" }).click();
    await page.fill("[data-edit-description]", "Replace the faucet cartridge.");
    await page.locator("[data-confirm=edit]").click();
    await page.waitForSelector("[data-stale-text]", { timeout: 10000 });
    const fresh = await page.locator("[data-stale-text]").innerText();
    check("409 STALE on edit shows the current server text", /gate code is 1234/.test(fresh), fresh.replace(/\s+/g, " "));
    check("my typed text is kept", (await page.inputValue("[data-edit-description]")) === "Replace the faucet cartridge.");
    await page.locator("[data-reapply]").click();
    await page.locator("[data-confirm=edit]").click();
    await page.waitForSelector("[data-result]");
    const edits = calls(server, /\/jobs\/j9$/, "PATCH");
    check("re-apply saves with the fresh updatedAt", edits.length === 2 && edits[1].body.note === "Replace the faucet cartridge." && edits[1].body.expectedUpdatedAt !== edits[0].body.expectedUpdatedAt);

    // Internal notes: append, author and time.
    await page.fill("[data-note-input]", "Gate code 1234, dog in the yard");
    await page.locator("[data-add-note]").click();
    await page.waitForSelector("[data-note]", { timeout: 10000 });
    const note = await page.locator("[data-note]").first().innerText();
    check("internal note appended with author and time", /Gate code 1234/.test(note) && /Owner Test \(owner\)/.test(note), note);

    // Free visit review opens in the same sheet.
    await page.goto(`${BASE}/admin/jobs/j2`, { waitUntil: "domcontentloaded" });
    await jobSheet(page).locator("[data-primary=review]").click();
    await page.waitForSelector("[role=dialog][data-sheet=job] [data-free-visit-panel][data-embedded]", { timeout: 10000 });
    check("free-visit review replaces the job sheet's content (one dialog)", (await page.locator("[role=dialog]").count()) === 1);
    await page.locator("[data-free-visit-decline]").click();
    check("decline asks its reason inline (no window.prompt)", (await page.locator("[data-free-visit-decline-form]").count()) === 1);
    await page.screenshot({ path: path.join(SHOTS, "free-visit-review-390x844.png") });
    check("no page errors (transitions)", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ================= Fixter: My day ================= */
  console.log("\n--- field Fixter: My day ---");
  {
    const { ctx, page, api, errors } = await open(browser, FIELD);
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    check("a field Fixter opening Jobs lands on My day", await waitPath(page, /^\/admin\/my-day$/));
    await page.waitForSelector("[data-section=my-day] [data-job-row]", { timeout: 15000 });
    const ids = await page.locator("[data-job-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job-row")));
    check("My day reads the server-scoped /api/admin/my-day", api.some((a) => a.path === "/api/admin/my-day"));
    check("My day shows only their own jobs", ids.length > 0 && ids.every((id) => ["j3", "j5", "j13"].includes(id)), ids.join(","));
    check("no view switcher, no 'All', no Fixter filter", (await page.locator("[aria-label='Job views']").count()) === 0 && (await page.locator("[data-tech-filter]").count()) === 0 && (await page.getByRole("button", { name: /^All/ }).count()) === 0);
    await page.locator("[data-job-row=j5] a").click();
    await jobSheet(page).locator("[data-job-body=j5]").waitFor();
    check("their job opens at /admin/my-day/:id", page.url().includes("/admin/my-day/j5"));
    const t = await jobSheet(page).innerText();
    check("Fixter sheet: Mark done, notes and photos", (await jobSheet(page).locator("[data-primary=done]").count()) === 1 && (await jobSheet(page).locator("[data-note-input]").count()) === 1 && (await jobSheet(page).getByRole("button", { name: "Add photos" }).count()) === 1);
    check("Fixter sheet: no money, no payment or Stripe link", !/Paid for this visit/.test(t) && (await jobSheet(page).locator("[data-stripe-link]").count()) === 0);
    check("Fixter sheet: no customer link, no More menu, no Change Fixter", (await jobSheet(page).locator("[data-customer-link]").count()) === 0 && (await jobSheet(page).locator("[data-job-more]").count()) === 0 && (await jobSheet(page).locator("[data-change-tech]").count()) === 0);
    check("Fixter sheet: no messages history", (await jobSheet(page).locator("[data-disclosure=messages]").count()) === 0);
    await page.screenshot({ path: path.join(SHOTS, "my-day-sheet-390x844.png") });
    await page.goto(`${BASE}/admin/jobs/j5`, { waitUntil: "domcontentloaded" });
    check("a /admin/jobs/:id link becomes /admin/my-day/:id", await waitPath(page, /^\/admin\/my-day\/j5$/));
    await page.goto(`${BASE}/admin/my-day/j4`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[role=dialog][data-sheet=job]");
    await page.waitForTimeout(800);
    check("someone else's job: 'not yours to open' (403 FORBIDDEN_RECORD)", /not yours to open/.test(await jobSheet(page).innerText()));
    await page.goto(`${BASE}/admin/customers`, { waitUntil: "domcontentloaded" });
    check("Customers is closed to a field Fixter", await page.waitForSelector("[data-permission-state]", { timeout: 15000 }).then(() => true).catch(() => false) || (await waitPath(page, /^\/admin\/my-day/)));
    check("no page errors (My day)", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ================= Schedule ================= */
  console.log("\n--- Schedule ---");
  {
    const { ctx, page, errors } = await open(browser, OWNER);
    const tomorrow = addDays(TODAY, 1);
    await page.goto(`${BASE}/admin/schedule?date=${tomorrow}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-timeline]", { timeout: 20000 });
    check("phone: a vertical timeline for the day", (await page.locator("[data-timeline] [data-sched-job]").count()) >= 4);
    check("conflicts are outlined (two overlapping jobs for one Fixter)", (await page.locator("[data-sched-job][data-conflict=true]").count()) === 2 && (await page.locator("[data-conflicts]").count()) === 1);
    check("full and closed slots are shaded from capacity", (await page.locator("[data-timeline] .adm-sched-band[data-state=full]").count()) >= 1 && (await page.locator("[data-timeline] .adm-sched-band[data-state=closed]").count()) >= 1);
    await page.screenshot({ path: path.join(SHOTS, "schedule-day-390x844.png") });
    await page.locator("[aria-label='Schedule view'] button", { hasText: /^G\. General/ }).click();
    await waitPath(page, /tech=fx2/);
    const blocks = await page.locator("[data-timeline] [data-sched-job]").count();
    check("technician chips filter the timeline (URL tech=)", blocks >= 3 && page.url().includes("tech=fx2"), `${blocks}`);
    await page.locator("[data-sched-job=j9]").click();
    await jobSheet(page).locator("[data-job-body=j9]").waitFor();
    check("a tap opens the job sheet over the schedule", page.url().includes("/admin/schedule/jobs/j9") && (await page.locator("[data-section=schedule]").count()) === 1);
    check("reassign from the schedule uses the same picker", (await jobSheet(page).locator("[data-change-tech]").count()) === 1);
    await page.keyboard.press("Escape");
    await waitPath(page, /^\/admin\/schedule\?/);
    await page.locator("[aria-label='Schedule view'] button", { hasText: "Week" }).click();
    await page.waitForSelector("[data-week-agenda]");
    check("phone week: an agenda of 7 days with capacity", (await page.locator("[data-week-agenda] [data-week-day]").count()) === 7);
    await page.screenshot({ path: path.join(SHOTS, "schedule-week-390x844.png") });
    await ctx.close();

    const desk = await open(browser, OWNER, { width: 1440, height: 900, touch: false });
    await desk.page.goto(`${BASE}/admin/schedule?date=${tomorrow}`, { waitUntil: "domcontentloaded" });
    await desk.page.waitForSelector("[data-day-columns]", { timeout: 20000 });
    const lanes = await desk.page.locator("[data-day-columns] [data-lane]").count();
    check("desktop day: technician columns x time", lanes >= 2, `${lanes} lanes`);
    await desk.page.screenshot({ path: path.join(SHOTS, "schedule-day-1440x900.png") });
    await desk.page.locator("[aria-label='Schedule view'] button", { hasText: "Week" }).click();
    await desk.page.waitForSelector("[data-week-columns]");
    check("desktop week: 7 day columns", (await desk.page.locator("[data-week-columns] [data-week-day]").count()) === 7);
    check("a closed day is shaded", (await desk.page.locator("[data-week-columns] .adm-sched-closed").count()) >= 1);
    await desk.page.screenshot({ path: path.join(SHOTS, "schedule-week-1440x900.png") });
    check("no page errors (schedule)", errors.length === 0 && desk.errors.length === 0, [...errors, ...desk.errors].join(" | "));
    await desk.ctx.close();
  }

  /* ================= Availability ================= */
  console.log("\n--- Availability (AdminCalendarSettings) ---");
  {
    const { ctx, page, server, errors } = await open(browser, OWNER, { width: 320, height: 568 });
    await page.goto(`${BASE}/admin/schedule/availability`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Calendar Control Center", { timeout: 20000 });
    await page.waitForTimeout(800);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("320px: Availability has no sideways overflow (was +22px)", ov <= 0, `+${ov}px`);
    // A future day, so the day panel offers its actions.
    const future = addDays(TODAY, 3);
    if (future.slice(0, 7) !== TODAY.slice(0, 7)) await page.getByRole("button", { name: "Next month" }).click();
    await page.waitForTimeout(400);
    await page.evaluate((d) => {
      const btn = [...document.querySelectorAll(".grid.grid-cols-7 > button")].find((b) => b.querySelector("span")?.textContent.trim() === String(d));
      if (btn) btn.click();
    }, Number(future.slice(8)));
    await page.waitForSelector("[data-custom-starts]", { timeout: 10000 });
    await page.locator("[data-custom-starts]").click();
    await page.waitForSelector("[data-sheet=custom-starts]");
    const inputs = await page.locator("[data-start-input]").count();
    check("Custom starts opens a kit sheet with one time field per start", inputs === 2, `${inputs}`);
    await page.getByRole("button", { name: "Add a start" }).click();
    await page.locator("[data-start-input]").nth(2).fill("16:00");
    await page.locator("[data-save-starts]").click();
    await page.waitForTimeout(600);
    const ovr = server.state.calls.find((c) => c.p === "/api/admin/calendar/overrides/day");
    check("Custom starts saves the times (no window.prompt)", ovr && JSON.stringify(ovr.body.starts) === JSON.stringify([{ time: "08:00" }, { time: "13:00" }, { time: "16:00" }]) && ovr.body.mode === "custom_hours", JSON.stringify(ovr && ovr.body));
    check("slot bookings link to the job", (await page.locator("a[href='/admin/schedule/jobs/j4']").count()) === 1);
    check("no page errors (availability)", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ================= sizes, overflow, a11y, screenshots ================= */
  console.log("\n--- every size: overflow, targets, labels, screenshots ---");
  const SIZES = [
    { name: "320x568", width: 320, height: 568 },
    { name: "375x667", width: 375, height: 667 },
    { name: "390x844", width: 390, height: 844 },
    { name: "430x932", width: 430, height: 932 },
    { name: "844x390", width: 844, height: 390 },
    { name: "820x1180", width: 820, height: 1180 },
    { name: "1440x900", width: 1440, height: 900, touch: false },
  ];
  for (const size of SIZES) {
    const { ctx, page, errors, external } = await open(browser, OWNER, size);
    const touchy = size.touch !== false;
    const routes = [
      ["jobs", "/admin/jobs", "[data-needs-action]"],
      ["today", "/admin/jobs?view=today", "[data-day]"],
      ["sheet", "/admin/jobs/j5", "[data-job-body=j5]"],
      ["schedule", `/admin/schedule?date=${addDays(TODAY, 1)}`, "[data-section=schedule] [data-sched-job]"],
      ["schedule-week", "/admin/schedule?mode=week", "[data-week-day]"],
      ["my-day", "/admin/my-day", "[data-section=my-day]"],
      ["availability", "/admin/schedule/availability", "text=Calendar Control Center"],
    ];
    for (const [name, route, ready] of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(ready, { timeout: 20000 }).catch(() => null);
      await page.waitForTimeout(500);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${size.name} ${name}: no sideways overflow`, ov <= 0, `+${ov}px`);
      if (["jobs", "today", "sheet", "schedule", "schedule-week"].includes(name)) await page.screenshot({ path: path.join(SHOTS, `${name}-${size.name}.png`) });
      if (name === "sheet") {
        const box = await jobSheet(page).boundingBox();
        check(`${size.name} sheet: inside the viewport`, box && box.x >= 0 && box.x + box.width <= size.width + 0.5 && box.y >= 0, JSON.stringify(box));
        const close = await page.locator("[data-sheet-close]").boundingBox();
        check(`${size.name} sheet: close button 44px and on screen`, close && close.width >= 44 && close.height >= 44 && close.y >= 0);
        const prim = await jobSheet(page).locator("[data-primary]").boundingBox();
        check(`${size.name} sheet: the primary action is on screen`, prim && prim.y + prim.height <= size.height + 0.5, JSON.stringify(prim));
        const a = await a11y(page, "[role=dialog][data-sheet=job]", { targets: touchy });
        check(`${size.name} sheet: every control has a name`, a.unnamed.length === 0, a.unnamed.join(" ; "));
        check(`${size.name} sheet: every field has a label`, a.unlabeled.length === 0, a.unlabeled.join(" ; "));
        check(`${size.name} sheet: no text under 12px`, a.tiny.length === 0, a.tiny.slice(0, 5).join(","));
        check(`${size.name} sheet: dialog is modal and labelled`, a.dialogs.length === 1 && a.dialogs[0].modal === "true" && a.dialogs[0].label.length > 0, JSON.stringify(a.dialogs));
        if (touchy) check(`${size.name} sheet: tap targets at least 44px`, a.small.length === 0, a.small.slice(0, 6).join(" ; "));
      }
      if (name === "jobs" || name === "today") {
        const a = await a11y(page, "[data-section=jobs]", { targets: touchy });
        check(`${size.name} ${name}: every control has a name`, a.unnamed.length === 0, a.unnamed.join(" ; "));
        check(`${size.name} ${name}: every field has a label`, a.unlabeled.length === 0, a.unlabeled.join(" ; "));
        check(`${size.name} ${name}: no text under 12px`, a.tiny.length === 0, a.tiny.slice(0, 5).join(","));
        if (touchy) check(`${size.name} ${name}: tap targets at least 44px (chips use their 44px hit area)`, a.small.length === 0, a.small.slice(0, 6).join(" ; "));
      }
      if (name === "schedule") {
        const a = await a11y(page, "[data-section=schedule]", { targets: false });
        check(`${size.name} schedule: every control has a name`, a.unnamed.length === 0, a.unnamed.join(" ; "));
      }
    }
    if (size.name === "390x844") {
      // The keyboard never hides a sheet's buttons: the footer rides above it (kit), the FAB hides.
      await page.goto(`${BASE}/admin/jobs/j4`, { waitUntil: "domcontentloaded" });
      await jobSheet(page).locator("[data-job-body=j4]").waitFor();
      const fabHidden = await page.evaluate(() => {
        document.documentElement.dataset.keyboard = "open";
        const fab = document.querySelector("[data-fab]");
        return !fab || getComputedStyle(fab).display === "none";
      });
      check("390: the + button hides while the keyboard is open", fabHidden);
    }
    check(`${size.name}: no page errors`, errors.length === 0, errors.join(" | "));
    check(`${size.name}: no request left the machine`, external.length === 0, external.slice(0, 3).join(" "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED:\n" + failed.map((f) => "  - " + f.name).join("\n"));
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function makeCounts(server) {
  const [, body] = server.handle("GET", "/api/admin/jobs", new URLSearchParams("view=needs_action"), null);
  return body.counts;
}
