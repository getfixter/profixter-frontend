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
  /* No date of any kind. The server does not send one; see toPublicDTO. */
  thumbUrl: string;
  imageUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  /* What We Do. Older API builds omit these; treat a missing kind as "photo". */
  kind?: "before_after" | "photo";
  /** One of WORK_GROUPS, or "" for a photo filed before groups existed. */
  group?: string;
  /** An example image (generated or staged), never presented as a real job. */
  illustrative?: boolean;
  /* Only on before/after pairs: the BEFORE at the same three sizes. */
  beforeThumbUrl?: string;
  beforeImageUrl?: string;
  beforeFullUrl?: string;
}

/** The What We Do chips, in the order the server files them. */
export const WORK_GROUPS = [
  "Electrical",
  "Bathroom",
  "Kitchen",
  "Doors & Trim",
  "Walls & Paint",
  "Outdoor",
  "Other",
] as const;

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
  /** "before_after" asks for What We Do pairs only. */
  kind?: "before_after";
  signal?: AbortSignal;
} = {}): Promise<PublicWorkPage> {
  const query = new URLSearchParams();
  if (params.kind) query.set("kind", params.kind);
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
