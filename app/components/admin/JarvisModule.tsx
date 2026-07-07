"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PhoneArrowUpRightIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/useAuth";
import {
  executeGhlAiCommanderPlan,
  generateGhlAiCommanderPlan,
  type GhlAiCommanderExecuteResponse,
  type GhlAiCommanderPlanResponse,
} from "@/lib/admin-service";

const STATUS_LINES = [
  "Everything is running normally.",
  "I've been keeping an eye on the business.",
  "Here's what happened while you were away.",
];

const THINKING_LINES = [
  "Jarvis is analyzing...",
  "Thinking...",
  "Reviewing available actions...",
  "Planning...",
];

const PROMPT_PLACEHOLDER = "Tell me what you'd like me to accomplish...";

const SUGGESTIONS = [
  {
    title: "Launch Roofing Campaign",
    body: "Because there are no active campaigns.",
    prompt: "Create a roofing campaign.",
  },
  {
    title: "Follow up with yesterday's leads",
    body: "No follow-up workflow exists yet.",
    prompt: "Follow up with yesterday's leads.",
  },
  {
    title: "Review conversations",
    body: "Check if anyone replied overnight.",
    prompt: "Review active GHL conversations.",
  },
  {
    title: "Create Membership Campaign",
    body: "Turn warm leads into member conversations.",
    prompt: "Create a membership campaign.",
  },
  {
    title: "Import Contacts",
    body: "Bring new leads into a controlled plan.",
    prompt: "Import contacts into GHL.",
  },
  {
    title: "Build SMS Follow-up",
    body: "Start with copy review before anything sends.",
    prompt: "Build an SMS follow-up sequence.",
  },
  {
    title: "Find Cold Leads",
    body: "Surface quiet contacts for reactivation.",
    prompt: "Find cold leads.",
  },
  {
    title: "Pause Campaign",
    body: "Stop a campaign safely after review.",
    prompt: "Pause a campaign.",
  },
];

type ChatMessage = {
  id: string;
  role: "user" | "jarvis";
  kind: "text" | "brief" | "plan" | "error";
  text?: string;
  plan?: GhlAiCommanderPlanResponse;
  error?: unknown;
};

type Conversation = {
  id: string;
  title: string;
  subtitle: string;
  messages: ChatMessage[];
};

