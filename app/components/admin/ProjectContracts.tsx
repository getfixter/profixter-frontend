"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ESignStatusBadge from "@/app/components/admin/ESignStatusBadge";
import InPersonSigning from "@/app/components/signing/InPersonSigning";
import SignatureDetails from "@/app/components/admin/SignaturePanel";
import {
  CONTRACT_WORK_TYPES,
  cancelProjectContract,
  downloadProjectContractPdf,
  emailProjectContract,
  generateProjectContractPdf,
  getContractEstimateOptions,
  getContractMeta,
  getDocumentSignatures,
  getProjectContracts,
  getSignatureMeta,
  saveProjectContractDraft,
  sendDocumentForSignature,
  sendForNativeSignature,
  resendNativeSignature,
  revokeNativeSignature,
  downloadNativeDocument,
  uploadManuallySignedDocument,
  uploadSignedProjectContract,
  type ContractEstimateOption,
  type ContractMeta,
  type ContractDiscountType,
  type DocumentSignature,
  type SignatureMeta,
  type ContractStatus,
  type ContractWorkType,
  type Project,
  type ProjectContract,
  type ProjectContractInput,
} from "@/lib/admin-service";

type PaymentScheduleDraft = {
  id: string;
  label: string;
  amount: string;
  dueCondition: string;
};

type DiscountDraft = {
  id: string;
  name: string;
  type: ContractDiscountType;
  value: string;
  note: string;
};

type ContractFormState = {
  contractId?: string;
  /**
   * The Estimate this Agreement is being built from. Sent once, on the draft
   * that first records it; the backend freezes its own copy from the database
   * and ignores later attempts to change it.
   */
  estimateId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerId: string;
  propertyAddress: string;
  workType: ContractWorkType;
  otherWorkType: string;
  projectDescription: string;
  scopeText: string;
  totalPrice: string;
  discounts: DiscountDraft[];
  depositRequired: string;
  paymentSchedule: PaymentScheduleDraft[];
  fullDepositConfirmed: boolean;
  zeroAdjustedPriceConfirmed: boolean;
  contractDate: string;
  /** True once the admin edits the date, which stops the backend rolling it. */
  contractDateIsManual: boolean;
  estimatedStartDate: string;
  estimatedCompletionDate: string;
  materialsAllowances: string;
  exclusions: string;
  permitResponsibility: string;
  specialInstructions: string;
  additionalNotes: string;
};

const STATUS_STYLES: Record<ContractStatus, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  Generated: "border-blue-200 bg-blue-50 text-blue-700",
  Emailed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Signed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Superseded: "border-slate-200 bg-slate-50 text-slate-500",
  Canceled: "border-rose-200 bg-rose-50 text-rose-700",
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents || 0) / 100);
}

function customerContractNumber(value?: string | null) {
  const text = String(value || "");
  const match = text.match(/(\d+)\D*$/);
  const sequence = match ? match[1] : text.replace(/\D/g, "");
  return (sequence || "0").padStart(6, "0");
}

function contractDisplayLabel(value?: string | null) {
  return `Contract #${customerContractNumber(value)}`;
}

function centsFromMoney(value: string) {
  const number = Number(String(value || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
}

function dollarsFromCents(cents: number) {
  if (!cents) return "";
  return (Number(cents || 0) / 100).toFixed(2);
}

const FULL_DEPOSIT_WARNING =
  "The entered deposit equals 100% of the adjusted contract price. Confirm that full payment is intentionally due before work begins.";
const ZERO_ADJUSTED_PRICE_WARNING =
  "Discounts reduce the adjusted contract price to $0. Confirm that this contract is intentionally being generated at no charge.";
const HIGH_DISCOUNT_WARNING =
  "Total discounts exceed 30% of the original contract price. Review before generating.";

function basisPointsFromPercentInput(value: string) {
  const normalized = String(value || "").replace(/[%\s]/g, "");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized) || normalized === "") return 0;
  const [wholePart, decimalPart = ""] = normalized.split(".");
  return Number(wholePart) * 100 + Number(decimalPart.padEnd(2, "0"));
}

