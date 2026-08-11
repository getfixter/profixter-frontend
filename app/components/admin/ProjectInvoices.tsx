"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INVOICE_DISCOUNT_TYPES,
  INVOICE_DUE_TERMS,
  INVOICE_LINE_ITEM_CATEGORIES,
  INVOICE_PAYMENT_METHODS,
  INVOICE_TAX_TREATMENTS,
  addProjectInvoicePayment,
  createProjectInvoiceFromContract,
  deleteProjectInvoicePayment,
  downloadProjectInvoicePdf,
  emailProjectInvoice,
  generateProjectInvoicePdf,
  getProjectFinancials,
  getProjectInvoices,
  saveProjectInvoiceDraft,
  updateProjectInvoicePayment,
  voidProjectInvoice,
  type InvoiceBillingIntent,
  type InvoiceBillingMode,
  type InvoiceFinancialWarning,
  type ProjectFinancials,
  type InvoiceDiscountType,
  type InvoiceDueTerm,
  type InvoiceLineItemCategory,
  type InvoicePayment,
  type InvoicePaymentMethod,
  type InvoiceStatus,
  type InvoiceTaxTreatment,
  type Project,
  type ProjectInvoice,
  type ProjectInvoiceInput,
} from "@/lib/admin-service";
import { ProjectFinancialSummaryView } from "@/app/components/admin/ProjectFinancialSummary";

type InvoiceView = "list" | "create" | "details" | "edit";

type LineItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  category: InvoiceLineItemCategory;
};

type DiscountDraft = {
  id: string;
  name: string;
  type: InvoiceDiscountType;
  value: string;
  note: string;
};

type InvoiceFormState = {
  invoiceId?: string;
  source: "manual" | "contract";
  contractId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerId: string;
  propertyAddress: string;
  workType: string;
  projectDescription: string;
  contractNumber: string;
  lineItems: LineItemDraft[];
  discounts: DiscountDraft[];
  taxTreatment: InvoiceTaxTreatment;
  taxRate: string;
  dueTerm: InvoiceDueTerm;
  invoiceDate: string;
  dueDate: string;
  serviceDate: string;
  publicNote: string;
  internalNote: string;
  paymentInstructions: string;
};

