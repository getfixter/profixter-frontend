import API from "./api";

/* Types mirror BackEnd/utils/growth/commandCenter.js - keep the two in step. */

export type GrowthMode = "off" | "shadow" | "supervised" | "autonomous";

export type GrowthActionView = {
  id: string;
  type: string;
  status: string;
  summary: string;
  rationale: string;
  riskTier: "low" | "medium" | "high";
  modeAtProposal: GrowthMode;
  heldReason: string | null;
  proposedBy: string;
  createdAt: string;
  executedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  expiresAt: string | null;
  lastError: string | null;
  result: { reason: string | null; to: string | null } | null;
  verification: string | null;
  /** What the owner approves: the exact reply text, page wording or playbook. */
  preview?: string | null;
};

export type GrowthPolicyView = {
  type: string;
  label: string;
  description: string;
  riskTier: "low" | "medium" | "high";
  mode: GrowthMode;
  defaultMode: GrowthMode;
  maxMode: GrowthMode;
  promoteAfter: number | null;
  perDay: number | null;
  streak: number;
  verifiedSuccesses: number;
  failures: number;
  setBy: string;
  setNote: string;
  setAt: string | null;
  promotedAt: string | null;
  demotedAt: string | null;
};

export type CapacityWeek = { from: string; capacity: number; booked: number; utilization: number | null };

export type CapacityOutlook = {
  from?: string;
  to?: string;
  days?: number;
  openDays?: number;
  capacity?: number;
  booked?: number;
  utilization?: number | null;
  weeks?: CapacityWeek[];
  signal: "near_full" | "room_to_grow" | "healthy" | "unknown";
  error?: string;
};

export type GrowthAlert = { level: "info" | "warning"; key: string; text: string };

/* Filled by BackEnd/utils/visibility/summary.js; every part may be unavailable. */
export type VisibilityPart = { available: boolean; reason?: string; [key: string]: unknown };
export type VisibilitySummary = {
  reviews?: VisibilityPart;
  search?: VisibilityPart;
  localRank?: VisibilityPart;
  aiVisibility?: VisibilityPart;
  collectors?: Array<{ name: string; enabled: boolean; configured: boolean; lastSuccessAt: string | null; lastError: string | null }>;
};

/* Filled by BackEnd/utils/growth/commandCenter.js acquisitionView(). */
export type Acquisition = {
  firstFreeVisits: { last7: number | null; prev7: number | null; last30: number | null; prev30: number | null };
  visitors30: number | null;
  registrations30: number | null;
  bySource30: Array<{ key: string; label: string; visitors: number; registrations: number; freeVisits: number }>;
  funnel30: {
    booking_page_view?: number;
    booker_started?: number;
    slot_selected?: number;
    signup_view?: number;
    firstFreeVisits: number | null;
    trackingSince: string;
  };
  costPerFirstFreeVisitCents: number | null;
};

export type CommandCenter = {
  generatedAt: string;
  engineEnabled: boolean;
  capacity: CapacityOutlook;
  queue: {
    pending: GrowthActionView[];
    recent: GrowthActionView[];
    shadow: GrowthActionView[];
    last7Days: Record<string, number>;
  };
  policies: GrowthPolicyView[];
  outcomes: {
    checkoutRecovery: { windowDays: number; sent: number; recovered: number; stillInWindow: number };
  };
  waitlist: { waiting: number; last30Days: number; topZips: Array<{ zip: string; count: number; county: string | null }> };
  alerts: GrowthAlert[];
  visibility?: VisibilitySummary;
  acquisition?: Acquisition | null;
};