function percentInputFromBasisPoints(value: number) {
  const basisPoints = Number(value || 0);
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  if (!fraction) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0+$/g, "")}`;
}

function calculatePercentageDiscountCents(originalCents: number, basisPoints: number) {
  return Math.floor((Number(originalCents || 0) * Number(basisPoints || 0) + 5000) / 10000);
}

function isBlankDiscount(discount: DiscountDraft) {
  return !discount.name.trim() && !discount.value.trim() && !discount.note.trim();
}

function discountAmountCents(originalCents: number, discount: DiscountDraft) {
  if (discount.type === "percentage") {
    return calculatePercentageDiscountCents(originalCents, basisPointsFromPercentInput(discount.value));
  }
  return centsFromMoney(discount.value);
}

function pricingFromForm(form: ContractFormState) {
  const original = centsFromMoney(form.totalPrice);
  const discounts = form.discounts
    .filter((discount) => !isBlankDiscount(discount))
    .map((discount) => ({
      ...discount,
      calculatedAmountCents: discountAmountCents(original, discount),
    }));
  const totalDiscount = discounts.reduce(
    (sum, discount) => sum + Number(discount.calculatedAmountCents || 0),
    0
  );
  const adjusted = Math.max(original - totalDiscount, 0);
  const deposit = centsFromMoney(form.depositRequired);
  const remaining = Math.max(adjusted - deposit, 0);
  const percentage = adjusted > 0 ? Math.round((deposit / adjusted) * 1000) / 10 : 0;
  const scheduleTotal = form.paymentSchedule.reduce(
    (sum, row) => sum + centsFromMoney(row.amount),
    0
  );
  const duplicateDiscountNames = discounts
    .map((discount) => discount.name.trim().toLowerCase())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) !== index);
  return {
    original,
    discounts,
    totalDiscount,
    adjusted,
    deposit,
    remaining,
    percentage,
    scheduleTotal,
    duplicateDiscountNames,
  };
}

function normalizeComparableText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addressHasStateAndZip(address: string) {
  return /\b[A-Z]{2}\b/i.test(address) && /\b\d{5}(?:-\d{4})?\b/.test(address);
}

function displayDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function defaultForm(project: Project): ContractFormState {
  const projectType = CONTRACT_WORK_TYPES.includes(project.projectType as ContractWorkType)
    ? (project.projectType as ContractWorkType)
    : "Other";
  return {
    customerName: project.customerSnapshot?.fullName || project.customerName || "",
    customerEmail: project.customerSnapshot?.email || project.email || "",
    customerPhone: project.customerSnapshot?.phone || project.phone || "",
    customerId: project.customerId || "",
    propertyAddress: project.propertySnapshot?.formattedAddress || project.address || "",
    workType: projectType,
    otherWorkType: projectType === "Other" ? project.projectType : "",
    projectDescription: project.notes || `${project.projectType} project for ${project.customerName}`,
    scopeText: "",
    totalPrice: project.estimateAmount ? String(project.estimateAmount) : "",
    discounts: [],
    depositRequired: project.depositAmount ? String(project.depositAmount) : "",
    paymentSchedule: [],
    fullDepositConfirmed: false,
    zeroAdjustedPriceConfirmed: false,
    contractDate: todayDate(),
    contractDateIsManual: false,
    estimatedStartDate: "",
    estimatedCompletionDate: "",
    materialsAllowances: "",
    exclusions: "",
    permitResponsibility: "",
    specialInstructions: "",
    additionalNotes: "",
  };
}

function formFromContract(contract: ProjectContract): ContractFormState {
  return {
    contractId: contract._id,
    estimateId: contract.estimateId || undefined,
    customerName: contract.customerSnapshot.fullName || "",
    customerEmail: contract.customerSnapshot.email || "",
    customerPhone: contract.customerSnapshot.phone || "",
    customerId: contract.customerSnapshot.customerId || "",
    propertyAddress: contract.propertySnapshot.address || "",
    workType: contract.workType,
    otherWorkType: contract.otherWorkType || "",
    projectDescription: contract.projectDescription || "",
    scopeText: contract.scopeText || "",
    totalPrice: dollarsFromCents(contract.originalContractPriceCents ?? contract.totalPriceCents),
    discounts: (contract.discounts || []).map((discount, index) => ({
      id: discount._id || `${index}-${discount.name}`,
      name: discount.name || "",
      type: discount.type || "fixed",
      value:
        discount.type === "percentage"
          ? percentInputFromBasisPoints(discount.value)
          : dollarsFromCents(discount.value),
      note: discount.note || "",
    })),
    depositRequired: dollarsFromCents(contract.depositAmountCents),
    fullDepositConfirmed: !!contract.fullDepositConfirmed,
    zeroAdjustedPriceConfirmed: !!contract.zeroAdjustedPriceConfirmed,
    paymentSchedule: (contract.paymentSchedule || []).map((row, index) => ({
      id: row._id || `${index}-${row.label}`,
      label: row.label,
      amount: dollarsFromCents(row.amountCents),
      dueCondition: row.dueCondition,
    })),
    contractDate: dateOnly(contract.dates.contractDate),
    contractDateIsManual: contract.dates.contractDateIsManual === true,
    estimatedStartDate: dateOnly(contract.dates.estimatedStartDate),
    estimatedCompletionDate: dateOnly(contract.dates.estimatedCompletionDate),
    materialsAllowances: contract.optionalDetails.materialsAllowances || "",
    exclusions: contract.optionalDetails.exclusions || "",
    permitResponsibility: contract.optionalDetails.permitResponsibility || "",
    specialInstructions: contract.optionalDetails.specialInstructions || "",
    additionalNotes: contract.optionalDetails.additionalNotes || "",
  };
}

function buildPayload(project: Project, form: ContractFormState): ProjectContractInput {
  return {
    contractId: form.contractId,
    ...(form.estimateId ? { estimateId: form.estimateId } : {}),
    customerSnapshot: {
      fullName: form.customerName,
      email: form.customerEmail,
      phone: form.customerPhone,
      customerId: form.customerId,
    },
    propertySnapshot: {
      address: form.propertyAddress,
      projectId: project._id,
      projectNumber: project.projectNumber,
    },
    workType: form.workType,
    otherWorkType: form.otherWorkType,
    projectDescription: form.projectDescription,
    scopeText: form.scopeText,
    originalContractPriceCents: centsFromMoney(form.totalPrice),
    totalPriceCents: centsFromMoney(form.totalPrice),
    discounts: form.discounts
      .filter((discount) => !isBlankDiscount(discount))
      .map((discount, index) => ({
        name: discount.name,
        type: discount.type,
        value:
          discount.type === "percentage"
            ? basisPointsFromPercentInput(discount.value)
            : centsFromMoney(discount.value),
        note: discount.note,
        order: index,
      })),
    depositAmountCents: centsFromMoney(form.depositRequired),
    fullDepositConfirmed: form.fullDepositConfirmed,
    zeroAdjustedPriceConfirmed: form.zeroAdjustedPriceConfirmed,
    paymentSchedule: form.paymentSchedule.map((row, index) => ({
      label: row.label,
      amountCents: centsFromMoney(row.amount),
      dueCondition: row.dueCondition,
      order: index,
    })),
    dates: {
      contractDate: form.contractDate,
      contractDateIsManual: form.contractDateIsManual,
      estimatedStartDate: form.estimatedStartDate || null,
      estimatedCompletionDate: form.estimatedCompletionDate || null,
    },
    optionalDetails: {
      materialsAllowances: form.materialsAllowances,
      exclusions: form.exclusions,
      permitResponsibility: form.permitResponsibility,
      specialInstructions: form.specialInstructions,
      additionalNotes: form.additionalNotes,
    },
  };
}

function contractPayloadSignature(project: Project, form: ContractFormState) {
  return JSON.stringify(buildPayload(project, form));
}

function contractTitle(contract: ProjectContract | null) {
  if (!contract) return "No Contract";
  return contractDisplayLabel(contract.contractNumber);
}

function discountPreviewLabel(discount: DiscountDraft & { calculatedAmountCents?: number }) {
  const name = discount.name.trim() || "Discount";
  if (discount.type !== "percentage") return name;
  const percent = String(discount.value || "").replace(/[%\s]/g, "").trim();
  return percent ? `${name} (${percent}%)` : name;
}

function PdfPreview({
  form,
  meta,
  contract,
}: {
  form: ContractFormState;
  meta: ContractMeta | null;
  contract: ProjectContract | null;
}) {
  const pricing = pricingFromForm(form);
  const schedule = form.paymentSchedule.length
    ? form.paymentSchedule
    : [
        { id: "deposit", label: "Deposit", amount: form.depositRequired, dueCondition: "Due when contract is signed." },
        { id: "balance", label: "Remaining Balance", amount: dollarsFromCents(pricing.remaining), dueCondition: "Due upon substantial completion unless otherwise agreed in writing." },
      ].filter((row) => centsFromMoney(row.amount) > 0);
  const contractLabel = contract ? contractDisplayLabel(contract.contractNumber) : "Draft Preview";
  const company = meta?.company;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-normal text-slate-950">Home Improvement Agreement</h3>
          <p className="mt-1 text-sm font-bold text-slate-900">{company?.legalName || "Premium Island Homes Inc."}</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            {(company?.addressLines || ["245 42nd Street", "Lindenhurst, NY 11757"]).join(" | ")} | {company?.phone || "631-599-1363"} | {company?.email || "premiumislandconstruction@gmail.com"} | {company?.website || "profixter.com"} | {company?.homeImprovementLicense || "HI-71484"}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-black text-slate-950">{contractLabel}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{displayDate(form.contractDate)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
        {[
          ["Customer", form.customerName || "Not set"],
          ["Phone", form.customerPhone || "Not specified"],
          ["Email", form.customerEmail || "Not specified"],
          ["Property", form.propertyAddress || "Not specified"],
          ["Work Type", form.workType === "Other" ? form.otherWorkType || "Other" : form.workType],
          ["Agreement Date", displayDate(form.contractDate)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="mt-1 leading-5 text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Project Description</p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{form.projectDescription || "No description yet."}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Scope of Work</p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{form.scopeText || "No scope yet."}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Final Agreement Amount</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{moneyFromCents(pricing.adjusted)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-slate-500">Original Price</p><strong>{moneyFromCents(pricing.original)}</strong></div>
              <div><p className="text-slate-500">Discounts</p><strong>{pricing.totalDiscount ? `-${moneyFromCents(pricing.totalDiscount).replace("-", "")}` : moneyFromCents(0)}</strong></div>
              <div><p className="text-slate-500">Deposit</p><strong>{moneyFromCents(pricing.deposit)}</strong></div>
              <div><p className="text-slate-500">Remaining Balance</p><strong>{moneyFromCents(pricing.remaining)}</strong></div>
            </div>
          </div>
          {pricing.discounts.length > 0 && (
            <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {pricing.discounts.map((discount) => (
                <div key={discount.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">{discountPreviewLabel(discount)}</span>
                  <span className="font-bold text-slate-950">-{moneyFromCents(discount.calculatedAmountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {schedule.map((row) => (
            <div key={row.id} className="grid gap-2 border-b border-slate-100 p-3 text-sm last:border-b-0 sm:grid-cols-[1fr_120px_1.4fr]">
              <strong className="text-slate-900">{row.label || "Milestone"}</strong>
              <span className="font-semibold text-slate-700">{moneyFromCents(centsFromMoney(row.amount))}</span>
              <span className="text-slate-600">{row.dueCondition || "Due condition not set"}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-slate-500">Start</p><strong>{displayDate(form.estimatedStartDate)}</strong></div>
          <div><p className="text-slate-500">Completion</p><strong>{displayDate(form.estimatedCompletionDate)}</strong></div>
        </div>
      </div>
    </section>
  );
}

/**
 * Where this Agreement came from.
 *
 * Once an Agreement has frozen an Estimate the link is permanent and shown
 * read-only: the Agreement is the baseline from that point, and re-importing a
 * later revision of the proposal would move a number the customer signed.
 */
function EstimateSource({
  estimates,
  form,
  frozen,
  onPick,
  onClear,
}: {
  estimates: ContractEstimateOption[];
  form: ContractFormState;
  frozen?: ProjectContract["estimateSnapshot"];
  onPick: (estimate: ContractEstimateOption) => void;
  onClear: () => void;
}) {
  if (frozen?.importedAt) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Created from Estimate</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold text-slate-900">
            {frozen.estimateNumber}
            {frozen.title ? ` - ${frozen.title}` : ""}
          </p>
          <p className="tabular-nums font-bold text-slate-700">{moneyFromCents(frozen.totalCents)} estimated</p>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Frozen on {displayDate(frozen.importedAt)}. Later edits to the Estimate do not change this Agreement.
        </p>
      </section>
    );
  }

  if (!estimates.length) return null;
  const picked = estimates.find((estimate) => estimate.id === form.estimateId) || null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Create from Estimate</p>
      <p className="mt-1 text-sm text-slate-500">
        Optional. Links this Agreement to the proposal it came from and fills in the price.
      </p>
      <div className="mt-4 grid gap-2">
        {estimates.slice(0, 6).map((estimate) => {
          const active = picked?.id === estimate.id;
          return (
            <button
              key={estimate.id}
              type="button"
              onClick={() => (active ? onClear() : onPick(estimate))}
              aria-pressed={active}
              className={`flex flex-wrap items-baseline justify-between gap-2 rounded-xl border p-3 text-left transition ${
                active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {estimate.estimateNumber}
                  {estimate.title ? ` - ${estimate.title}` : ""}
                </span>
                <span className="text-xs text-slate-500">
                  {estimate.status} - {estimate.lineItems.length} line item
                  {estimate.lineItems.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-bold text-slate-900">
                {moneyFromCents(estimate.totalCents)}
              </span>
            </button>
          );
        })}
      </div>
      {picked ? (
        <p className="mt-3 text-xs font-semibold text-blue-700">
          The Agreement price has been set to {moneyFromCents(picked.totalCents)}. Adjust it below if the
          agreed figure differs - the Estimate is a record of the proposal, not a constraint.
        </p>
      ) : null}
    </section>
  );
}

