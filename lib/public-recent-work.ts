/**
 * The public Recent Work feed.
 *
 * Deliberately not the axios client the admin uses: this runs for logged-out
 * visitors, so it must not carry an Authorization header, must not redirect to
 * /signin on a 401, and must not drag the interceptor stack onto a marketing
 * page. Plain fetch against a public endpoint is the whole requirement.
 */

export interface PublicWorkPhoto {
  id: string;
  title: string;
  caption: string;
  category: string;
  location: string;
  featured: boolean;
  publishedAt: string | null;
  thumbUrl: string;
  imageUrl: string;
  fullUrl: string;
  width: number;
  height: number;
}

export interface PublicWorkPage {
  photos: PublicWorkPhoto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PublicWorkCategory {
  slug: string;
  label: string;
  count: number;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function fetchRecentWork(params: {
  page?: number;
  limit?: number;
  category?: string;
  signal?: AbortSignal;
} = {}): Promise<PublicWorkPage> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.category) query.set("category", params.category);

  const res = await fetch(`${BASE}/api/recent-work?${query.toString()}`, {
    signal: params.signal,
  });
  if (!res.ok) throw new Error(`Recent work request failed: ${res.status}`);
  return res.json();
}

export async function fetchRecentWorkCategories(
  signal?: AbortSignal
): Promise<PublicWorkCategory[]> {
  const res = await fetch(`${BASE}/api/recent-work/categories`, { signal });
  if (!res.ok) throw new Error(`Categories request failed: ${res.status}`);
  const data = await res.json();
  return data.categories || [];
}