function normalize(raw: Partial<CommandCenter> | null | undefined): CommandCenter {
  const r = raw || {};
  return {
    generatedAt: r.generatedAt || new Date().toISOString(),
    engineEnabled: Boolean(r.engineEnabled),
    capacity: r.capacity || { signal: "unknown" },
    queue: {
      pending: r.queue?.pending || [],
      recent: r.queue?.recent || [],
      shadow: r.queue?.shadow || [],
      last7Days: r.queue?.last7Days || {},
    },
    policies: r.policies || [],
    outcomes: {
      checkoutRecovery: r.outcomes?.checkoutRecovery || { windowDays: 14, sent: 0, recovered: 0, stillInWindow: 0 },
    },
    waitlist: r.waitlist || { waiting: 0, last30Days: 0, topZips: [] },
    alerts: r.alerts || [],
    visibility: r.visibility,
    acquisition: r.acquisition || null,
  };
}

export async function getCommandCenter(): Promise<CommandCenter> {
  const res = await API.get("/api/admin/growth/summary");
  return normalize(res.data);
}

export async function decideAction(id: string, decision: "approve" | "reject", note = "") {
  const res = await API.post(`/api/admin/growth/actions/${encodeURIComponent(id)}/${decision}`, { note });
  return res.data?.action as GrowthActionView;
}

export async function setPolicyMode(type: string, mode: GrowthMode, note = "") {
  const res = await API.put(`/api/admin/growth/policies/${encodeURIComponent(type)}`, { mode, note });
  return res.data?.policy;
}

export const MODE_LABEL: Record<GrowthMode, string> = {
  off: "Off",
  shadow: "Watching only",
  supervised: "Needs approval",
  autonomous: "Runs on its own",
};

export const STATUS_LABEL: Record<string, string> = {
  shadow: "Would have run",
  awaiting_approval: "Waiting for you",
  approved: "Queued",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Not needed",
  rejected: "Declined",
  expired: "Expired",
  rolled_back: "Undone",
};

export const SKIP_REASON_LABEL: Record<string, string> = {
  already_member: "already became a member",
  profixter_customer: "already a Profixter customer - answer from Profixter",
  homeowner_wrote_again: "the homeowner wrote again",
  already_answered: "someone already answered",
  opted_out: "opted out",
  unsubscribed: "unsubscribed from email",
  not_marketable: "not a customer we email",
  reminded_recently: "reminded in the last 30 days",
  user_not_found: "account no longer exists",
};

export function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;
}

/* Growth agents - mirror BackEnd routes/adminGrowth.js (/agents, /findings). */

export type AgentRunView = {
  id: string;
  startedAt: string;
  status: "running" | "succeeded" | "failed" | "budget_stopped" | "skipped";
  skipReason: string | null;
  costCents: number;
  turns: number;
  tools: number;
  findings: number;
  actions: number;
  summary: string;
  error: string | null;
};

export type AgentView = {
  name: string;
  label: string;
  schedule: string;
  budgetCents: number;
  allowedActions: string[];
  monthCostCents: number;
  monthRuns: number;
  openFindings: number;
  nextRunAt: string | null;
  lastSuccessAt: string | null;
  runs: AgentRunView[];
};

export type AgentsStatus = {
  enabled: boolean;
  keyConfigured: boolean;
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  spentTodayCents: number;
  spentThisMonthCents: number;
  costNote: string;
  secrets: { loaded: string[]; lastLoadAt: string | null; error: string | null } | null;
  agents: AgentView[];
};

export type AgentFindingView = {
  id: string;
  agent: string;
  kind: string;
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  expectedImpact: string;
  evidence: unknown;
  body: string;
  target: string;
  status: string;
  seenCount: number;
  createdAt: string;
  updatedAt: string;
};

export async function getAgents(): Promise<AgentsStatus> {
  const res = await API.get("/api/admin/growth/agents");
  const d = res.data || {};
  return {
    enabled: Boolean(d.enabled),
    keyConfigured: Boolean(d.keyConfigured),
    dailyBudgetCents: Number(d.dailyBudgetCents) || 0,
    monthlyBudgetCents: Number(d.monthlyBudgetCents) || 0,
    spentTodayCents: Number(d.spentTodayCents) || 0,
    spentThisMonthCents: Number(d.spentThisMonthCents) || 0,
    costNote: String(d.costNote || ""),
    secrets: d.secrets || null,
    agents: Array.isArray(d.agents) ? d.agents : [],
  };
}

