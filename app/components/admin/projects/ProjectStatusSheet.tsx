"use client";

import { useState } from "react";
import { PROJECT_STATUSES } from "@/lib/admin-service";
import { errorCode, errorMessage, invalidateQueries } from "@/lib/admin/query";
import { formatDay, projectKeys, setProjectStatus, type ProjectOverview } from "@/lib/admin/projects";
import { Button, Field, Select, Sheet, Textarea, useToast } from "@/app/components/admin/ui";
import { StageBadge } from "./badges";

/**
 * The hand-set status, changed on purpose: the server records who, when and
 * why, and refuses (409 STALE) if someone changed it since this sheet
 * opened. The derived stage is shown for comparison and is never written.
 */
export function ProjectStatusSheet({ open, onClose, overview }: { open: boolean; onClose: () => void; overview: ProjectOverview }) {
  const toast = useToast();
  const [status, setStatus] = useState(overview.manualStatus);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const history = [...overview.project.statusHistory].reverse();
  const changed = status !== overview.manualStatus;

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    setError("");
    try {
      await setProjectStatus(overview.project.id, { status, expectedStatus: overview.manualStatus, reason: reason.trim() });
      toast.show(`Status changed to ${status}`);
      invalidateQueries(projectKeys.overview(overview.project.id));
      invalidateQueries(projectKeys.record(overview.project.id));
      invalidateQueries(["projects", "search"]);
      onClose();
    } catch (e) {
      if (errorCode(e) === "STALE") {
        setError("Someone changed the status since you opened this. The latest is loaded; choose again.");
        invalidateQueries(projectKeys.overview(overview.project.id));
      } else setError(errorMessage(e, "The status could not be changed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Project status"
      dirty={changed || Boolean(reason.trim())}
      busy={saving}
      data-sheet="project-status"
      footer={
        <>
          <Button variant="secondary" large onClick={onClose}>
            Cancel
          </Button>
          <Button large busy={saving} disabled={!changed} onClick={save} data-action="save-status">
            Change status
          </Button>
        </>
      }
    >
      <p className="text-[14px] text-adm-text-2">
        The stage comes from the documents: <StageBadge stage={overview.derivedStage} />. The status is your own label and changes only here.
      </p>
      <Field label="Status" className="mt-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={PROJECT_STATUSES.map((s) => ({ value: s, label: s }))} />
      </Field>
      <Field label="Reason (optional)" className="mt-3">
        <Textarea rows={2} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="mt-3 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
          {error}
        </p>
      )}
      <h3 className="mt-5 text-[13px] font-semibold text-adm-ink">History</h3>
      {history.length === 0 ? (
        <p className="mt-1 text-[13px] text-adm-text-3">No changes recorded yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2" data-status-history="">
          {history.map((h, i) => (
            <li key={`${h.at}-${i}`} className="rounded-adm-sm bg-adm-bg px-3 py-2 text-[13px] text-adm-text-2">
              <span className="font-semibold text-adm-ink">
                {h.from ? `${h.from} → ${h.to}` : h.to}
              </span>
              {" · "}
              {formatDay(h.at)}
              {h.actorName ? ` · ${h.actorName}` : ""}
              {h.reason ? <span className="block text-adm-text-3">{h.reason}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
