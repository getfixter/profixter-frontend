import axios from "axios";

/**
 * Public signing API client.
 *
 * Deliberately NOT the shared admin client. That one attaches the admin bearer
 * token from localStorage and, on a 401, clears storage and redirects to
 * /signin - all of which would be wrong for a customer who has no account and
 * whose only credential is the token in the URL.
 *
 * SECURITY NOTES FOR ANYTHING ADDED HERE
 *  - The signing token is a credential. It lives in the URL and in React state
 *    only. It is never written to localStorage, never logged, and never sent to
 *    analytics or error reporting.
 *  - The server is authoritative for price, version, hashes, identity and
 *    timestamps. Nothing in this file may send those values.
 */

const SigningAPI = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
  timeout: 60000,
});

/** Terminal and live states the signing page can be in. */
export type SigningState =
  | "ready"
  | "completed"
  | "declined"
  | "revoked"
  | "expired"
  | "invalid"
  | "error";

export interface DisclosureSection {
  title: string;
  body: string;
}

export interface SigningPayload {
  state: SigningState;
  message?: string;
  documentLabel?: string;
  documentType?: "CONTRACT" | "CHANGE_ORDER";
  customerName?: string;
  propertyAddress?: string;
  company?: { legalName: string; phone: string; email: string };
  disclosure?: {
    version: string;
    sections: DisclosureSection[];
    consentLabel: string;
    signIntent: string;
    padInstruction: string;
  };
  signingMode?: "REMOTE" | "IN_PERSON";
  expiresAt?: string | null;
  /** True once signing is finished and the executed PDF can be retrieved. */
  executedDocumentAvailable?: boolean;
  completedAt?: string | null;
}

/** Terminal responses arrive as 200 or 404; both are meaningful, neither throws. */
function readPayload(error: unknown): SigningPayload | null {
  const data = (error as { response?: { data?: SigningPayload } })?.response?.data;
  return data && typeof data.state === "string" ? data : null;
}

export async function fetchSigningPayload(token: string): Promise<SigningPayload> {
  try {
    const response = await SigningAPI.get(`/api/sign/${encodeURIComponent(token)}`);
    return response.data as SigningPayload;
  } catch (error) {
    return (
      readPayload(error) || {
        state: "error",
        message: "We could not load this document. Please check your connection and try again.",
      }
    );
  }
}

/** The document URL is built for an <iframe>/<object>; the token stays in the path. */
export function signingDocumentUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
  return `${base}/api/sign/${encodeURIComponent(token)}/document`;
}

/**
 * The executed document the customer just signed.
 *
 * A separate route from the frozen document above: once signing is complete the
 * frozen route reports the terminal state instead of returning a PDF, which is
 * correct for signing and wrong for reading back what was signed. Both stream
 * through the API - the browser never sees a storage URL.
 */
export function signedDocumentUrl(token: string, options: { download?: boolean } = {}) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
  const query = options.download ? "?download=1" : "";
  return `${base}/api/sign/${encodeURIComponent(token)}/executed${query}`;
}

export async function submitSignature(
  token: string,
  payload: { consentAccepted: boolean; signatureImage: string }
): Promise<SigningPayload> {
  try {
    // Only consent and the drawn signature are sent. Everything substantive is
    // decided by the server from the frozen record.
    const response = await SigningAPI.post(`/api/sign/${encodeURIComponent(token)}/sign`, {
      consentAccepted: payload.consentAccepted,
      signatureImage: payload.signatureImage,
    });
    return response.data as SigningPayload;
  } catch (error) {
    return (
      readPayload(error) || {
        state: "error",
        message: "We could not complete your signature. Please try again.",
      }
    );
  }
}

export async function declineSignature(token: string, reason: string): Promise<SigningPayload> {
  try {
    const response = await SigningAPI.post(`/api/sign/${encodeURIComponent(token)}/decline`, {
      reason,
    });
    return response.data as SigningPayload;
  } catch (error) {
    return (
      readPayload(error) || { state: "error", message: "Something went wrong. Please try again." }
    );
  }
}

export default SigningAPI;
