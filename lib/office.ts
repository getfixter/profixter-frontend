import API from "./api";

/* Types mirror BackEnd/utils/growth/office.js and explain.js - keep them in step. */

/** Two levels for everything: what the robot says (simple) and a full brief to paste into ChatGPT. */
export type Simple = { say: string; ask?: string | null; details?: string[]; pendingSimple?: boolean };
export type Explained = { simple: Simple; chatgpt: string };

export type RobotKey = "visibility" | "outreach" | "conversation";
export type RobotStatus = "working" | "needs_you" | "paused" | "off" | "error" | "waiting";

export type RobotState = {
  key: RobotKey;
  name: string;
  role: string;
  status: RobotStatus;
  statusText: string;
  waiting: number;
  paused: boolean;
  nextRunAt: string | null;
  nextRunLabel: string | null;
  lastRun: { at: string; status: string; summary: string; costCents: number; agent: string } | null;
  monthCostCents: number;
  guidanceVersion: number;
  liveReplies?: boolean;
};

export type OfficeState = {
  generatedAt: string;
  agentsEnabled: boolean;
  engineEnabled: boolean;
  conversationsEnabled: boolean;
  robots: RobotState[];
  kpis: {
    firstFreeVisits: { last7: number | null; prev7: number | null; last30: number | null; prev30: number | null } | null;
    funnel30: {
      booking_page_view?: number;
      booker_started?: number;
      slot_selected?: number;
      signup_view?: number;
      firstFreeVisits: number | null;
      trackingSince: string;
    } | null;
    visitors30: number | null;
    registrations30: number | null;
    bySource30: Array<{ key: string; label: string; visitors: number; registrations: number; freeVisits: number }>;
    search: { windowDays: number; clicks: number | null; impressions: number | null; clicksChangePct: number | null } | null;
    searchReason: string | null;
    conversations30: { total: number; qualified: number };
  };
  costs: { todayCents: number; monthCents: number; dailyCapCents: number; monthlyCapCents: number };
  approvals: { actions: number; playbooks: number; drafts: number; notes: number; total: number };
  lastFirstFreeVisitAt: string | null;
  report: { headline: string; at: string } | null;
  explained?: Explained;
};

export type Capability = { label: string; state: "on" | "off" | "approval" | "never"; note: string };

export type RobotDetail = {
  robot: { key: RobotKey; name: string; role: string; mission: string; does: string[]; cannot: string[]; personality: string };
  state: RobotState;
  schedule: string[];
  capabilities: Capability[];
  runs: Array<{
    id: string;
    agent: string;
    at: string;
    status: string;
    trigger: string;
    skipReason: string | null;
    costCents: number;
    summary: string;
    error: string;
    findings: number;
    actions: number;
  } & Partial<Explained>>;
  findings: Array<{ id: string; kind: string; severity: string; title: string; detail: string; at: string } & Partial<Explained>>;
  results: Array<{ id: string; title: string; at: string; verification: string | null }>;
  learned: Array<{ key: string; content: string; at: string }>;
  mistakes: Array<{ at: string; what: string; detail: string } & Partial<Explained>>;
  explained?: Explained;
  teach: {
    teachable: boolean;
    agent: string | null;
    guidance: string;
    version: number;
    history: Array<{ version: number; guidance: string; by: string; at: string; note: string }>;
    fixedRules: string;
    note: string;
    explained?: Explained;
  };
};

export type ApprovalItem = {
  kind: "action" | "playbook" | "draft" | "note";
  id: string;
  robot: RobotKey | null;
  title: string;
  detail: string;
  preview?: string;
  at: string;
  risk?: string;
  severity?: string;
  simple?: Simple;
  chatgpt?: string;
};

export async function getOffice(fresh = false): Promise<OfficeState> {
  const res = await API.get(`/api/admin/growth/office${fresh ? "?fresh=1" : ""}`);
  return res.data;
}

export async function getRobot(key: RobotKey): Promise<RobotDetail> {
  const res = await API.get(`/api/admin/growth/office/robots/${key}`);
  return res.data;
}

export async function getApprovals(): Promise<{ items: ApprovalItem[]; notes: ApprovalItem[] }> {
  const res = await API.get("/api/admin/growth/office/approvals");
  return res.data;
}

export async function setRobotPaused(key: RobotKey, paused: boolean) {
  await API.post(`/api/admin/growth/office/robots/${key}/pause`, { paused });
}

export async function saveGuidance(key: RobotKey, guidance: string, note = "") {
  const res = await API.put(`/api/admin/growth/office/robots/${key}/guidance`, { guidance, note });
  return res.data as { version: number; guidance: string; unchanged: boolean };
}

export async function restoreGuidance(key: RobotKey, version: number) {
  const res = await API.post(`/api/admin/growth/office/robots/${key}/guidance/rollback`, { version });
  return res.data as { version: number; guidance: string };
}

/** Starts a shift now; the server picks the agent's normal mode. */
export async function runShiftNow(agent: string) {
  await API.post(`/api/admin/growth/agents/${encodeURIComponent(agent)}/run`, {});
}

export function errorMessage(e: unknown, fallback: string): { message: string; problems: string[] } {
  const data = (e as { response?: { data?: { message?: string; problems?: string[] } } })?.response?.data;
  return { message: data?.message || fallback, problems: data?.problems || [] };
}
