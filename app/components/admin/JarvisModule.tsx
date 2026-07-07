"use client";

import { useMemo, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/useAuth";
import {
  executeGhlAiCommanderPlan,
  generateGhlAiCommanderPlan,
  type GhlAiCommanderExecuteResponse,
  type GhlAiCommanderPlanResponse,
} from "@/lib/admin-service";

const SUGGESTED_ACTIONS = [
  "Create Roofing Campaign",
  "Create Membership Campaign",
  "Create SMS Follow-up",
  "Find Cold Leads",
  "Send Review Campaign",
  "Create Pipeline",
  "Create Workflow",
  "Import Contacts",
];

const PROMPT_EXAMPLES = [
  "Create a roofing campaign.",
  "Build a follow-up workflow.",
  "Create an SMS campaign.",
  "Move all interested leads.",
  "Create a pipeline.",
  "Find inactive contacts.",
  "Generate follow-up sequence.",
];

type ConversationItem = {
  id: string;
  role: "user" | "jarvis";
  title: string;
  body: string;
  tone?: "normal" | "success" | "error";
};

type TechnicalError = {
  message?: string;
  response?: { data?: unknown };
  status?: number;
};

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

function getPlanBullets(plan: GhlAiCommanderPlanResponse | null) {
  if (!plan) return [];
  const exactPlan = asArray(plan.exactPlan)
    .map(readable)
    .filter(Boolean)
    .slice(0, 6);
  if (exactPlan.length) return exactPlan;

  return asArray(plan.plannedApiActions)
    .map((action) => {
      const record = objectRecord(action);
      return readable(record.description) || titleCase(readable(record.actionType));
    })
    .filter(Boolean)
    .slice(0, 6);
}

function getObjectsSummary(plan: GhlAiCommanderPlanResponse | null) {
  return asArray(plan?.objectsAffected)
    .map((item) => {
      const record = objectRecord(item);
      const operation = readable(record.operation);
      const type = readable(record.type);
      const name = readable(record.name);
      const details = readable(record.details);
      return [operation && titleCase(operation), type && titleCase(type), name]
        .filter(Boolean)
        .join(" ")
        .trim() || details;
    })
    .filter(Boolean);
}

function getMessageSummary(plan: GhlAiCommanderPlanResponse | null) {
  return asArray(plan?.messagesToSendOrCreate)
    .map((item) => {
      const record = objectRecord(item);
      const channel = readable(record.channel) || "Message";
      const timing = readable(record.timing);
      const subject = readable(record.subject);
      const body = readable(record.body);
      return {
        channel,
        timing,
        headline: subject || `${channel} message`,
        body,
      };
    })
    .filter((item) => item.headline || item.body);
}

function unsupportedFromPlan(plan: GhlAiCommanderPlanResponse | null) {
  if (!plan) return [];
  const explicit = asArray(plan.unsupportedActions);
  if (explicit.length) return explicit;
  return asArray(plan.plannedApiActions).filter((action) => {
    const record = objectRecord(action);
    return record.supported === false || record.actionType === "unsupported";
  });
}

function unsupportedCopy(item: unknown) {
  const record = objectRecord(item);
  const requested = readable(record.requestedAction) || readable(record.actionType);
  const reason = readable(record.reason) || readable(record.unsupportedReason);
  if (requested && reason) return `${requested}: ${reason}`;
  return requested || reason || "This needs more information before Jarvis can continue.";
}

function actionLabel(value: unknown) {
  const record = objectRecord(value);
  const type = readable(record.actionType);
  const description = readable(record.description);
  if (description) return description;

  const labels: Record<string, string> = {
    create_contact: "Create contact",
    upsert_contact: "Create or update contact",
    update_contact: "Update contact",
    add_contact_tags: "Add tags",
    remove_contact_tags: "Remove tags",
    create_contact_note: "Create note",
    create_contact_task: "Create task",
    add_contact_to_campaign: "Add contact to campaign",
    add_contact_to_workflow: "Add contact to workflow",
    create_opportunity: "Create opportunity",
    create_pipeline: "Create pipeline",
    send_conversation_message: "Send message",
    create_calendar_appointment: "Create appointment",
    get_pipelines: "Review pipelines",
    get_workflows: "Review workflows",
  };

  return labels[type] || titleCase(type) || "Complete action";
}

function getExecuteLabels(result: GhlAiCommanderExecuteResponse | null) {
  return asArray(result?.executedActions).map(actionLabel).filter(Boolean);
}

function estimateCompletion(plan: GhlAiCommanderPlanResponse | null) {
  const actions = asArray(plan?.plannedApiActions).length;
  if (!actions) return "Under a minute";
  if (actions <= 2) return "Under a minute";
  if (actions <= 6) return "About 2 minutes";
  return "A few minutes";
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
      title: "I couldn't complete this task.",
      reason: "GHL rejected the request.",
      possibleReason: "Invalid or unauthorized GHL token.",
    };
  }

  if (/expired/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete this task.",
      reason: "This approval window expired.",
      possibleReason: "Create a fresh plan and approve it within 30 minutes.",
    };
  }

  if (/unsupported/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete this task.",
      reason: "One or more requested GHL actions are not supported yet.",
      possibleReason: "Review the plan and adjust the request.",
    };
  }

  if (/ghl|request failed|rejected|400|403|422|500/i.test(diagnosticText)) {
    return {
      title: "I couldn't complete this task.",
      reason: "GHL rejected the request.",
      possibleReason: "Open technical details for the exact response.",
    };
  }

  return {
    title: "I couldn't complete this task.",
    reason: message || "Something stopped Jarvis before completion.",
    possibleReason: "Review the request or open technical details.",
  };
}

