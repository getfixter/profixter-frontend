"use client";

import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  CreditCardIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  UserCircleIcon,
  UserIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import BookingImageGallery from "@/app/components/admin/BookingImageGallery";
import BookingHistory from "@/app/components/admin/BookingHistory";
import CommunicationHistory from "@/app/components/admin/CommunicationHistory";
import FreeVisitReviewPanel from "@/app/components/admin/FreeVisitReviewPanel";
import { LibraryThumb } from "@/app/components/booking/PhotoLibraryPicker";
import { libraryLabel } from "@/lib/booking-library";
import { compressImage } from "@/lib/compressImage";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { can, PERM } from "@/lib/admin-access";
import { errorCode, errorMessage, errorStatus, fetchQuery, useAdminQuery } from "@/lib/admin/query";
import { isFieldFixter } from "@/lib/admin/sections";
import { addJobNote, addJobPhotos, applyJob, dayLabel, fetchJob, jobKeys, nyYMD, refreshJobLists, whenText, type JobDetail } from "@/lib/admin/jobs";
import {
  Button,
  ContactActions,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Menu,
  MoneyBlock,
  Sheet,
  SkeletonRows,
  StatusBadge,
  Textarea,
  TypeBadge,
  cx,
  useToast,
  type MenuItem,
  type MoneyRow,
} from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { FlagBadge } from "@/app/components/admin/jobs/JobRows";
import { CancelStep, ConfirmStep, DoneStep, EditStep, ReassignStep, ReinstateStep, RescheduleStep, type StepResult } from "@/app/components/admin/jobs/JobSteps";
import { ChargeExtraStep, ExtraChargesBlock } from "@/app/components/admin/jobs/ChargeExtra";
import { peekOpenedFromList, takeOpenedFromList } from "@/app/components/admin/jobs/openedFrom";
import { badgeTypeOf } from "@/lib/admin/jobs";
import "@/app/components/admin/jobs/jobs.css";

type Step = "confirm" | "done" | "reinstate" | "cancel" | "reschedule" | "reassign" | "edit" | "review" | "chargeExtra";

const STEP_TITLE: Record<Step, string> = {
  confirm: "Confirm & assign",
  done: "Mark done?",
  reinstate: "Reinstate this job?",
  cancel: "Cancel this job?",
  reschedule: "Reschedule",
  reassign: "Change Fixter",
  edit: "Edit description",
  review: "Review request",
  chargeExtra: "Charge extra",
};

const MAX_PHOTOS = 10;

/**
 * /admin/jobs/[id] (F.2): one job in a sheet over the list (a side panel on a
 * desktop), deep-linkable on its own. Everything the person may do comes from
 * the server's allowedActions; there is ONE primary action for the state,
 * the rest is under More. Each action replaces the sheet's content with its
 * confirmation step (never a second sheet on top), sends expectedStatus /
 * expectedUpdatedAt and one idempotency key per intent, and writes the saved
 * job into every list in place. What the customer was told is shown after.
 */
