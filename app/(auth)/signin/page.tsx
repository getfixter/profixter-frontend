"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, type AccountChoice } from "@/lib/auth-service";
import { useAuth } from "@/lib/useAuth";
import { getAutomaticEntryPath, safeReturnPath } from "@/lib/auth-routing";
import { trackEvent } from "@/lib/analytics";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import AuthScreen, {
  AuthHeading,
  AuthInput,
  AuthPassword,
  AuthSubmit,
} from "@/app/components/auth/AuthScreen";

function SignInForm() {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("rememberedEmail") || "";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /*
   * Only ever set when the server says one email has two accounts and the same
   * password opens both. The server refuses to guess, so this asks.
   */
  const [accountChoices, setAccountChoices] = useState<AccountChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: authLogin } = useAuth();
  /*
   * Where they were going. Someone sent here from halfway through booking a
   * Full Day should land back on the Full Day, not on a home page that has
   * forgotten what they were doing.
   */
  const returnPath = safeReturnPath(searchParams.get("next"));

  useEffect(() => {
    trackEvent("view_login", { page: "/signin" });
  }, []);

  const signIn = async (accountRole?: "customer" | "employee") => {
    setError("");
    setLoading(true);
    try {
      const { token } = await login({
        email: email.toLowerCase().trim(),
        password,
        ...(accountRole ? { accountRole } : {}),
      });
      const verifiedUser = await authLogin(token);
      if (!verifiedUser) {
        throw new Error("We could not verify your account. Please try again.");
      }
      localStorage.setItem("rememberedEmail", email);
      router.replace(returnPath || getAutomaticEntryPath(verifiedUser));
    } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: { message?: string; code?: string; accounts?: AccountChoice[] } };
        message?: string;
      };
      // One email, two accounts, one password. Ask rather than pick.
      if (error.response?.data?.code === "ACCOUNT_CHOICE_REQUIRED") {
        setAccountChoices(error.response.data.accounts || []);
        setLoading(false);
        return;
      }
      const message = error.response?.data?.message || error.message || "Invalid email or password";
      setError(message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountChoices([]);
    await signIn();
  };

  return (
    <RoleEntryGate loadingLabel="Checking your session..." redirectLabel="Opening Your Home...">
      <AuthScreen altLabel="Get Started" altHref={returnPath ? `/signup?next=${encodeURIComponent(returnPath)}` : "/signup"}>
        {/*
          "Welcome back" and nothing under it. The line that used to sit there -
          "Sign in to access your account" - explained a login form to somebody
          looking at a login form.
        */}
        <AuthHeading>Welcome back</AuthHeading>

        <form onSubmit={handleSubmit} className="auth-fields" noValidate>
          <AuthInput
            id="email"
            label="Email address"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />

          <AuthPassword
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />

          {/*
            One email, two accounts, one password. The server refuses to guess,
            so this asks - unchanged behaviour, quieter presentation.
          */}
          {accountChoices.length > 0 ? (
            <div className="rounded-[12px] border border-[#DDE4F0] bg-white p-4">
              <p className="text-[14px] font-bold text-[#0B1628]">
                This email has more than one account
              </p>
              <p className="mt-1 text-[13px] text-[#6B7688]">Choose which one to open.</p>
              <div className="mt-3 space-y-2">
                {accountChoices.map((choice) => (
                  <button
                    key={choice.accountRole}
                    type="button"
                    disabled={loading}
                    onClick={() => void signIn(choice.accountRole)}
                    className="min-h-[46px] w-full rounded-[10px] bg-[#0B1628] px-4 text-[14px] font-bold text-white transition hover:bg-[#172033] disabled:opacity-50"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="auth-error auth-error--form">{error}</p> : null}

          <AuthSubmit disabled={loading} loading={loading}>
            {loading ? "Logging in" : "Log In"}
          </AuthSubmit>
        </form>

        <p className="auth-alt">
          <Link href="/forgot-password" className="auth-inline-link">
            Forgot password?
          </Link>
        </p>
      </AuthScreen>
    </RoleEntryGate>
  );
}

/**
 * Reading ?next= needs useSearchParams, and useSearchParams needs a boundary
 * or the route stops being prerenderable. The fallback is the page's own
 * background so there is no flash of a different colour behind the form.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F8FC]" />}>
      <SignInForm />
    </Suspense>
  );
}
