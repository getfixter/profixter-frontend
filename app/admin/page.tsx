"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath } from "@/lib/auth-routing";
import { handOffQuery, handOffToast } from "@/lib/admin/handoff";
import { resolveLegacyAdminLink } from "@/lib/admin/legacy-links";
import { canOpen, hasWorkspace, landingPathFor } from "@/lib/admin/sections";
import { BrandedLoader } from "@/app/components/admin/shell/BrandedLoader";
import "./admin.css";

/**
 * /admin: where the admin starts, and every old link still works.
 *
 * - Plain /admin goes to this person's landing section: Jobs for the owner
 *   and staff with Jobs, My day for a field Fixter, otherwise the first
 *   section they may open (lib/admin/sections.ts).
 * - /admin?tab=...&bookingId|userId|invoiceId|q|gift|paid|session_id (emails
 *   already sent, Stripe returns, bookmarks) goes to the matching new route
 *   (lib/admin/legacy-links.ts). The search text is handed over through
 *   sessionStorage and never written back into a URL; Stripe return messages
 *   become a toast on arrival; session_id is dropped.
 * - An invoice link resolves to its project when the server can say which
 *   (GET /api/admin/invoices/:id, if present), otherwise Projects.
 * - A destination this person may not open falls back to their landing.
 *
 * router.replace throughout, so Back never returns to this redirect.
 */
function AdminRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (isLoading || done.current) return;
    if (!user) {
      done.current = true;
      router.replace(`/signin?next=${encodeURIComponent("/admin")}`);
      return;
    }
    if (!hasWorkspace(user)) {
      done.current = true;
      router.replace(getRoleLandingPath(user));
      return;
    }
    done.current = true;
    const target = resolveLegacyAdminLink(new URLSearchParams(params.toString()));
    if (target.toast) handOffToast(target.toast);
    const landing = landingPathFor(user) || "/admin/more";

    const go = (path: string | null, section = target.section) => {
      const allowed = path && section ? canOpen(user, section) : false;
      const destination = allowed && path ? path : landing;
      if (target.query && allowed && section) handOffQuery(section, target.query);
      router.replace(destination);
    };

    if (target.invoiceId && canOpen(user, "projects")) {
      API.get(`/api/admin/invoices/${encodeURIComponent(target.invoiceId)}`, { timeout: 8000 })
        .then((response) => {
          const data = response.data || {};
          const projectId = data.projectId || data.invoice?.projectId || data.project?._id;
          go(projectId ? `/admin/projects/${encodeURIComponent(String(projectId))}` : "/admin/projects", "projects");
        })
        .catch(() => go("/admin/projects", "projects"));
      return;
    }
    go(target.path);
  }, [isLoading, user, params, router]);

  return <BrandedLoader />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<BrandedLoader />}>
      <AdminRedirect />
    </Suspense>
  );
}