type TechnicalError = {
  message?: string;
  response?: { data?: unknown };
  status?: number;
};

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "today",
    title: "Today",
    subtitle: "AI brief",
    messages: [
      {
        id: "today-brief",
        role: "jarvis",
        kind: "brief",
      },
    ],
  },
  {
    id: "test-contact",
    title: "Create Test Contact",
    subtitle: "GHL contact",
    messages: [
      {
        id: "test-contact-user",
        role: "user",
        kind: "text",
        text: "Create a test contact.",
      },
      {
        id: "test-contact-jarvis",
        role: "jarvis",
        kind: "text",
        text:
          "I can prepare that. I will create one contact, attach the requested tag, and wait for your approval before anything changes.",
      },
    ],
  },
  {
    id: "roofing",
    title: "Roofing Campaign",
    subtitle: "Campaign idea",
    messages: [
      {
        id: "roofing-user",
        role: "user",
        kind: "text",
        text: "Create a roofing campaign.",
      },
      {
        id: "roofing-jarvis",
        role: "jarvis",
        kind: "text",
        text:
          "I understand. I would prepare the campaign structure, follow-up language, and lead organization for your approval.",
      },
    ],
  },
  {
    id: "membership",
    title: "Membership Campaign",
    subtitle: "Lead nurturing",
    messages: [
      {
        id: "membership-jarvis",
        role: "jarvis",
        kind: "text",
        text:
          "A membership campaign can be staged here when you are ready. I will analyze the audience and show you exactly what changes before approval.",
      },
    ],
  },
  {
    id: "sms",
    title: "SMS Automation",
    subtitle: "Follow-up",
    messages: [
      {
        id: "sms-jarvis",
        role: "jarvis",
        kind: "text",
        text:
          "For SMS automation, I will always show the message copy first and wait for approval before anything is sent.",
      },
    ],
  },
  {
    id: "import-leads",
    title: "Import Leads",
    subtitle: "Contacts",
    messages: [
      {
        id: "import-jarvis",
        role: "jarvis",
        kind: "text",
        text:
          "Lead import planning will stay controlled: review first, approval second, execution only after you confirm.",
      },
    ],
  },
];

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readable(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(name?: string | null) {
  return String(name || "Taras").trim().split(/\s+/)[0] || "Taras";
}

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function holdThinking(startedAt: number, minimumMs = 2200) {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await wait(remaining);
}

function titleFromPrompt(value: string) {
  const clean = value.replace(/[^\w\s-]/g, "").trim();
  if (!clean) return "New Conversation";
  return clean.split(/\s+/).slice(0, 4).join(" ");
}

function getPlanBullets(plan: GhlAiCommanderPlanResponse | null) {
  if (!plan) return [];

  const exactPlan = asArray(plan.exactPlan)
    .map(readable)
    .filter(Boolean)
    .slice(0, 5);
  if (exactPlan.length) return exactPlan;

  return asArray(plan.plannedApiActions)
    .map((item) => {
      const record = objectRecord(item);
      return readable(record.description) || titleCase(readable(record.actionType));
    })
    .filter(Boolean)
    .slice(0, 5);
}

function getObjectsSummary(plan: GhlAiCommanderPlanResponse | null) {
  return asArray(plan?.objectsAffected)
    .map((item) => {
      const record = objectRecord(item);
      const operation = readable(record.operation);
      const type = readable(record.type);
      const name = readable(record.name);
      const details = readable(record.details);
      return (
        [operation && titleCase(operation), type && titleCase(type), name]
          .filter(Boolean)
          .join(" ")
          .trim() || details
      );
    })
    .filter(Boolean);
}

function getMessageSummary(plan: GhlAiCommanderPlanResponse | null) {
  return asArray(plan?.messagesToSendOrCreate)
    .map((item) => {
      const record = objectRecord(item);
      return {
        channel: readable(record.channel) || "Message",
        timing: readable(record.timing),
        headline: readable(record.subject) || "Prepared message",
        body: readable(record.body),
      };
    })
    .filter((item) => item.headline || item.body);
}

function unsupportedFromPlan(plan: GhlAiCommanderPlanResponse | null) {
  if (!plan) return [];
  const explicit = asArray(plan.unsupportedActions);
  if (explicit.length) return explicit;
  return asArray(plan.plannedApiActions).filter((item) => {
    const record = objectRecord(item);
    return record.supported === false || record.actionType === "unsupported";
  });
}

function unsupportedCopy(item: unknown) {
  const record = objectRecord(item);
  const requested = readable(record.requestedAction) || readable(record.actionType);
  const reason = readable(record.reason) || readable(record.unsupportedReason);
  if (requested && reason) return `${requested}: ${reason}`;
  return requested || reason || "I need one more detail before I can continue.";
}

function actionLabel(value: unknown) {
  const record = objectRecord(value);
  const type = readable(record.actionType);
  const labels: Record<string, string> = {
    create_contact: "Contact",
    upsert_contact: "Contact",
    update_contact: "Contact",
    add_contact_tags: "Tags",
    remove_contact_tags: "Tags",
    create_contact_note: "Note",
    create_contact_task: "Task",
    add_contact_to_campaign: "Campaign",
    add_contact_to_workflow: "Workflow",
    create_opportunity: "Opportunity",
    create_pipeline: "Pipeline",
    send_conversation_message: "Message",
    create_calendar_appointment: "Appointment",
  };
  return labels[type] || titleCase(type) || "Item";
}

function getExecuteLabels(result?: GhlAiCommanderExecuteResponse | null) {
  return asArray(result?.executedActions).map(actionLabel).filter(Boolean);
}

function getFriendlyError(error: unknown) {
  const technical = error as TechnicalError;
  const message = technical?.response?.data
    ? readable((technical.response.data as { message?: unknown }).message)
    : readable(technical?.message);
  const diagnosticText = [
    message,
    technical?.response?.data ? JSON.stringify(technical.response.data) : "",
    error instanceof Error ? error.message : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (/token|jwt|unauthorized|401/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete that request.",
      reason: "Invalid GHL token.",
    };
  }

  if (/expired/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete that request.",
      reason: "The approval window expired.",
    };
  }

  if (/unsupported/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete that request.",
      reason: "One part of this is not supported yet.",
    };
  }

  if (/ghl|rejected|400|403|422|500/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete that request.",
      reason: "GHL rejected the request.",
    };
  }

  return {
    title: "I couldn't complete that request.",
    reason: message || "Something blocked completion.",
  };
}

function estimateCompletion(plan: GhlAiCommanderPlanResponse | null) {
  const count = asArray(plan?.plannedApiActions).length;
  if (count <= 2) return "Under a minute";
  if (count <= 6) return "About 2 minutes";
  return "A few minutes";
}