type PaymentFormState = {
  amount: string;
  paymentDate: string;
  method: InvoicePaymentMethod;
  reference: string;
  note: string;
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  Sent: "border-blue-200 bg-blue-50 text-blue-700",
  "Partially Paid": "border-amber-200 bg-amber-50 text-amber-700",
  "Paid in Full": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Overdue: "border-rose-200 bg-rose-50 text-rose-700",
  Voided: "border-slate-300 bg-slate-100 text-slate-500",
  Superseded: "border-slate-200 bg-slate-50 text-slate-500",
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function addDays(date: string, days: number) {
  const base = date ? new Date(`${date}T12:00:00.000Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents || 0) / 100);
}

function centsFromMoney(value: string) {
  const number = Number(String(value || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
}

function dollarsFromCents(cents: number) {
  if (!cents) return "";
  return (Number(cents || 0) / 100).toFixed(2);
}

function basisPointsFromPercentInput(value: string) {
  const number = Number(String(value || "").replace(/[%\s]/g, ""));
  return Number.isFinite(number) && number > 0 ? number * 100 : 0;
}

function percentInputFromBasisPoints(value: number) {
  if (!value) return "";
  return (Number(value || 0) / 100)
    .toFixed(3)
    .replace(/0+$/g, "")
    .replace(/\.$/, "");
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

function dueDateForTerm(invoiceDate: string, dueTerm: InvoiceDueTerm, customDueDate: string) {
  if (dueTerm === "custom") return customDueDate || invoiceDate;
  if (dueTerm === "net_7") return addDays(invoiceDate, 7);
  if (dueTerm === "net_15") return addDays(invoiceDate, 15);
  if (dueTerm === "net_30") return addDays(invoiceDate, 30);
  return invoiceDate;
}

function invoiceDisplay(invoice: ProjectInvoice | null) {
  return invoice ? `Invoice #${invoice.invoiceNumber}` : "New Invoice";
}

function defaultPaymentInstructions() {
  return "Checks payable to Premium Island Homes Inc.\nContact 631-599-1363 for payment arrangements.";
}

function defaultForm(project: Project): InvoiceFormState {
  const invoiceDate = todayDate();
  const amountCents = Math.round(Number(project.balanceDue || project.estimateAmount || 0) * 100);
  return {
    source: "manual",
    contractId: null,
    customerName: project.customerSnapshot?.fullName || project.customerName || "",
    customerEmail: project.customerSnapshot?.email || project.email || "",
    customerPhone: project.customerSnapshot?.phone || project.phone || "",
    customerId: project.customerId || "",
    propertyAddress: project.propertySnapshot?.formattedAddress || project.address || "",
    workType: project.projectType || "Project",
    projectDescription: project.notes || `${project.projectType} project for ${project.customerName}`,
    contractNumber: "",
    lineItems: [
      {
        id: `${Date.now()}`,
        description: `${project.projectType || "Project"} work`,
        quantity: "1",
        unitPrice: amountCents ? dollarsFromCents(amountCents) : "",
        category: "Other",
      },
    ],
    discounts: [],
    taxTreatment: "Not Determined",
    taxRate: "",
    dueTerm: "due_on_receipt",
    invoiceDate,
    dueDate: invoiceDate,
    serviceDate: "",
    publicNote: "Thank you for your business.",
    internalNote: "",
    paymentInstructions: defaultPaymentInstructions(),
  };
}

function formFromInvoice(invoice: ProjectInvoice): InvoiceFormState {
  return {
    invoiceId: invoice._id,
    source: invoice.source || "manual",
    contractId: invoice.contractId || invoice.contractSnapshot?.contractId || null,
    customerName: invoice.customerSnapshot.fullName || "",
    customerEmail: invoice.customerSnapshot.email || "",
    customerPhone: invoice.customerSnapshot.phone || "",
    customerId: invoice.customerSnapshot.customerId || "",
    propertyAddress: invoice.propertySnapshot.formattedAddress || invoice.propertySnapshot.address || "",
    workType: invoice.projectSnapshot.workType || "",
    projectDescription: invoice.projectSnapshot.projectDescription || "",
    contractNumber: invoice.contractSnapshot?.contractNumber || "",
    lineItems: invoice.lineItems.map((item, index) => ({
      id: item._id || `${index}-${item.description}`,
      description: item.description,
      quantity: String(item.quantity || 1),
      unitPrice: dollarsFromCents(item.unitPriceCents),
      category: item.category || "Other",
    })),
    discounts: invoice.discounts.map((discount, index) => ({
      id: discount._id || `${index}-${discount.name}`,
      name: discount.name || "",
      type: discount.type || "fixed",
      value: discount.type === "percentage"
        ? percentInputFromBasisPoints(discount.value)
        : dollarsFromCents(discount.value),
      note: discount.note || "",
    })),
    taxTreatment: invoice.taxTreatment || "Not Determined",
    taxRate: percentInputFromBasisPoints(invoice.taxRateBasisPoints),
    dueTerm: invoice.dueTerm || "due_on_receipt",
    invoiceDate: dateOnly(invoice.dates.invoiceDate),
    dueDate: dateOnly(invoice.dates.dueDate),
    serviceDate: dateOnly(invoice.dates.serviceDate),
    publicNote: invoice.publicNote || "",
    internalNote: invoice.internalNote || "",
    paymentInstructions: invoice.paymentInstructions || defaultPaymentInstructions(),
  };
}

function buildPayload(project: Project, form: InvoiceFormState): ProjectInvoiceInput {
  return {
    invoiceId: form.invoiceId,
    source: form.source,
    contractId: form.contractId || null,
    customerSnapshot: {
      fullName: form.customerName,
      email: form.customerEmail,
      phone: form.customerPhone,
      customerId: form.customerId,
    },
    propertySnapshot: {
      address: form.propertyAddress,
      formattedAddress: form.propertyAddress,
    },
    projectSnapshot: {
      projectId: project._id,
      projectNumber: project.projectNumber,
      workType: form.workType,
      projectDescription: form.projectDescription,
    },
    contractSnapshot: {
      contractId: form.contractId || "",
      contractNumber: form.contractNumber,
    },
    lineItems: form.lineItems.map((item, index) => ({
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPriceCents: centsFromMoney(item.unitPrice),
      category: item.category,
      order: index,
    })),
    discounts: form.discounts
      .filter((discount) => discount.name.trim() || discount.value.trim() || discount.note.trim())
      .map((discount, index) => ({
        name: discount.name,
        type: discount.type,
        value: discount.type === "percentage"
          ? basisPointsFromPercentInput(discount.value)
          : centsFromMoney(discount.value),
        note: discount.note,
        order: index,
      })),
    taxTreatment: form.taxTreatment,
    taxRateBasisPoints: form.taxTreatment === "Taxable Repair / Maintenance"
      ? basisPointsFromPercentInput(form.taxRate)
      : 0,
    dueTerm: form.dueTerm,
    dates: {
      invoiceDate: form.invoiceDate,
      dueDate: dueDateForTerm(form.invoiceDate, form.dueTerm, form.dueDate),
      serviceDate: form.serviceDate || null,
    },
    publicNote: form.publicNote,
    internalNote: form.internalNote,
    paymentInstructions: form.paymentInstructions,
  };
}

function pricingFromForm(form: InvoiceFormState, payments: InvoicePayment[] = []) {
  const subtotal = form.lineItems.reduce(
    (sum, item) => sum + Math.round(Number(item.quantity || 0) * centsFromMoney(item.unitPrice)),
    0
  );
  const discounts = form.discounts
    .filter((discount) => discount.name.trim() || discount.value.trim() || discount.note.trim())
    .map((discount) => {
      const amount = discount.type === "percentage"
        ? Math.floor((subtotal * basisPointsFromPercentInput(discount.value) + 5000) / 10000)
        : centsFromMoney(discount.value);
      return { ...discount, amountCents: amount };
    });
  const totalDiscount = discounts.reduce((sum, discount) => sum + discount.amountCents, 0);
  const net = Math.max(subtotal - totalDiscount, 0);
  const tax = form.taxTreatment === "Taxable Repair / Maintenance"
    ? Math.floor((net * basisPointsFromPercentInput(form.taxRate) + 5000) / 10000)
    : 0;
  const total = Math.max(net + tax, 0);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amountCents || 0), 0);
  return {
    subtotal,
    discounts,
    totalDiscount,
    taxable: form.taxTreatment === "Taxable Repair / Maintenance" ? net : 0,
    tax,
    total,
    paid,
    remaining: Math.max(total - paid, 0),
  };
}

