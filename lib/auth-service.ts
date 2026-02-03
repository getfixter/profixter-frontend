// lib/auth-service.ts — FULL FINAL
import API from "./api";

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
  county: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// =================== REGISTER ===================
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const phoneDigits = data.phone.replace(/\D/g, "");

  const response = await API.post<AuthResponse>("/api/auth/register", {
    ...data,
    email: data.email.toLowerCase().trim(),
    phone: phoneDigits,
  });

  return response.data;
};

// =================== LOGIN ===================
export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await API.post<AuthResponse>("/api/auth/login", {
    email: data.email.toLowerCase().trim(),
    password: data.password,
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
