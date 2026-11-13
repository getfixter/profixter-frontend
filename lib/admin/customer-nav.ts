/**
 * Where "Back to customers" goes from a profile: the list exactly as it was
 * left (its filter is in the URL; the search text never is). The list stays
 * mounted under the profile, so its rows, pages and search results are still
 * there when it comes back.
 */
let lastListHref = "/admin/customers";

export function rememberListHref(href: string): void {
  if (href.startsWith("/admin/customers")) lastListHref = href;
}

export function customerListHref(): string {
  return lastListHref;
}
