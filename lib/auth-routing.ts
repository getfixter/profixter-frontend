import type { User } from "./auth-service";

const ADMIN_EMAIL = "getfixter@gmail.com";

export function isAdminUser(user: User | null | undefined) {
  if (!user) return false;
  return (
    user.role === "admin" ||
    String(user.email || "").trim().toLowerCase() === ADMIN_EMAIL
  );
}

export function isEmployeeUser(user: User | null | undefined) {
  return user?.role === "employee";
}

export function getRoleLandingPath(user: User | null | undefined) {
  if (!user) return "/";
  if (isAdminUser(user) || isEmployeeUser(user)) return "/admin";
  return "/account";
}
