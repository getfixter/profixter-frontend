// Helper function to determine redirect path after login
export const getPostLoginRedirect = (userEmail: string): string => {
  const ADMIN_EMAIL = 'getfixter@gmail.com';
  return userEmail === ADMIN_EMAIL ? '/admin' : '/account';
};
