/**
 * Live search wording, layered over the page defaults in lib/seo-content.ts.
 *
 * The backend's growth engine may change a page's title, meta description,
 * H1 or intro through a verified, reversible action (see BackEnd
 * utils/growth/actions/seoPageUpdate.js). Pages read the active overrides
 * during incremental regeneration; if the API is slow or down, the code
 * defaults are used, so this can never break a page. Nothing else about a
 * page - services, prices, booking - can be changed this way.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";

type SeoFields = { metaTitle?: string; metaDescription?: string; h1?: string; intro?: string };

async function fetchOverrides(): Promise<Record<string, SeoFields>> {
  try {
    const res = await fetch(`${API}/api/seo/overrides`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data.overrides === "object" ? data.overrides : {};
  } catch {
    return {};
  }
}

const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);

/** The page content with any active override applied (a copy; the default is untouched). */
export async function withSeoOverride<T extends { metaTitle: string; metaDescription: string; h1?: string; intro?: string }>(
  content: T | undefined | null,
  path: string
): Promise<T | undefined> {
  if (!content) return undefined;
  const o = (await fetchOverrides())[path];
  if (!o) return content;
  return {
    ...content,
    metaTitle: clean(o.metaTitle, 70) ?? content.metaTitle,
    metaDescription: clean(o.metaDescription, 165) ?? content.metaDescription,
    ...(content.h1 !== undefined ? { h1: clean(o.h1, 90) ?? content.h1 } : {}),
    ...(content.intro !== undefined ? { intro: clean(o.intro, 600) ?? content.intro } : {}),
  };
}
