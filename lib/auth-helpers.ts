// Helper function to determine redirect path after login
export const getPostLoginRedirect = (
  userEmail: string,
  role?: "customer" | "employee" | "admin"
): string => {
  const ADMIN_EMAIL = 'getfixter@gmail.com';
  return role === "admin" || role === "employee" || userEmail === ADMIN_EMAIL
    ? "/admin"
    : "/account";
};