export function JobDetailSheet({ id, backHref = "/admin/jobs" }: { id: string; backHref?: string }) {
  const { user, canOpen } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const field = isFieldFixter(user);

  const q = useAdminQuery(jobKeys.detail(id), (signal) => fetchJob(id, signal), { staleTime: 10_000 });
  const job = q.data;

  const [step, setStep] = useState<Step | null>(null);
  const [stepBusy, setStepBusy] = useState(false);
  const [stepDirty, setStepDirty] = useState(false);
  const [result, setResult] = useState<StepResult | null>(null);
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  // A Back press while open leaves nothing behind for the next sheet.
  useEffect(() => () => void takeOpenedFromList(), []);

  const close = useCallback(() => {
    if (peekOpenedFromList() && window.history.length > 1) {
      takeOpenedFromList();
      router.back();
      return;
    }
    const qs = params.toString();
    router.replace(qs ? `${backHref}?${qs}` : backHref, { scroll: false });
  }, [params, router, backHref]);

  const leaveStep = useCallback(() => {
    setStep(null);
    setStepBusy(false);
    setStepDirty(false);
  }, []);

  const refresh = useCallback(async () => {
    leaveStep();
    await q.refetch();
    refreshJobLists();
  }, [leaveStep, q]);

  const onDone = useCallback(
    (r: StepResult) => {
      applyJob(r.booking);
      setResult(r);
      leaveStep();
      toast.show(r.title);
    },
    [leaveStep, toast]
  );

  const open = (s: Step) => {
    setResult(null);
    setStepDirty(false);
    setStep(s);
  };

  const allowed = new Set(job?.allowedActions || []);
  const primary = job ? primaryFor(job, allowed) : null;

  const stepProps = job
    ? { job, footer: footerEl, onBack: leaveStep, onDone, onRefresh: () => void refresh(), setBusy: setStepBusy, setDirty: setStepDirty }
    : null;

  const menuItems: MenuItem[] = [];
  if (job) {
    if (allowed.has("reschedule")) menuItems.push({ label: "Reschedule", icon: <CalendarDaysIcon />, onSelect: () => open("reschedule") });
    if (allowed.has("reassign")) menuItems.push({ label: job.technician ? "Change Fixter" : "Assign a Fixter", icon: <UserIcon />, onSelect: () => open("reassign") });
    if (allowed.has("edit")) menuItems.push({ label: "Edit description", icon: <PencilSquareIcon />, onSelect: () => open("edit") });
    if (allowed.has("complete") && primary?.step !== "done") menuItems.push({ label: "Mark done", icon: <CheckCircleIcon />, onSelect: () => open("done") });
    if (allowed.has("chargeExtra")) menuItems.push({ label: "Charge extra", icon: <CreditCardIcon />, onSelect: () => open("chargeExtra") });
    if (job.customer.id && canOpen("customers")) menuItems.push({ label: "Open customer", icon: <UserCircleIcon />, href: `/admin/customers/${encodeURIComponent(job.customer.id)}` });
    if (job.customer.email && !field) menuItems.push({ label: "Email the customer", hint: job.customer.email, icon: <EnvelopeIcon />, href: `mailto:${job.customer.email}` });
    menuItems.push({
      label: "Copy job link",
      icon: <ClipboardDocumentIcon />,
      onSelect: () => void writeToClipboard(`${window.location.origin}/admin/jobs/${job.id}`).then((ok) => toast.show(ok ? "Job link copied" : "Could not copy the link")),
    });
    if (allowed.has("cancel")) menuItems.push({ label: job.status === "Pending Confirmation" ? "Decline request" : "Cancel job", icon: <XCircleIcon />, tone: "destructive", onSelect: () => open("cancel") });
  }

  const title = step ? STEP_TITLE[step] : job ? job.customer.name || `Job ${job.bookingNumber}` : "Job";
  const footer = step ? <div ref={setFooterEl} className="contents" data-step-footer="" /> : primary ? <PrimaryButton primary={primary} onOpen={open} /> : undefined;

  const notFound = q.error && !job && (errorStatus(q.error) === 404 || errorCode(q.error) === "BOOKING_NOT_FOUND" || errorCode(q.error) === "INVALID_BOOKING");
  const forbidden = q.error && !job && (errorStatus(q.error) === 403 || errorCode(q.error) === "FORBIDDEN_RECORD");

  return (
    <Sheet
      open
      onClose={step ? leaveStep : close}
      title={title}
      size="full"
      width="wide"
      data-sheet="job"
      dirty={step ? stepDirty : false}
      busy={stepBusy}
      footer={footer}
      discardMessage="Leave without saving?"
      headerActions={
        !step && job && menuItems.length > 1 ? <IconButton ref={moreRef} label="More actions" icon={<EllipsisHorizontalIcon />} onClick={() => setMenuOpen(true)} data-job-more="" /> : null
      }
    >
      {q.isLoading ? (
        <SkeletonRows count={3} label="Loading the job" />
      ) : notFound ? (
        <EmptyState message="This job was not found" detail="It may have been removed, or the link is out of date." />
      ) : forbidden ? (
        <EmptyState message="This job is not yours to open" detail="It is assigned to someone else. Ask the office if you should have it." />
      ) : q.error && !job ? (
        <ErrorState title="The job could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : !job || !stepProps ? null : step === "review" ? (
        <FreeVisitReviewPanel
          bookingId={job.id}
          onChanged={(message) => {
            toast.show(message);
            if (/declined|confirmed|approved/i.test(message)) {
              void fetchQuery(jobKeys.detail(job.id), (signal) => fetchJob(job.id, signal), { force: true }).then((fresh) => {
                applyJob(fresh);
                leaveStep();
              });
            }
          }}
          embedded={{ footer: footerEl, onState: ({ dirty, busy }) => (setStepDirty(dirty), setStepBusy(busy)) }}
        />
      ) : step === "confirm" ? (
        <ConfirmStep {...stepProps} />
      ) : step === "done" ? (
        <DoneStep {...stepProps} />
      ) : step === "reinstate" ? (
        <ReinstateStep {...stepProps} />
      ) : step === "cancel" ? (
        <CancelStep {...stepProps} />
      ) : step === "reschedule" ? (
        <RescheduleStep {...stepProps} />
      ) : step === "reassign" ? (
        <ReassignStep {...stepProps} />
      ) : step === "edit" ? (
        <EditStep {...stepProps} />
      ) : step === "chargeExtra" ? (
        <ChargeExtraStep job={job} footer={footerEl} onBack={leaveStep} setBusy={setStepBusy} setDirty={setStepDirty} />
      ) : (
        <JobBody job={job} field={field} result={result} onDismissResult={() => setResult(null)} onOpen={open} canCustomers={canOpen("customers")} canComms={can(user, PERM.COMMUNICATIONS_MANAGE)} refreshing={q.isFetching} onRefresh={() => void q.refetch()} />
      )}
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={moreRef} title="Job actions" items={menuItems} />
    </Sheet>
  );
}