function riskTone(plan: GhlAiCommanderPlanResponse | null) {
  if (plan?.riskLevel === "high" || plan?.destructive) return "text-rose-700 bg-rose-50 border-rose-200";
  if (plan?.riskLevel === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
        {title}
      </div>
      <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function TechnicalDetails({
  plan,
  execution,
  error,
}: {
  plan?: GhlAiCommanderPlanResponse;
  execution?: GhlAiCommanderExecuteResponse;
  error?: unknown;
}) {
  if (!plan && !execution && !error) return null;

  return (
    <details className="group mt-5 rounded-[22px] border border-slate-200 bg-white/80">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-slate-700">
        <span>Show technical details</span>
        <ChevronDownIcon className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t border-slate-100 p-4">
        {plan && (
          <>
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Confirmation ID
              </div>
              <div className="break-all rounded-2xl bg-slate-100 p-3 text-xs font-bold text-slate-700">
                {plan.confirmationId}
              </div>
            </div>
            <JsonPanel title="JSON" value={plan} />
          </>
        )}
        {execution && <JsonPanel title="Execution" value={execution} />}
        {error ? <JsonPanel title="Developer diagnostics" value={error} /> : null}
      </div>
    </details>
  );
}

function ThinkingBubble({ label = "Jarvis is thinking" }: { label?: string }) {
  return (
    <div className="jarvis-fade flex items-center gap-3 rounded-[26px] border border-white/60 bg-white/90 px-5 py-4 text-sm font-bold text-slate-700 shadow-sm">
      <span className="flex gap-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-300 [animation-delay:240ms]" />
      </span>
      {label}
    </div>
  );
}

function ChatText({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <article
      className={`jarvis-fade flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[760px] rounded-[28px] px-5 py-4 text-[15px] font-semibold leading-7 shadow-sm ${
          isUser
            ? "bg-[#0E1424] text-white"
            : "border border-white/70 bg-white/90 text-slate-800"
        }`}
      >
        {message.text}
      </div>
    </article>
  );
}

function DailyBriefMessage({ firstName }: { firstName: string }) {
  const cards = [
    {
      title: "Conversations",
      body: "No customers are waiting.",
      icon: ChatBubbleLeftRightIcon,
      tone: "bg-blue-50 text-blue-700 border-blue-100",
    },
    {
      title: "Campaigns",
      body: "No campaigns are currently running.",
      icon: ChartBarIcon,
      tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    {
      title: "Follow-ups",
      body: "No callbacks are scheduled.",
      icon: PhoneArrowUpRightIcon,
      tone: "bg-violet-50 text-violet-700 border-violet-100",
    },
    {
      title: "Attention",
      body: "Nothing needs your attention right now.",
      icon: ExclamationTriangleIcon,
      tone: "bg-amber-50 text-amber-700 border-amber-100",
    },
  ];

  return (
    <article className="jarvis-fade flex justify-start">
      <div className="w-full max-w-[900px] rounded-[32px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_70px_rgba(15,23,42,0.10)] md:p-6">
        <div className="max-w-2xl">
          <div className="text-sm font-black text-slate-950">
            {getGreeting()}, {firstName}.
          </div>
          <p className="mt-2 text-2xl font-black tracking-normal text-slate-950">
            I&apos;ve checked everything this morning.
          </p>
          <p className="mt-2 text-base font-bold text-slate-600">
            Here&apos;s today&apos;s briefing.
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <section
                key={card.title}
                className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
              >
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${card.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="mt-4 text-sm font-black text-slate-950">{card.title}</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{card.body}</p>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-lg font-black text-slate-950">
          What would you like me to accomplish today?
        </p>
      </div>
    </article>
  );
}

function PlanMessage({
  plan,
  execution,
  error,
  canceled,
  executing,
  onApprove,
  onCancel,
}: {
  plan: GhlAiCommanderPlanResponse;
  execution?: GhlAiCommanderExecuteResponse;
  error?: unknown;
  canceled: boolean;
  executing: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const bullets = getPlanBullets(plan);
  const objects = getObjectsSummary(plan);
  const messages = getMessageSummary(plan);
  const unsupported = unsupportedFromPlan(plan);
  const completed = execution?.status === "executed";
  const failed = Boolean(error) || execution?.status === "failed";
  const friendlyError = failed ? getFriendlyError(error || execution) : null;
  const created = getExecuteLabels(execution);

  return (
    <article className="jarvis-fade flex justify-start">
      <div className="w-full max-w-[900px] overflow-hidden rounded-[32px] border border-white/70 bg-white/95 shadow-[0_18px_70px_rgba(15,23,42,0.10)]">
        <div className="p-5 md:p-6">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-500">
            I understand.
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-normal text-slate-950">
            Here&apos;s what I plan to do.
          </h3>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-700">
            {plan.summary || "I will prepare the work, show you the impact, and wait for approval before anything changes."}
          </p>
          <div className="mt-5 space-y-3">
            {(bullets.length ? bullets : ["Prepare the work and wait for approval."]).map((item) => (
              <div key={item} className="flex gap-3 text-[15px] font-bold leading-7 text-slate-800">
                <CheckCircleIcon className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm font-black text-blue-700">
            Nothing has been changed yet.
          </p>

          <div className="mt-6">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Estimated impact
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
              <Impact label="Contacts" value={String(objects.filter((item) => /contact/i.test(item)).length || objects.length || 0)} />
              <Impact label="Messages" value={String(messages.length)} />
              <Impact label="Workflows" value={String(objects.filter((item) => /workflow/i.test(item)).length)} />
              <Impact label="Risk" value={titleCase(plan.riskLevel || "low")} tone={riskTone(plan)} />
              <Impact label="Time" value={estimateCompletion(plan)} />
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4 md:px-6">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Message copy
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {messages.map((item) => (
                <div key={`${item.channel}-${item.headline}-${item.timing}`} className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    {item.channel} {item.timing ? `- ${item.timing}` : ""}
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-950">{item.headline}</div>
                  {item.body && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.body}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {unsupported.length > 0 && (
          <div className="mx-5 mb-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-950 md:mx-6">
            <div className="text-sm font-black">Before I continue...</div>
            <div className="mt-3 space-y-2">
              {unsupported.map((item, index) => (
                <div key={index} className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-bold">
                  {unsupportedCopy(item)}
                </div>
              ))}
            </div>
          </div>
        )}

        {completed && (
          <div className="mx-5 mb-5 rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 md:mx-6">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-7 w-7 flex-shrink-0 text-emerald-600" aria-hidden="true" />
              <div>
                <h3 className="text-2xl font-black">Done.</h3>
                <p className="mt-1 text-sm font-bold">Everything completed successfully.</p>
                <p className="mt-4 text-sm font-black">I created:</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(created.length ? created : ["No additional action is required."]).map((item) => (
                    <div key={item} className="flex gap-2 rounded-2xl bg-white/70 px-3 py-2 text-sm font-black">
                      <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm font-bold">No additional action is required.</p>
              </div>
            </div>
          </div>
        )}

        {failed && friendlyError && (
          <div className="mx-5 mb-5 rounded-[26px] border border-rose-200 bg-rose-50 p-5 text-rose-950 md:mx-6">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-7 w-7 flex-shrink-0 text-rose-600" aria-hidden="true" />
              <div>
                <h3 className="text-2xl font-black">{friendlyError.title}</h3>
                <p className="mt-3 text-sm font-black">Reason:</p>
                <p className="mt-1 text-sm font-semibold">{friendlyError.reason}</p>
                <p className="mt-4 text-sm font-semibold">Would you like to see technical details?</p>
              </div>
            </div>
          </div>
        )}

        {!completed && !failed && (
          <div className="border-t border-slate-100 bg-slate-50 p-5 md:p-6">
            <div className="mx-auto max-w-xl text-center">
              <h4 className="text-3xl font-black text-slate-950">Ready?</h4>
              <p className="mt-2 text-sm font-bold text-slate-600">
                Nothing has been changed yet.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={executing || canceled}
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-black text-white shadow-[0_16px_45px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {executing ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Working...
                    </>
                  ) : (
                    "Approve & Execute"
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={executing || canceled}
                  className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canceled ? "Canceled" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-5 md:px-6 md:pb-6">
          <TechnicalDetails plan={plan} execution={execution} error={error} />
        </div>
      </div>
    </article>
  );
}

function Impact({
  label,
  value,
  tone = "border-slate-200 bg-white text-slate-950",
  wide = false,
}: {
  label: string;
  value: string;
  tone?: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-3 py-2 ${tone} ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.12em] opacity-50">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

export default function JarvisModule() {
  const { user } = useAuth();
  const [statusLine, setStatusLine] = useState(STATUS_LINES[0]);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState(INITIAL_CONVERSATIONS[0].id);
  const [draft, setDraft] = useState("");
  const [planning, setPlanning] = useState(false);
  const [thinkingLine, setThinkingLine] = useState(THINKING_LINES[0]);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [executionByPlanId, setExecutionByPlanId] = useState<Record<string, GhlAiCommanderExecuteResponse>>({});
  const [errorByPlanId, setErrorByPlanId] = useState<Record<string, unknown>>({});
  const [canceledPlans, setCanceledPlans] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setStatusLine(STATUS_LINES[Math.floor(Math.random() * STATUS_LINES.length)]);
  }, []);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ||
    conversations[0];
  const firstName = getFirstName(user?.name);

  const updateConversation = (
    conversationId: string,
    updater: (conversation: Conversation) => Conversation
  ) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation
      )
    );
  };

  const startNewConversation = () => {
    const next: Conversation = {
      id: id(),
      title: "New Conversation",
      subtitle: "Ready",
      messages: [
        {
          id: id(),
          role: "jarvis",
          kind: "text",
          text: "I'm here. Tell me what you want handled.",
        },
      ],
    };
    setConversations((current) => [next, ...current]);
    setActiveConversationId(next.id);
    setDraft("");
  };

  const selectSuggestion = (prompt: string) => {
    if (!activeConversation) startNewConversation();
    setDraft(prompt);
  };

  const handleAnalyze = async () => {
    const trimmed = draft.trim();
    if (!trimmed || planning) return;

    const conversationId = activeConversation.id;
    const userMessage: ChatMessage = {
      id: id(),
      role: "user",
      kind: "text",
      text: trimmed,
    };

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title:
        conversation.title === "Today" || conversation.title === "New Conversation"
          ? titleFromPrompt(trimmed)
          : conversation.title,
      subtitle: "In progress",
      messages: [...conversation.messages, userMessage],
    }));
    setDraft("");
    setPlanning(true);
    setThinkingLine(THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)]);
    const thinkingStartedAt = Date.now();

    try {
      const nextPlan = await generateGhlAiCommanderPlan(trimmed);
      await holdThinking(thinkingStartedAt);
      const planMessage: ChatMessage = {
        id: id(),
        role: "jarvis",
        kind: "plan",
        plan: nextPlan,
      };
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        subtitle: `${titleCase(nextPlan.riskLevel || "low")} risk`,
        messages: [...conversation.messages, planMessage],
      }));
    } catch (planError) {
      await holdThinking(thinkingStartedAt);
      const friendly = getFriendlyError(planError);
      const errorMessage: ChatMessage = {
        id: id(),
        role: "jarvis",
        kind: "error",
        text: `${friendly.title} ${friendly.reason}`,
        error: planError,
      };
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        subtitle: "Needs attention",
        messages: [...conversation.messages, errorMessage],
      }));
    } finally {
      setPlanning(false);
    }
  };

  const approvePlan = async (plan: GhlAiCommanderPlanResponse) => {
    if (!plan.confirmationId || executingPlanId) return;

    setExecutingPlanId(plan.confirmationId);
    setErrorByPlanId((current) => {
      const next = { ...current };
      delete next[plan.confirmationId];
      return next;
    });

    try {
      const result = await executeGhlAiCommanderPlan(plan.confirmationId);
      setExecutionByPlanId((current) => ({
        ...current,
        [plan.confirmationId]: result,
      }));
      if (result.status !== "executed") {
        setErrorByPlanId((current) => ({
          ...current,
          [plan.confirmationId]: {
            message: "GHL rejected it.",
            response: { data: { errors: result.errors || [] } },
          },
        }));
      }
    } catch (executeError) {
      setErrorByPlanId((current) => ({
        ...current,
        [plan.confirmationId]: executeError,
      }));
    } finally {
      setExecutingPlanId(null);
    }
  };

  const cancelPlan = (plan: GhlAiCommanderPlanResponse) => {
    if (!plan.confirmationId) return;
    setCanceledPlans((current) => ({ ...current, [plan.confirmationId]: true }));
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-950">
      <div className="grid min-h-screen gap-4 p-3 lg:grid-cols-[280px_minmax(0,1fr)_310px] lg:p-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="order-2 rounded-[30px] border border-white/10 bg-white/[0.06] p-4 text-white shadow-2xl backdrop-blur-xl lg:order-1 lg:pt-16">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Jarvis
              </div>
              <h2 className="mt-1 text-xl font-black">Conversations</h2>
            </div>
            <button
              type="button"
              onClick={startNewConversation}
              aria-label="New conversation"
              className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
            >
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {conversations.map((conversation) => {
              const active = conversation.id === activeConversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`w-full rounded-[18px] border px-4 py-3 text-left transition duration-200 hover:translate-x-0.5 ${
                    active
                      ? "border-blue-300/40 bg-blue-400/15 text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <div className="truncate text-sm font-bold">{conversation.title}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="order-1 flex min-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[#EEF3FB] shadow-2xl lg:order-2">
          <section className="relative overflow-hidden bg-[#090F1D] px-5 pb-7 pt-20 text-white md:px-8 md:pb-9 lg:pt-9">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(48,110,236,0.30),rgba(15,23,42,0)_44%),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0))]" />
            <div className="relative">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                  <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                  JARVIS
                </div>
                <h1 className="mt-5 text-4xl font-black tracking-normal md:text-6xl">
                  {getGreeting()}, {firstName}.
                </h1>
                <p className="mt-4 text-xl font-black text-white md:text-2xl">{statusLine}</p>
              </div>
            </div>
          </section>

          <section className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
            <div className="mx-auto max-w-5xl space-y-5">
              {activeConversation.messages.map((chat) => {
                if (chat.kind === "brief") {
                  return <DailyBriefMessage key={chat.id} firstName={firstName} />;
                }

                if (chat.kind === "plan" && chat.plan) {
                  return (
                    <PlanMessage
                      key={chat.id}
                      plan={chat.plan}
                      execution={executionByPlanId[chat.plan.confirmationId]}
                      error={errorByPlanId[chat.plan.confirmationId]}
                      canceled={Boolean(canceledPlans[chat.plan.confirmationId])}
                      executing={executingPlanId === chat.plan.confirmationId}
                      onApprove={() => approvePlan(chat.plan as GhlAiCommanderPlanResponse)}
                      onCancel={() => cancelPlan(chat.plan as GhlAiCommanderPlanResponse)}
                    />
                  );
                }

                if (chat.kind === "error") {
                  const friendly = getFriendlyError(chat.error);
                  return (
                    <article key={chat.id} className="jarvis-fade flex justify-start">
                      <div className="max-w-[760px] rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm">
                        <h3 className="text-lg font-black">{friendly.title}</h3>
                        <p className="mt-2 text-sm font-bold">Reason:</p>
                        <p className="mt-1 text-sm font-semibold">{friendly.reason}</p>
                        <p className="mt-4 text-sm font-semibold">Would you like to see technical details?</p>
                        <TechnicalDetails error={chat.error} />
                      </div>
                    </article>
                  );
                }

                return <ChatText key={chat.id} message={chat} />;
              })}

              {planning && <ThinkingBubble label={thinkingLine} />}
            </div>
          </section>

          <section className="border-t border-slate-200 bg-white/80 p-4 backdrop-blur md:p-5">
            <div className="mx-auto max-w-5xl">
              <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
                <div className="px-2 pb-2 text-sm font-black text-slate-900">
                  What would you like me to accomplish today?
                </div>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleAnalyze();
                    }
                  }}
                  placeholder={PROMPT_PLACEHOLDER}
                  className="min-h-[118px] w-full resize-none rounded-[22px] bg-slate-50 px-4 py-4 text-base font-semibold leading-7 text-slate-950 outline-none placeholder:text-slate-400 focus:bg-white"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="hidden items-center gap-2 text-xs font-bold text-slate-400 sm:flex">
                    <BoltIcon className="h-4 w-4" aria-hidden="true" />
                    I will review first, then wait for approval.
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAnalyze()}
                    disabled={planning || !draft.trim()}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0E1424] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {planning ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Thinking
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="order-3 space-y-4 rounded-[30px] border border-white/10 bg-white/[0.06] p-4 text-white shadow-2xl backdrop-blur-xl">
          <section>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Recommended for Today
            </div>
            <div className="mt-4 grid gap-3">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  onClick={() => selectSuggestion(suggestion.prompt)}
                  className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 text-left transition hover:border-blue-300/40 hover:bg-blue-400/10"
                >
                  <div className="text-sm font-black text-white">{suggestion.title}</div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                    {suggestion.body}
                  </p>
                </button>
              ))}
            </div>
          </section>

        </aside>
      </div>
      <style>{`
        @keyframes jarvisFade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .jarvis-fade {
          animation: jarvisFade 360ms ease-out both;
        }
      `}</style>
    </div>
  );
}
