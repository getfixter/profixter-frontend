/*
 * Registration & Authentication 2.0 - the client half of the contract.
 *
 * Every call goes through the shared API client (lib/api.ts), so the base URL,
 * the Authorization header for "attach" calls and the 401 handling are the same
 * as everywhere else on the site. Nothing here stores a session: a successful
 * sign-in hands its token to useAuth().login, exactly like password login.
 */
import API from "./api";
import type { User } from "./auth-service";
import { extractUSNationalPhoneDigits, isValidUSNationalPhoneDigits } from "./phone";
import { getAttribution, getFbCookies, type Attribution } from "./meta";

/* ------------------------------------------------------------------ types */

export type OtpStartResponse = {
  ok: true;
  phoneMasked?: string;
  emailMasked?: string;
  resendAfterSeconds: number;
  expiresInSeconds: number;
};

export type SignedInResult = {
  status: "signed_in";
  token: string;
  user: User;
  created: boolean;
  linkedPhone?: boolean;
};

export type LinkRequiredResult = {
  status: "link_required";
  linkToken: string;
  hint: { maskedEmail: string | null; hasPassword: boolean };
};

export type AttachedResult = { status: "attached"; user: User };

/** Several accounts verified the same (household) phone: the person picks one. */
export type ChooseAccountResult = {
  status: "choose_account";
  choiceToken: string;
  accounts: { id: string; label: string; detail: string }[];
};

export type VerifyResult = SignedInResult | LinkRequiredResult | AttachedResult | ChooseAccountResult;

/** What rides along with every call that can create an account. */
export type ConversionFields = {
  metaEventId: string;
  fbp: string;
  fbc: string;
  attribution: Attribution;
};

export function conversionFields(metaEventId: string): ConversionFields {
  const { fbp, fbc } = getFbCookies();
  return { metaEventId, fbp, fbc, attribution: getAttribution() };
}

/* ------------------------------------------------------------------ calls */

/*
 * Just the number. Registration 2.0: the code is a one-time text the person
 * requests, sent through Twilio Verify outside the A2P campaign, so no SMS
 * consent travels with it (and none is inferred from it on the server).
 */
export async function startPhoneOtp(input: { phone: string }): Promise<OtpStartResponse> {
  const { data } = await API.post<OtpStartResponse>("/api/auth/otp/phone/start", input);
  return data;
}

export async function verifyPhoneOtp(
  input: { phone: string; code: string; mode?: "attach" } & Partial<ConversionFields>
): Promise<VerifyResult> {
  const { data } = await API.post<VerifyResult>("/api/auth/otp/phone/verify", input);
  return data;
}

export async function choosePhoneAccount(input: { choiceToken: string; accountId: string }): Promise<SignedInResult> {
  const { data } = await API.post<SignedInResult>("/api/auth/otp/phone/choose", input);
  return data;
}

export async function createAccountForPhone(
  input: { linkToken: string } & ConversionFields
): Promise<SignedInResult> {
  const { data } = await API.post<SignedInResult>("/api/auth/otp/phone/new-account", input);
  return data;
}

export async function startEmailOtp(email: string): Promise<OtpStartResponse> {
  const { data } = await API.post<OtpStartResponse>("/api/auth/otp/email/start", {
    email: email.trim().toLowerCase(),
  });
  return data;
}

export async function verifyEmailOtp(
  input: { email: string; code: string; linkToken?: string; mode?: "attach" } & Partial<ConversionFields>
): Promise<VerifyResult> {
  const { data } = await API.post<VerifyResult>("/api/auth/otp/email/verify", {
    ...input,
    email: input.email.trim().toLowerCase(),
  });
  return data;
}

export async function passwordLogin(input: {
  email: string;
  password: string;
  linkToken?: string;
  accountRole?: "customer" | "employee";
}): Promise<{ token: string; user: User }> {
  const { data } = await API.post<{ token: string; user: User }>("/api/auth/login", {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    ...(input.linkToken ? { linkToken: input.linkToken } : {}),
    ...(input.accountRole ? { accountRole: input.accountRole } : {}),
  });
  return data;
}