type Primary = { step: Step; label: string; tone?: "primary" | "secondary" };

/** One primary action by state (F.2), only when the server allows it. */
function primaryFor(job: JobDetail, allowed: Set<string>): Primary | null {
  if (job.status === "Pending" && allowed.has("confirm")) return { step: "confirm", label: "Confirm & assign" };
  if (job.status === "Pending Confirmation" && allowed.has("reviewFreeVisit")) return { step: "review", label: "Review request" };
  if (job.status === "Confirmed" && allowed.has("complete")) return { step: "done", label: "Mark done" };
  if ((job.status === "Canceled" || job.status === "Completed") && allowed.has("reinstate")) return { step: "reinstate", label: "Reinstate", tone: "secondary" };
  return null;
}

function PrimaryButton({ primary, onOpen }: { primary: Primary; onOpen: (s: Step) => void }) {
  return (
    <Button large block variant={primary.tone === "secondary" ? "secondary" : "primary"} onClick={() => onOpen(primary.step)} data-primary={primary.step}>
      {primary.label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* The job                                                             */
/* ------------------------------------------------------------------ */

function JobBody({
  job,
  field,
  result,
  onDismissResult,
  onOpen,
  canCustomers,
  canComms,
  refreshing,
  onRefresh,
}: {
  job: JobDetail;
  field: boolean;
  result: StepResult | null;
  onDismissResult: () => void;
  onOpen: (s: Step) => void;
  canCustomers: boolean;
  canComms: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const allowed = new Set(job.allowedActions || []);
  const timing = job.timing && job.timing.key !== "upcoming" ? job.timing : null;
  const flags = (job.flags || []).filter((f) => !(timing && f.key === "not_closed"));
  return (
    <div className="flex flex-col gap-5" data-job-body={job.id} data-status={job.status}>
      {result && <ResultNotice result={result} onDismiss={onDismissResult} />}

      {/* Title row, when, status */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={badgeTypeOf(String(job.type))}>{job.typeLabel}</TypeBadge>
          <StatusBadge status={job.status} />
          {timing && (
            <StatusBadge tone={timing.key === "not_closed" ? "problem" : "info"}>
              {timing.label}
            </StatusBadge>
          )}
          {flags.map((f) => (
            <FlagBadge key={String(f.key)} flag={f} />
          ))}
        </div>
        <p className="text-[17px] font-semibold text-adm-ink" data-job-when="">
          {whenText(job)}
        </p>
        {/* No " · " before the customer link: at 320px the 44px link wraps and the dot was left dangling. */}
        <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-adm-text-2">
          <span>Job {job.bookingNumber ? `#${String(job.bookingNumber).replace(/^#/, "")}` : ""}</span>
          {job.customer.id && canCustomers && !field ? (
            <>
              <Link href={`/admin/customers/${encodeURIComponent(job.customer.id)}`} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-adm-accent-ink underline-offset-4 hover:underline" data-customer-link="">
                {job.customer.name || "Customer"}
                {typeof job.customer.visitsCompleted === "number" ? ` · ${job.customer.visitsCompleted} completed ${job.customer.visitsCompleted === 1 ? "visit" : "visits"}` : ""}
              </Link>
            </>
          ) : job.customer.guest ? (
            <span>Guest (no account)</span>
          ) : null}
          {refreshing ? <span>Updating…</span> : null}
        </p>
        {job.reservationIssue && (
          <p className="flex items-start gap-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem" data-reservation-issue="">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            {job.reservationIssue.message || "The reservation needs review."}
          </p>
        )}
        {job.status === "Canceled" && job.cancellationReason && <p className="text-[14px] text-adm-text-2">Canceled: {job.cancellationReason}</p>}
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-2">
        <p className="text-[15px] text-adm-ink" data-job-address="">
          {job.address.full || "No address on the job"}
        </p>
        <ContactActions phone={job.customer.phone || null} email={job.customer.email || null} address={job.address.full || null} />
      </div>

      {/* Task */}
      <Block title="Task">
        <TaskBlock job={job} />
      </Block>

      {/* Photos */}
      <Block title={`Photos${job.photos.length ? ` · ${job.photos.length}` : ""}`}>
        <PhotosBlock job={job} canAdd={allowed.has("addPhotos")} />
      </Block>

      {/* Technician */}
      <Block title="Fixter">
        <div className="flex min-h-[44px] items-center justify-between gap-3">
          <p className={cx("text-[15px] font-semibold", job.technician ? "text-adm-ink" : "text-adm-attn")} data-job-tech="">
            {job.technician ? job.technician.name || "Assigned" : "Unassigned"}
          </p>
          {allowed.has("reassign") && (
            <Button variant="secondary" onClick={() => onOpen("reassign")} data-change-tech="">
              {job.technician ? "Change" : "Assign"}
            </Button>
          )}
        </div>
      </Block>

      {/* Money (not for field Fixters: K.1) */}
      {!field && job.money && <MoneyView job={job} />}

      {/* Additional charges (owner only: the server sends extraCharges to the owner alone) */}
      {!field && job.extraCharges && <ExtraChargesBlock job={job} canCharge={allowed.has("chargeExtra")} onCharge={() => onOpen("chargeExtra")} />}

      {/* Internal notes */}
      <Block title="Internal notes" hint="Staff only. The customer never sees these.">
        <NotesBlock job={job} canAdd={allowed.has("addInternalNote")} />
      </Block>

      {/* Details */}
      <Disclosure title="Booking details" id="details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
          <dt className="text-adm-text-2">Booking</dt>
          <dd className="adm-num text-adm-ink">#{String(job.bookingNumber || "").replace(/^#/, "")}</dd>
          {job.createdAt && (
            <>
              <dt className="text-adm-text-2">Booked</dt>
              <dd className="text-adm-ink">{dayLabel(nyYMD(job.createdAt), { year: true })}</dd>
            </>
          )}
          {job.completedAt && (
            <>
              <dt className="text-adm-text-2">Completed</dt>
              <dd className="text-adm-ink">{dayLabel(nyYMD(job.completedAt), { year: true })}</dd>
            </>
          )}
          {job.freeVisit && (
            <>
              <dt className="text-adm-text-2">Free visit</dt>
              <dd className="text-adm-ink">
                {job.freeVisit.channel === "callback" ? "Callback request" : job.freeVisit.channel === "online" ? "Booked online" : job.freeVisit.channel || "Free visit"}
                {job.freeVisit.purpose === "consultation" ? " · to-do review, no labor" : job.freeVisit.purpose ? ` · ${job.freeVisit.purpose}` : ""}
                {job.freeVisit.reviewRequired ? " · verify it is not a repeat" : ""}
              </dd>
            </>
          )}
          {!field && job.customer.plan && (
            <>
              <dt className="text-adm-text-2">Plan</dt>
              <dd className="text-adm-ink">
                {job.customer.plan.plan || "Membership"} · {job.customer.plan.billingCycle} · {job.customer.plan.status}
                {job.customer.plan.cancelAtPeriodEnd ? " · ends at period end" : ""}
              </dd>
            </>
          )}
        </dl>
        <Button variant="tertiary" icon={<ArrowPathIcon className="h-4 w-4" aria-hidden="true" />} onClick={onRefresh} className="mt-2">
          Reload this job
        </Button>
      </Disclosure>

      <Disclosure title="History" id="history">
        <BookingHistory bookingId={job.id} embedded />
      </Disclosure>
      {!field && canComms && (
        <Disclosure title="Messages to the customer" id="messages" hint="Emails and texts for this booking, with delivery">
          <CommunicationHistory bookingNumber={String(job.bookingNumber || "").replace(/^#/, "")} hideHeading />
        </Disclosure>
      )}
    </div>
  );
}

function ResultNotice({ result, onDismiss }: { result: StepResult; onDismiss: () => void }) {
  const problem = result.lines.some((l) => l.tone === "problem");
  return (
    <div role="status" className={cx("rounded-adm-md border px-4 py-3", problem ? "border-adm-problem bg-adm-problem-bg" : "border-adm-line bg-adm-ok-bg")} data-result="">
      <div className="flex items-start justify-between gap-3">
        <p className={cx("flex items-center gap-2 text-[15px] font-semibold", problem ? "text-adm-problem" : "text-adm-ok")}>
          {problem ? <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" /> : <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />}
          {result.title}
        </p>
        <button type="button" onClick={onDismiss} className="min-h-[44px] min-w-[44px] text-[13px] font-semibold text-adm-text-2" aria-label="Dismiss">
          OK
        </button>
      </div>
      {result.lines.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 text-[14px]" data-result-lines="">
          {result.lines.map((l, i) => (
            <li key={i} className={l.tone === "problem" ? "font-medium text-adm-problem" : l.tone === "ok" ? "text-adm-ink" : "text-adm-text-2"}>
              {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[15px] font-semibold text-adm-ink">{title}</h3>
        {hint && <p className="text-[13px] text-adm-text-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Disclosure({ title, id, hint, children }: { title: string; id: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = `job-${id}`;
  return (
    <section className="rounded-adm-md border border-adm-line bg-adm-surface" data-disclosure={id}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)} className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-adm-ink">{title}</span>
          {hint && <span className="text-[13px] text-adm-text-2">{hint}</span>}
        </span>
        <ChevronDownIcon className={cx("h-5 w-5 flex-none text-adm-text-3 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {/* Mounted only when open, so its request is never made for a job nobody is reading. */}
      {open && (
        <div id={panelId} className="border-t border-adm-line px-4 py-3">
          {children}
        </div>
      )}
    </section>
  );
}

function TaskBlock({ job }: { job: JobDetail }) {
  const [more, setMore] = useState(false);
  const text = job.description || "";
  const long = text.length > 180 || text.split("\n").length > 3;
  const lib = libraryLabel(job.libraryReference);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] font-semibold text-adm-ink">
        {[job.service, job.selectedTask]
          .filter((v, i, list) => Boolean(v) && list.findIndex((x) => String(x || "").trim().toLowerCase() === String(v).trim().toLowerCase()) === i)
          .join(" · ") || "Handyman visit"}
      </p>
      {text ? (
        <div>
          <p className="text-[13px] font-semibold text-adm-text-2">Customer&apos;s description</p>
          <p className={cx("whitespace-pre-wrap text-[15px] leading-relaxed text-adm-ink", !more && long && "adm-clamp-3")} data-job-description="">
            {text}
          </p>
          {long && (
            <button type="button" onClick={() => setMore((v) => !v)} className="min-h-[44px] text-[14px] font-semibold text-adm-accent-ink" aria-expanded={more}>
              {more ? "Less" : "More"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-adm-text-2">The customer did not describe the job.</p>
      )}
      {lib && (
        <div className="flex items-center gap-3 rounded-adm-sm border border-adm-line px-3 py-2">
          <LibraryThumb itemKey={job.libraryReference} label={lib} className="h-12 w-12 flex-none rounded-adm-xs" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-adm-text-2">Job type (Profixter example)</p>
            <p className="text-[15px] font-semibold text-adm-ink">{lib}</p>
            <p className="text-[13px] text-adm-text-2">A generic picture, not the customer&apos;s home.</p>
          </div>
        </div>
      )}
      {job.adminNote && (
        <div>
          <p className="text-[13px] font-semibold text-adm-text-2">Admin note</p>
          <p className="whitespace-pre-wrap text-[14px] text-adm-ink">{job.adminNote}</p>
        </div>
      )}
    </div>
  );
}

function PhotosBlock({ job, canAdd }: { job: JobDetail; canAdd: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const room = MAX_PHOTOS;
  const upload = async (list: FileList | null) => {
    if (!list?.length || busy) return;
    setBusy(true);
    try {
      const files = await Promise.all(Array.from(list).slice(0, room).map((f) => Promise.race([compressImage(f), new Promise<File>((r) => setTimeout(() => r(f), 8000))])));
      const res = await addJobPhotos(job.id, files);
      applyJob(res.booking);
      toast.show(res.added === 1 ? "Photo added" : `${res.added} photos added`);
    } catch (error) {
      toast.show(errorMessage(error, "The photos could not be added."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {job.photos.length ? (
        <div className="rounded-adm-sm border border-adm-line p-2" data-job-photos={job.photos.length}>
          <BookingImageGallery images={job.photos} bookingNumber={job.bookingNumber} />
        </div>
      ) : (
        <p className="text-[14px] text-adm-text-2">No photos yet.</p>
      )}
      {canAdd && (
        <div className="flex gap-2">
          <Button variant="secondary" busy={busy} icon={<CameraIcon className="h-5 w-5" aria-hidden="true" />} onClick={() => camera.current?.click()}>
            Take photo
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            Add photos
          </Button>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (void upload(e.target.files), (e.target.value = ""))} aria-label="Take a photo" />
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (void upload(e.target.files), (e.target.value = ""))} aria-label="Choose photos" data-photo-input="" />
        </div>
      )}
    </div>
  );
}

function NotesBlock({ job, canAdd }: { job: JobDetail; canAdd: boolean }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const notes = [...(job.staffNotes || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const add = async () => {
    const value = text.trim();
    if (!value || running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await addJobNote(job.id, value);
      applyJob(res.booking);
      setText("");
      toast.show("Note added");
    } catch (err) {
      setError(errorMessage(err, "The note could not be added. It is still here; try again."));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3" data-notes="">
      {notes.length ? (
        <ul className="flex flex-col gap-2" role="list">
          {notes.map((n) => (
            <li key={n.id} className="rounded-adm-sm border border-adm-line bg-adm-surface px-3 py-2" data-note={n.id}>
              <p className="whitespace-pre-wrap text-[15px] text-adm-ink">{n.text}</p>
              <p className="mt-1 text-[13px] text-adm-text-2">
                {n.authorName || "Staff"}
                {n.authorRole ? ` (${n.authorRole})` : ""} · {noteTime(n.at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-adm-text-2">No internal notes yet.</p>
      )}
      {canAdd && (
        <div className="flex flex-col gap-2">
          <Field label="Add an internal note" error={error || undefined}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Gate code, parts needed, what you found…" data-note-input="" />
          </Field>
          <Button variant="secondary" className="self-start" busy={busy} disabled={!text.trim()} onClick={add} data-add-note="">
            Add note
          </Button>
        </div>
      )}
    </div>
  );
}

function noteTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function MoneyView({ job }: { job: JobDetail }) {
  const m = job.money;
  const rows: MoneyRow[] = [];
  const tone: MoneyRow["tone"] = m.kind === "paid" ? "success" : m.kind === "payment_failed" ? "problem" : m.kind === "payment_pending" ? "default" : "muted";
  rows.push({
    label: m.label,
    ...(typeof m.amountCents === "number" ? { cents: m.amountCents } : { text: m.kind === "paid" ? "In Stripe" : m.kind === "payment_pending" ? "Not paid yet" : "No charge" }),
    tone,
    note: m.paidAt ? `Paid ${dayLabel(nyYMD(m.paidAt), { year: true })}` : undefined,
  });
  if (m.tipCents) rows.push({ label: "Tip", cents: m.tipCents, tone: "success" });
  const footer =
    m.kind === "paid" || m.kind === "refunded" ? (
      <span>
        {m.kind === "paid" ? "Canceling does not refund. Refunds are made in Stripe. " : ""}
        {m.stripeUrl && (
          <a href={m.stripeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-semibold text-adm-accent-ink" data-stripe-link="">
            Open in Stripe ↗
          </a>
        )}
      </span>
    ) : m.kind === "membership_included" ? (
      "The membership's own price is not shown as a visit price."
    ) : undefined;
  return <MoneyBlock title="Money" rows={rows} footer={footer} className="!p-3" />;
}

