"use client";

import {
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  GiftIcon,
  KeyIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PhoneIcon,
  SparklesIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import AdminGiftModal from "@/app/components/admin/AdminGiftModal";
import CustomerEditSheet from "@/app/components/admin/CustomerEditSheet";
import BuyMembershipSheet from "@/app/components/admin/tools/BuyMembershipSheet";
import CreateVisitSheet from "@/app/components/admin/tools/CreateVisitSheet";
import { deliveryText } from "@/app/components/admin/tools/AdminSheet";
import { resendCustomerAccess } from "@/lib/admin-tools-service";
import type { User } from "@/lib/admin-service";
import { can, PERM } from "@/lib/admin-access";
import { isAdminUser } from "@/lib/auth-routing";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { extractUSNationalPhoneDigits } from "@/lib/phone";
import { formatAddressLine } from "@/lib/admin/address";
import { customerListHref } from "@/lib/admin/customer-nav";
import { errorMessage, errorStatus, invalidateQueries, setQueryData, useAdminQuery } from "@/lib/admin/query";
import {
  archiveCustomer,
  customerKeys,
  fetchBilling,
  fetchConsent,
  fetchCustomerProjects,
  fetchProfile,
  hasLiveMembership,
  planChip,
  shortDate,
  unarchiveCustomer,
  type CustomerProfileSummary,
  type ProfileAddress,
} from "@/lib/admin/customers";
import { ConfirmSheet, EmptyState, ErrorBoundary, ErrorState, Field, Menu, PermissionState, Skeleton, StatusBadge, Tabs, Textarea, formatPhone, useToast, type MenuItem } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { BlockSheet } from "./AccountSheets";
import { ChargeCustomerSheet } from "./ChargeCustomerSheet";
import { CancellationSheet, ChangePlanSheet, ComplimentarySheet } from "./MembershipSheets";
import { ActivityTab, BillingTab, MessagesTab, NotesTab, OverviewTab, ProjectsTab, VisitsTab, type MembershipAction } from "./ProfileTabs";

type SheetState =
  | { kind: "edit" }
  | { kind: "sell" }
  | { kind: "visit" }
  | { kind: "gift"; addressId?: string | null }
  | { kind: "change"; addressId?: string | null }
  | { kind: "cancel"; addressId?: string | null }
  | { kind: "complimentary"; addressId?: string | null }
  | { kind: "block" }
  | { kind: "unblock" }
  | { kind: "archive" }
  | { kind: "unarchive" }
  | { kind: "resend" }
  | { kind: "charge" }
  | null;

/** The account as the older sheets (sell, visit, gift) expect it; the unit stays folded into line1 there, as stored. */
function toLegacyUser(p: CustomerProfileSummary): User {
  const grants = (a: ProfileAddress) => ["active", "trialing", "ending"].includes(a.planStatus);
  const folded = (a: ProfileAddress) => [a.line1, a.unit].filter(Boolean).join(" ");
  return {
    _id: p.customer.id,
    userId: p.customer.userId,
    name: p.customer.name,
    email: p.customer.email,
    phone: p.customer.phone,
    defaultAddressId: p.addresses.find((a) => a.isDefault)?.id,
    addresses: p.addresses.map((a) => ({ _id: a.id, label: a.label, line1: folded(a), city: a.town, state: a.state, zip: a.zip })),
    addressesDetailed: p.addresses.map((a) => ({ _id: a.id, label: a.label, line1: folded(a), city: a.town, state: a.state, zip: a.zip, isDefault: a.isDefault, plan: grants(a) ? a.plan : null })),
  };
}

function telHref(value: string): string {
  const digits = extractUSNationalPhoneDigits(value);
  return digits.length === 10 ? `+1${digits}` : value.replace(/[^\d+]/g, "");
}

function ActionButton({ label, icon, href, onClick, disabled, buttonRef, data }: { label: string; icon: ReactNode; href?: string; onClick?: () => void; disabled?: boolean; buttonRef?: React.Ref<HTMLButtonElement>; data?: string }) {
  const cls = "flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-adm-sm border border-adm-line-2 bg-adm-surface px-1 text-[12px] font-semibold text-adm-ink transition-colors hover:bg-adm-bg disabled:opacity-40 aria-disabled:opacity-40 [&>svg]:h-5 [&>svg]:w-5";
  if (href && !disabled) {
    return (
      <a href={href} className={cls} data-action={data}>
        {icon}
        <span className="truncate">{label}</span>
      </a>
    );
  }
  return (
    <button ref={buttonRef} type="button" className={cls} onClick={onClick} disabled={disabled || (!onClick && !href)} data-action={data}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-adm-text-3">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[14px] font-medium text-adm-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

type TabId = "overview" | "visits" | "billing" | "messages" | "projects" | "activity" | "notes";

/**
 * The unified customer profile (audit G.2) at /admin/customers/[id].
 * Header with the facts asked about most; one action row (Call, Text, Email,
 * Copy, New visit, More); tabs in the URL (?tab=). Money and destructive
 * actions live behind More or inside the Membership tab, each with its own
 * confirmation; what is offered comes from the server's allowedActions.
 */
export function CustomerProfile({ id }: { id: string }) {
  const { user, canOpen } = useAdmin();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const owner = isAdminUser(user);
  const canCustomers = can(user, PERM.CUSTOMERS_MANAGE);
  const canMembers = can(user, PERM.MEMBERS_READ);
  const canProjects = canOpen("projects");
  const canList = canCustomers || canMembers;

  const profileQ = useAdminQuery(customerKeys.profile(id), (signal) => fetchProfile(id, signal), { enabled: canList });
  const profile = profileQ.data;
  const consentQ = useAdminQuery(customerKeys.consent(id), (signal) => fetchConsent(id, signal), { enabled: canList && Boolean(profile) });
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);

  const requestedTab = (params.get("tab") || "overview") as TabId;
  const tabsAllowed: TabId[] = ["overview", "visits", "billing", ...(canCustomers ? (["messages"] as TabId[]) : []), ...(canProjects ? (["projects"] as TabId[]) : []), "activity", "notes"];
  const tab: TabId = tabsAllowed.includes(requestedTab) ? requestedTab : "overview";
  const tabHref = (t: TabId) => `/admin/customers/${encodeURIComponent(id)}${t === "overview" ? "" : `?tab=${t}`}`;

  const billingQ = useAdminQuery(customerKeys.billing(id), (signal) => fetchBilling(id, signal), {
    enabled: Boolean(profile?.allowedActions.viewBilling) && (moreOpen || tab === "billing"),
    staleTime: 60_000,
  });
  const projectsQ = useAdminQuery(customerKeys.projects(id), (signal) => fetchCustomerProjects(id, signal), {
    enabled: canProjects && Boolean(profile) && (tab === "projects" || tab === "overview"),
    staleTime: 60_000,
  });

  const [sheet, setSheet] = useState<SheetState>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const close = () => setSheet(null);

  const refreshAll = () => {
    invalidateQueries(["customer", id]);
    invalidateQueries("customer-list");
    invalidateQueries("customer-search");
  };
  const done = (message: string) => {
    toast.show(message);
    refreshAll();
  };

  if (!canList) return <PermissionState section="Customer profiles" />;

  const back = (
    <Link href={customerListHref()} scroll={false} className="adm-btn adm-btn--tertiary !-ml-2 !px-2" data-action="back-to-list">
      <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
      Customers
    </Link>
  );

  if (profileQ.isLoading) {
    return (
      <div data-customer-profile="" aria-busy="true">
        {back}
        <Skeleton className="mt-2 h-7 w-48" />
        <Skeleton className="mt-3 h-16 w-full" />
        <Skeleton className="mt-3 h-14 w-full" />
      </div>
    );
  }
  if (profileQ.error && !profile) {
    const status = errorStatus(profileQ.error);
    return (
      <div data-customer-profile="">
        {back}
        {status === 404 || status === 400 ? (
          <EmptyState message="This customer was not found" detail="They may have been deleted, or the link is out of date." />
        ) : status === 403 ? (
          <PermissionState message="This record is not a customer account, or you do not have access to it." />
        ) : (
          <ErrorState title="This customer could not be loaded" message={errorMessage(profileQ.error)} onRetry={profileQ.refetch} />
        )}
      </div>
    );
  }
  if (!profile) return null;

  const c = profile.customer;
  const a = profile.allowedActions;
  const phone = c.phone;
  const stopped = Boolean(consentQ.data?.stop.phoneOptedOut);
  const homes = profile.addresses;
  const changeHomes = homes.filter((h) => h.stripeManaged && ["active", "trialing"].includes(h.planStatus) && !h.cancelAt);
  const cancelHomes = homes.filter(hasLiveMembership);
  const billing = billingQ.data;
  const stripeUrl = billing && billing.available ? billing.customers.find((x) => !x.deleted)?.dashboardUrl : undefined;

  const copy = async (text: string, what: string) => {
    const ok = await writeToClipboard(text);
    toast.show(ok ? `${what} copied` : `Could not copy the ${what.toLowerCase()}. Select it and copy it by hand.`);
  };

  const onMembershipAction = (action: MembershipAction, addressId?: string) => {
    if (action === "sell") setSheet({ kind: "sell" });
    else if (action === "change") setSheet({ kind: "change", addressId });
    else if (action === "cancel") setSheet({ kind: "cancel", addressId });
    else setSheet({ kind: "complimentary", addressId });
  };

  const copyItems: MenuItem[] = [
    phone ? { label: `Phone · ${formatPhone(phone)}`, icon: <PhoneIcon />, onSelect: () => void copy(formatPhone(phone), "Phone") } : null,
    c.email ? { label: "Email", hint: c.email, icon: <EnvelopeIcon />, onSelect: () => void copy(c.email, "Email") } : null,
    ...homes.map((h) => ({ label: homes.length > 1 ? `Address · ${h.label || "Home"}` : "Address", hint: formatAddressLine(h), icon: <DocumentDuplicateIcon />, onSelect: () => void copy(formatAddressLine(h), "Address") })),
    c.userId ? { label: "Customer ID", hint: c.userId, icon: <DocumentDuplicateIcon />, onSelect: () => void copy(c.userId, "Customer ID") } : null,
  ].filter(Boolean) as MenuItem[];

  const moreItems: MenuItem[] = [
    a.editProfile ? { label: "Edit details", hint: "Names, phone, email, addresses", icon: <PencilSquareIcon />, onSelect: () => setSheet({ kind: "edit" }) } : null,
    a.chargeCustomer ? { label: "Charge customer", hint: "Saved card · no booking needed", icon: <CreditCardIcon />, onSelect: () => setSheet({ kind: "charge" }) } : null,
    a.sellMembership ? { label: "Sell a membership", hint: "Pay by phone or send a link", icon: <CreditCardIcon />, onSelect: () => setSheet({ kind: "sell" }) } : null,
    a.changePlan && changeHomes.length ? { label: "Change plan", hint: "Preview, then confirm", icon: <SparklesIcon />, onSelect: () => setSheet({ kind: "change" }) } : null,
    a.scheduleCancellation && cancelHomes.length ? { label: "Cancellation", hint: "Schedule or clear", icon: <XCircleIcon />, onSelect: () => setSheet({ kind: "cancel" }) } : null,
    a.grantComplimentary ? { label: "Complimentary membership", hint: "Owner only · needs a reason", icon: <SparklesIcon />, onSelect: () => setSheet({ kind: "complimentary" }) } : null,
    owner ? { label: "Gift a membership", hint: "You pay on Stripe", icon: <GiftIcon />, onSelect: () => setSheet({ kind: "gift" }) } : null,
    a.viewBilling && profile.flags.hasStripeCustomer
      ? stripeUrl
        ? { label: "Open in Stripe", icon: <ArrowTopRightOnSquareIcon />, href: stripeUrl, external: true }
        : { label: "Open in Stripe", icon: <ArrowTopRightOnSquareIcon />, disabled: true, hint: billingQ.isFetching || !billing ? "Loading…" : "Stripe is not reachable right now" }
      : null,
    a.resendAccess ? { label: "Resend sign-in details", hint: "They have not set a password yet", icon: <KeyIcon />, onSelect: () => setSheet({ kind: "resend" }) } : null,
    a.unblock ? { label: "Unblock", icon: <ArrowUturnLeftIcon />, onSelect: () => setSheet({ kind: "unblock" }) } : null,
    a.unarchive ? { label: "Restore from archive", icon: <ArrowUturnLeftIcon />, onSelect: () => setSheet({ kind: "unarchive" }) } : null,
    a.block ? { label: "Block", hint: "Needs a reason", icon: <NoSymbolIcon />, tone: "destructive" as const, onSelect: () => setSheet({ kind: "block" }) } : null,
    a.archive ? { label: "Archive", hint: "Owner only · hides from lists", icon: <ArchiveBoxIcon />, tone: "destructive" as const, onSelect: () => setSheet({ kind: "archive" }) } : null,
  ].filter(Boolean) as MenuItem[];

  const chips = homes.map((h) => ({ h, chip: planChip(h) })).filter((x) => x.chip);
  const legacy = toLegacyUser(profile);

  return (
    <div data-customer-profile={c.id} className="flex flex-col gap-4">
      <div>{back}</div>

      <header className="flex flex-col gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-adm-ink [overflow-wrap:anywhere]" data-profile-name="">
            {c.name || "Unnamed customer"}
          </h1>
          <p className="adm-num mt-0.5 text-[14px] text-adm-text-2 [overflow-wrap:anywhere]">{[phone ? formatPhone(phone) : "", c.email].filter(Boolean).join(" · ") || "No phone or email"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5" data-profile-chips="">
            {chips.map(({ h, chip }) => (
              <StatusBadge key={h.id} tone={chip!.tone}>
                {chip!.text}
              </StatusBadge>
            ))}
            {profile.flags.blocked && <StatusBadge tone="problem">Blocked</StatusBadge>}
            {profile.flags.archived && <StatusBadge tone="neutral">Archived</StatusBadge>}
            {stopped && <StatusBadge tone="problem">Texted STOP</StatusBadge>}
            {profile.flags.phoneVerified && <StatusBadge tone="success">Phone verified</StatusBadge>}
            {profile.flags.textsOk && !stopped && <StatusBadge tone="info">Texts OK</StatusBadge>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-adm-md border border-adm-line bg-adm-surface p-3 sm:grid-cols-4" data-profile-facts="">
          <Fact label="Next visit">
            {profile.visits.next ? (
              <Link href={profile.visits.next.href || `/admin/jobs/${profile.visits.next.id}`} className="text-adm-accent-ink underline-offset-2 hover:underline">
                {shortDate(profile.visits.next.date)}
              </Link>
            ) : (
              "None booked"
            )}
          </Fact>
          <Fact label="Last visit">
            {profile.visits.last ? (
              <Link href={profile.visits.last.href || `/admin/jobs/${profile.visits.last.id}`} className="text-adm-accent-ink underline-offset-2 hover:underline">
                {shortDate(profile.visits.last.date)}
              </Link>
            ) : (
              "None yet"
            )}
          </Fact>
          <Fact label="Visits done">
            <span className="adm-num">{profile.visits.completed}</span>
          </Fact>
          <Fact label="Customer since">{shortDate(c.customerSince) || "—"}</Fact>
        </dl>

        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Customer actions" data-profile-actions="">
          <ActionButton label="Call" icon={<PhoneIcon aria-hidden="true" />} href={phone ? `tel:${telHref(phone)}` : undefined} disabled={!phone} data="call" />
          <ActionButton label="Text" icon={<ChatBubbleLeftIcon aria-hidden="true" />} href={phone && !stopped ? `sms:${telHref(phone)}` : undefined} disabled={!phone || stopped} data="text" />
          <ActionButton label="Email" icon={<EnvelopeIcon aria-hidden="true" />} href={c.email ? `mailto:${c.email}` : undefined} disabled={!c.email} data="email" />
          <ActionButton label="Copy" icon={<DocumentDuplicateIcon aria-hidden="true" />} onClick={() => setCopyOpen(true)} disabled={!copyItems.length} buttonRef={copyRef} data="copy" />
          <ActionButton label="Visit" icon={<CalendarDaysIcon aria-hidden="true" />} onClick={a.createVisit ? () => setSheet({ kind: "visit" }) : undefined} disabled={!a.createVisit} data="new-visit" />
          <ActionButton label="More" icon={<EllipsisHorizontalIcon aria-hidden="true" />} onClick={() => setMoreOpen(true)} disabled={!moreItems.length} buttonRef={moreRef} data="more" />
        </div>
        {stopped && <p className="text-[13px] text-adm-text-2">Text is off: this phone texted STOP.</p>}
      </header>

      <Tabs label="Customer" value={tab} items={tabsAllowed.map((t) => ({ id: t, href: tabHref(t), label: TAB_LABEL[t], count: t === "notes" && profile.notesCount ? profile.notesCount : undefined }))} className="adm-sticky z-[2] bg-adm-bg" />

      <ErrorBoundary label={`Customer ${TAB_LABEL[tab]}`} resetKey={`${id}:${tab}`}>
        {tab === "overview" && <OverviewTab profile={profile} canMembers={canMembers} canProjects={canProjects} projects={projectsQ.data} onOpenTab={(t) => router.replace(tabHref(t as TabId), { scroll: false })} onEdit={a.editProfile ? () => setSheet({ kind: "edit" }) : undefined} />}
        {tab === "visits" && <VisitsTab profile={profile} />}
        {tab === "billing" && <BillingTab profile={profile} onAction={onMembershipAction} onCharge={() => setSheet({ kind: "charge" })} />}
        {tab === "messages" && <MessagesTab profile={profile} showReviewed={canCustomers} />}
        {tab === "projects" && <ProjectsTab projects={projectsQ.data} loading={projectsQ.isLoading} error={projectsQ.error} />}
        {tab === "activity" && <ActivityTab profile={profile} showProfileHistory={canCustomers || canMembers} />}
        {tab === "notes" && <NotesTab profile={profile} />}
      </ErrorBoundary>

      <Menu open={copyOpen} onClose={() => setCopyOpen(false)} anchorRef={copyRef} title="Copy" items={copyItems} />
      <Menu open={moreOpen} onClose={() => setMoreOpen(false)} anchorRef={moreRef} title={c.name || "Customer"} items={moreItems} />

      {/* Sheets: one at a time, each over the profile page (never over another sheet). */}
      {sheet?.kind === "edit" && (
        <CustomerEditSheet
          userId={c.id}
          onClose={close}
          onSaved={() => {
            refreshAll();
            toast.show("Customer updated");
          }}
        />
      )}
      {sheet?.kind === "charge" && <ChargeCustomerSheet customerId={c.id} onClose={close} />}
      {sheet?.kind === "sell" && <BuyMembershipSheet customer={legacy} onClose={close} onDone={(note) => (close(), done(note))} />}
      {sheet?.kind === "visit" && (
        <CreateVisitSheet
          presetCustomer={legacy}
          onClose={close}
          onCreated={(note) => {
            close();
            invalidateQueries("bookings");
            done(note);
          }}
        />
      )}
      {sheet?.kind === "gift" && <AdminGiftModal user={legacy} addressId={sheet.addressId || null} onClose={close} />}
      {sheet?.kind === "change" && <ChangePlanSheet open onClose={close} customerId={c.id} homes={changeHomes} initialAddressId={sheet.addressId} onChanged={done} />}
      {sheet?.kind === "cancel" && <CancellationSheet open onClose={close} customerId={c.id} homes={cancelHomes} initialAddressId={sheet.addressId} onChanged={done} />}
      {sheet?.kind === "complimentary" && <ComplimentarySheet open onClose={close} customerId={c.id} homes={homes} initialAddressId={sheet.addressId} onChanged={done} />}
      {(sheet?.kind === "block" || sheet?.kind === "unblock") && (
        <BlockSheet
          open
          onClose={close}
          mode={sheet.kind}
          customerId={c.id}
          name={c.name}
          history={profile.blockHistory || []}
          onDone={(message, history) => {
            setQueryData<CustomerProfileSummary>(customerKeys.profile(id), (cur) => (cur ? { ...cur, blockHistory: history } : (cur as never)));
            done(message);
          }}
        />
      )}
      <ConfirmSheet
        open={sheet?.kind === "archive"}
        onClose={() => {
          close();
          setArchiveReason("");
        }}
        title="Archive this customer?"
        consequence="They disappear from the customer lists and search. Nothing else changes: bookings, memberships, billing and messages carry on. You can restore them from the Archived filter."
        confirmLabel="Archive customer"
        tone="danger"
        onConfirm={async () => {
          await archiveCustomer(c.id, archiveReason.trim());
          setArchiveReason("");
          done(`${c.name || "Customer"} archived`);
        }}
      >
        <Field label="Reason (optional)">
          <Textarea value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} rows={2} maxLength={500} data-input="archive-reason" />
        </Field>
      </ConfirmSheet>
      <ConfirmSheet
        open={sheet?.kind === "unarchive"}
        onClose={close}
        title="Restore this customer?"
        consequence="They show in the customer lists and search again."
        confirmLabel="Restore customer"
        onConfirm={async () => {
          await unarchiveCustomer(c.id);
          done(`${c.name || "Customer"} restored`);
        }}
      />
      <ConfirmSheet
        open={sheet?.kind === "resend"}
        onClose={close}
        title="Resend sign-in details?"
        consequence={`${c.name || "The customer"} gets an email${phone ? " and a text" : ""} with a new temporary password (their phone number). Only works while they have not set their own password.`}
        confirmLabel="Resend sign-in details"
        onConfirm={async () => {
          const result = await resendCustomerAccess(c.id);
          toast.show(`Sign-in details sent. ${deliveryText(result.delivery)}.`);
        }}
      />
    </div>
  );
}

const TAB_LABEL: Record<TabId, string> = {
  overview: "Overview",
  visits: "Visits",
  billing: "Membership & billing",
  messages: "Messages & consent",
  projects: "Projects",
  activity: "Activity",
  notes: "Notes",
};

