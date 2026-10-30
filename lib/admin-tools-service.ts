import API from "./api";

/*
 * Admin tools for phone work: create a customer, their communication
 * switches, sell a membership, create a visit. The server decides every rule
 * (routes/adminCustomers.js, routes/adminSales.js); these are thin calls.
 */

export type FieldErrors = Record<string, string>;

export type ApiFailure = {
  status: number;
  message: string;
  code: string;
  errors: FieldErrors;
  existing?: unknown;
};

export function readFailure(error: unknown): ApiFailure {
  const response = (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
  const data = response?.data || {};
  return {
    status: response?.status || 0,
    message: String(data.message || "Something went wrong. Please try again."),
    code: String(data.code || ""),
    errors: (data.errors as FieldErrors) || {},
    existing: data.existing,
  };
}

/* ------------------------------ customers ------------------------------ */

export type NewCustomerAddress = { line1: string; unit?: string; city: string; state: string; zip: string; placeId?: string; lat?: number | null; lng?: number | null };

export type CommunicationKey = "service.email" | "service.sms" | "marketing.email" | "marketing.sms";

export type NewCustomerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addresses: NewCustomerAddress[];
  communication?: Partial<Record<CommunicationKey, boolean>>;
  allowSharedPhone?: boolean;
};

export type CreatedCustomer = {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  addresses: Array<{ _id: string; label: string; line1: string; city: string; state: string; zip: string }>;
};

export type Delivery = { email: string | null; sms: string | null };

export const createCustomer = async (input: NewCustomerInput) =>
  (await API.post("/api/admin/customers", input)).data as {
    customer: CreatedCustomer;
    delivery: Delivery;
    temporaryPasswordExpiresAt: string;
    warnings: string[];
  };

export const resendCustomerAccess = async (userId: string) =>
  (await API.post(`/api/admin/customers/${userId}/resend-access`)).data as { delivery: Delivery; temporaryPasswordExpiresAt: string };

export type SwitchState = { enabled: boolean; locked: string | null; changedAt: string | null; source: string };
export type CommunicationState = {
  service: { email: SwitchState; sms: SwitchState };
  marketing: { email: SwitchState; sms: SwitchState };
};

export const getCommunication = async (userId: string) =>
  (await API.get(`/api/admin/users/${userId}/communication`)).data as CommunicationState;

export const setCommunication = async (userId: string, key: CommunicationKey, enabled: boolean) =>
  (await API.put(`/api/admin/users/${userId}/communication`, { key, enabled })).data as { changed: boolean; state: CommunicationState };

/* ------------------------------ memberships ----------------------------- */

export type SalesOptions = {
  plans: Array<{ key: string; label: string; monthly: number; annual: number }>;
  oneTime: { enabled: boolean; priceCents: number };
  fullDay: { enabled: boolean; priceCents: number };
};

export const getSalesOptions = async () => (await API.get("/api/admin/sales/options")).data as SalesOptions;

export type MembershipHome = {
  addressId: string;
  label: string;
  line: string;
  current: { plan: string; billingCycle: string; status: string } | null;
  canBuy: boolean;
  blocked: { code: string; message: string } | null;
};

export const getMembershipOptions = async (userId: string) =>
  (await API.get(`/api/admin/customers/${userId}/membership-options`)).data as { homes: MembershipHome[]; hasEmail: boolean; hasPhone: boolean };

export type Channel = "email" | "sms";

export type MembershipSaleResult =
  | { method: "phone"; url: string; billingStartsAt: string | null }
  | { method: "link"; payUrl: string; delivery: { email: string; sms: string }; expiresAt: string; linkDays: number };

export const sellMembership = async (
  userId: string,
  input: { addressId: string; plan: string; billingCycle: "monthly" | "annual"; method: "phone" | "link"; channels?: Channel[] }
) => (await API.post(`/api/admin/customers/${userId}/membership-sale`, input)).data as MembershipSaleResult;

/* -------------------------------- visits -------------------------------- */

export type VisitType = "membership" | "one_time" | "full_day" | "admin_free";

export type CreateVisitInput = {
  mode: "existing" | "guest";
  userId?: string;
  addressId?: string;
  guest?: { name: string; phone: string; email: string; line1: string; unit?: string; city: string; state: string; zip: string; smsConsent: boolean };
  type: VisitType;
  date: string;
  time?: string;
  task: string;
  description?: string;
  notes?: string;
  payment?: "phone" | "link";
  channels?: Channel[];
  photos?: File[];
};

export type CreatedVisit = {
  booking: { _id: string; bookingNumber: string; date: string; service: string; status: string; accessType: string; bookingType: string; paymentState: string; images: string[] };
  payment:
    | null
    | { method: "phone"; url: string; expiresAt: string }
    | { method: "link"; payUrl: string; delivery: { email: string; sms: string }; expiresAt: string; linkId: string };
};

export const createVisit = async (input: CreateVisitInput) => {
  const form = new FormData();
  form.append("mode", input.mode);
  form.append("type", input.type);
  form.append("date", input.date);
  if (input.time) form.append("time", input.time);
  form.append("task", input.task);
  if (input.description) form.append("description", input.description);
  if (input.notes) form.append("notes", input.notes);
  if (input.mode === "existing") {
    form.append("userId", input.userId || "");
    form.append("addressId", input.addressId || "");
  } else if (input.guest) {
    form.append("guestName", input.guest.name);
    form.append("guestPhone", input.guest.phone);
    form.append("guestEmail", input.guest.email);
    form.append("guestLine1", input.guest.line1);
    if (input.guest.unit) form.append("guestUnit", input.guest.unit);
    form.append("guestCity", input.guest.city);
    form.append("guestState", input.guest.state);
    form.append("guestZip", input.guest.zip);
    form.append("guestSmsConsent", input.guest.smsConsent ? "true" : "false");
  }
  if (input.payment) form.append("payment", input.payment);
  if (input.channels?.length) form.append("channels", input.channels.join(","));
  for (const photo of input.photos || []) form.append("images", photo, photo.name || "photo.jpg");
  return (await API.post("/api/admin/visits", form, { timeout: 60000 })).data as CreatedVisit;
};

/* ------------------------------ customer search --------------------------- */

export type CustomerHit = {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  addresses: Array<{ _id: string; label?: string; line1: string; city: string; state: string; zip: string }>;
};

/* ------------------------------ payment links ----------------------------- */

export type PayLinkState = { status: "open" | "paid" | "expired" | "canceled" | "not_found" | "unavailable"; kind?: string; itemLabel?: string; expiresAt?: string; message?: string };

export const getPayLink = async (token: string) => {
  try {
    return (await API.get(`/api/pay/${token}`)).data as PayLinkState;
  } catch (error) {
    const failure = readFailure(error);
    return { status: failure.status === 404 ? "not_found" : "unavailable", message: failure.message } as PayLinkState;
  }
};

export const openPayLink = async (token: string) => (await API.post(`/api/pay/${token}/checkout`)).data as { url: string };