export default function ProjectContracts({ project }: { project: Project }) {
  const [contracts, setContracts] = useState<ProjectContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [form, setForm] = useState<ContractFormState>(() => defaultForm(project));
  const [meta, setMeta] = useState<ContractMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingAction, setWorkingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [signatureMeta, setSignatureMeta] = useState<SignatureMeta | null>(null);
  const [signature, setSignature] = useState<DocumentSignature | null>(null);
  const [showSendForSignature, setShowSendForSignature] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState("");
  /**
   * In-person session token. Held in memory for the life of the ceremony only -
   * never persisted, never logged: it is a signing credential.
   */
  const [inPersonToken, setInPersonToken] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState({ recipient: "", subject: "", message: "" });
  const [estimateOptions, setEstimateOptions] = useState<ContractEstimateOption[]>([]);

  /**
   * Prefill from an Estimate. Only the price and the wording move across;
   * everything else stays the Admin's to decide, and the backend takes its own
   * frozen copy of the Estimate rather than trusting anything sent from here.
   */
  const applyEstimate = (estimate: ContractEstimateOption) => {
    setForm((current) => ({
      ...current,
      estimateId: estimate.id,
      totalPrice: dollarsFromCents(estimate.totalCents),
      projectDescription: current.projectDescription || estimate.title,
      scopeText:
        current.scopeText ||
        estimate.lineItems.map((item) => `- ${item.description}`).join("\n"),
    }));
  };

  const selectedContract = useMemo(
    () =>
      selectedContractId
        ? contracts.find((contract) => contract._id === selectedContractId) || null
        : null,
    [contracts, selectedContractId]
  );

  const totals = useMemo(() => pricingFromForm(form), [form]);
  const contractWarnings = useMemo(() => {
    const warnings: Array<{ code: string; message: string; requiresConfirmation?: boolean }> = [];
    const description = normalizeComparableText(form.projectDescription);
    const scope = normalizeComparableText(form.scopeText);

    if (totals.adjusted > 0 && totals.deposit === totals.adjusted) {
      warnings.push({
        code: "full_deposit",
        message: FULL_DEPOSIT_WARNING,
        requiresConfirmation: true,
      });
    }
    if (totals.totalDiscount > totals.original) {
      warnings.push({
        code: "discount_total_exceeds_price",
        message: "Total discounts exceed the original contract price.",
      });
    }
    if (totals.original > 0 && totals.totalDiscount > Math.floor((totals.original * 30) / 100)) {
      warnings.push({
        code: "high_discount_total",
        message: HIGH_DISCOUNT_WARNING,
      });
    }
    if (totals.original > 0 && totals.adjusted === 0) {
      warnings.push({
        code: "zero_adjusted_price",
        message: ZERO_ADJUSTED_PRICE_WARNING,
        requiresConfirmation: true,
      });
    }
    if (totals.deposit > totals.adjusted) {
      warnings.push({
        code: "deposit_exceeds_adjusted",
        message: "Deposit cannot exceed the adjusted contract price.",
      });
    }
    if (totals.duplicateDiscountNames.length > 0) {
      warnings.push({
        code: "duplicate_discount_names",
        message: "One or more discount names are repeated. Duplicate names are allowed, but review them before generating.",
      });
    }
    if (description && scope && description === scope) {
      warnings.push({
        code: "duplicate_description_scope",
        message: "Project Description and Scope of Work are identical. The PDF will avoid repeating the same text twice.",
      });
    }
    if (!form.estimatedCompletionDate) {
      warnings.push({
        code: "missing_completion",
        message: "Estimated completion date is missing.",
      });
    }
    if (!addressHasStateAndZip(form.propertyAddress)) {
      warnings.push({
        code: "missing_state_zip",
        message: "Customer address may be missing a state or ZIP code.",
      });
    }
    if (scope && scope.length < 80) {
      warnings.push({
        code: "short_scope",
        message: "Scope of Work is unusually short. Add enough detail for the customer to understand what is included.",
      });
    }
    return warnings;
  }, [
    form.estimatedCompletionDate,
    form.projectDescription,
    form.propertyAddress,
    form.scopeText,
    totals.deposit,
    totals.adjusted,
    totals.duplicateDiscountNames.length,
    totals.original,
    totals.totalDiscount,
  ]);
  const requiresFullDepositConfirmation = contractWarnings.some(
    (warning) => warning.code === "full_deposit"
  );
  const missingFullDepositConfirmation =
    requiresFullDepositConfirmation && !form.fullDepositConfirmed;
  const requiresZeroAdjustedPriceConfirmation = contractWarnings.some(
    (warning) => warning.code === "zero_adjusted_price"
  );
  const missingZeroAdjustedPriceConfirmation =
    requiresZeroAdjustedPriceConfirmation && !form.zeroAdjustedPriceConfirmed;
  const currentSignature = useMemo(
    () => contractPayloadSignature(project, form),
    [form, project]
  );
  const selectedSignature = useMemo(
    () =>
      selectedContract
        ? contractPayloadSignature(project, formFromContract(selectedContract))
        : "",
    [project, selectedContract]
  );
  const hasUnsavedChanges = !selectedContract || currentSignature !== selectedSignature;
  const canSaveOrGenerateDraft =
    !selectedContract || selectedContract.status === "Draft" || hasUnsavedChanges;

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextMeta, nextContracts, nextSignatureMeta, nextEstimates] = await Promise.all([
        getContractMeta(),
        getProjectContracts(project._id),
        getSignatureMeta().catch(() => null),
        getContractEstimateOptions(project._id).catch(() => []),
      ]);
      setMeta(nextMeta);
      setContracts(nextContracts);
      setSignatureMeta(nextSignatureMeta);
      setEstimateOptions(nextEstimates);
      const nextSelected = nextContracts.find((contract) => contract.current) || nextContracts[0] || null;
      setSelectedContractId(nextSelected?._id || "");
      setForm(nextSelected ? formFromContract(nextSelected) : defaultForm(project));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  const selectedContractId2 = selectedContract?._id || "";
  const refreshSignature = useCallback(async () => {
    if (!selectedContractId2) {
      setSignature(null);
      return;
    }
    try {
      const list = await getDocumentSignatures("CONTRACT", selectedContractId2);
      setSignature(list[0] || null);
    } catch {
      // A signature history that cannot be read must not break the contract UI.
      setSignature(null);
    }
  }, [selectedContractId2]);

  useEffect(() => {
    void refreshSignature();
  }, [refreshSignature]);

  /**
   * Turn a backend failure into copy an admin can act on. A missing company
   * signature is a configuration problem; the raw message would expose server
   * internals such as the storage key and env var name.
   */
  const signingError = (caught: unknown) => {
    const response = (caught as { response?: { data?: { code?: string } } })?.response;
    if (response?.data?.code === "SIGNING_NOT_CONFIGURED") {
      return "Company signature needs to be configured before this Agreement can be sent for signing.";
    }
    return errorMessage(caught);
  };

  /** Remote: freeze, email the customer a secure link. */
  const handleNativeSend = async () => {
    if (!selectedContract) return;
    setWorkingAction("Sending for signature...");
    setError("");
    try {
      const result = await sendForNativeSignature({
        documentType: "CONTRACT",
        documentId: selectedContract._id,
        mode: "REMOTE",
      });
      setSuccess(
        result.emailed
          ? "Agreement sent. The customer has been emailed a secure signing link."
          : "Agreement is ready to sign, but the email could not be delivered. Use Resend to try again."
      );
      await refreshSignature();
      await loadContracts();
    } catch (sendError) {
      setError(signingError(sendError));
    } finally {
      setWorkingAction("");
    }
  };

  /** In person: freeze, then open the ceremony on this device. No email. */
  const handleSignInPerson = async () => {
    if (!selectedContract) return;
    setWorkingAction("Preparing signing session...");
    setError("");
    try {
      const result = await sendForNativeSignature({
        documentType: "CONTRACT",
        documentId: selectedContract._id,
        mode: "IN_PERSON",
      });
      const token = result.signingUrl.split("/sign/")[1];
      setInPersonToken(token || null);
    } catch (sendError) {
      setError(signingError(sendError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleResend = async () => {
    if (!signature) return;
    setWorkingAction("Resending...");
    setError("");
    try {
      await resendNativeSignature(signature.id);
      setSuccess("A new signing link has been emailed. The previous link no longer works.");
      await refreshSignature();
    } catch (resendError) {
      setError(errorMessage(resendError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleRevoke = async () => {
    if (!signature) return;
    if (!window.confirm("Revoke this signature request? The link will stop working.")) return;
    setWorkingAction("Revoking...");
    try {
      await revokeNativeSignature(signature.id, "Revoked by admin");
      setSuccess("Signature request revoked.");
      await refreshSignature();
      await loadContracts();
    } catch (revokeError) {
      setError(errorMessage(revokeError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleNativeDownload = async (kind: "frozen" | "executed" | "certificate") => {
    if (!signature) return;
    setWorkingAction("Preparing download...");
    try {
      const blob = await downloadNativeDocument(signature.id, kind);
      const names = {
        frozen: "original-agreement.pdf",
        executed: "signed-agreement.pdf",
        certificate: "signature-certificate.pdf",
      };
      downloadBlob(blob, names[kind]);
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedContract) return;
    setWorkingAction("Uploading signed Agreement...");
    setError("");
    try {
      await uploadManuallySignedDocument("CONTRACT", selectedContract._id, file);
      setSuccess("Signed Agreement recorded as a manual upload.");
      await refreshSignature();
      await loadContracts();
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleSendForSignature = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedContract) return;
    setWorkingAction("Sending for signature...");
    setError("");
    try {
      await sendDocumentForSignature({
        documentType: "CONTRACT",
        documentId: selectedContract._id,
        message: signatureMessage,
      });
      setShowSendForSignature(false);
      setSignatureMessage("");
      setSuccess("Agreement sent for signature. Status updates arrive automatically.");
      await refreshSignature();
      await loadContracts();
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setWorkingAction("");
    }
  };

  const updateField = <K extends keyof ContractFormState>(field: K, value: ContractFormState[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "totalPrice" || field === "depositRequired"
        ? { fullDepositConfirmed: false, zeroAdjustedPriceConfirmed: false }
        : {}),
    }));
  };

  const saveDraft = async () => {
    if (!canSaveOrGenerateDraft) {
      setSuccess("No changes to save. The generated contract was left unchanged.");
      return null;
    }
    if (missingFullDepositConfirmation) {
      setError(FULL_DEPOSIT_WARNING);
      return null;
    }
    if (missingZeroAdjustedPriceConfirmation) {
      setError(ZERO_ADJUSTED_PRICE_WARNING);
      return null;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveProjectContractDraft(project._id, buildPayload(project, form));
      setContracts((current) => {
        const withoutSaved = current.filter((contract) => contract._id !== saved._id);
        return [saved, ...withoutSaved].sort((a, b) => b.version - a.version);
      });
      setSelectedContractId(saved._id);
      setForm(formFromContract(saved));
      setSuccess("Agreement draft saved.");
      return saved;
    } catch (saveError) {
      setError(errorMessage(saveError));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    setWorkingAction("Generating PDF...");
    setError("");
    setSuccess("");
    try {
      const generated = await generateProjectContractPdf(
        project._id,
        saved._id,
        form.fullDepositConfirmed,
        form.zeroAdjustedPriceConfirmed
      );
      setContracts((current) => current.map((contract) => (contract._id === generated._id ? generated : contract)));
      setSelectedContractId(generated._id);
      setForm(formFromContract(generated));
      setSuccess("PDF generated and saved to this project.");
      await loadContracts();
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleDownload = async (type: "generated" | "signed" = "generated") => {
    if (!selectedContract) return;
    setWorkingAction("Preparing download...");
    setError("");
    try {
      const blob = await downloadProjectContractPdf(project._id, selectedContract._id, type);
      const displayNumber = contractDisplayLabel(selectedContract.contractNumber).replace("#", "").replace(/\s+/g, "-");
      const filename =
        type === "signed"
          ? selectedContract.signedPdf?.fileName || `${displayNumber}-signed.pdf`
          : selectedContract.generatedPdf?.fileName || `${displayNumber}-Contract.pdf`;
      downloadBlob(blob, filename);
      await loadContracts();
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setWorkingAction("");
    }
  };

  const openEmail = () => {
    if (!selectedContract) return;
    setEmailForm({
      recipient: selectedContract.customerSnapshot.email || form.customerEmail,
      subject: `Your Premium Island Homes Contract - ${selectedContract.workType}`,
      message: [
        `Hi ${selectedContract.customerSnapshot.fullName || "there"},`,
        "",
        "Attached is your Premium Island Homes contract for review.",
        "Please review the scope, pricing, discounts if listed, payment schedule, terms, and signature page. If everything looks good, sign and return the contract so we can move forward.",
        "",
        "Thank you,",
        "Premium Island Homes Inc.",
      ].join("\n"),
    });
    setShowEmail(true);
  };

  const handleEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedContract) return;
    setWorkingAction("Emailing contract...");
    setError("");
    try {
      const emailed = await emailProjectContract(selectedContract._id, {
        ...emailForm,
        projectId: project._id,
      });
      setContracts((current) => current.map((contract) => (contract._id === emailed._id ? emailed : contract)));
      setSelectedContractId(emailed._id);
      setForm(formFromContract(emailed));
      setShowEmail(false);
      setSuccess("Agreement emailed and history saved.");
    } catch (emailError) {
      setError(errorMessage(emailError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleSignedUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedContract) return;
    setWorkingAction("Uploading signed contract...");
    setError("");
    try {
      const signed = await uploadSignedProjectContract(project._id, selectedContract._id, file);
      setContracts((current) => current.map((contract) => (contract._id === signed._id ? signed : contract)));
      setSelectedContractId(signed._id);
      setForm(formFromContract(signed));
      setSuccess("Signed contract uploaded.");
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setWorkingAction("");
    }
  };

  const handleCancel = async () => {
    if (!selectedContract) return;
    const reason = window.prompt("Reason for canceling this contract?", "");
    if (reason === null) return;
    setWorkingAction("Canceling contract...");
    setError("");
    try {
      const canceled = await cancelProjectContract(project._id, selectedContract._id, reason);
      setContracts((current) => current.map((contract) => (contract._id === canceled._id ? canceled : contract)));
      setSelectedContractId(canceled._id);
      setForm(formFromContract(canceled));
      setSuccess("Agreement canceled.");
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    } finally {
      setWorkingAction("");
    }
  };

  const createNewDraft = () => {
    setSelectedContractId("");
    setForm(defaultForm(project));
    setSuccess("");
    setError("");
  };

  const selectContract = (contract: ProjectContract) => {
    setSelectedContractId(contract._id);
    setForm(formFromContract(contract));
    setSuccess("");
    setError("");
  };

  const addScheduleRow = () => {
    setForm((current) => ({
      ...current,
      paymentSchedule: [
        ...current.paymentSchedule,
        { id: `${Date.now()}`, label: "", amount: "", dueCondition: "" },
      ],
    }));
  };

  const updateScheduleRow = (
    index: number,
    field: keyof Omit<PaymentScheduleDraft, "id">,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      paymentSchedule: current.paymentSchedule.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeScheduleRow = (index: number) => {
    setForm((current) => ({
      ...current,
      paymentSchedule: current.paymentSchedule.filter((_row, rowIndex) => rowIndex !== index),
    }));
  };

  const addDiscountRow = () => {
    setForm((current) => ({
      ...current,
      fullDepositConfirmed: false,
      zeroAdjustedPriceConfirmed: false,
      discounts: [
        ...current.discounts,
        { id: `${Date.now()}`, name: "", type: "fixed", value: "", note: "" },
      ],
    }));
  };

  const updateDiscountRow = (
    index: number,
    field: keyof Omit<DiscountDraft, "id">,
    value: DiscountDraft[keyof Omit<DiscountDraft, "id">]
  ) => {
    setForm((current) => ({
      ...current,
      fullDepositConfirmed: false,
      zeroAdjustedPriceConfirmed: false,
      discounts: current.discounts.map((discount, discountIndex) =>
        discountIndex === index ? { ...discount, [field]: value } : discount
      ),
    }));
  };

  const removeDiscountRow = (index: number) => {
    setForm((current) => ({
      ...current,
      fullDepositConfirmed: false,
      zeroAdjustedPriceConfirmed: false,
      discounts: current.discounts.filter((_discount, discountIndex) => discountIndex !== index),
    }));
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Loading Agreement workspace...</div>;
  }

  if (inPersonToken) {
    return (
      <InPersonSigning
        token={inPersonToken}
        onExit={() => {
          setInPersonToken(null);
          void refreshSignature();
          void loadContracts();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Contract</p>
            <h3 className="mt-2 text-2xl font-black">{contractTitle(selectedContract)}</h3>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${selectedContract ? STATUS_STYLES[selectedContract.status] : "border-slate-700 bg-slate-900 text-slate-300"}`}>
                {selectedContract?.status || "No Contract"}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                {project.projectNumber}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                {meta?.company.homeImprovementLicense || "HI-71484"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={createNewDraft} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">
              New Draft
            </button>
            <button type="button" onClick={saveDraft} disabled={saving || !!workingAction || missingFullDepositConfirmation || missingZeroAdjustedPriceConfirmation} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-60">
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" onClick={handleGenerate} disabled={!canSaveOrGenerateDraft || saving || !!workingAction || missingFullDepositConfirmation || missingZeroAdjustedPriceConfirmation} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60">
              Generate Agreement
            </button>
          </div>
        </div>
        {workingAction && <p className="mt-4 text-sm font-semibold text-blue-200">{workingAction}</p>}
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{success}</div>}

      {contractWarnings.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">Review before generating</p>
          <ul className="mt-2 space-y-1">
            {contractWarnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
          {requiresFullDepositConfirmation && (
            <label className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 font-semibold text-amber-950">
              <input
                type="checkbox"
                checked={form.fullDepositConfirmed}
                onChange={(event) => updateField("fullDepositConfirmed", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300"
              />
              <span>I confirm full payment is intentionally due before work begins.</span>
            </label>
          )}
          {requiresZeroAdjustedPriceConfirmation && (
            <label className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 font-semibold text-amber-950">
              <input
                type="checkbox"
                checked={form.zeroAdjustedPriceConfirmed}
                onChange={(event) => updateField("zeroAdjustedPriceConfirmed", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300"
              />
              <span>I confirm this contract is intentionally being generated at no charge.</span>
            </label>
          )}
        </section>
      )}

      {contracts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {contracts.map((contract) => (
              <button
                key={contract._id}
                type="button"
                onClick={() => selectContract(contract)}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                  contract._id === selectedContractId
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {contractDisplayLabel(contract.contractNumber)}
                <span className="ml-2 font-semibold text-slate-400">{contract.status}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
          <EstimateSource
            estimates={estimateOptions}
            form={form}
            frozen={selectedContract?.estimateSnapshot}
            onPick={applyEstimate}
            onClear={() => setForm((current) => ({ ...current, estimateId: undefined }))}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer Snapshot</p>
            <p className="mt-1 text-sm text-slate-500">Edits here affect this contract only. Project and customer records stay unchanged.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Customer name *
                <input required maxLength={160} value={form.customerName} onChange={(event) => updateField("customerName", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Email
                <input type="email" maxLength={254} value={form.customerEmail} onChange={(event) => updateField("customerEmail", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Phone
                <input maxLength={40} value={form.customerPhone} onChange={(event) => updateField("customerPhone", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Customer ID
                <input maxLength={120} value={form.customerId} onChange={(event) => updateField("customerId", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Project address *
                <input required maxLength={500} value={form.propertyAddress} onChange={(event) => updateField("propertyAddress", event.target.value)} className={inputClass} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Project</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Work type *
                <select value={form.workType} onChange={(event) => updateField("workType", event.target.value as ContractWorkType)} className={inputClass}>
                  {CONTRACT_WORK_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              {form.workType === "Other" && (
                <label className="text-sm font-semibold text-slate-700">
                  Other work type *
                  <input required maxLength={120} value={form.otherWorkType} onChange={(event) => updateField("otherWorkType", event.target.value)} className={inputClass} />
                </label>
              )}
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Project description *
                <textarea required rows={4} maxLength={10000} value={form.projectDescription} onChange={(event) => updateField("projectDescription", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Scope of work *
                <textarea required rows={10} maxLength={30000} value={form.scopeText} onChange={(event) => updateField("scopeText", event.target.value)} className={inputClass} placeholder={"Use paragraphs, line breaks, or lists. The PDF keeps this structure."} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pricing</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">
                Original contract price *
                <input required inputMode="decimal" value={form.totalPrice} onChange={(event) => updateField("totalPrice", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Deposit required *
                <input required inputMode="decimal" value={form.depositRequired} onChange={(event) => updateField("depositRequired", event.target.value)} className={inputClass} />
              </label>
              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Adjusted contract price</p>
                <p className="mt-1 text-xl font-black text-slate-950">{moneyFromCents(totals.adjusted)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{totals.percentage}% deposit</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Discounts</p>
                  <p className="text-xs text-slate-500">Optional. Each discount is calculated from the original price.</p>
                </div>
                <button type="button" onClick={addDiscountRow} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  Add Discount
                </button>
              </div>
              {form.discounts.length > 0 && (
                <div className="mt-3 space-y-3">
                  {form.discounts.map((discount, index) => {
                    const amount = discountAmountCents(totals.original, discount);
                    return (
                      <div key={discount.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[1fr_135px_135px_1fr_auto]">
                        <input
                          placeholder="Discount name"
                          value={discount.name}
                          onChange={(event) => updateDiscountRow(index, "name", event.target.value)}
                          className={inputClass.replace("mt-1.5 ", "")}
                        />
                        <select
                          value={discount.type}
                          onChange={(event) => updateDiscountRow(index, "type", event.target.value as ContractDiscountType)}
                          className={inputClass.replace("mt-1.5 ", "")}
                        >
                          <option value="fixed">Fixed</option>
                          <option value="percentage">Percentage</option>
                        </select>
                        <input
                          placeholder={discount.type === "percentage" ? "10" : "500.00"}
                          inputMode="decimal"
                          value={discount.value}
                          onChange={(event) => updateDiscountRow(index, "value", event.target.value)}
                          className={inputClass.replace("mt-1.5 ", "")}
                        />
                        <input
                          placeholder="Optional note"
                          value={discount.note}
                          onChange={(event) => updateDiscountRow(index, "note", event.target.value)}
                          className={inputClass.replace("mt-1.5 ", "")}
                        />
                        <div className="flex items-center gap-2">
                          <span className="min-w-[92px] rounded-lg bg-emerald-50 px-3 py-2 text-right text-xs font-black text-emerald-700">
                            -{moneyFromCents(amount)}
                          </span>
                          <button type="button" onClick={() => removeDiscountRow(index)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-slate-500">Original price</p>
                  <p className="font-black text-slate-950">{moneyFromCents(totals.original)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total discounts</p>
                  <p className="font-black text-emerald-700">-{moneyFromCents(totals.totalDiscount)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Adjusted price</p>
                  <p className="font-black text-slate-950">{moneyFromCents(totals.adjusted)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Remaining balance</p>
                  <p className="font-black text-slate-950">{moneyFromCents(totals.remaining)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Payment schedule</p>
                  <p className="text-xs text-slate-500">Leave empty to use Deposit and Remaining Balance defaults.</p>
                </div>
                <button type="button" onClick={addScheduleRow} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  Add Row
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {form.paymentSchedule.map((row, index) => (
                  <div key={row.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_120px_1.2fr_auto]">
                    <input placeholder="Milestone" value={row.label} onChange={(event) => updateScheduleRow(index, "label", event.target.value)} className={inputClass.replace("mt-1.5 ", "")} />
                    <input placeholder="Amount" value={row.amount} onChange={(event) => updateScheduleRow(index, "amount", event.target.value)} className={inputClass.replace("mt-1.5 ", "")} />
                    <input placeholder="Due condition" value={row.dueCondition} onChange={(event) => updateScheduleRow(index, "dueCondition", event.target.value)} className={inputClass.replace("mt-1.5 ", "")} />
                    <button type="button" onClick={() => removeScheduleRow(index)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {form.paymentSchedule.length > 0 && (
                <p className={`mt-2 text-xs font-semibold ${totals.scheduleTotal > totals.adjusted ? "text-rose-600" : "text-slate-500"}`}>
                  Schedule total: {moneyFromCents(totals.scheduleTotal)} of {moneyFromCents(totals.adjusted)} adjusted price
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Dates</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Agreement date
                <input
                  type="date"
                  value={form.contractDate}
                  onChange={(event) => {
                    updateField("contractDate", event.target.value);
                    // Touching the field makes it a deliberate choice, which the
                    // backend then never rolls forward when the PDF is generated.
                    updateField("contractDateIsManual", true);
                  }}
                  className={inputClass}
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  {form.contractDateIsManual
                    ? "Set by you. This date stays as entered."
                    : "Set automatically to the day the Agreement is generated."}
                </span>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Estimated start
                <input type="date" value={form.estimatedStartDate} onChange={(event) => updateField("estimatedStartDate", event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Estimated completion
                <input type="date" value={form.estimatedCompletionDate} onChange={(event) => updateField("estimatedCompletionDate", event.target.value)} className={inputClass} />
              </label>
            </div>
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-black text-slate-900">Additional Details</summary>
            <div className="mt-4 grid gap-4">
              {[
                ["materialsAllowances", "Materials / allowances"],
                ["exclusions", "Exclusions"],
                ["permitResponsibility", "Permit responsibility"],
                ["specialInstructions", "Special customer instructions"],
                ["additionalNotes", "Notes"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm font-semibold text-slate-700">
                  {label}
                  <textarea rows={3} value={String(form[field as keyof ContractFormState] || "")} onChange={(event) => updateField(field as keyof ContractFormState, event.target.value as never)} className={inputClass} />
                </label>
              ))}
            </div>
          </details>
        </form>

        <div className="space-y-5">
          <PdfPreview form={form} meta={meta} contract={selectedContract} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Actions</p>
            <div className="mt-3">
              <ESignStatusBadge meta={signatureMeta} />
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" disabled={!selectedContract?.generatedPdf?.available || !!workingAction} onClick={() => void handleDownload("generated")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                Download Agreement
              </button>
              <button type="button" disabled={!selectedContract?.generatedPdf?.available || !!workingAction} onClick={openEmail} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                Email Agreement
              </button>
              <label className={`rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-800 ${selectedContract ? "cursor-pointer hover:bg-slate-50" : "opacity-50"}`}>
                Upload Signed Agreement
                <input disabled={!selectedContract || !!workingAction} type="file" accept="application/pdf,.pdf" onChange={handleSignedUpload} className="hidden" />
              </label>
              <button type="button" disabled={!selectedContract?.signedPdf?.available || !!workingAction} onClick={() => void handleDownload("signed")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                Download Signed Agreement
              </button>
              {/* Signing actions appear only when they apply to the current state. */}
              {selectedContract?.generatedPdf?.available &&
                selectedContract.status !== "Signed" &&
                selectedContract.status !== "Canceled" &&
                signature?.status !== "Completed" && (
                  <>
                    <button
                      type="button"
                      disabled={!!workingAction}
                      onClick={handleSignInPerson}
                      className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Sign In Person
                    </button>
                    <button
                      type="button"
                      disabled={!!workingAction}
                      onClick={handleNativeSend}
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Send for Signature
                    </button>
                  </>
                )}

              {/* A live request can be nudged or withdrawn. */}
              {signature &&
                !["Completed", "Declined", "Cancelled", "Expired"].includes(signature.status) && (
                  <>
                    <button
                      type="button"
                      disabled={!!workingAction}
                      onClick={handleResend}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Resend Link
                    </button>
                    <button
                      type="button"
                      disabled={!!workingAction}
                      onClick={handleRevoke}
                      className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Revoke Request
                    </button>
                  </>
                )}

              {/* Completed: the three artifacts worth keeping. */}
              {signature?.status === "Completed" && (
                <>
                  <button
                    type="button"
                    disabled={!!workingAction}
                    onClick={() => void handleNativeDownload("executed")}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Download Signed Agreement
                  </button>
                  <button
                    type="button"
                    disabled={!!workingAction}
                    onClick={() => void handleNativeDownload("certificate")}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Signature Certificate
                  </button>
                  <button
                    type="button"
                    disabled={!!workingAction}
                    onClick={() => void handleNativeDownload("frozen")}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    View Original Agreement
                  </button>
                </>
              )}

              <label className={`rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-800 ${selectedContract ? "cursor-pointer hover:bg-slate-50" : "opacity-50"}`}>
                Upload Signed Agreement
                <input
                  disabled={!selectedContract || !!workingAction}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleManualUpload}
                  className="hidden"
                />
              </label>
              <button type="button" disabled={!selectedContract || !!workingAction} onClick={handleCancel} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                Cancel Agreement
              </button>
            </div>
          </section>

          {selectedContract && (
            <SignatureDetails
              signature={signature}
              providerConfigured={signatureMeta?.configured ?? false}
              webhookConfigured={signatureMeta?.webhook?.state === "ACTIVE"}
              working={workingAction}
              onChanged={async () => {
                await refreshSignature();
                await loadContracts();
              }}
              setError={setError}
              setSuccess={setSuccess}
              setWorking={setWorkingAction}
            />
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Event History</p>
            <div className="mt-4 space-y-3">
              {selectedContract?.auditHistory?.length ? (
                [...selectedContract.auditHistory].reverse().map((event) => (
                  <div key={event._id || `${event.event}-${event.at}`} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-bold text-slate-900">{event.event}</p>
                    <p className="mt-1 text-xs text-slate-500">{displayDate(event.at)} {event.adminEmail ? `by ${event.adminEmail}` : ""}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No contract events yet.</p>
              )}
            </div>
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-black text-slate-900">Terms Included in PDF</summary>
            <div className="mt-4 space-y-3">
              {meta?.termsSections.map((section) => (
                <div key={section.title} className="text-sm">
                  <p className="font-bold text-slate-900">{section.title}</p>
                  <p className="mt-1 leading-6 text-slate-600">{section.body}</p>
                </div>
              ))}
              {meta?.cancellationNotice?.includeCancellationNotice && (
                <div className="text-sm">
                  <p className="font-bold text-slate-900">{meta.cancellationNotice.title}</p>
                  <p className="mt-1 leading-6 text-slate-600">{meta.cancellationNotice.body}</p>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>

      {showSendForSignature && selectedContract && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowSendForSignature(false)}
        >
          <form
            onSubmit={handleSendForSignature}
            className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-lg font-black text-slate-900">
              Send {contractDisplayLabel(selectedContract.contractNumber)} for signature
            </h4>
            {!signatureMeta?.configured ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Adobe Acrobat Sign is not configured on the server.
              </p>
            ) : (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {selectedContract.customerSnapshot.email
                  ? `${selectedContract.customerSnapshot.fullName || "The customer"} will receive a signing link at ${selectedContract.customerSnapshot.email}.`
                  : "This contract has no customer email on file."}
                {signatureMeta?.companySignerConfigured
                  ? " Premium Island Homes will countersign afterwards."
                  : ""}
              </p>
            )}
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Message to signer (optional)
              </span>
              <textarea
                value={signatureMessage}
                onChange={(event) => setSignatureMessage(event.target.value)}
                rows={4}
                className={inputClass}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendForSignature(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !!workingAction ||
                  !signatureMeta?.configured ||
                  !selectedContract.customerSnapshot.email
                }
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Send for Signature
              </button>
            </div>
          </form>
        </div>
      )}

      {showEmail && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center" onClick={() => setShowEmail(false)}>
          <form onSubmit={handleEmail} className="w-full max-w-2xl rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Email Agreement</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">{contractTitle(selectedContract)}</h3>
              </div>
              <button type="button" onClick={() => setShowEmail(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="text-sm font-semibold text-slate-700">
                Recipient
                <input required type="email" value={emailForm.recipient} onChange={(event) => setEmailForm((current) => ({ ...current, recipient: event.target.value }))} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Subject
                <input required value={emailForm.subject} onChange={(event) => setEmailForm((current) => ({ ...current, subject: event.target.value }))} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Body
                <textarea required rows={8} value={emailForm.message} onChange={(event) => setEmailForm((current) => ({ ...current, message: event.target.value }))} className={inputClass} />
              </label>
            </div>
            <button type="submit" disabled={!!workingAction} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60">
              {workingAction || "Send Contract"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
