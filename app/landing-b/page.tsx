import { redirect } from "next/navigation";

/**
 * An old ad landing URL. It now opens the homepage, which is the free-visit
 * booker, and keeps the query string - utm_* and fbclid are how the visit gets
 * attributed, and the previous redirect dropped them on the floor.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v);
  }
  const query = params.toString();
  redirect(query ? `/?${query}` : "/");
}