export async function getFindings(status = "open"): Promise<AgentFindingView[]> {
  const res = await API.get(`/api/admin/growth/findings?status=${encodeURIComponent(status)}&limit=60`);
  return Array.isArray(res.data?.findings) ? res.data.findings : [];
}

export async function setFindingStatus(id: string, status: "acknowledged" | "dismissed" | "resolved") {
  await API.post(`/api/admin/growth/findings/${encodeURIComponent(id)}/status`, { status });
}

export async function runAgentNow(name: string, mode: "daily" | "weekly" = "daily") {
  await API.post(`/api/admin/growth/agents/${encodeURIComponent(name)}/run`, { mode });
}

/* Email playbooks - mirror BackEnd routes/adminGrowth.js (/playbooks). */

export type PlaybookView = {
  id: string;
  key: string;
  name: string;
  segment: string;
  segmentLabel: string;
  purpose: string;
  measure: string;
  subject: string;
  status: "draft" | "approved" | "retired";
  version: number;
  approvedVersion: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string;
  statusNote: string;
  updatedAt: string;
  copyProblems: string[];
  sends: Record<string, number>;
};

export async function getPlaybooks(): Promise<PlaybookView[]> {
  const res = await API.get("/api/admin/growth/playbooks");
  return Array.isArray(res.data?.playbooks) ? res.data.playbooks : [];
}

export async function getPlaybookPreview(key: string): Promise<{ subject: string; html: string }> {
  const res = await API.get(`/api/admin/growth/playbooks/${encodeURIComponent(key)}/preview`);
  return { subject: String(res.data?.subject || ""), html: String(res.data?.html || "") };
}

export async function decidePlaybook(key: string, decision: "approve" | "retire", note = "") {
  await API.post(`/api/admin/growth/playbooks/${encodeURIComponent(key)}/${decision}`, { note });
}

/* ------------------------------------------------------------------ */
/* Outreach (postal mail) and conversations                            */
/* ------------------------------------------------------------------ */

export type MailWaveView = {
  key: string;
  name: string;
  status: "draft" | "approved" | "exported" | "mailed" | "cancelled";
  targetZips: string[];
  size: number;
  format: string;
  copy: { headline: string; body: string; callToAction: string };
  rationale: string;
  estimatedCostCents: number;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  mailedAt: string | null;
  results: { registrations: number; firstFreeVisits: number } | null;
};

export type OutreachView = {
  audience: {
    synced: number;
    eligible: number;
    mailableNow: number;
    excluded: Record<string, number>;
    byCounty: Record<string, number>;
    topZips: Array<{ city: string; zip: string; eligible: number }>;
  };
  waves: MailWaveView[];
  costPerPieceCents: number;
};

export async function getOutreach(): Promise<OutreachView> {
  const res = await API.get("/api/admin/growth/outreach");
  return res.data;
}

export async function decideWave(key: string, decision: "approve" | "cancel" | "mailed", note = "") {
  await API.post(`/api/admin/growth/outreach/waves/${encodeURIComponent(key)}/${decision}`, { note });
}

/** Downloads the print vendor's CSV (names, addresses, personal URLs) and marks the wave exported. */
export async function exportWave(key: string) {
  const res = await API.post(`/api/admin/growth/outreach/waves/${encodeURIComponent(key)}/export`, {}, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `profixter-${key}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export type ConversationView = {
  id: string;
  status: "needs_reply" | "reply_proposed" | "replied" | "escalated" | "closed" | "opted_out";
  intent: string | null;
  summary: string | null;
  channel: string;
  firstName: string;
  town: string;
  escalationReason: string | null;
  lastInboundAt: string | null;
  messages: Array<{ direction: "inbound" | "outbound"; by: string; body: string; at: string }>;
};

export async function getConversations(): Promise<{ threads: ConversationView[]; enabled: boolean }> {
  const res = await API.get("/api/admin/growth/conversations");
  return res.data;
}