export async function googleSignIn(
  input: { idToken: string } & ConversionFields
): Promise<{ token: string; user: User; created: boolean }> {
  const { data } = await API.post<{ token: string; user: User; created: boolean }>("/api/auth/google", input);
  return data;
}

export async function appleSignIn(
  input: {
    idToken: string;
    rawNonce: string;
    name?: { firstName: string; lastName: string };
  } & ConversionFields
): Promise<{ token: string; user: User; created: boolean }> {
  const { data } = await API.post<{ token: string; user: User; created: boolean }>("/api/auth/apple", input);
  return data;
}

export async function updateProfileName(name: string): Promise<{ user: User }> {
  const { data } = await API.patch<{ user: User }>("/api/users/me/profile", { name: name.trim() });
  return data;
}

export type NewHomeInput = {
  line1: string;
  city: string;
  state: string;
  zip: string;
  placeId?: string;
  lat?: number | null;
  lng?: number | null;
  label?: string;
};

export type NewHomeResult = {
  user: User;
  address: { _id: string; line1: string; city: string; state: string; zip: string; county?: string };
  serviceArea: { inArea: boolean; county: string | null };
};

export async function addHome(input: NewHomeInput): Promise<NewHomeResult> {
  const { data } = await API.post<NewHomeResult>("/api/users/me/addresses", input);
  return data;
}

/* ----------------------------------------------------------------- errors */

export type AuthApiError = {
  status: number | null;
  code: string;
  message: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  field?: string;
  accounts?: { accountRole: "customer" | "employee"; label: string }[];
};

/** Flattens an axios failure into the fields the contract defines. */
export function readApiError(err: unknown): AuthApiError {
  const e = err as {
    response?: { status?: number; data?: Record<string, unknown> };
    message?: string;
  };
  const data = (e?.response?.data || {}) as Record<string, unknown>;
  return {
    status: typeof e?.response?.status === "number" ? e.response.status : null,
    code: typeof data.code === "string" ? data.code : e?.response ? "" : "NETWORK",
    message: typeof data.message === "string" ? data.message : "",
    attemptsLeft: typeof data.attemptsLeft === "number" ? data.attemptsLeft : undefined,
    retryAfterSeconds: typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : undefined,
    field: typeof data.field === "string" ? data.field : undefined,
    accounts: Array.isArray(data.accounts) ? (data.accounts as AuthApiError["accounts"]) : undefined,
  };
}

export function formatWait(seconds: number | undefined) {
  const s = Math.max(1, Math.ceil(seconds || 60));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** Plain-language copy for every error the OTP endpoints can return. */
export function otpErrorMessage(err: AuthApiError, channel: "phone" | "email"): string {
  switch (err.code) {
    case "INVALID_PHONE":
      return "That doesn't look like a mobile number. Check it and try again.";
    case "INVALID_EMAIL":
      return "That doesn't look like an email address. Check it and try again.";
    case "SERVICE_SMS_CONSENT_REQUIRED":
      return "We couldn't text a code to that number. Please try again, or continue with email.";
    case "RATE_LIMITED":
      return `Too many tries. Please wait ${formatWait(err.retryAfterSeconds)} and try again.`;
    case "SMS_UNAVAILABLE":
      return "We can't send text messages right now. Please continue with email instead.";
    case "INVALID_CODE":
      if (typeof err.attemptsLeft === "number") {
        if (err.attemptsLeft <= 0) return "That code isn't right, and there are no tries left. Send a new code.";
        return `That code isn't right. ${err.attemptsLeft} ${err.attemptsLeft === 1 ? "try" : "tries"} left.`;
      }
      return "That code isn't right. Check it and try again.";
    case "CODE_EXPIRED":
      return "That code has expired. Send a new one.";
    case "LINK_EXPIRED":
      return "That took a little too long. Please confirm your number again.";
    case "IDENTIFIER_IN_USE":
      return channel === "phone"
        ? "This number already belongs to another Profixter account."
        : "This email already belongs to another Profixter account.";
    case "NETWORK":
      return "We couldn't reach Profixter. Check your connection and try again.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

/* ------------------------------------------------------------------ phone */

/**
 * US formatting as you type, without fighting a pasted international number.
 *
 * "+44 20 7946 0958" stays international (digits only after the plus);
 * "+1 631 555 1234", "16315551234" and "631-555-1234" all become (631) 555-1234.
 */
export function formatPhoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "+" || trimmed === "+1") return trimmed;
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("1")) return `+${digits.slice(0, 15)}`;
    digits = digits.slice(1);
  } else if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** E.164 for the API, or null when the number cannot be right yet. */
