"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  executeGhlAiCommanderPlan,
  generateGhlAiCommanderPlan,
  type GhlAiCommanderExecuteResponse,
  type GhlAiCommanderPlanResponse,
} from "@/lib/admin-service";

const TEST_COMMAND =
  "Create a test GHL contact named AI Test Contact, phone 6315991363, tag ai-test.";

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  const response = error as {
    response?: { data?: { message?: string; error?: string; errors?: unknown } };
    message?: string;
  };

  const data = response.response?.data;
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (data?.errors) return JSON.stringify(data.errors, null, 2);
  if (response.message) return response.message;
  return "Jarvis request failed.";
}

function unsupportedFromPlan(plan: GhlAiCommanderPlanResponse | null) {
  if (!plan) return [];
  const explicit = asArray(plan.unsupportedActions);
  if (explicit.length) return explicit;
  return asArray(plan.plannedApiActions).filter((action) => {
    if (!action || typeof action !== "object") return false;
    const record = action as Record<string, unknown>;
    return record.supported === false || record.actionType === "unsupported";
  });
}

function RiskBadge({
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
      {risk}
    </span>
  );
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${
        value
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {String(value)}
    </span>
  );
}

function DataBlock({
  title,
  value,
  empty = "None",
}: {
  title: string;
  value: unknown;
  empty?: string;
}) {
  const items = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">{empty}</p>
      ) : (
        <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(items, null, 2)}
        </pre>
      )}
    </section>
  );
}

export default function JarvisModule() {
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<GhlAiCommanderPlanResponse | null>(null);
  const [executeResult, setExecuteResult] =
    useState<GhlAiCommanderExecuteResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");

  const unsupportedActions = useMemo(() => unsupportedFromPlan(plan), [plan]);
  const highRisk = plan?.riskLevel === "high" || plan?.destructive === true;
  const canExecute =
    Boolean(plan?.confirmationId) &&
    !executing &&
    executeResult?.status !== "executed";

  const handleMessageChange = (value: string) => {
    setMessage(value);
    setPlan(null);
    setExecuteResult(null);
    setError("");
  };

  const handleGeneratePlan = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Enter a GHL task for Jarvis.");
      return;
    }

    setPlanning(true);
    setError("");
    setPlan(null);
    setExecuteResult(null);

    try {
      const nextPlan = await generateGhlAiCommanderPlan(trimmed);
      setPlan(nextPlan);
    } catch (planError) {
      setError(getErrorMessage(planError));
    } finally {
      setPlanning(false);
    }
  };

  const handleExecute = async () => {
    if (!plan?.confirmationId) return;

    setExecuting(true);
    setError("");

    try {
      const result = await executeGhlAiCommanderPlan(plan.confirmationId);
      setExecuteResult(result);
      if (result.status !== "executed" && asArray(result.errors).length) {
        setError("Jarvis reached GHL, but execution failed.");
      }
    } catch (executeError) {
      setError(getErrorMessage(executeError));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[26px] bg-slate-950 text-white shadow-lg">
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              <SparklesIcon className="h-4 w-4" aria-hidden="true" />
              Jarvis
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-normal md:text-4xl">
              Jarvis
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              AI Commander for GoHighLevel
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleMessageChange(TEST_COMMAND)}
            className="self-end rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-xs font-bold text-white transition hover:bg-white/15 md:min-w-[340px]"
          >
            {TEST_COMMAND}
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <label
          htmlFor="jarvis-message"
          className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
        >
          Command
        </label>
        <textarea
          id="jarvis-message"
          value={message}
          onChange={(event) => handleMessageChange(event.target.value)}
          placeholder="Tell Jarvis what to do in GHL…"
          className="mt-3 min-h-[180px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-500">
            Approval is required before anything runs in GHL.
          </p>
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={planning || !message.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {planning ? "Generating..." : "Generate Plan"}
          </button>
        </div>
      </section>

      {error && (
        <section className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </section>
      )}

      {plan && (
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Plan
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {plan.summary || "GHL plan ready"}
                </h3>
                <p className="mt-2 text-sm font-bold text-blue-700">
                  Nothing has been changed in GHL yet.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    riskLevel
                  </div>
                  <RiskBadge riskLevel={plan.riskLevel} destructive={plan.destructive} />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    destructive
                  </div>
                  <BooleanBadge value={Boolean(plan.destructive)} />
                </div>
              </div>
            </div>
          </div>

          {highRisk && (
            <div className="flex gap-3 border-b border-rose-100 bg-rose-50 px-5 py-4 text-rose-800">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div>
                <div className="text-sm font-black">High-risk approval</div>
                <p className="mt-1 text-sm font-semibold">
                  Review every affected object and message before execution.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Confirmation ID
              </div>
              <div className="mt-1 break-all text-sm font-black text-slate-950">
                {plan.confirmationId}
              </div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Expires
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">
                {formatDateTime(plan.expiresAt)}
              </div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Approval Required
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">
                {String(plan.requiresApproval ?? plan.approvalRequired ?? true)}
              </div>
            </div>
          </div>

          <DataBlock title="Exact Plan" value={plan.exactPlan} />
          <DataBlock title="Objects Affected" value={plan.objectsAffected} />
          <DataBlock
            title="Messages To Send Or Create"
            value={plan.messagesToSendOrCreate}
          />
          <DataBlock title="Planned API Actions" value={plan.plannedApiActions} />
          <DataBlock
            title="Unsupported Actions"
            value={unsupportedActions}
            empty="No unsupported actions"
          />

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-slate-600">
              Execution uses this saved confirmation ID only.
            </p>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!canExecute}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {executing ? "Executing..." : "Approve & Execute"}
            </button>
          </div>
        </section>
      )}

      {executeResult && (
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Execution
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Status: {executeResult.status}
                </h3>
              </div>
              {executeResult.status === "executed" && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                  <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                  Executed in GHL
                </div>
              )}
            </div>
          </div>
          <DataBlock title="Executed Actions" value={executeResult.executedActions} />
          <DataBlock title="Results" value={executeResult.results} />
          <DataBlock title="Errors" value={executeResult.errors} empty="No errors" />
        </section>
      )}
    </div>
  );
}