function defaultEmail(invoice: ProjectInvoice) {
  const firstName = invoice.customerSnapshot.fullName.split(/\s+/).filter(Boolean)[0] || "there";
  const paid = invoice.status === "Paid in Full" || (invoice.invoiceTotalCents > 0 && invoice.remainingBalanceCents === 0);
  const amountLine = paid
    ? "This invoice is paid in full. Thank you for your payment."
    : `Amount due: ${moneyFromCents(invoice.remainingBalanceCents)}`;
  return {
    recipient: invoice.customerSnapshot.email || "",
    subject: `Premium Island Homes Invoice #${invoice.invoiceNumber}`,
    message: [
      `Hi ${firstName},`,
      "",
      `Attached is Invoice #${invoice.invoiceNumber} for the project at ${invoice.propertySnapshot.formattedAddress || invoice.propertySnapshot.address}.`,
      "",
      amountLine,
      "",
      "Please contact us if you have any questions.",
      "",
      "Thank you,",
      "Taras Bandura",
      "Premium Island Homes Inc.",
      "631-599-1363",
    ].join("\n"),
  };
}

function emptyPaymentForm(): PaymentFormState {
  return {
    amount: "",
    paymentDate: todayDate(),
    method: "Check",
    reference: "",
    note: "",
  };
}

/**
 * What this invoice is meant to bill.
 *
 * Deliberately a separate decision from what the project is worth. The
 * approved Agreement value is context the Admin reads; the amount is a choice
 * the Admin makes.
 */
type BillingFormState = {
  mode: InvoiceBillingMode;
  amount: string;
  label: string;
  changeOrderIds: string[];
};

const BILLING_CHOICES: { mode: InvoiceBillingMode; title: string; blurb: string }[] = [
  { mode: "amount", title: "A set amount", blurb: "Deposit, progress payment or milestone." },
  { mode: "remaining", title: "Remaining approved", blurb: "Everything approved that is not yet invoiced." },
  { mode: "changeOrders", title: "Change orders only", blurb: "Bill executed change order work on its own." },
  { mode: "full", title: "Full Agreement", blurb: "Agreement plus every executed change order." },
];

const emptyBillingForm: BillingFormState = {
  mode: "amount",
  amount: "",
  label: "",
  changeOrderIds: [],
};

function paymentFormFromPayment(payment: InvoicePayment): PaymentFormState {
  return {
    amount: dollarsFromCents(payment.amountCents),
    paymentDate: dateOnly(payment.paymentDate) || todayDate(),
    method: payment.method || "Other",
    reference: payment.reference || "",
    note: payment.note || "",
  };
}

