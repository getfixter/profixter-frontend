"use client";

import { useState } from "react";
import { TrashIcon } from "@heroicons/react/20/solid";
import { errorCode, errorMessage, invalidateQueries, setQueryData } from "@/lib/admin/query";
import {
  addPunchItem,
  dayToIso,
  formatDay,
  markSubstantiallyComplete,
  projectKeys,
  removePunchItem,
  updatePunchItem,
  type ProjectOverview,
  type PunchItem,
} from "@/lib/admin/projects";
import { Button, Card, ConfirmSheet, Field, IconButton, TextInput, useToast } from "@/app/components/admin/ui";

const todayNY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

/**
 * Closeout: an explicit "Mark substantially complete" (a confirmation, never
 * automatic) and the punch list. The warranty end date is shown only as the
 * server derived it from the signed agreement's terms; the browser never
 * computes one.
 */
export function ProjectCloseout({ overview }: { overview: ProjectOverview }) {
  const toast = useToast();
  const p = overview.project;
  const [asking, setAsking] = useState(false);
  const [completedOn, setCompletedOn] = useState(todayNY());
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [listError, setListError] = useState("");
  const [busyItem, setBusyItem] = useState("");
  const [removing, setRemoving] = useState<PunchItem | null>(null);
  const canEditList = overview.allowedActions.editPunchList;

  const writePunch = (punchList: PunchItem[], updatedAt?: string) =>
    setQueryData<ProjectOverview>(projectKeys.overview(p.id), (current) =>
      current ? { ...current, project: { ...current.project, punchList, updatedAt: updatedAt || current.project.updatedAt } } : (current as unknown as ProjectOverview)
    );

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || adding) return;
    setAdding(true);
    setListError("");
    try {
      const result = await addPunchItem(p.id, value);
      writePunch(result.punchList, result.updatedAt);
      setText("");
      invalidateQueries(projectKeys.overview(p.id));
    } catch (e) {
      setListError(errorMessage(e, "The item could not be added."));
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (item: PunchItem) => {
    if (busyItem) return;
    setBusyItem(item.id);
    setListError("");
    try {
      const result = await updatePunchItem(p.id, item.id, { done: !item.done });
      writePunch(result.punchList, result.updatedAt);
      invalidateQueries(projectKeys.overview(p.id));
    } catch (e) {
      setListError(errorMessage(e, "The item could not be updated."));
    } finally {
      setBusyItem("");
    }
  };

  const open = p.punchList.filter((i) => !i.done).length;

  return (
    <div className="flex flex-col gap-4" data-tab-panel="closeout">
      <Card title="Substantial completion">
        {p.substantialCompletionAt ? (
          <dl className="grid gap-3 sm:grid-cols-2" data-completion="">
            <div>
              <dt className="text-[13px] text-adm-text-3">Substantially complete</dt>
              <dd className="text-[15px] font-semibold text-adm-ink">{formatDay(p.substantialCompletionAt)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-adm-text-3">Workmanship warranty ends</dt>
              <dd className="text-[15px] font-semibold text-adm-ink" data-warranty-ends="">
                {p.warrantyEndsAt ? formatDay(p.warrantyEndsAt) : "No date: the agreement's terms do not define a warranty period"}
              </dd>
            </div>
          </dl>
        ) : overview.allowedActions.markSubstantiallyComplete ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-adm-text-2">When the work is done except for punch list items, record it here. The warranty end date then comes from the signed agreement.</p>
            <Button onClick={() => setAsking(true)} className="flex-none" data-action="mark-complete">
              Mark substantially complete
            </Button>
          </div>
        ) : (
          <p className="text-[14px] text-adm-text-2" data-completion="unavailable">
            Available once the customer has signed the agreement.
          </p>
        )}
      </Card>

      <Card title={`Punch list${p.punchList.length ? ` · ${open} open` : ""}`}>
        {p.punchList.length === 0 ? (
          <p className="text-[14px] text-adm-text-3">No items yet.</p>
        ) : (
          <ul role="list" className="flex flex-col" data-punch-list="">
            {p.punchList.map((item) => (
              <li key={item.id} className="flex items-center gap-2 border-b border-adm-line last:border-b-0" data-punch-item={item.id} data-done={item.done || undefined}>
                <label className="flex min-h-[48px] flex-1 items-center gap-3 py-1 text-[15px]">
                  <input type="checkbox" className="h-5 w-5 flex-none" checked={item.done} disabled={!canEditList || busyItem === item.id} onChange={() => toggle(item)} />
                  <span className={item.done ? "text-adm-text-3 line-through" : "text-adm-ink"}>{item.text}</span>
                </label>
                {item.done && item.doneAt && <span className="hidden text-[13px] text-adm-text-3 sm:inline">{formatDay(item.doneAt, false)}</span>}
                {canEditList && <IconButton label={`Remove "${item.text}"`} icon={<TrashIcon className="h-5 w-5" />} onClick={() => setRemoving(item)} />}
              </li>
            ))}
          </ul>
        )}
        {canEditList && (
          <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Add an item" className="flex-1">
              <TextInput value={text} onChange={(e) => setText(e.target.value)} maxLength={500} enterKeyHint="done" placeholder="Touch up paint by the window" />
            </Field>
            <Button type="submit" busy={adding} disabled={!text.trim()} data-action="add-punch">
              Add
            </Button>
          </form>
        )}
        {listError && (
          <p role="alert" className="mt-3 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
            {listError}
          </p>
        )}
      </Card>

      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        title="Mark substantially complete?"
        consequence={`Records that the work on ${p.projectNumber} is substantially complete. The workmanship warranty end date is set from the signed agreement's terms. This cannot be undone here.`}
        confirmLabel="Mark substantially complete"
        onConfirm={async () => {
          const iso = completedOn === todayNY() ? undefined : dayToIso(completedOn) || undefined;
          try {
            const result = await markSubstantiallyComplete(p.id, iso);
            toast.show(result.warrantyEndsAt ? `Marked complete. Warranty ends ${formatDay(result.warrantyEndsAt)}.` : "Marked substantially complete.");
          } finally {
            invalidateQueries(projectKeys.overview(p.id));
            invalidateQueries(["projects", "search"]);
          }
        }}
        errorText={(e) => (errorCode(e) === "INVALID_TRANSITION" ? errorMessage(e, "This project cannot be marked complete now.") : errorMessage(e))}
      >
        <Field label="Completed on" help="Today unless the work finished earlier. It cannot be in the future.">
          <TextInput type="date" value={completedOn} max={todayNY()} onChange={(e) => setCompletedOn(e.target.value || todayNY())} />
        </Field>
      </ConfirmSheet>

      <ConfirmSheet
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this item?"
        consequence={removing ? `"${removing.text}" is removed from the punch list.` : ""}
        confirmLabel="Remove item"
        tone="danger"
        onConfirm={async () => {
          if (!removing) return;
          const result = await removePunchItem(p.id, removing.id);
          writePunch(result.punchList, result.updatedAt);
          invalidateQueries(projectKeys.overview(p.id));
        }}
      />
    </div>
  );
}

