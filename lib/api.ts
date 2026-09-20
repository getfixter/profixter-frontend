import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
  timeout: 15000,
  // ❌ REMOVE default Content-Type (this breaks FormData uploads)
});

// Add token to every request
API.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

/**
 * Endpoints where a 401 is an ANSWER, not an expired session.
 *
 * Signing in with the wrong password returns 401. So does asking to reset a
 * password for an address that does not exist. Those are the endpoint doing its
 * job, and the caller is already showing the customer what happened.
 */
const AUTH_CHALLENGE_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/password-reset',
];

// Handle 401 errors (unauthorized)
API.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    /*
     * A wrong password used to reload the page.
     *
     * This interceptor exists for one case - a token that has expired while
     * somebody was using the site - and it handled it by throwing away the
     * session and navigating to /signin. On every page but one that is right.
     * On /signin itself the failing request IS the sign-in attempt, so a
     * mistyped password triggered a full navigation back to the page the
     * customer was already on, unmounting the form and destroying the error
     * message before a single frame of it was painted. The screen blinked and
     * said nothing, and the only way to learn anything was to guess again.
     *
     * The redirect is for stale sessions. A challenge endpoint answering 401 is
     * not a stale session, so it is passed through to the caller untouched.
     */
    const url = error?.config?.url || '';
    const isChallenge = AUTH_CHALLENGE_ROUTES.some((route) => url.startsWith(route));

    if (error?.response?.status === 401 && !isChallenge) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.location.href = '/signin';
      }
    }
    return Promise.reject(error);
  }
);

export default API;
