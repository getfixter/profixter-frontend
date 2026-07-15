"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProjectContracts from "@/app/components/admin/ProjectContracts";
import ProjectEstimates from "@/app/components/admin/ProjectEstimates";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  createProject,
  deleteProject,
  getProjects,
  updateProject,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/admin-service";

type View = "list" | "create" | "details" | "edit";
type ProjectDetailTab = "overview" | "contract" | "estimates";

const EMPTY_PROJECT: ProjectInput = {
  status: "Lead",
  customerName: "",
  phone: "",
  email: "",
  address: "",
  projectType: "Roofing",
  estimateAmount: 0,
  depositAmount: 0,
  balanceDue: 0,
  notes: "",
};

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Lead: "border-slate-200 bg-slate-100 text-slate-700",
  "Estimate Sent": "border-sky-200 bg-sky-50 text-sky-700",
  "Follow Up": "border-amber-200 bg-amber-50 text-amber-700",
  Won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "In Progress": "border-indigo-200 bg-indigo-50 text-indigo-700",
  Completed: "border-teal-200 bg-teal-50 text-teal-700",
  Lost: "border-rose-200 bg-rose-50 text-rose-700",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

function ProjectForm({
  initial,
  title,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ProjectInput;
  title: string;
  submitLabel: string;
  onSubmit: (data: ProjectInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProjectInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
            ← Back to projects
          </button>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">{title}</h2>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Customer name *
          <input required value={form.customerName} onChange={(e) => set("customerName", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Phone
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Email
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Address *
          <input required value={form.address} onChange={(e) => set("address", e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Project type *
          <select value={form.projectType} onChange={(e) => set("projectType", e.target.value as ProjectType)} className={inputClass}>
            {PROJECT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status *
          <select value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)} className={inputClass}>
            {PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        {(["estimateAmount", "depositAmount", "balanceDue"] as const).map((field) => (
          <label key={field} className="text-sm font-semibold text-slate-700">
            {field === "estimateAmount" ? "Estimate amount" : field === "depositAmount" ? "Deposit amount" : "Balance due"}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form[field]}
                onChange={(e) => set(field, Number(e.target.value))}
                className={`${inputClass} pl-7`}
              />
            </div>
          </label>
        ))}
      </section>

      <label className="block rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">
        Notes
        <textarea rows={7} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
      </label>
    </form>
  );
}

export default function ProjectsModule() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<ProjectDetailTab>("overview");
  const [status, setStatus] = useState("");
  const [projectType, setProjectType] = useState("");
  const [customer, setCustomer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProjects(await getProjects());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = customer.trim().toLowerCase();
    return projects.filter((project) => {
      if (status && project.status !== status) return false;
      if (projectType && project.projectType !== projectType) return false;
      if (q && !project.customerName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [customer, projectType, projects, status]);

  const openDetails = (project: Project) => {
    setSelected(project);
    setDetailTab("overview");
    setError("");
    setView("details");
  };

  const closeDeleteProject = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteConfirmation("");
    setDeleteError("");
  };

  const confirmDeleteProject = async () => {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.projectNumber) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteProject(deleteTarget._id, deleteConfirmation);
      setProjects((current) => current.filter((project) => project._id !== deleteTarget._id));
      if (selected?._id === deleteTarget._id) {
        setSelected(null);
        setView("list");
      }
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setDeleteError("");
    } catch (deleteProjectError) {
      setDeleteError(errorMessage(deleteProjectError));
    } finally {
      setDeleting(false);
    }
  };

  if (view === "create") {
    return (
      <ProjectForm
        initial={EMPTY_PROJECT}
        title="Create project"
        submitLabel="Create Project"
        onCancel={() => setView("list")}
        onSubmit={async (data) => {
          const project = await createProject(data);
          setProjects((current) => [project, ...current]);
          setSelected(project);
          setDetailTab("overview");
          setView("details");
        }}
      />
    );
  }

  if (view === "edit" && selected) {
    const initial: ProjectInput = {
      status: selected.status,
      customerName: selected.customerName,
      phone: selected.phone,
      email: selected.email,
      address: selected.address,
      projectType: selected.projectType,
      estimateAmount: selected.estimateAmount,
      depositAmount: selected.depositAmount,
      balanceDue: selected.balanceDue,
      notes: selected.notes,
    };
    return (
      <ProjectForm
        initial={initial}
        title={`Edit ${selected.projectNumber}`}
        submitLabel="Save Changes"
        onCancel={() => setView("details")}
        onSubmit={async (data) => {
          const project = await updateProject(selected._id, data);
          setProjects((current) => current.map((item) => item._id === project._id ? project : item));
          setSelected(project);
          setView("details");
        }}
      />
    );
  }

  if (view === "details" && selected) {
    return (
      <>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button type="button" onClick={() => setView("list")} className="text-sm font-semibold text-blue-700">← Back to projects</button>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-950">{selected.projectNumber}</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Created {date(selected.createdAt)} · Updated {date(selected.updatedAt)}</p>
          </div>
          <div className="flex gap-2">
            {detailTab === "overview" && (
              <button type="button" onClick={() => setView("edit")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Edit</button>
            )}
            {detailTab === "overview" && (
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(selected);
                  setDeleteConfirmation("");
                  setDeleteError("");
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}

        <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
          {(["overview", "contract", "estimates"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDetailTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-bold capitalize ${
                detailTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {detailTab === "overview" ? (
          <>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Customer</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">{selected.customerName}</h3>
                <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div><p className="text-slate-400">Phone</p><p className="mt-1 font-semibold text-slate-800">{selected.phone || "—"}</p></div>
                  <div><p className="text-slate-400">Email</p><p className="mt-1 break-all font-semibold text-slate-800">{selected.email || "—"}</p></div>
                  <div className="sm:col-span-2"><p className="text-slate-400">Address</p><p className="mt-1 font-semibold text-slate-800">{selected.address}</p></div>
                  <div><p className="text-slate-400">Project type</p><p className="mt-1 font-semibold text-slate-800">{selected.projectType}</p></div>
                </div>
              </section>
              <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Financials</p>
                <div className="mt-5 space-y-4">
                  <div className="flex justify-between"><span className="text-slate-400">Estimate</span><strong>{money(selected.estimateAmount)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">Deposit</span><strong>{money(selected.depositAmount)}</strong></div>
                  <div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Balance due</span><strong>{money(selected.balanceDue)}</strong></div>
                </div>
              </section>
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Notes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.notes || "No notes yet."}</p>
            </section>
          </>
        ) : detailTab === "contract" ? (
          <ProjectContracts project={selected} />
        ) : (
          <ProjectEstimates project={selected} />
        )}
      </div>
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={closeDeleteProject}
        >
          <div
            className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Delete Project</div>
                <h3 className="mt-1 text-2xl font-black text-slate-950">Delete Project</h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteProject}
                disabled={deleting}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close delete project confirmation"
              >
                ×
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              This action cannot be undone. Existing estimates must be deleted before a project can be deleted.
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-sm text-slate-600">
                Type the project number exactly to continue:{' '}
                <span className="font-bold text-slate-950">{deleteTarget.projectNumber}</span>
              </div>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                placeholder={deleteTarget.projectNumber}
                autoFocus
              />
            </div>
            {deleteError && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {deleteError}
              </div>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteProject}
                disabled={deleting}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                disabled={deleting || deleteConfirmation !== deleteTarget.projectNumber}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] bg-slate-950 p-5 text-white shadow-lg md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Project sales</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">Projects</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">Track leads, estimates, active work, and completed projects in one clean pipeline.</p>
          </div>
          <button type="button" onClick={() => setView("create")} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">
            + Create Project
          </button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Search customer name..." className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm">
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm">
          <option value="">All project types</option>
          {PROJECT_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading projects...</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h3 className="font-bold text-slate-900">No projects found</h3>
          <p className="mt-2 text-sm text-slate-500">Create the first project or adjust your filters.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full">
              <thead className="bg-slate-950 text-white">
                <tr>{["Project Number", "Customer", "Address", "Type", "Status", "Estimate Amount", "Created Date"].map((label) => <th key={label} className="px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.08em]">{label}</th>)}</tr>
              </thead>
              <tbody>
                {visible.map((project) => (
                  <tr key={project._id} onClick={() => openDetails(project)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-4 text-sm font-bold text-blue-700">{project.projectNumber}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">{project.customerName}</td>
                    <td className="max-w-[260px] truncate px-4 py-4 text-sm text-slate-600">{project.address}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{project.projectType}</td>
                    <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[project.status]}`}>{project.status}</span></td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">{money(project.estimateAmount)}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{date(project.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {visible.map((project) => (
              <button key={project._id} type="button" onClick={() => openDetails(project)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-bold text-blue-700">{project.projectNumber}</p><h3 className="mt-1 font-bold text-slate-950">{project.customerName}</h3></div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[project.status]}`}>{project.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{project.address}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">{project.projectType} · {date(project.createdAt)}</span><strong>{money(project.estimateAmount)}</strong></div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