function RiskPill({
  riskLevel,
  destructive,
}: {
  riskLevel?: string;
  destructive?: boolean;
}) {
  const risk = String(riskLevel || "low").toLowerCase();
  const tone =
    risk === "high" || destructive
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : risk === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${tone}`}>
      {risk} risk
    </span>
  );
}

function ImpactMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    blue: "border-blue-100 bg-blue-50 text-blue-900",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    rose: "border-rose-100 bg-rose-50 text-rose-900",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.14em] opacity-60">
        {label}
      </div>
      <div className="mt-2 text-lg font-black">{value}</div>
    </div>
  );
}

function TechnicalDetails({
  plan,
  execution,
  error,
}: {
  plan: GhlAiCommanderPlanResponse | null;
  execution: GhlAiCommanderExecuteResponse | null;
  error: unknown;
}) {
  if (!plan && !execution && !error) return null;

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-black text-slate-800">
        <span>Advanced Details</span>
        <ChevronDownIcon className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-100 p-5">
        <div className="grid gap-4">
          {plan && (
            <>
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Confirmation ID
                </div>
                <div className="break-all rounded-xl bg-slate-100 p-3 text-xs font-bold text-slate-700">
                  {plan.confirmationId}
                </div>
              </div>
              <JsonPanel title="Plan JSON" value={plan} />
            </>
          )}
          {execution && <JsonPanel title="Execution JSON" value={execution} />}
          {error ? <JsonPanel title="Error Details" value={error} /> : null}
        </div>
      </div>
    </details>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function JarvisModule() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<GhlAiCommanderPlanResponse | null>(null);
  const [executeResult, setExecuteResult] =
    useState<GhlAiCommanderExecuteResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [history, setHistory] = useState<ConversationItem[]>([]);

  const firstName = getFirstName(user?.name);
  const planBullets = useMemo(() => getPlanBullets(plan), [plan]);
  const objects = useMemo(() => getObjectsSummary(plan), [plan]);
  const messages = useMemo(() => getMessageSummary(plan), [plan]);
  const unsupportedActions = useMemo(() => unsupportedFromPlan(plan), [plan]);
  const completedLabels = useMemo(() => getExecuteLabels(executeResult), [executeResult]);
  const highRisk = plan?.riskLevel === "high" || plan?.destructive === true;
  const canExecute =
    Boolean(plan?.confirmationId) &&
    !executing &&
    executeResult?.status !== "executed";
  const friendlyError = error ? getFriendlyError(error) : null;

  const addHistory = (item: Omit<ConversationItem, "id">) => {
    setHistory((current) => [
      ...current,
      { ...item, id: `${Date.now()}-${current.length}` },
    ]);
  };

  const resetForNewPrompt = (value: string) => {
    setMessage(value);
    setPlan(null);
    setExecuteResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError(new Error("Tell Jarvis what you want handled in GHL."));
      return;
    }

    setPlanning(true);
    setError(null);
    setPlan(null);
    setExecuteResult(null);
    addHistory({
      role: "user",
      title: "You",
      body: trimmed,
    });

    try {
      const nextPlan = await generateGhlAiCommanderPlan(trimmed);
      setPlan(nextPlan);
      addHistory({
        role: "jarvis",
        title: "Jarvis",
        body: nextPlan.summary || "I analyzed the request and prepared a plan.",
      });
    } catch (planError) {
      setError(planError);
      const friendly = getFriendlyError(planError);
      addHistory({
        role: "jarvis",
        title: "Jarvis",
        body: `${friendly.reason} ${friendly.possibleReason}`,
        tone: "error",
      });
    } finally {
      setPlanning(false);
    }
  };

  const handleExecute = async () => {
    if (!plan?.confirmationId) return;

    setExecuting(true);
    setError(null);

    try {
      const result = await executeGhlAiCommanderPlan(plan.confirmationId);
      setExecuteResult(result);
      if (result.status === "executed") {
        addHistory({
          role: "jarvis",
          title: "Jarvis",
          body: "Completed. I successfully executed the approved GHL plan.",
          tone: "success",
        });
      } else {
        const executionError = {
          message: "GHL rejected the request.",
          response: { data: { errors: result.errors || [] } },
        };
        setError(executionError);
        addHistory({
          role: "jarvis",
          title: "Jarvis",
          body: "I couldn't complete this task. GHL rejected the request.",
          tone: "error",
        });
      }
    } catch (executeError) {
      setError(executeError);
      const friendly = getFriendlyError(executeError);
      addHistory({
        role: "jarvis",
        title: "Jarvis",
        body: `${friendly.reason} ${friendly.possibleReason}`,
        tone: "error",
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] bg-[#080D18] text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="bg-[linear-gradient(135deg,rgba(48,110,236,0.28),rgba(15,23,42,0)_44%),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0))] px-5 py-8 md:px-8 md:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                Jarvis
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-normal md:text-6xl">
                {getGreeting()}, {firstName}.
              </h2>
              <p className="mt-4 text-2xl font-black text-white md:text-3xl">
                I&apos;m ready.
              </p>
              <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-slate-300">
                What would you like me to do today?
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
              GHL operations are approval-only
            </div>
          </div>
        </div>
      </section>

      {history.length > 0 && (
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Conversation History
          </div>
          <div className="space-y-3">
            {history.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border px-4 py-3 ${
                  item.role === "user"
                    ? "ml-auto max-w-3xl border-slate-200 bg-slate-50 text-slate-900"
                    : item.tone === "success"
                      ? "mr-auto max-w-3xl border-emerald-100 bg-emerald-50 text-emerald-950"
                      : item.tone === "error"
                        ? "mr-auto max-w-3xl border-rose-100 bg-rose-50 text-rose-950"
                        : "mr-auto max-w-3xl border-blue-100 bg-blue-50 text-blue-950"
                }`}
              >
                <div className="text-xs font-black uppercase tracking-[0.14em] opacity-60">
                  {item.title}
                </div>
                <p className="mt-1 text-sm font-semibold leading-6">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <textarea
          value={message}
          onChange={(event) => resetForNewPrompt(event.target.value)}
          placeholder={PROMPT_EXAMPLES.join("\n")}
          className="min-h-[210px] w-full resize-y rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-base font-semibold leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => resetForNewPrompt(action)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              {action}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-500">
            Jarvis will analyze first. Nothing executes until you approve.
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={planning || !message.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {planning ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                Analyzing...
              </>
            ) : (
              "Analyze Request"
            )}
          </button>
        </div>
      </section>

      {friendlyError && !plan && (
        <section className="rounded-[26px] border border-rose-200 bg-rose-50 p-5 text-rose-950 shadow-sm">
          <div className="flex gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <h3 className="text-xl font-black">{friendlyError.title}</h3>
              <p className="mt-2 text-sm font-bold">Reason: {friendlyError.reason}</p>
              <p className="mt-1 text-sm font-semibold text-rose-800">
                Possible reason: {friendlyError.possibleReason}
              </p>
            </div>
          </div>
        </section>
      )}

      {plan && (
        <section className="rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="p-5 md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Here&apos;s what I understand
                </div>
                <h3 className="mt-3 text-2xl font-black text-slate-950">
                  {plan.summary || "I prepared a plan for this GHL request."}
                </h3>
                <p className="mt-3 text-sm font-black text-blue-700">
                  Nothing has been changed yet.
                </p>
              </div>
              <RiskPill riskLevel={plan.riskLevel} destructive={plan.destructive} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <ImpactMetric
                label="Contacts affected"
                value={String(objects.filter((item) => /contact/i.test(item)).length || objects.length || 0)}
                tone="blue"
              />
              <ImpactMetric
                label="Estimated messages"
                value={String(messages.length)}
                tone={messages.length ? "amber" : "slate"}
              />
              <ImpactMetric
                label="Risk"
                value={titleCase(plan.riskLevel || "low")}
                tone={highRisk ? "rose" : plan.riskLevel === "medium" ? "amber" : "emerald"}
              />
              <ImpactMetric
                label="Completion time"
                value={estimateCompletion(plan)}
                tone="slate"
              />
            </div>

            <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <h4 className="text-sm font-black text-slate-950">You would like me to:</h4>
                <div className="mt-3 space-y-3">
                  {(planBullets.length ? planBullets : ["Prepare a safe GHL plan for approval."]).map((item) => (
                    <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                      <p className="text-sm font-bold leading-6 text-slate-800">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-black text-slate-950">Objects Jarvis sees</h4>
                  <div className="mt-3 space-y-2">
                    {objects.length ? (
                      objects.slice(0, 5).map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
                        No existing GHL objects were identified.
                      </div>
                    )}
                  </div>
                </div>

                {messages.length > 0 && (
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Messages Jarvis will prepare</h4>
                    <div className="mt-3 space-y-2">
                      {messages.map((item) => (
                        <article key={`${item.channel}-${item.headline}-${item.timing}`} className="rounded-2xl border border-slate-200 px-4 py-3">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            {item.channel} {item.timing ? `- ${item.timing}` : ""}
                          </div>
                          <div className="mt-1 text-sm font-black text-slate-950">{item.headline}</div>
                          {item.body && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.body}</p>}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {unsupportedActions.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <div className="text-sm font-black">Before I continue...</div>
                <p className="mt-1 text-sm font-semibold">
                  I need one adjustment before this can be executed cleanly.
                </p>
                <div className="mt-3 space-y-2">
                  {unsupportedActions.map((item, index) => (
                    <div key={index} className="rounded-xl bg-white/70 px-3 py-2 text-sm font-bold">
                      {unsupportedCopy(item)}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => resetForNewPrompt(`${message.trim()}\n\nLet Jarvis write the missing copy, names, timing, and safe defaults.`)}
                  className="mt-4 rounded-full bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600"
                >
                  Let Jarvis write it
                </button>
              </div>
            )}

            {highRisk && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
                <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-rose-600" aria-hidden="true" />
                <div>
                  <div className="text-sm font-black">This needs careful review.</div>
                  <p className="mt-1 text-sm font-semibold">
                    Jarvis marked this as high risk or destructive. Review every contact, message, and object before approval.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-5 md:p-7">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-slate-950">
                  <ShieldCheckIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  <h3 className="text-2xl font-black">Ready to execute?</h3>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-600">
                  Nothing has been changed in GHL. After approval Jarvis will:
                </p>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {(planBullets.length ? planBullets.slice(0, 4) : ["Execute the approved GHL plan."]).map((item) => (
                    <div key={item} className="flex gap-2 text-sm font-bold text-slate-700">
                      <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExecute}
                disabled={!canExecute}
                className="inline-flex min-h-[58px] items-center justify-center rounded-2xl bg-blue-600 px-8 py-4 text-base font-black text-white shadow-[0_16px_40px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {executing ? "Executing..." : "Approve & Execute"}
              </button>
            </div>
          </div>
        </section>
      )}

      {executeResult && executeResult.status === "executed" && (
        <section className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm md:p-8">
          <div className="flex gap-4">
            <CheckCircleIcon className="h-8 w-8 flex-shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <h3 className="text-3xl font-black">Completed</h3>
              <p className="mt-2 text-base font-bold">
                Jarvis successfully completed your request.
              </p>
              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {(completedLabels.length ? completedLabels : ["Everything completed successfully."]).map((item) => (
                  <div key={item} className="flex gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm font-black">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {friendlyError && plan && (
        <section className="rounded-[26px] border border-rose-200 bg-rose-50 p-5 text-rose-950 shadow-sm">
          <div className="flex gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 flex-shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <h3 className="text-xl font-black">{friendlyError.title}</h3>
              <p className="mt-2 text-sm font-bold">Reason: {friendlyError.reason}</p>
              <p className="mt-1 text-sm font-semibold text-rose-800">
                Possible reason: {friendlyError.possibleReason}
              </p>
            </div>
          </div>
        </section>
      )}

      <TechnicalDetails plan={plan} execution={executeResult} error={error} />
    </div>
  );
}
