export const PUBLIC_CONTACT_EMAIL = "getfixter@gmail.com";
export const PUBLIC_CONTACT_MAILTO = `mailto:${PUBLIC_CONTACT_EMAIL}`;

/* ------------------------------------------------------------------ */
/* Membership callback lead                                            */
/* ------------------------------------------------------------------ */

/**
 * "Call me and explain membership."
 *
 * Two fields, because every extra one is somebody who would have closed the
 * tab. It reaches the same Leads list as every other enquiry; the endpoint
 * validates and normalizes, so this is a transport, not a gatekeeper.
 */
export async function submitMembershipLead(input: {
  name: string;
  phone: string;
  sourcePage?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = process.env.NEXT_PUBLIC_API_URL || "";
  try {
    const response = await fetch(`${base}/api/requests/membership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name.trim(),
        phone: input.phone.trim(),
        sourcePage: input.sourcePage || "/",
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.success) return { ok: true };
    return {
      ok: false,
      message: data?.message || "We could not send that just now. Please try again.",
    };
  } catch {
    return { ok: false, message: "Please check your connection and try again." };
  }
}
