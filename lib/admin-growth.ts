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
  runs: AgentRunView[];
};

export type AgentsStatus = { enabled: boolean; dailyBudgetCents: number; agents: AgentView[] };

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
  return { enabled: Boolean(d.enabled), dailyBudgetCents: Number(d.dailyBudgetCents) || 0, agents: Array.isArray(d.agents) ? d.agents : [] };
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
