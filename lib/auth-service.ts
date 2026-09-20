// lib/auth-service.ts — FULL FINAL
import API from "./api";
import { normalizeUSPhoneE164 } from "./phone";

export interface Address {
  _id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;

  // Provided by backend /api/auth/me
  hasActiveSubscription?: boolean;
  plan?: "basic" | "plus" | "premium" | "elite" | null;
}

export interface User {
  _id?: string; // mongo internal
  id?: string; // frontend ID (public)
  userId?: string; // backend userId

  name: string;
  email: string;
  phone: string;

  // legacy single-address (kept for backward compatibility)
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;

  // new multi-address
  addresses?: Address[];
  defaultAddressId?: string | null;

  // legacy subscription (kept)
  subscription?: string | null;
  subscriptionExpiry?: string | null;
  subscriptionStart?: string | null;

  createdAt?: string;
  updatedAt?: string;
  role?: "customer" | "employee" | "admin";
  employeePosition?: "Fixter" | "General Fixter" | null;
  isActive?: boolean;
  mustChangePassword?: boolean;
  permissions?: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone: string;

  // REQUIRED on backend
  address: string; // line1
  city: string;
  state: string;
  zip: string;

  /**
   * No longer sent by signup, and no longer read by the server.
   *
   * The county is derived from the ZIP allowlist in utils/serviceArea.js, which
   * is the only place allowed to decide it. Kept optional so callers that still
   * pass it keep compiling; the value is ignored.
   */
  county?: string;

  /**
   * What the address lookup returned, when the address came from one.
   *
   * Absent for a hand-typed address, which is exactly how the server tells a
   * looked-up address from a typed one. The coordinates are checked against
   * their own ZIP's polygon before being stored, so sending nonsense here gets
   * the coordinates dropped rather than the registration refused.
   */
  placeId?: string;
  lat?: number | null;
  lng?: number | null;

  /**
   * Affirmative marketing-SMS consent, exactly as the customer left the box.
   *
   * Optional because nothing requires it and no other caller sends it. It is
   * never inferred from `phone` being populated: a number is given to book a
   * visit, which is the transactional basis, and promotional texting needs a
   * separate express opt-in that only this field carries.
   */
  smsMarketingConsent?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  /**
   * Which account to open when one email has both a customer and a Fixter
   * record and the same password opens both. Sent only after the server has
   * asked; it never widens access, it only disambiguates.
   */
  accountRole?: "customer" | "employee";
}

/** Returned with a 409 when the password alone cannot say which account. */
export interface AccountChoice {
  accountRole: "customer" | "employee";
  label: string;
}

// =================== REGISTER ===================
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const normalizedPhone = normalizeUSPhoneE164(data.phone);

  const response = await API.post<AuthResponse>("/api/auth/register", {
    ...data,
    email: data.email.toLowerCase().trim(),
    phone: normalizedPhone || data.phone,
  });

  return response.data;
};

// =================== LOGIN ===================
export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await API.post<AuthResponse>("/api/auth/login", {
    email: data.email.toLowerCase().trim(),
    password: data.password,
    ...(data.accountRole ? { accountRole: data.accountRole } : {}),
  });

  return response.data;
};

// =================== FORGOT PASSWORD - Step 1: Request OTP ===================
export const requestPasswordReset = async (
  email: string
): Promise<{ message: string }> => {
  const response = await API.post<{ message: string }>("/api/password-reset", {
    email: email.toLowerCase().trim(),
  });

  return response.data;
};

// =================== FORGOT PASSWORD - Step 2: Verify OTP ===================
export const verifyOTP = async (
  email: string,
  otp: string
): Promise<{ message: string; token: string }> => {
  const response = await API.post<{ message: string; token: string }>(
    "/api/password-reset/verify",
    {
      email: email.toLowerCase().trim(),
      otp,
    }
  );

  return response.data;
};

// =================== FORGOT PASSWORD - Step 3: Set New Password ===================
export const setNewPassword = async (
  token: string,
  password: string
): Promise<{ message: string }> => {
  const response = await API.post<{ message: string }>(
    "/api/password-reset/set-password",
    { token, password },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

// =================== GET CURRENT USER ===================
// Your backend /api/auth/me returns the user object directly (not { user: ... })
export const getCurrentUser = async (): Promise<User> => {
  const response = await API.get<User>("/api/auth/me");
  return response.data;
};

// =================== GOOGLE LOGIN ===================
export const googleLogin = async (idToken: string): Promise<AuthResponse> => {
  const response = await API.post<AuthResponse>("/api/auth/google", { idToken });
  return response.data;
};

// =================== LOGOUT ===================
export const logout = (): void => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
