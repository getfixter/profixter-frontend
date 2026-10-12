"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminStudio, apiUrl, money } from "@/lib/studio/api";
import StudioDesignEditor from "./StudioDesignEditor";

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-600" },
  submitted: { label: "New request", tone: "bg-blue-100 text-blue-700" },
  in_review: { label: "In review", tone: "bg-amber-100 text-amber-800" },
  proposal: { label: "Proposal", tone: "bg-violet-100 text-violet-700" },
  signed: { label: "Signed", tone: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Closed", tone: "bg-slate-200 text-slate-600" },
  archived: { label: "Archived", tone: "bg-slate-200 text-slate-500" },
};
const FILTERS = [
  { id: "", label: "Open" },
  { id: "submitted", label: "New requests" },
  { id: "in_review", label: "In review" },
  { id: "proposal", label: "Proposals" },
  { id: "all", label: "All" },
];
const TYPE_LABEL: Record<string, string> = { "tub-to-shower": "Tub → shower", "shower-replacement": "Shower replacement", "tub-replacement": "Tub replacement" };
export const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${s.tone}`}>{s.label}</span>;
}

/** Admin -> Shower Studio: Studio requests and staff designs, and the design editor. */
export default function StudioAdmin() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("design");
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const setOpen = useCallback((id: string | null) => {
    const p = new URLSearchParams(params.toString());
    p.set("tab", "studio");
    if (id) p.set("design", id); else p.delete("design");
    router.replace(`/admin?${p.toString()}`, { scroll: false });
  }, [params, router]);

  const load = useCallback(async () => {
    try {
      const r = await adminStudio.designs({ ...(filter ? { status: filter } : {}), ...(q ? { q } : {}) });
      setList(r.designs); setError(null);
    } catch (e: any) { setError(e.message); }
  }, [filter, q]);
  useEffect(() => { if (!openId) { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); } }, [load, openId, q]);

  if (openId) return <StudioDesignEditor id={openId} onClose={() => { setOpen(null); }} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Shower Studio</h2>
          <p className="mt-1 text-sm text-slate-500">Requests from the website and designs made with customers. Open one to verify measurements, adjust the estimate and create a proposal.</p>
        </div>
        <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700" onClick={() => setCreating(true)} data-testid="studio-new">New design</button>
      </div>

      {creating ? <NewDesign onCancel={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpen(id); }} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{f.label}</button>
        ))}
        <input className={`${inputClass} ml-auto max-w-xs py-2`} placeholder="Search name, email, phone, ZIP" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!list ? <p className="text-slate-500">Loading…</p> : list.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">No designs here yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <button key={d.id} type="button" onClick={() => setOpen(d.id)} data-testid={`studio-row-${d.id}`}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-300">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {d.thumb ? <img src={apiUrl(d.thumb)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><StatusBadge status={d.status} /><span className="text-xs text-slate-400">{d.origin === "public" ? "Website" : "Staff"}</span></div>
                <div className="mt-1 truncate font-bold text-slate-900">{d.customer?.name || "No name yet"}</div>
                <div className="truncate text-sm text-slate-500">{[d.customer?.phone, d.customer?.zip].filter(Boolean).join(" · ") || "—"}</div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{TYPE_LABEL[d.projectType] || d.projectType}</span>
                  <span className="font-bold text-slate-900">{d.priceComplete === false ? "Price incomplete" : money(d.totalCents)}</span>
                </div>
                <div className="text-xs text-slate-400">{new Date(d.submittedAt || d.updatedAt).toLocaleString()}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewDesign({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", zip: "", projectType: "tub-to-shower" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      try {
        const r = await adminStudio.createDesign({ projectType: f.projectType, customer: { name: f.name, phone: f.phone, email: f.email, address: f.address, zip: f.zip } });
        onCreated(r.design.id);
      } catch (er: any) { setErr(er.message); } finally { setBusy(false); }
    }}>
      <h3 className="text-lg font-bold text-slate-900">New design for a customer</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[["name", "Customer name"], ["phone", "Phone"], ["email", "Email"], ["address", "Address"], ["zip", "ZIP"]].map(([k, l]) => (
          <label key={k} className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">{l}
            <input className={inputClass} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} required={k === "name"} data-testid={`new-${k}`} />
          </label>
        ))}
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">Project
          <select className={inputClass} value={f.projectType} onChange={(e) => set("projectType", e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" data-testid="new-create">{busy ? "Creating…" : "Create and add photo"}</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
      </div>
    </form>
  );
}
