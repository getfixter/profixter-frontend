import { permanentRedirect } from "next/navigation";

const ALLOWED_TYPES = new Set([
  "roofing",
  "siding",
  "bathroom",
  "kitchen",
  "full-house",
  "basement",
  "interior",
  "other",
]);

export default async function EstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const type = String(rawType || "").toLowerCase();
  const query = ALLOWED_TYPES.has(type)
    ? `?type=${encodeURIComponent(type)}`
    : "";

  permanentRedirect(`/projects${query}#estimate`);
}