function InvoiceEditor({
  project,
  initial,
  invoice,
  submitLabel,
  onSubmit,
  onCancel,
  onGenerate,
}: {
  project: Project;
  initial: InvoiceFormState;
  invoice: ProjectInvoice | null;
  submitLabel: string;
  onSubmit: (form: InvoiceFormState) => Promise<ProjectInvoice | null>;
  onCancel: () => void;
  onGenerate: (form: InvoiceFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [workingAction, setWorkingAction] = useState("");
  const [error, setError] = useState("");
  const totals = useMemo(() => pricingFromForm(form, invoice?.payments || []), [form, invoice?.payments]);
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const updateField = <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "invoiceDate" || field === "dueTerm") {
        next.dueDate = dueDateForTerm(
          field === "invoiceDate" ? String(value) : current.invoiceDate,
          field === "dueTerm" ? (value as InvoiceDueTerm) : current.dueTerm,
          current.dueDate
        );
      }
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setWorkingAction("Generating PDF...");
    setError("");
    try {
      await onGenerate(form);
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setWorkingAction("");
    }
  };

  const addLineItem = () => {
    setForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        { id: `${Date.now()}`, description: "", quantity: "1", unitPrice: "", category: "Other" },
      ],
    }));
  };

  const updateLineItem = <K extends keyof LineItemDraft>(index: number, field: K, value: LineItemDraft[K]) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addDiscount = () => {
    setForm((current) => ({
      ...current,
      discounts: [
        ...current.discounts,
        { id: `${Date.now()}`, name: "", type: "fixed", value: "", note: "" },
      ],
    }));
  };

  const updateDiscount = <K extends keyof DiscountDraft>(index: number, field: K, value: DiscountDraft[K]) => {
    setForm((current) => ({
      ...current,
      discounts: current.discounts.map((discount, discountIndex) =>
        discountIndex === index ? { ...discount, [field]: value } : discount
      ),
    }));
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" onClick={onCancel} className="text-sm font-semibold text-blue-300">
              Back to invoices
            </button>
            <h3 className="mt-3 text-2xl font-bold">{invoiceDisplay(invoice)}</h3>
            <p className="mt-2 text-sm text-slate-300">{project.customerName} - {project.projectNumber}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={saving || !!workingAction}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? "Saving..." : submitLabel}
            </button>
            <button
              type="button"
              disabled={saving || !!workingAction}
              onClick={generate}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
            >
              {workingAction || "Generate PDF"}
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}
      {invoice?.requiresRegeneration && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Current invoice data changed after the last PDF. Generate a new PDF before emailing.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer and Project Snapshot</p>
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
            Work type
            <input maxLength={120} value={form.workType} onChange={(event) => updateField("workType", event.target.value)} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Property address *
            <input required maxLength={500} value={form.propertyAddress} onChange={(event) => updateField("propertyAddress", event.target.value)} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Project description
            <textarea rows={3} maxLength={10000} value={form.projectDescription} onChange={(event) => updateField("projectDescription", event.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h4 className="font-bold text-slate-950">Line items</h4>
            <p className="mt-1 text-xs text-slate-500">The backend recalculates all line amounts and totals.</p>
          </div>
          <button type="button" onClick={addLineItem} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
            Add item
          </button>
        </div>
        <div className="hidden grid-cols-[1fr_120px_140px_145px_100px] gap-3 bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-500 md:grid">
          <span>Description</span><span>Qty</span><span>Rate</span><span>Category</span><span />
        </div>
        <div className="divide-y divide-slate-100">
          {form.lineItems.map((item, index) => (
            <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_120px_140px_145px_100px] md:items-center md:px-5">
              <input required placeholder="Description" value={item.description} onChange={(event) => updateLineItem(index, "description", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <input required inputMode="decimal" placeholder="1" value={item.quantity} onChange={(event) => updateLineItem(index, "quantity", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <input required inputMode="decimal" placeholder="0.00" value={item.unitPrice} onChange={(event) => updateLineItem(index, "unitPrice", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <select value={item.category} onChange={(event) => updateLineItem(index, "category", event.target.value as InvoiceLineItemCategory)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                {INVOICE_LINE_ITEM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
              <button
                type="button"
                disabled={form.lineItems.length === 1}
                onClick={() => setForm((current) => ({ ...current, lineItems: current.lineItems.filter((_row, rowIndex) => rowIndex !== index) }))}
                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Discounts and Credits</p>
            <h4 className="mt-1 font-bold text-slate-950">Adjustments</h4>
          </div>
          <button type="button" onClick={addDiscount} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Add adjustment
          </button>
        </div>
        {form.discounts.length > 0 && (
          <div className="mt-4 space-y-3">
            {form.discounts.map((discount, index) => (
              <div key={discount.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[1fr_135px_135px_1fr_auto]">
                <input placeholder="Name" value={discount.name} onChange={(event) => updateDiscount(index, "name", event.target.value)} className={inputClass.replace("mt-1.5 ", "")} />
                <select value={discount.type} onChange={(event) => updateDiscount(index, "type", event.target.value as InvoiceDiscountType)} className={inputClass.replace("mt-1.5 ", "")}>
                  {INVOICE_DISCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input placeholder={discount.type === "percentage" ? "10" : "500.00"} value={discount.value} onChange={(event) => updateDiscount(index, "value", event.target.value)} className={inputClass.replace("mt-1.5 ", "")} />
                <input placeholder="Optional note" value={discount.note} onChange={(event) => updateDiscount(index, "note", event.target.value)} className={inputClass.replace("mt-1.5 ", "")} />
                <button type="button" onClick={() => setForm((current) => ({ ...current, discounts: current.discounts.filter((_row, rowIndex) => rowIndex !== index) }))} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Dates and Tax</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Invoice date *
              <input required type="date" value={form.invoiceDate} onChange={(event) => updateField("invoiceDate", event.target.value)} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Due term
              <select value={form.dueTerm} onChange={(event) => updateField("dueTerm", event.target.value as InvoiceDueTerm)} className={inputClass}>
                {INVOICE_DUE_TERMS.map((term) => <option key={term} value={term}>{term.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Due date *
              <input required type="date" value={form.dueDate} disabled={form.dueTerm !== "custom"} onChange={(event) => updateField("dueDate", event.target.value)} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Service/project date
              <input type="date" value={form.serviceDate} onChange={(event) => updateField("serviceDate", event.target.value)} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Tax treatment
              <select value={form.taxTreatment} onChange={(event) => updateField("taxTreatment", event.target.value as InvoiceTaxTreatment)} className={inputClass}>
                {INVOICE_TAX_TREATMENTS.map((treatment) => <option key={treatment}>{treatment}</option>)}
              </select>
            </label>
            {form.taxTreatment === "Taxable Repair / Maintenance" && (
              <label className="text-sm font-semibold text-slate-700">
                Tax rate %
                <input required inputMode="decimal" placeholder="8.625" value={form.taxRate} onChange={(event) => updateField("taxRate", event.target.value)} className={inputClass} />
              </label>
            )}
            {form.taxTreatment === "Capital Improvement - No Sales Tax" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 md:col-span-2">
                Confirm NY Form ST-124 is stored before treating this invoice as a capital improvement.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <h4 className="font-bold">Preview summary</h4>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><strong>{moneyFromCents(totals.subtotal)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-400">Discounts/Credits</span><strong>-{moneyFromCents(totals.totalDiscount).replace("-", "")}</strong></div>
            <div className="flex justify-between"><span className="text-slate-400">Sales tax</span><strong>{moneyFromCents(totals.tax)}</strong></div>
            <div className="flex justify-between border-t border-white/10 pt-4"><span>Invoice total</span><strong>{moneyFromCents(totals.total)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-400">Payments</span><strong>-{moneyFromCents(totals.paid).replace("-", "")}</strong></div>
            <div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Remaining</span><strong>{moneyFromCents(totals.remaining)}</strong></div>
          </div>
        </section>
      </div>

      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Customer note
          <textarea rows={5} maxLength={10000} value={form.publicNote} onChange={(event) => updateField("publicNote", event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Internal note
          <textarea rows={5} maxLength={10000} value={form.internalNote} onChange={(event) => updateField("internalNote", event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">
          Payment instructions
          <textarea rows={3} maxLength={2000} value={form.paymentInstructions} onChange={(event) => updateField("paymentInstructions", event.target.value)} className={inputClass} />
        </label>
      </section>
    </form>
  );
}

/**
 * The agreement position this invoice was issued against.
 *
 * Read from the invoice's own frozen snapshot, not from the live project, so
 * an invoice sent months ago keeps showing the figures it was actually sent
 * against. Invoices predating the snapshot simply have none and show nothing.
 */
function AgreementPosition({ invoice }: { invoice: ProjectInvoice }) {
  const snapshot = invoice.projectFinancialSnapshot;
  if (!snapshot?.capturedAt || !snapshot.approvedAgreementCents) return null;

  const totalInvoiced = snapshot.previouslyInvoicedCents + invoice.invoiceTotalCents;
  const remaining = snapshot.approvedAgreementCents - totalInvoiced;
  const issued = !!invoice.sentAt;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Agreement position
        </p>
        <p className="text-[11px] text-slate-400">
          {issued
            ? `Frozen when this invoice was issued on ${displayDate(invoice.sentAt)}`
            : "Draft - updates until this invoice is issued"}
        </p>
      </div>
      <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span className="text-slate-600">Original Agreement</span>
          <span className="tabular-nums font-bold text-slate-900">{moneyFromCents(snapshot.originalAgreementCents)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span className="text-slate-600">
            Executed change orders{snapshot.executedChangeOrders.length ? ` (${snapshot.executedChangeOrders.length})` : ""}
          </span>
          <span className="tabular-nums font-bold text-slate-900">
            {snapshot.executedChangeOrderCents < 0 ? "-" : "+"}
            {moneyFromCents(Math.abs(snapshot.executedChangeOrderCents))}
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span className="text-slate-600">Approved Agreement Value</span>
          <span className="tabular-nums font-black text-slate-950">{moneyFromCents(snapshot.approvedAgreementCents)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span className="text-slate-600">Previously invoiced</span>
          <span className="tabular-nums font-bold text-slate-900">{moneyFromCents(snapshot.previouslyInvoicedCents)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span className="text-slate-600">This invoice</span>
          <span className="tabular-nums font-bold text-slate-900">{moneyFromCents(invoice.invoiceTotalCents)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
          <span className={remaining < 0 ? "text-rose-700" : "text-slate-600"}>
            {remaining < 0 ? "Invoiced above approved" : "Approved, not yet invoiced"}
          </span>
          <span className={`tabular-nums font-bold ${remaining < 0 ? "text-rose-700" : "text-slate-900"}`}>
            {moneyFromCents(Math.abs(remaining))}
          </span>
        </div>
      </div>
      {snapshot.executedChangeOrders.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {snapshot.executedChangeOrders.map((entry) => (
            <li key={entry.changeOrderNumber} className="flex justify-between gap-3 text-xs">
              <span className="truncate text-slate-500">
                {entry.changeOrderNumber}
                {entry.title ? ` - ${entry.title}` : ""}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-slate-600">
                {entry.netAdjustmentCents < 0 ? "-" : "+"}
                {moneyFromCents(Math.abs(entry.netAdjustmentCents))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProjectInvoices({ project }: { project: Project }) {
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [selected, setSelected] = useState<ProjectInvoice | null>(null);
  const [view, setView] = useState<InvoiceView>("list");
  const [loading, setLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ recipient: "", subject: "", message: "" });
  const [showPayment, setShowPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InvoicePayment | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [financials, setFinancials] = useState<ProjectFinancials | null>(null);
  const [showBilling, setShowBilling] = useState(false);
  const [billing, setBilling] = useState<BillingFormState>(emptyBillingForm);
  const [warnings, setWarnings] = useState<InvoiceFinancialWarning[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await getProjectInvoices(project._id);
      setInvoices(next);
      setSelected((current) => current ? next.find((invoice) => invoice._id === current._id) || current : null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  /**
   * The project's approved position, reloaded whenever billing changes it.
   * Read-only context: it tells the Admin what the project is worth, never
   * what this invoice should be.
   */
  const loadFinancials = useCallback(async () => {
    try {
      setFinancials(await getProjectFinancials(project._id));
    } catch {
      setFinancials(null);
    }
  }, [project._id]);

  useEffect(() => {
    void load();
    void loadFinancials();
  }, [load, loadFinancials]);

  const upsertInvoice = (invoice: ProjectInvoice) => {
    setInvoices((current) => {
      const without = current.filter((item) => item._id !== invoice._id);
      return [invoice, ...without].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
    setSelected(invoice);
    // Issuing, voiding or paying an invoice all move the project totals.
    void loadFinancials();
  };

  const createNew = () => {
    setSelected(null);
    setView("create");
    setSuccess("");
    setError("");
  };

  const createFromContract = async () => {
    setWorkingAction("Creating invoice...");
    setError("");
    setSuccess("");
    setWarnings([]);
    try {
      const intent: InvoiceBillingIntent =
        billing.mode === "amount"
          ? { mode: "amount", amountCents: centsFromMoney(billing.amount), label: billing.label.trim() }
          : billing.mode === "changeOrders"
            ? { mode: "changeOrders", changeOrderIds: billing.changeOrderIds }
            : { mode: billing.mode };
      const result = await createProjectInvoiceFromContract(project._id, undefined, intent);
      upsertInvoice(result.invoice);
      setWarnings(result.financialWarnings);
      setShowBilling(false);
      setBilling(emptyBillingForm);
      // Review before editing: money was just prefilled on the Admin's behalf.
      setView("details");
      setSuccess("Invoice draft created. Review the amounts before generating the PDF.");
      void loadFinancials();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setWorkingAction("");
    }
  };

  const saveForm = async (form: InvoiceFormState) => {
    const invoice = await saveProjectInvoiceDraft(project._id, buildPayload(project, form));
    upsertInvoice(invoice);
    setView("details");
    setSuccess("Invoice draft saved.");
    return invoice;
  };

  const generateFromForm = async (form: InvoiceFormState) => {
    const saved = await saveProjectInvoiceDraft(project._id, buildPayload(project, form));
    upsertInvoice(saved);
    const generated = await generateProjectInvoicePdf(project._id, saved._id);
    upsertInvoice(generated);
    setView("details");
    setSuccess("Invoice PDF generated.");
  };

  const generateSelected = async () => {
    if (!selected) return;
    setWorkingAction("Generating PDF...");
    setError("");
    try {
      const generated = await generateProjectInvoicePdf(project._id, selected._id);
      upsertInvoice(generated);
      setSuccess("Invoice PDF generated.");
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setWorkingAction("");
    }
  };

  const downloadSelected = async (invoice = selected) => {
    if (!invoice) return;
    setWorkingAction("Preparing download...");
    setError("");
    try {
      const blob = await downloadProjectInvoicePdf(project._id, invoice._id);
      downloadBlob(blob, invoice.currentPdf?.fileName || `Invoice-${invoice.invoiceNumber}.pdf`);
      await load();
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setWorkingAction("");
    }
  };

  const openEmail = (invoice: ProjectInvoice) => {
    setEmailForm(defaultEmail(invoice));
    setShowEmail(true);
  };

  const sendEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setWorkingAction("Emailing invoice...");
    setError("");
    try {
      const emailed = await emailProjectInvoice(selected._id, {
        ...emailForm,
        projectId: project._id,
      });
      upsertInvoice(emailed);
      setShowEmail(false);
      setSuccess(emailed.status === "Paid in Full" ? "Paid receipt emailed and history saved." : "Invoice emailed and history saved.");
    } catch (emailError) {
      setError(errorMessage(emailError));
    } finally {
      setWorkingAction("");
    }
  };

  const openPayment = (payment?: InvoicePayment) => {
    setEditingPayment(payment || null);
    setPaymentForm(payment ? paymentFormFromPayment(payment) : emptyPaymentForm());
    setShowPayment(true);
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setWorkingAction(editingPayment ? "Updating payment..." : "Adding payment...");
    setError("");
    try {
      const payload = {
        amountCents: centsFromMoney(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        method: paymentForm.method,
        reference: paymentForm.reference,
        note: paymentForm.note,
      };
      const invoice = editingPayment?._id
        ? await updateProjectInvoicePayment(project._id, selected._id, editingPayment._id, payload)
        : await addProjectInvoicePayment(project._id, selected._id, payload);
      upsertInvoice(invoice);
      setShowPayment(false);
      setSuccess(invoice.status === "Paid in Full" ? "Payment saved. Invoice is paid in full." : "Payment saved.");
    } catch (paymentError) {
      setError(errorMessage(paymentError));
    } finally {
      setWorkingAction("");
    }
  };

  const removePayment = async (payment: InvoicePayment) => {
    if (!selected || !payment._id) return;
    if (!window.confirm("Remove this payment record?")) return;
    setWorkingAction("Removing payment...");
    setError("");
    try {
      const invoice = await deleteProjectInvoicePayment(project._id, selected._id, payment._id);
      upsertInvoice(invoice);
      setSuccess("Payment removed.");
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setWorkingAction("");
    }
  };

  const voidSelected = async () => {
    if (!selected) return;
    const confirmation = window.prompt(`Type VOID to void Invoice #${selected.invoiceNumber}.`, "");
    if (confirmation !== "VOID") return;
    const reason = window.prompt("Optional reason for voiding this invoice:", "") || "";
    setWorkingAction("Voiding invoice...");
    setError("");
    try {
      const invoice = await voidProjectInvoice(project._id, selected._id, { confirmation: "VOID", reason });
      upsertInvoice(invoice);
      setSuccess("Invoice voided. Generate a new PDF if a voided copy is needed.");
    } catch (voidError) {
      setError(errorMessage(voidError));
    } finally {
      setWorkingAction("");
    }
  };

  if (view === "create") {
    return (
      <InvoiceEditor
        project={project}
        initial={defaultForm(project)}
        invoice={null}
        submitLabel="Save Draft"
        onCancel={() => setView("list")}
        onSubmit={saveForm}
        onGenerate={generateFromForm}
      />
    );
  }

  if (view === "edit" && selected) {
    return (
      <InvoiceEditor
        project={project}
        initial={formFromInvoice(selected)}
        invoice={selected}
        submitLabel="Save Draft"
        onCancel={() => setView("details")}
        onSubmit={saveForm}
        onGenerate={generateFromForm}
      />
    );
  }

  if (view === "details" && selected) {
    const paid = selected.status === "Paid in Full";
    return (
      <div className="space-y-5">
        <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <button type="button" onClick={() => setView("list")} className="text-sm font-semibold text-blue-300">Back to invoices</button>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-bold">Invoice #{selected.invoiceNumber}</h3>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
                {selected.requiresRegeneration && <span className="rounded-full border border-amber-300 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">Needs new PDF</span>}
              </div>
              <p className="mt-2 text-slate-300">{selected.customerSnapshot.fullName} - {selected.projectSnapshot.workType}</p>
              {paid && selected.dates.paidInFullAt && (
                <p className="mt-2 text-sm font-semibold text-emerald-200">Paid in Full on {displayDate(selected.dates.paidInFullAt)}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setView("edit")} disabled={selected.status === "Voided" || !!workingAction} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold disabled:opacity-50">Edit</button>
              <button type="button" onClick={generateSelected} disabled={!!workingAction} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold hover:bg-white/10 disabled:opacity-50">{workingAction || "Generate PDF"}</button>
            </div>
          </div>
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</div>}
        {warnings.map((warning) => (
          <div key={warning.code} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            {warning.message}
          </div>
        ))}

        <AgreementPosition invoice={selected} />

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 bg-slate-950 px-5 py-4 text-xs font-bold uppercase text-white md:grid-cols-[1fr_90px_120px_120px]">
              <span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span>
            </div>
            <div className="divide-y divide-slate-100">
              {selected.lineItems.map((item) => (
                <div key={item._id || item.description} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_90px_120px_120px] md:px-5">
                  <strong className="text-slate-900">{item.description}</strong>
                  <span className="text-slate-600">{item.quantity}</span>
                  <span className="text-slate-600">{moneyFromCents(item.unitPriceCents)}</span>
                  <strong className="text-slate-900">{moneyFromCents(item.amountCents)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><strong>{moneyFromCents(selected.subtotalCents)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Discounts/Credits</span><strong>-{moneyFromCents(selected.totalDiscountCents).replace("-", "")}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Sales tax</span><strong>{moneyFromCents(selected.taxAmountCents)}</strong></div>
              <div className="flex justify-between border-t border-white/10 pt-4"><span>Invoice total</span><strong>{moneyFromCents(selected.invoiceTotalCents)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Payments</span><strong>-{moneyFromCents(selected.totalPaidCents).replace("-", "")}</strong></div>
              <div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Remaining</span><strong>{moneyFromCents(selected.remainingBalanceCents)}</strong></div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Actions</p>
              <h4 className="mt-1 font-bold text-slate-950">PDF and Delivery</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!selected.currentPdf?.available || !!workingAction} onClick={() => void downloadSelected()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                {paid ? "Download Paid Invoice" : "Download PDF"}
              </button>
              <button type="button" disabled={!selected.currentPdf?.available || selected.requiresRegeneration || !!workingAction} onClick={() => openEmail(selected)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                {paid ? "Email Paid Receipt" : "Email Invoice"}
              </button>
              <button type="button" disabled={selected.status === "Voided" || !!workingAction} onClick={() => openPayment()} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                Add Payment
              </button>
              <button type="button" disabled={selected.status === "Voided" || !!workingAction} onClick={voidSelected} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                Void Invoice
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Payments</p>
              <h4 className="mt-1 font-bold text-slate-950">Payment ledger</h4>
            </div>
          </div>
          {selected.payments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No payments recorded.</p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {selected.payments.map((payment) => (
                <div key={payment._id || `${payment.paymentDate}-${payment.amountCents}`} className="grid gap-3 p-3 text-sm md:grid-cols-[120px_1fr_120px_auto] md:items-center">
                  <span className="font-semibold text-slate-700">{displayDate(payment.paymentDate)}</span>
                  <span className="text-slate-600">{payment.method}{payment.reference ? ` - ${payment.reference}` : ""}</span>
                  <strong className="text-slate-950">{moneyFromCents(payment.amountCents)}</strong>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openPayment(payment)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Edit</button>
                    <button type="button" onClick={() => void removePayment(payment)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer note</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.publicNote || "No customer note."}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Event History</p>
            <div className="mt-3 space-y-2">
              {selected.eventHistory?.length ? [...selected.eventHistory].reverse().slice(0, 8).map((event) => (
                <div key={event._id || `${event.event}-${event.at}`} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-bold text-slate-900">{event.event}</p>
                  <p className="mt-1 text-xs text-slate-500">{displayDate(event.at)} {event.adminEmail ? `by ${event.adminEmail}` : ""}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No invoice events yet.</p>}
            </div>
          </div>
        </section>

        {showEmail && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center" onClick={() => setShowEmail(false)}>
            <form onSubmit={sendEmail} className="w-full max-w-2xl rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Email Invoice</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">Invoice #{selected.invoiceNumber}</h3>
                </div>
                <button type="button" onClick={() => setShowEmail(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  Close
                </button>
              </div>
              <div className="mt-5 space-y-4">
                <label className="text-sm font-semibold text-slate-700">
                  Recipient
                  <input required type="email" value={emailForm.recipient} onChange={(event) => setEmailForm((current) => ({ ...current, recipient: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Subject
                  <input required value={emailForm.subject} onChange={(event) => setEmailForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Body
                  <textarea required rows={8} value={emailForm.message} onChange={(event) => setEmailForm((current) => ({ ...current, message: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </label>
              </div>
              <button type="submit" disabled={!!workingAction} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60">
                {workingAction || "Send Invoice"}
              </button>
            </form>
          </div>
        )}

        {showPayment && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center" onClick={() => setShowPayment(false)}>
            <form onSubmit={savePayment} className="w-full max-w-xl rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">{editingPayment ? "Edit Payment" : "Add Payment"}</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">Invoice #{selected.invoiceNumber}</h3>
                </div>
                <button type="button" onClick={() => setShowPayment(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  Close
                </button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Amount
                  <input required inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Payment date
                  <input required type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Method
                  <select value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as InvoicePaymentMethod }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm">
                    {INVOICE_PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Reference
                  <input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" />
                </label>
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Note
                  <textarea rows={3} value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" />
                </label>
              </div>
              <button type="submit" disabled={!!workingAction} className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                {workingAction || "Save Payment"}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-950">Invoices</h3>
          <p className="mt-1 text-sm text-slate-500">Customer-facing invoices attached to {project.projectNumber}.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setShowBilling((current) => !current);
              setError("");
              setSuccess("");
            }}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            {showBilling ? "Cancel" : "Bill from Agreement"}
          </button>
          <button type="button" onClick={createNew} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
            New Invoice
          </button>
        </div>
      </div>

      {financials ? <ProjectFinancialSummaryView financials={financials} compact /> : null}

      {showBilling && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h4 className="text-sm font-black text-slate-950">What is this invoice billing?</h4>
          <p className="mt-1 text-xs text-slate-500">
            The figures above are the project&apos;s position. The amount billed is your decision.
          </p>

          {!financials?.agreement ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              This project has no Agreement yet. Create one first, or use New Invoice for manual billing.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {BILLING_CHOICES.map((choice) => {
                  const active = billing.mode === choice.mode;
                  return (
                    <button
                      key={choice.mode}
                      type="button"
                      onClick={() => setBilling((current) => ({ ...current, mode: choice.mode }))}
                      aria-pressed={active}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-bold text-slate-900">{choice.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{choice.blurb}</span>
                    </button>
                  );
                })}
              </div>

              {billing.mode === "amount" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    This invoice amount
                    <input
                      inputMode="decimal"
                      placeholder="5,000.00"
                      value={billing.amount}
                      onChange={(event) => setBilling((current) => ({ ...current, amount: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Description on the invoice
                    <input
                      placeholder="Deposit"
                      maxLength={240}
                      value={billing.label}
                      onChange={(event) => setBilling((current) => ({ ...current, label: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm"
                    />
                  </label>
                </div>
              )}

              {billing.mode === "remaining" && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Bills <strong className="tabular-nums">{moneyFromCents(financials.totals.uninvoicedApprovedCents)}</strong>
                  {" "}- the approved Agreement value not yet invoiced.
                </p>
              )}

              {billing.mode === "changeOrders" && (
                <div className="mt-4">
                  {financials.changeOrders.executed.length === 0 ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                      No executed change orders on this Agreement yet.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {financials.changeOrders.executed.map((changeOrder) => {
                        const checked =
                          billing.changeOrderIds.length === 0 ||
                          billing.changeOrderIds.includes(changeOrder.id);
                        return (
                          <label
                            key={changeOrder.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setBilling((current) => {
                                    const explicit = current.changeOrderIds.length
                                      ? current.changeOrderIds
                                      : financials.changeOrders.executed.map((item) => item.id);
                                    const next = explicit.includes(changeOrder.id)
                                      ? explicit.filter((id) => id !== changeOrder.id)
                                      : [...explicit, changeOrder.id];
                                    return { ...current, changeOrderIds: next };
                                  })
                                }
                                className="h-4 w-4 shrink-0 rounded border-slate-300"
                              />
                              <span className="truncate text-slate-800">
                                {changeOrder.changeOrderNumber}
                                {changeOrder.title ? ` - ${changeOrder.title}` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums font-bold text-slate-900">
                              {changeOrder.netAdjustmentCents < 0 ? "-" : "+"}
                              {moneyFromCents(Math.abs(changeOrder.netAdjustmentCents))}
                            </span>
                          </label>
                        );
                      })}
                      <p className="text-xs text-slate-500">
                        Deductions become credits on the invoice. A no-cost change order bills nothing.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {billing.mode === "full" && financials.totals.invoicedCents > 0 && (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {moneyFromCents(financials.totals.invoicedCents)} has already been invoiced on this project.
                  Billing the full Agreement again would double-bill it.
                </p>
              )}

              <button
                type="button"
                onClick={createFromContract}
                disabled={!!workingAction || (billing.mode === "amount" && centsFromMoney(billing.amount) <= 0)}
                className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {workingAction || "Create Invoice Draft"}
              </button>
            </>
          )}
        </section>
      )}

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</div>}
      {warnings.map((warning) => (
        <div key={warning.code} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          {warning.message}
        </div>
      ))}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h4 className="font-bold text-slate-900">No invoices yet</h4>
          <p className="mt-2 text-sm text-slate-500">Create the first invoice for this project.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map((invoice) => (
            <button
              key={invoice._id}
              type="button"
              onClick={() => {
                setSelected(invoice);
                setView("details");
                setError("");
                setSuccess("");
              }}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md sm:grid-cols-[150px_1fr_140px_150px] sm:items-center"
            >
              <span className="font-bold text-blue-700">#{invoice.invoiceNumber}</span>
              <span>
                <strong className="block text-slate-950">{invoice.customerSnapshot.fullName}</strong>
                <span className="text-sm text-slate-500">{displayDate(invoice.dates.invoiceDate)} - due {displayDate(invoice.dates.dueDate)}</span>
              </span>
              <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[invoice.status]}`}>{invoice.status}</span>
              <strong className="text-slate-950 sm:text-right">{moneyFromCents(invoice.remainingBalanceCents)}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
