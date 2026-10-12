"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminStudio } from "@/lib/studio/api";

/** From a Leads row: open the Shower Studio design this request came with. */
export default function OpenInStudio({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700"
        onClick={async () => {
          try {
            const r = await adminStudio.designByLead(leadId.replace(/^estimate:/, ""));
            router.push(`/admin?tab=studio&design=${encodeURIComponent(r.id)}`);
          } catch (e: unknown) {
            const status = (e as { status?: number }).status;
            setMsg(status === 403 ? "Needs Shower Studio access" : "Design not found");
          }
        }}
      >
        Open in Shower Studio
      </button>
      {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
    </span>
  );
}
