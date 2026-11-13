"use client";

import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  getProjectCustomer,
  searchProjectCustomers,
  type Project,
  type ProjectCustomerAddress,
  type ProjectCustomerSearchResult,
  type ProjectInput,
  type ProjectMembershipSummary,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/admin-service";
import { errorMessage } from "@/lib/admin/query";
import { Button, Field, Select, Sheet, StatusBadge, TextInput, Textarea, cx } from "@/app/components/admin/ui";

/*
 * Create and Edit project, as one kit Sheet (sticky footer, keyboard-safe,
 * max-height in dvh). The customer selector works exactly as before: link a
 * registered customer and one of their properties, or keep a manual customer.
 * Every "are you sure" that used window.confirm is now an inline step inside
 * this sheet (no second modal on top).
 *
 * The manual status is chosen only when creating. On an existing project it
 * changes through its own control, which records history with a precondition,
 * so saving contact details can never silently overwrite a status someone
 * else changed.
 */

type CustomerSource = "existing" | "manual";

export const EMPTY_PROJECT: ProjectInput = {
  status: "Lead",
  customerId: null,
  addressId: null,
  customerName: "",
  phone: "",
  email: "",
  address: "",
  customerSnapshot: { fullName: "", email: "", phone: "" },
  propertySnapshot: { addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", formattedAddress: "" },
  projectType: "Roofing",
  estimateAmount: 0,
  depositAmount: 0,
  balanceDue: 0,
  notes: "",
};

export function projectToInput(project: Project): ProjectInput {
  return {
    status: project.status,
    customerId: project.customerId || null,
    addressId: project.addressId || null,
    customerName: project.customerName,
    phone: project.phone,
    email: project.email,
    address: project.address,
    customerSnapshot: project.customerSnapshot || { fullName: project.customerName, email: project.email, phone: project.phone },
    propertySnapshot: project.propertySnapshot || {
      addressLine1: project.address,
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      formattedAddress: project.address,
    },
    projectType: project.projectType,
    estimateAmount: project.estimateAmount,
    depositAmount: project.depositAmount,
    balanceDue: project.balanceDue,
    notes: project.notes,
  };
}

function hasManualContactData(form: ProjectInput) {
  return Boolean(
    String(form.customerName || "").trim() || String(form.email || "").trim() || String(form.phone || "").trim() || String(form.address || "").trim()
  );
}

export function membershipLabel(summary?: ProjectMembershipSummary | null) {
  if (!summary) return "No active membership";
  const status = summary.selectedAddressStatus || summary.overallStatus;
  const plan = summary.selectedAddressPlanName || summary.planName;
  if ((status === "active" || status === "trialing") && plan) return `Active · ${plan}`;
  if (status === "scheduled_for_cancellation" && plan) return `Scheduled for cancellation · ${plan}`;
  if (status === "past_due") return plan ? `Past due · ${plan}` : "Past due";
  if (status === "canceled") return "Past member";
  return "No active membership";
}

export function membershipTone(summary?: ProjectMembershipSummary | null): "success" | "attention" | "problem" | "neutral" {
  const status = summary?.selectedAddressStatus || summary?.overallStatus;
  if (status === "active" || status === "trialing") return "success";
  if (status === "scheduled_for_cancellation") return "attention";
  if (status === "past_due") return "problem";
  return "neutral";
}

function propertySnapshotFromAddress(address: ProjectCustomerAddress | null, fallbackAddress = "") {
  return {
    addressLine1: address?.line1 || fallbackAddress,
    addressLine2: "",
    city: address?.city || "",
    state: address?.state || "",
    postalCode: address?.zip || "",
    formattedAddress: address?.formattedAddress || fallbackAddress,
  };
}

function customerSnapshotFromForm(form: ProjectInput) {
  return { fullName: form.customerName, email: form.email, phone: form.phone };
}

function highlightMatch(value: string | null | undefined, query: string): ReactNode {
  const text = String(value || "");
  const needle = query.trim();
  if (!text || needle.length < 2) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-adm-xs bg-adm-attn-bg px-0.5 text-adm-ink">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

/** "1,250.50" → 1250.5; anything unreadable → NaN. */
function parseMoney(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

type Guard = { message: string; proceed: () => void } | null;

export function ProjectFormSheet({
  open,
  mode,
  initial,
  title,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: ProjectInput;
  title: string;
  onClose: () => void;
  /** Throws on failure; the sheet stays open with the server's message. */
  onSubmit: (data: ProjectInput) => Promise<void>;
}) {
  const [state, setState] = useState({ dirty: false, saving: false });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="full"
      width="wide"
      dirty={state.dirty}
      busy={state.saving}
      data-sheet={mode === "create" ? "project-create" : "project-edit"}
      footer={
        <>
          <Button variant="secondary" large onClick={onClose}>
            Cancel
          </Button>
          <Button large type="submit" form="pfx-project-form" busy={state.saving} data-action="save-project">
            {mode === "create" ? "Create project" : "Save changes"}
          </Button>
        </>
      }
    >
      <ProjectFormBody key={open ? "open" : "closed"} mode={mode} initial={initial} onSubmit={onSubmit} onState={setState} />
    </Sheet>
  );
}

function ProjectFormBody({
  mode,
  initial,
  onSubmit,
  onState,
}: {
  mode: "create" | "edit";
  initial: ProjectInput;
  onSubmit: (data: ProjectInput) => Promise<void>;
  onState: (state: { dirty: boolean; saving: boolean }) => void;
}) {
  const [form, setForm] = useState<ProjectInput>(initial);
  const [amountText, setAmountText] = useState(initial.estimateAmount ? String(initial.estimateAmount) : "");
  const [customerSource, setCustomerSource] = useState<CustomerSource>(initial.customerId ? "existing" : "manual");
  const [selectedCustomer, setSelectedCustomer] = useState<ProjectCustomerSearchResult | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(!initial.customerId);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<ProjectCustomerSearchResult[]>([]);
  const [customerNextCursor, setCustomerNextCursor] = useState<string | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [guard, setGuard] = useState<Guard>(null);
  const searchId = useId();
  const initialAmount = initial.estimateAmount ? String(initial.estimateAmount) : "";
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || amountText !== initialAmount;
  useEffect(() => {
    onState({ dirty, saving });
  }, [dirty, saving, onState]);

  /* Ask before an action that would replace what was typed or change a linked customer. */
  const confirmFirst = (needed: boolean, message: string, proceed: () => void) => {
    if (!needed) return proceed();
    setGuard({ message, proceed });
  };
  const LINK_CHANGE = "Changing the linked customer can affect future agreements and documents. Continue?";

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "customerName" || key === "email" || key === "phone") next.customerSnapshot = customerSnapshotFromForm(next);
      if (key === "address") {
        next.propertySnapshot = {
          ...(next.propertySnapshot || {}),
          formattedAddress: String(value || ""),
          addressLine1: next.propertySnapshot?.addressLine1 || String(value || ""),
        };
      }
      return next;
    });
  };

  useEffect(() => {
    let canceled = false;
    if (!initial.customerId) return;
    getProjectCustomer(initial.customerId, initial.addressId || null)
      .then((customer) => {
        if (!canceled) setSelectedCustomer(customer);
      })
      .catch(() => {
        if (!canceled) setSelectedCustomer(null);
      });
    return () => {
      canceled = true;
    };
  }, [initial.addressId, initial.customerId]);

  useEffect(() => {
    if (customerSource !== "existing" || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setCustomerNextCursor(null);
      setCustomerSearchError("");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCustomerSearching(true);
      setCustomerSearchError("");
      searchProjectCustomers({ q: customerQuery, limit: 12 }, controller.signal)
        .then((response) => {
          setCustomerResults(response.customers);
          setCustomerNextCursor(response.nextCursor);
        })
        .catch((searchError) => {
          if (controller.signal.aborted) return;
          setCustomerSearchError(errorMessage(searchError));
        })
        .finally(() => {
          if (!controller.signal.aborted) setCustomerSearching(false);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [customerQuery, customerSource]);

  const loadMoreCustomers = async () => {
    if (!customerNextCursor || customerSearching) return;
    setCustomerSearching(true);
    setCustomerSearchError("");
    try {
      const response = await searchProjectCustomers({ q: customerQuery, limit: 12, cursor: customerNextCursor });
      setCustomerResults((current) => [...current, ...response.customers]);
      setCustomerNextCursor(response.nextCursor);
    } catch (loadError) {
      setCustomerSearchError(errorMessage(loadError));
    } finally {
      setCustomerSearching(false);
    }
  };

  const chooseAddress = (customer: ProjectCustomerSearchResult, address: ProjectCustomerAddress | null) => {
    setSelectedCustomer(customer);
    setForm((current) => ({
      ...current,
      customerId: customer.customerId,
      addressId: address?.id || null,
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: address?.formattedAddress || current.address,
      customerSnapshot: { fullName: customer.name, email: customer.email, phone: customer.phone },
      propertySnapshot: propertySnapshotFromAddress(address, address?.formattedAddress || current.address),
    }));
  };

  const selectCustomer = (customer: ProjectCustomerSearchResult) => {
    const preferredAddress = customer.matchingAddress || customer.addresses.find((address) => address.isDefault) || customer.addresses[0] || null;
    chooseAddress(customer, preferredAddress);
    setCustomerQuery("");
    setCustomerResults([]);
    setCustomerNextCursor(null);
    setShowCustomerSearch(false);
  };

  const clearSelectedCustomer = () =>
    confirmFirst(Boolean(initial.customerId), LINK_CHANGE, () => {
      setSelectedCustomer(null);
      setShowCustomerSearch(true);
      setCustomerResults([]);
      setCustomerNextCursor(null);
      setForm((current) => ({
        ...current,
        customerId: null,
        addressId: null,
        customerSnapshot: customerSnapshotFromForm(current),
        propertySnapshot: propertySnapshotFromAddress(null, current.address),
      }));
    });

  const useSearchAsManualCustomer = () => {
    const manualName = customerQuery.trim();
    if (!manualName) return;
    setCustomerSource("manual");
    setSelectedCustomer(null);
    setShowCustomerSearch(false);
    setCustomerResults([]);
    setCustomerNextCursor(null);
    setForm((current) => {
      const next = { ...current, customerId: null, addressId: null, customerName: manualName };
      return { ...next, customerSnapshot: customerSnapshotFromForm(next), propertySnapshot: propertySnapshotFromAddress(null, next.address) };
    });
  };

  const switchSource = (source: CustomerSource) => {
    if (source === customerSource) return;
    if (source === "manual") {
      setCustomerSource("manual");
      setSelectedCustomer(null);
      setShowCustomerSearch(false);
      setForm((current) => ({
        ...current,
        customerId: null,
        addressId: null,
        customerSnapshot: customerSnapshotFromForm(current),
        propertySnapshot: propertySnapshotFromAddress(null, current.address),
      }));
      return;
    }
    const replacesTyped = customerSource === "manual" && hasManualContactData(form);
    const changesLink = Boolean(initial.customerId && form.customerId);
    confirmFirst(
      replacesTyped || changesLink,
      replacesTyped ? "Selecting a registered customer will replace the customer and property details typed here. Continue?" : LINK_CHANGE,
      () => {
        setCustomerSource("existing");
        setShowCustomerSearch(true);
      }
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const errors: Record<string, string> = {};
    if (!String(form.customerName || "").trim()) errors.customerName = "Enter the customer's name.";
    if (!String(form.address || "").trim()) errors.address = "Enter the project address.";
    const amount = parseMoney(amountText);
    if (Number.isNaN(amount)) errors.estimateAmount = "Enter an amount like 12500 or 12,500.00.";
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    setError("");
    try {
      const payload: ProjectInput = {
        ...form,
        estimateAmount: amount,
        customerId: customerSource === "existing" ? form.customerId || null : null,
        addressId: customerSource === "existing" ? form.addressId || null : null,
        customerSnapshot: customerSnapshotFromForm(form),
        propertySnapshot: { ...(form.propertySnapshot || propertySnapshotFromAddress(null, form.address)), formattedAddress: form.address },
      };
      await onSubmit(payload);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const selectedProjectAddress = selectedCustomer?.addresses.find((address) => address.id === form.addressId) || null;
  const selectedMembershipSummary = selectedProjectAddress?.membershipSummary || selectedCustomer?.membershipSummary || null;
  const trimmedCustomerQuery = customerQuery.trim();
  const showNoRegisteredCustomersFound =
    showCustomerSearch && trimmedCustomerQuery.length >= 2 && !customerSearching && !customerSearchError && customerResults.length === 0;
  const showCustomerDropdown = customerResults.length > 0 || showNoRegisteredCustomersFound;
  const sourceOptions = useMemo(
    () =>
      [
        ["existing", "Registered customer"],
        ["manual", "New or manual customer"],
      ] as const,
    []
  );

  return (
    <form id="pfx-project-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" aria-busy={saving || undefined}>
      {error && (
        <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] font-medium text-adm-problem">
          {error}
        </p>
      )}

      {guard && (
        <div role="alertdialog" aria-label="Confirm change" className="rounded-adm-md border border-adm-attn bg-adm-attn-bg p-3 text-[14px] text-adm-ink" data-guard="">
          <p>{guard.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const next = guard.proceed;
                setGuard(null);
                next();
              }}
            >
              Continue
            </Button>
            <Button variant="secondary" onClick={() => setGuard(null)}>
              Keep as is
            </Button>
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[13px] font-semibold text-adm-ink">Customer</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Customer source">
          {sourceOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={customerSource === value}
              onClick={() => switchSource(value)}
              className={cx(
                "min-h-[44px] rounded-adm-sm border px-3 py-2 text-left text-[14px] font-semibold",
                customerSource === value ? "border-adm-accent bg-adm-accent-soft text-adm-ink" : "border-adm-line bg-adm-surface text-adm-text-2"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {customerSource === "existing" ? (
          <div className="flex flex-col gap-3">
            {selectedCustomer && (
              <div className="rounded-adm-md border border-adm-line bg-adm-bg p-3" data-linked-customer="">
                <p className="text-[13px] text-adm-text-3">Linked customer</p>
                <p className="text-[16px] font-semibold text-adm-ink">{selectedCustomer.name}</p>
                <p className="break-words text-[14px] text-adm-text-2">
                  {selectedCustomer.email || "No email"}
                  {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={membershipTone(selectedMembershipSummary)}>{membershipLabel(selectedMembershipSummary)}</StatusBadge>
                  {selectedMembershipSummary?.activeMembershipAtAnotherAddress && <StatusBadge tone="info">Member at another saved property</StatusBadge>}
                </div>
                {selectedCustomer.addresses.length > 0 ? (
                  <Field label="Project property" className="mt-3">
                    <Select
                      value={form.addressId || ""}
                      onChange={(event) => {
                        const nextAddress = selectedCustomer.addresses.find((address) => address.id === event.target.value) || null;
                        chooseAddress(selectedCustomer, nextAddress);
                      }}
                      options={[
                        { value: "", label: "No saved property selected" },
                        ...selectedCustomer.addresses.map((address) => ({
                          value: address.id,
                          label: `${address.formattedAddress}${address.isDefault ? " · Default" : ""}${
                            address.membershipSummary.selectedAddressPlanName ? ` · ${address.membershipSummary.selectedAddressPlanName}` : ""
                          }`,
                        })),
                      ]}
                    />
                  </Field>
                ) : (
                  <p className="mt-3 rounded-adm-sm bg-adm-attn-bg px-3 py-2 text-[14px] text-adm-attn">No saved address. Enter a project address manually below.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/admin/customers/${encodeURIComponent(selectedCustomer.customerId)}`} className="adm-btn adm-btn--secondary">
                    Open customer
                  </Link>
                  <Button variant="secondary" onClick={() => confirmFirst(Boolean(initial.customerId), LINK_CHANGE, () => setShowCustomerSearch(true))}>
                    Change linked customer
                  </Button>
                  <Button variant="destructive" onClick={clearSelectedCustomer}>
                    Clear selected customer
                  </Button>
                </div>
              </div>
            )}

            {showCustomerSearch && (
              <div className="flex flex-col gap-2">
                <Field label="Search registered customers" help={trimmedCustomerQuery.length === 1 ? "Enter at least 2 characters." : undefined}>
                  <TextInput
                    id={searchId}
                    type="search"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="Name, email, phone or address"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                </Field>
                {customerSearching && <p className="text-[13px] text-adm-text-2">Searching…</p>}
                {customerSearchError && <p className="text-[13px] text-adm-problem">{customerSearchError}</p>}
                {showCustomerDropdown && (
                  <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
                    {customerResults.map((customer) => {
                      const address = customer.matchingAddress;
                      return (
                        <li key={customer.customerId} className="border-b border-adm-line last:border-b-0">
                          <button type="button" onClick={() => selectCustomer(customer)} className="flex min-h-[56px] w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-adm-bg">
                            <span className="text-[15px] font-semibold text-adm-ink">{highlightMatch(customer.name || "Unnamed customer", customerQuery)}</span>
                            <span className="break-words text-[13px] text-adm-text-2">
                              {highlightMatch(customer.email || "No email", customerQuery)}
                              {customer.phone ? " · " : ""}
                              {customer.phone ? highlightMatch(customer.phone, customerQuery) : ""}
                            </span>
                            <span className="break-words text-[13px] text-adm-text-3">{highlightMatch(address?.formattedAddress || "No saved address.", customerQuery)}</span>
                            <span className="mt-1">
                              <StatusBadge tone={membershipTone(customer.membershipSummary)}>{membershipLabel(customer.membershipSummary)}</StatusBadge>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {showNoRegisteredCustomersFound && <li className="px-3 py-3 text-[14px] text-adm-text-2">No registered customers found</li>}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  {showNoRegisteredCustomersFound && (
                    <Button variant="secondary" onClick={useSearchAsManualCustomer}>
                      Use as Manual Customer
                    </Button>
                  )}
                  {customerNextCursor && (
                    <Button variant="secondary" onClick={loadMoreCustomers} disabled={customerSearching}>
                      Load more results
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-adm-text-2">Saved as a manual customer, not linked to a registered account.</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[13px] font-semibold text-adm-ink">Project contact and property</legend>
        <p className="text-[13px] text-adm-text-3">Saved on the project. Changing them here does not change the customer&apos;s account.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name" required error={fieldErrors.customerName}>
            <TextInput value={form.customerName} onChange={(e) => set("customerName", e.target.value)} autoComplete="name" autoCapitalize="words" enterKeyHint="next" />
          </Field>
          <Field label="Phone">
            <TextInput type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} enterKeyHint="next" />
          </Field>
          <Field label="Email">
            <TextInput type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={form.email} onChange={(e) => set("email", e.target.value)} enterKeyHint="next" />
          </Field>
          <Field label="Project address" required error={fieldErrors.address}>
            <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" enterKeyHint="next" />
          </Field>
          <Field label="Project type" required>
            <Select value={form.projectType} onChange={(e) => set("projectType", e.target.value as ProjectType)} options={PROJECT_TYPES.map((type) => ({ value: type, label: type }))} />
          </Field>
          {mode === "create" && (
            <Field label="Status" help="Shown beside the stage the documents show. Changes later are recorded.">
              <Select value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)} options={PROJECT_STATUSES.map((status) => ({ value: status, label: status }))} />
            </Field>
          )}
          <Field
            label="Rough estimate (optional)"
            help="For your reference only. The agreement, change orders, invoices and payments are the record."
            error={fieldErrors.estimateAmount}
          >
            <TextInput
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value);
                setFieldErrors((current) => ({ ...current, estimateAmount: "" }));
              }}
              enterKeyHint="next"
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </fieldset>
    </form>
  );
}
