import { getRoleLandingPath } from "./auth-routing";
import type { User } from "./auth-service";

// Compatibility wrapper. New auth redirects should use auth-routing directly.
export const getPostLoginRedirect = (
  userEmail: string,
  role?: "customer" | "employee" | "admin"
): string => {
  return getRoleLandingPath({ email: userEmail, role } as User);
};