export function phoneToE164(display: string): string | null {
  const trimmed = display.trim();
  if (trimmed.startsWith("+") && !trimmed.startsWith("+1")) {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const national = extractUSNationalPhoneDigits(trimmed);
  return isValidUSNationalPhoneDigits(national) ? `+1${national}` : null;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/* -------------------------------------------------------- interrupted flow */

/**
 * Where an unfinished registration was, so a refresh lands on the code step
 * instead of the beginning. Session-scoped on purpose: it holds a phone number
 * or an email and a link token, none of which should outlive the tab.
 */
export type PendingAuthFlow = {
  screen: "phone" | "code" | "email" | "link" | "password" | "choose";
  channel?: "phone" | "email";
  phone?: string;
  email?: string;
  masked?: string;
  linkToken?: string;
  hint?: LinkRequiredResult["hint"];
  choiceToken?: string;
  accounts?: ChooseAccountResult["accounts"];
  resendAt?: number;
  expiresAt?: number;
  savedAt: number;
};

const FLOW_KEY = "profixter.auth.flow";
const FLOW_TTL_MS = 30 * 60 * 1000;

export function loadPendingFlow(): PendingAuthFlow | null {
  try {
    const raw = sessionStorage.getItem(FLOW_KEY);
    if (!raw) return null;
    const flow = JSON.parse(raw) as PendingAuthFlow;
    if (!flow?.screen || Date.now() - Number(flow.savedAt || 0) > FLOW_TTL_MS) {
      sessionStorage.removeItem(FLOW_KEY);
      return null;
    }
    return flow;
  } catch {
    return null;
  }
}

export function savePendingFlow(flow: Omit<PendingAuthFlow, "savedAt">) {
  try {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify({ ...flow, savedAt: Date.now() }));
  } catch {
    /* private mode: a refresh simply starts over */
  }
}

export function clearPendingFlow() {
  try {
    sessionStorage.removeItem(FLOW_KEY);
  } catch {
    /* nothing stored */
  }
}

/* ----------------------------------------------------------- user helpers */

/**
 * Whether a booking can be submitted for this user without asking anything.
 *
 * The Booking model needs a phone AND an email. A legacy customer who typed a
 * phone at registration (phoneVerified false) is NOT asked again: "never re-ask
 * for info already present". Flip this to require OTP-verified phones before
 * booking once every legacy number has been verified.
 */
export const REQUIRE_VERIFIED_PHONE_FOR_BOOKING = false;

/** What a booking still needs from this customer (the server's CONTACT_REQUIRED, ahead of time). */
export function missingContact(user: User | null | undefined): { name: boolean; phone: boolean; email: boolean } {
  if (!user) return { name: true, phone: true, email: true };
  const phone = String(user.phone || "").trim();
  const email = String(user.email || "").trim();
  return {
    name: !String(user.name || "").trim(),
    phone: !phone || (REQUIRE_VERIFIED_PHONE_FOR_BOOKING && user.phoneVerified === false),
    email: !email,
  };
}

export function maskPhoneForDisplay(e164: string) {
  const national = extractUSNationalPhoneDigits(e164);
  if (e164.startsWith("+1") || national.length === 10) {
    return `(•••) •••-${national.slice(-4)}`;
  }
  return `•••${e164.replace(/\D/g, "").slice(-4)}`;
}
