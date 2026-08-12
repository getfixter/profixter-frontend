import type { AxiosProgressEvent } from 'axios';
import API from './api';

// Types
export interface User {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  subscription?: string;
  defaultAddressId?: string;
  addresses: Address[];
addressesDetailed?: AddressDetailed[];
createdAt?: string; // ✅ add this
}

export interface CustomerActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  descriptionLines?: string[];
  timestamp: string;
  source: string;
  actorName: string;
  actorRole: string;
  relatedBookingNumber: string;
  status: string;
}

export interface CustomerActivityResponse {
  user: {
    _id: string;
    userId: string;
    name: string;
    email: string;
  };
  limit: number | "all";
  total: number;
  items: CustomerActivityItem[];
  unavailableSources?: string[];
}

export interface AdminActivityLogItem {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface AdminActivityLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminActivityLogResponse {
  items: AdminActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminActivitySummary {
  since: string;
  usersDeleted: number;
  leadsDeleted: number;
  projectsDeleted: number;
}

export type GhlAiCommanderRiskLevel = "low" | "medium" | "high";

export interface GhlAiCommanderPlanResponse {
  confirmationId: string;
  summary: string;
  exactPlan?: unknown[];
  objectsAffected?: unknown[];
  messagesToSendOrCreate?: unknown[];
  plannedApiActions?: unknown[];
  unsupportedActions?: unknown[];
  riskLevel: GhlAiCommanderRiskLevel;
  destructive: boolean;
  requiresApproval: boolean;
  approvalRequired?: boolean;
  expiresAt: string;
}

export interface GhlAiCommanderExecuteResponse {
  status: "executed" | "failed" | "running";
  jobId?: string;
  workflowJob?: {
    jobId: string;
    name: string;
    actionType: string;
    status: "queued" | "running" | "completed" | "failed" | "canceled";
    progress?: {
      processed?: number;
      total?: number;
      percent?: number;
      message?: string;
    };
    progressEvents?: unknown[];
    report?: unknown;
    errors?: unknown[];
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    updatedAt?: string;
  };
  executedActions?: unknown[];
  results?: unknown[];
  errors?: unknown[];
}

export interface RoofingSalesAgentTrainingRequest {
  contactName: string;
  phone: string;
  incomingMessage: string;
  conversationHistory: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

export interface RoofingSalesAgentTrainingAction {
  actionType?: string;
  description?: string;
  supported?: boolean;
  executed?: boolean;
  reason?: string;
  requestPreview?: unknown;
  result?: unknown;
}

export interface RoofingSalesAgentTrainingResponse {
  classification: string;
  recommendedReply: string;
  actionsPlanned: RoofingSalesAgentTrainingAction[];
  humanTakeover: boolean;
}

export interface JarvisUploadedFile {
  uploadId: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
  storage: "s3" | "local";
  tempRef: string;
  storageKey: string;
}

export interface JarvisUploadBatchResponse {
  uploadBatchId: string;
  prompt: string;
  files: JarvisUploadedFile[];
  temporary: true;
  expiresAt: string;
  maxFileSizeBytes: number;
}

export interface JarvisSavedConversationMessage {
  clientId?: string;
  id?: string;
  role: "user" | "jarvis";
  kind: "text" | "brief" | "plan" | "answer" | "error";
  text?: string;
  intent?: JarvisAskResponse["intent"];
  sources?: string[];
  files?: unknown[];
  plan?: GhlAiCommanderPlanResponse;
  data?: unknown;
  error?: unknown;
  createdAt?: string;
}

export interface JarvisSavedConversation {
  id: string;
  conversationId: string;
  title: string;
  subtitle: string;
  messages?: JarvisSavedConversationMessage[];
  executionByPlanId?: Record<string, GhlAiCommanderExecuteResponse>;
  errorByPlanId?: Record<string, unknown>;
  canceledPlans?: Record<string, boolean>;
  uploadBatchIds?: string[];
  workflowJobIds?: string[];
  messageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
}

export interface JarvisConversationListResponse {
  conversations: JarvisSavedConversation[];
}

export interface JarvisCampaignMessageStep {
  stepId: string;
  channel: "sms" | "email";
  subject?: string;
  body: string;
  waitDelay?: {
    amount?: number;
    unit?: "minutes" | "hours" | "days";
    seconds?: number;
  };
  enabled?: boolean;
}

export interface JarvisCampaignRun {
  id: string;
  templateId: string;
  status: "queued" | "running" | "paused" | "completed" | "failed" | "canceled";
  testMode: boolean;
  dryRun: boolean;
  currentStepIndex?: number;
  audience?: {
    type?: string;
    tags?: string[];
    limit?: number;
    contactCount?: number;
    previewContacts?: unknown[];
    partial?: boolean;
    reason?: string;
    resolvedAt?: string | null;
  };
  stats?: {
    leadCount?: number;
    messagesQueued?: number;
    messagesSent?: number;
    messagesSkipped?: number;
    replies?: number;
    appointments?: number;
    escalations?: number;
    stopped?: number;
    errors?: number;
  };
  messageLog?: unknown[];
  events?: unknown[];
  errors?: unknown[];
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  failedAt?: string;
  nextRunAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface JarvisCampaignTemplate {
  id: string;
  campaignName: string;
  description?: string;
  audienceDefinition?: {
    type?: "ghl_tags" | "smart_list" | "uploaded_csv" | "custom_query";
    tags?: string[];
    smartListId?: string;
    uploadBatchId?: string;
    files?: unknown[];
    filters?: unknown;
    limit?: number;
    testMode?: boolean;
  };
  messageSteps?: JarvisCampaignMessageStep[];
  stopConditions?: unknown;
  replyHandlingRules?: unknown;
  aiQualificationPrompt?: string;
  outcomeTags?: string[];
  appointmentBookingRules?: unknown;
  ownerNotificationRules?: unknown;
  testMode?: boolean;
  approvalBeforeSending?: boolean;
  status: "draft" | "approved" | "running" | "paused" | "completed" | "archived";
  stats?: JarvisCampaignRun["stats"];
  latestRun?: JarvisCampaignRun | null;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
}

export interface JarvisCampaignListResponse {
  campaigns: JarvisCampaignTemplate[];
}

export interface JarvisCampaignDetailResponse {
  campaign: JarvisCampaignTemplate;
  runs: JarvisCampaignRun[];
}

export interface JarvisCampaignMutationResponse {
  campaign: JarvisCampaignTemplate;
  run: JarvisCampaignRun;
  confirmationUsed?: string;
}

export interface JarvisGhlControlReport {
  title: string;
  generatedAt: string;
  diagnostics?: {
    baseUrl?: string;
    apiVersion?: string;
    locationIdUsed?: string | null;
    token?: {
      source?: string;
      hasToken?: boolean;
      length?: number;
      hasLegacyGhlApiToken?: boolean;
      legacyLength?: number;
      apiVersion?: string;
    };
  };
  approvalRules?: {
    read?: string;
    write?: string;
    highRisk?: string;
    destructive?: string;
    campaignStart?: string;
  };
  summary?: {
    workingCapabilities?: number;
    failingCapabilities?: number;
    registryEnabledEndpoints?: number;
    writeEndpoints?: number;
    highRiskEndpoints?: number;
    destructiveEndpoints?: number;
    recentActions?: number;
    failedActions?: number;
  };
  capabilities?: {
    working?: Array<{ key?: string; label?: string; status?: string }>;
    failing?: Array<{ key?: string; label?: string; status?: string; reason?: string }>;
    all?: unknown[];
  };
  registry?: {
    stats?: Record<string, unknown>;
    groups?: Array<{
      group: string;
      totals?: {
        total?: number;
        enabled?: number;
        read?: number;
        write?: number;
        highRisk?: number;
        destructive?: number;
      };
    }>;
  };
  dryRunWrites?: Array<{
    key?: string;
    method?: string;
    path?: string;
    status?: string;
    riskCategory?: string;
    requiresApproval?: boolean;
    requiresExtraConfirmation?: boolean;
    confirmationPhraseRequired?: string;
    message?: string;
  }>;
  recentActions?: unknown[];
  failedActions?: unknown[];
  recommendations?: string[];
}

export type JarvisAskResponse =
  | {
      intent: "read";
      answer: string;
      data?: unknown;
      sources?: string[];
      requiresApproval: false;
    }
  | {
      intent: "advice";
      answer: string;
      data?: unknown;
      sources?: string[];
      requiresApproval: false;
    }
  | {
      intent: "write";
      plan: GhlAiCommanderPlanResponse;
      requiresApproval: true;
    };

export interface Address {
  _id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}

export interface AddressDetailed extends Address {
  isDefault: boolean;
  plan?: "basic" | "plus" | "premium" | "elite" | null;
  scheduledCancellationDate?: string | null;
}

export interface SubscriptionRepairRequest {
  userId?: string;
  email?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface SubscriptionRepairResponse {
  message: string;
  repaired: boolean;
  reason: string;
  user: {
    _id: string;
    userId: string | null;
    name: string;
    email: string;
    stripeCustomerId: string | null;
  };
  selectedCurrentPlan: {
    subscriptionId: string;
    subscriptionType: "basic" | "plus" | "premium" | "elite";
    status: string;
    accessStatus?: string;
    currentPeriodEnd?: string | null;
  } | null;
  addressesDetailed: AddressDetailed[];
}


export interface Booking {
  _id: string;
  bookingNumber: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  date: string;
  service: string;
  subscription?: string;
  accessType?: "membership" | "one_time" | "free_first_visit" | "admin";
  bookingType?: "membership_visit" | "one_time_handyman_visit";
  paymentState?: "not_required" | "pending" | "paid" | "failed" | "expired" | "refunded";
  entitlementId?: string | null;
  selectedTask?: string;
  reservationIssue?: {
    status?: string;
    message?: string;
    code?: string;
    stripeCheckoutSessionId?: string;
    holdExpiresAt?: string | null;
    occurredAt?: string | null;
  };
  status: string;
  note?: string;
  adminNote?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  images?: Array<string | { key: string; url: string }>;
  assignedFixterId?: string | null;
  assignedFixterName?: string;
  assignedFixterEmail?: string;
  assignedFixterPosition?: EmployeePosition | "";
}

export interface BlacklistEntry {
  _id: string;
  userId: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  reason?: string;
}

export interface SegmentCounts {
  all: number;
  subscribed: number;
  not_subscribed: number;
  basic: number;
  plus: number;
  premium: number;
  elite: number;
}

export interface CampaignRequest {
  segment: string;
  subject: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  excludedUserIds?: string[];
  excludedEmails?: string[];
}

export type BookingAdminPatch = {
  note?: string;
  adminNote?: string;
  date?: string;
  assignedFixterId?: string | null;
  images?: File[];
};

export interface CampaignResponse {
  campaignId: string;
  segment: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  excluded?: number;
  adminCopySent: boolean;
  status: string;
  errors: Array<{ email: string; error: string }>;
}

export interface CampaignPreview {
  segment: string;
  recipientCount: number;
  subject: string;
  html: string;
  text: string;
  sampleValues: Record<string, string>;
  includedRecipients?: CampaignRecipient[];
  excludedRecipientCount?: number;
  eligibleBeforeExclusions?: number;
}

export interface CampaignRecipient {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  plans: string[];
  subscriptionStatuses: string[];
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface CampaignRecipientsResponse {
  segment: string;
  includedCount: number;
  excludedCount: number;
  eligibleBeforeExclusions: number;
  recipients: CampaignRecipient[];
  excludedRecipients: CampaignRecipient[];
}

export interface CampaignVariable {
  key: string;
  tag: string;
  description: string;
}

export interface CampaignVariableGroup {
  id: string;
  label: string;
  variables: CampaignVariable[];
}

export interface CampaignTestResponse {
  testOnly: true;
  recipient: string;
  estimatedRecipientCount: number;
  excludedRecipientCount?: number;
  providerMessageId: string;
}

export interface EmailLogItem {
  _id: string;
  templateKey?: string;
  subject?: string;
  recipientEmail?: string;
  recipientName?: string;
  customerEmail?: string;
  customerName?: string;
  bookingNumber?: string;
  campaignNumber?: string;
  source?: string;
  emailType?: string;
  status: 'sent' | 'failed';
  sentAt?: string | null;
  failedAt?: string | null;
  providerMessageId?: string;
  providerResponse?: string;
  errorMessage?: string;
  errorCode?: string;
  responseCode?: string;
  createdAt: string;
}

export interface EmailLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  templateKey?: string;
  bookingNumber?: string;
  customerEmail?: string;
  recipientEmail?: string;
  status?: string;
  emailType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface EmailLogResponse {
  items: EmailLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RequestLead {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  message?: string;
  serviceType?: string;
  sourcePage?: string;
  leadSource?: string;
  status?: "new" | "contacted" | "won" | "lost";
  createdAt?: string;
}

export interface BookingHistoryChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface BookingHistoryEntry {
  _id: string;
  bookingId: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  actorPosition: string;
  actionType: string;
  changes: BookingHistoryChange[];
  summary: string;
  createdAt: string;
}

export type EmployeePosition = "Fixter" | "General Fixter";
export type EmployeeAvailabilityStatus =
  | "Available"
  | "Busy"
  | "Vacation"
  | "Sick"
  | "Training"
  | "Inactive";

export interface FixterAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "employee";
  employeePosition: EmployeePosition;
  isActive: boolean;
  mustChangePassword: boolean;
  isDefaultFixter: boolean;
  employeeAvailabilityStatus: EmployeeAvailabilityStatus;
  completedBookingsCount: number;
  offDaysSummary: {
    upcomingCount: number;
    pastCount: number;
    recent: Array<{
      date: string;
      endDate?: string;
      reason: string;
      type?: string;
      status: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_TYPES = [
  "Roofing",
  "Siding",
  "Bathroom",
  "Kitchen",
  "Handyman",
  "Other",
] as const;

export const PROJECT_STATUSES = [
  "Lead",
  "Estimate Sent",
  "Follow Up",
  "Won",
  "In Progress",
  "Completed",
  "Lost",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectMembershipStatus =
  | "active"
  | "trialing"
  | "scheduled_for_cancellation"
  | "past_due"
  | "canceled"
  | "none";

export interface ProjectMembershipSummary {
  overallStatus: ProjectMembershipStatus;
  planName: string | null;
  selectedAddressStatus: ProjectMembershipStatus | null;
  selectedAddressPlanName: string | null;
  addressId: string | null;
  activeMembershipAtAnotherAddress?: boolean;
}

export interface ProjectCustomerAddress {
  id: string;
  _id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  formattedAddress: string;
  isDefault: boolean;
  membershipSummary: ProjectMembershipSummary;
}

export interface ProjectCustomerSearchResult {
  id: string;
  customerId: string;
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  defaultAddressId: string | null;
  addresses: ProjectCustomerAddress[];
  matchingAddress: ProjectCustomerAddress | null;
  membershipSummary: ProjectMembershipSummary;
}

export interface ProjectCustomerSearchResponse {
  customers: ProjectCustomerSearchResult[];
  nextCursor: string | null;
  limit: number;
  message?: string;
}

export interface Project {
  _id: string;
  projectNumber: string;
  status: ProjectStatus;
  customerId?: string | null;
  addressId?: string | null;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  customerSnapshot?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  propertySnapshot?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    formattedAddress?: string;
  };
  projectType: ProjectType;
  estimateAmount: number;
  depositAmount: number;
  balanceDue: number;
  notes: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deleteReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<
  Project,
  "_id" | "projectNumber" | "isDeleted" | "deletedAt" | "deletedBy" | "deleteReason" | "createdAt" | "updatedAt"
>;

export interface ProjectDeletionSummary {
  contractCount: number;
  estimateCount: number;
  invoiceCount?: number;
  generatedPdfCount: number;
  signedPdfCount: number;
  invoicePdfCount?: number;
  storedDocumentCount: number;
  hasRelatedRecords: boolean;
  requiresDeleteConfirmation: boolean;
}

export interface ProjectDeletionResult {
  message: string;
  project: Project;
  deletion: {
    isDeleted: boolean;
    deletedAt: string | null;
    deletedBy?: string | null;
    relatedRecords: ProjectDeletionSummary;
  };
}

export const ESTIMATE_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export interface EstimateLineItem {
  _id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Estimate {
  _id: string;
  estimateNumber: string;
  projectId: string;
  status: EstimateStatus;
  title: string;
  description: string;
  lineItems: EstimateLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string;
  expirationDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateInput {
  projectId: string;
  status: EstimateStatus;
  title: string;
  description: string;
  lineItems: Array<Omit<EstimateLineItem, "_id" | "total">>;
  tax: number;
  discount: number;
  notes: string;
  expirationDate: string | null;
}

export const CONTRACT_WORK_TYPES = [
  "Kitchen",
  "Bathroom",
  "Roofing",
  "Siding",
  "Flooring",
  "Sheetrock",
  "Home Remodeling",
  "Handyman",
  "Other",
] as const;

export const CONTRACT_STATUSES = [
  "No Contract",
  "Draft",
  "Generated",
  "Emailed",
  "Signed",
  "Superseded",
  "Canceled",
] as const;

export type ContractWorkType = (typeof CONTRACT_WORK_TYPES)[number];
export type ContractStatus = Exclude<(typeof CONTRACT_STATUSES)[number], "No Contract">;

export interface ContractPaymentScheduleRow {
  _id?: string;
  label: string;
  amountCents: number;
  dueCondition: string;
  order?: number;
}

export type ContractDiscountType = "fixed" | "percentage";

export interface ProjectContractDiscount {
  _id?: string;
  name: string;
  type: ContractDiscountType;
  value: number;
  calculatedAmountCents?: number;
  note?: string;
  order?: number;
}

export interface ProjectContractInput {
  contractId?: string;
  /** The Estimate this Agreement is being created from, when there is one. */
  estimateId?: string;
  customerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
    customerId: string;
  };
  propertySnapshot: {
    address: string;
    projectId: string;
    projectNumber: string;
  };
  workType: ContractWorkType;
  otherWorkType: string;
  projectDescription: string;
  scopeText: string;
  originalContractPriceCents: number;
  totalPriceCents: number;
  discounts: ProjectContractDiscount[];
  depositAmountCents: number;
  fullDepositConfirmed?: boolean;
  zeroAdjustedPriceConfirmed?: boolean;
  paymentSchedule: ContractPaymentScheduleRow[];
  dates: {
    contractDate: string;
    /** True when the admin deliberately set the date instead of accepting today. */
    contractDateIsManual?: boolean;
    estimatedStartDate: string | null;
    estimatedCompletionDate: string | null;
  };
  optionalDetails: {
    materialsAllowances: string;
    exclusions: string;
    permitResponsibility: string;
    specialInstructions: string;
    additionalNotes: string;
  };
}

export interface ProjectContract {
  _id: string;
  id: string;
  contractNumber: string;
  version: number;
  current: boolean;
  projectId: string;
  status: ContractStatus;
  termsVersion: string;
  legalNoticeVersion?: string;
  fullDepositConfirmed?: boolean;
  zeroAdjustedPriceConfirmed?: boolean;
  /** The Estimate this Agreement came from, when there was one. */
  estimateId?: string | null;
  /** What that Estimate said at the moment this Agreement was created. */
  estimateSnapshot?: {
    estimateNumber: string;
    title: string;
    totalCents: number;
    lineItemCount: number;
    importedAt: string | null;
  };
  customerSnapshot: ProjectContractInput["customerSnapshot"];
  propertySnapshot: ProjectContractInput["propertySnapshot"];
  workType: ContractWorkType;
  otherWorkType: string;
  projectDescription: string;
  scopeText: string;
  originalContractPriceCents?: number;
  totalPriceCents: number;
  discounts?: ProjectContractDiscount[];
  totalDiscountAmountCents?: number;
  adjustedContractPriceCents?: number;
  depositAmountCents: number;
  remainingBalanceCents: number;
  paymentSchedule: ContractPaymentScheduleRow[];
  dates: ProjectContractInput["dates"];
  optionalDetails: ProjectContractInput["optionalDetails"];
  generatedPdf?: {
    available?: boolean;
    fileName?: string;
    size?: number;
    generatedAt?: string | null;
    generatedBy?: string | null;
  };
  signedPdf?: {
    available?: boolean;
    fileName?: string;
    size?: number;
    uploadedAt?: string | null;
    uploadedBy?: string | null;
  };
  emailHistory?: Array<{
    _id?: string;
    recipient: string;
    subject: string;
    message: string;
    sentAt: string;
    sentBy?: string | null;
    providerResponse?: string;
  }>;
  auditHistory?: Array<{
    _id?: string;
    event: string;
    at: string;
    adminId?: string | null;
    adminEmail?: string;
    details?: Record<string, unknown>;
  }>;
  parentProjectDeletedAt?: string | null;
  parentProjectDeletedMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractMeta {
  company: {
    legalName: string;
    addressLines: string[];
    phone: string;
    email: string;
    website: string;
    homeImprovementLicense: string;
    projectManager: string;
  };
  workTypes: ContractWorkType[];
  statuses: string[];
  termsVersion: string;
  termsSections: Array<{ title: string; body: string }>;
  cancellationNotice?: {
    includeCancellationNotice: boolean;
    termsVersion: string;
    title: string;
    body: string;
  };
  cancellationNoticeAttorneyReviewNote?: string;
  sourceUrls: string[];
  attorneyReviewNote: string;
  maxSignedPdfBytes: number;
}

/* ------------------------------------------------------------------ */
/* Change Orders                                                       */
/* ------------------------------------------------------------------ */

export const CHANGE_ORDER_STATUSES = [
  "Draft",
  "Ready to Send",
  "Sent",
  "Viewed",
  "Awaiting Signature",
  "Partially Signed",
  "Executed",
  "Declined",
  "Voided",
] as const;

export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export type ChangeLineDirection = "add" | "deduct" | "none";

export type ScheduleImpactType = "none" | "add_days" | "reduce_days" | "custom";

export interface ChangeOrderLine {
  _id?: string;
  description: string;
  direction: ChangeLineDirection;
  /** Always a magnitude; the direction carries the sign. */
  amountCents: number;
  order?: number;
}

export interface ChangeOrderInput {
  title: string;
  lines: Array<Omit<ChangeOrderLine, "_id">>;
  scheduleImpact: { type: ScheduleImpactType; days: number; note: string };
  notes: string;
}

export interface SignatureSigner {
  role: "CUSTOMER" | "COMPANY";
  name: string;
  email: string;
  order: number;
  status: string;
  viewedAt?: string | null;
  signedAt?: string | null;
}

export type SignatureStatus =
  | "Draft"
  | "Sent"
  | "Viewed"
  | "Awaiting Signature"
  | "Partially Signed"
  | "Completed"
  | "Declined"
  | "Cancelled"
  | "Expired"
  | "Failed";

export interface DocumentSignature {
  id: string;
  /** How the signature was obtained. Absent on historical Adobe records. */
  signingMode?: "REMOTE" | "IN_PERSON" | "MANUAL_UPLOAD";
  projectId?: string;
  documentType?: "CONTRACT" | "CHANGE_ORDER";
  documentId?: string;
  documentNumber?: string;
  provider: string;
  providerAgreementId: string;
  status: SignatureStatus;
  providerStatus: string;
  signers: SignatureSigner[];
  message?: string;
  sentAt?: string | null;
  completedAt?: string | null;
  declinedAt?: string | null;
  voidedAt?: string | null;
  expiredAt?: string | null;
  declineReason?: string;
  originalPdfAvailable: boolean;
  executedPdfAvailable: boolean;
  auditTrailAvailable: boolean;
  documentRetrieval: {
    state: "not_needed" | "pending" | "succeeded" | "failed";
    attempts: number;
    lastAttemptAt?: string | null;
    lastError?: string;
  };
  events?: Array<{ eventType: string; receivedAt: string }>;
  eventCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProjectChangeOrder {
  _id: string;
  id: string;
  changeOrderNumber: string;
  sequence: number;
  projectId: string;
  contractId: string;
  status: ChangeOrderStatus;
  termsVersion: string;
  title: string;
  customerSnapshot: { fullName: string; email: string; phone: string };
  propertySnapshot: { address: string; projectNumber: string };
  contractSnapshot: {
    contractNumber: string;
    contractDate?: string | null;
    originalContractAmountCents: number;
  };
  lines: ChangeOrderLine[];
  netAdjustmentCents: number;
  contractAmountBeforeChangeCents: number;
  newContractAmountCents: number;
  previousChangeOrderAdjustmentCents: number;
  scheduleImpact: { type: ScheduleImpactType; days: number; note: string };
  notes: string;
  generatedPdf?: { available?: boolean; fileName?: string; size?: number; generatedAt?: string | null };
  executedPdf?: {
    available?: boolean;
    fileName?: string;
    size?: number;
    uploadedAt?: string | null;
    source?: string;
  };
  signatureId?: string | null;
  signature?: DocumentSignature | null;
  emailHistory?: Array<{
    _id?: string;
    recipient: string;
    subject: string;
    message: string;
    sentAt: string;
    providerResponse?: string;
  }>;
  auditHistory?: Array<{
    _id?: string;
    event: string;
    at: string;
    adminEmail?: string;
    details?: Record<string, unknown>;
  }>;
  sentAt?: string | null;
  executedAt?: string | null;
  declinedAt?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Executed vs projected contract value for one contract. */
export interface ContractValueSummary {
  contractId: string;
  contractNumber: string;
  contractStatus: string;
  originalContractCents: number;
  executedAdjustmentCents: number;
  executedContractCents: number;
  pendingAdjustmentCents: number;
  projectedContractCents: number;
  executedCount: number;
  pendingCount: number;
}

/**
 * A project's financial position, exactly as the backend computed it.
 *
 * Every figure here is served by /api/admin/projects/:id/financials. The UI
 * renders these numbers and derives none of its own: a second implementation
 * of the money rules in the browser is how "approved" and "invoiced" start
 * quietly disagreeing.
 */
export interface ProjectFinancialTotals {
  originalAgreementCents: number;
  executedChangeOrderCents: number;
  approvedAgreementCents: number;
  pendingChangeOrderCents: number;
  projectedAgreementCents: number;
  executedChangeOrderCount: number;
  pendingChangeOrderCount: number;
  invoicedCents: number;
  paidCents: number;
  outstandingInvoicedCents: number;
  uninvoicedApprovedCents: number;
  overInvoicedCents: number;
  countedInvoiceCount: number;
}

export interface ProjectFinancialChangeOrderRef {
  id: string;
  changeOrderNumber: string;
  title: string;
  status: string;
  netAdjustmentCents: number;
  executedAt: string | null;
}

export interface ProjectFinancialInvoiceRef {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceTotalCents: number;
  paidCents: number;
  countsTowardInvoiced: boolean;
  issuedAt: string | null;
  invoiceDate: string | null;
  hasFinancialSnapshot: boolean;
}

export interface ProjectFinancials {
  projectId: string;
  projectNumber: string;
  agreement: {
    id: string;
    contractNumber: string;
    version: number;
    status: string;
    isBinding: boolean;
    contractDate: string | null;
    estimate: {
      id: string;
      estimateNumber: string;
      title: string;
      totalCents: number;
      importedAt: string | null;
    } | null;
  } | null;
  /** Other Agreement numbers on this project, if it carries more than one. */
  otherAgreementNumbers: string[];
  changeOrders: {
    executed: ProjectFinancialChangeOrderRef[];
    pending: ProjectFinancialChangeOrderRef[];
  };
  invoices: ProjectFinancialInvoiceRef[];
  totals: ProjectFinancialTotals;
}

/** An Estimate an Agreement can be built from. */
export interface ContractEstimateOption {
  id: string;
  estimateNumber: string;
  title: string;
  description: string;
  status: string;
  totalCents: number;
  lineItems: { description: string; quantity: number; totalCents: number }[];
  createdAt: string;
}

/** How much of the project a new invoice is meant to bill. */
export type InvoiceBillingMode = "full" | "amount" | "remaining" | "changeOrders";

export interface InvoiceBillingIntent {
  mode: InvoiceBillingMode;
  amountCents?: number;
  label?: string;
  changeOrderIds?: string[];
}

/** A caution shown before billing. Never a block. */
export interface InvoiceFinancialWarning {
  code: string;
  message: string;
  overageCents?: number;
}

export interface ChangeOrderMeta {
  company: ContractMeta["company"];
  statuses: ChangeOrderStatus[];
  scheduleImpactTypes: ScheduleImpactType[];
  termsVersion: string;
  amendableContractStatuses: string[];
  maxSignedPdfBytes: number;
}

/** A native signing request created from the Admin. */
export interface NativeSignatureRequest {
  signature: DocumentSignature;
  /**
   * Returned exactly once by the server. Treat as a credential: never persist
   * it, never log it, never send it to analytics.
   */
  signingUrl: string;
  mode: "REMOTE" | "IN_PERSON";
  emailed?: boolean;
}

export interface SignatureMeta {
  provider: string;
  configured: boolean;
  /** Which credential style the server is using — never the credentials. */
  authMode: "" | "oauth" | "integration_key";
  companySignerConfigured: boolean;
  webhookConfigured: boolean;
  webhookPath: string;
  /** The registered provider webhook, or null if none is recorded. */
  webhook: {
    registered: boolean;
    providerWebhookId: string;
    state: string;
    eventCount: number;
    url: string;
    lastCheckedAt?: string | null;
    lastError?: string;
  } | null;
}

export const INVOICE_STATUSES = [
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid in Full",
  "Overdue",
  "Voided",
  "Superseded",
] as const;

export const INVOICE_LINE_ITEM_CATEGORIES = [
  "Contract work",
  "Change order",
  "Materials",
  "Labor",
  "Permit/fee",
  "Credit",
  "Other",
] as const;

export const INVOICE_DISCOUNT_TYPES = ["fixed", "percentage", "credit"] as const;

export const INVOICE_PAYMENT_METHODS = [
  "Cash",
  "Check",
  "Credit Card",
  "ACH / Bank Transfer",
  "Zelle",
  "Financing",
  "Other",
] as const;

export const INVOICE_TAX_TREATMENTS = [
  "Capital Improvement - No Sales Tax",
  "Taxable Repair / Maintenance",
  "Tax Exempt",
  "Not Determined",
] as const;

export const INVOICE_DUE_TERMS = [
  "due_on_receipt",
  "net_7",
  "net_15",
  "net_30",
  "custom",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceLineItemCategory = (typeof INVOICE_LINE_ITEM_CATEGORIES)[number];
export type InvoiceDiscountType = (typeof INVOICE_DISCOUNT_TYPES)[number];
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];
export type InvoiceTaxTreatment = (typeof INVOICE_TAX_TREATMENTS)[number];
export type InvoiceDueTerm = (typeof INVOICE_DUE_TERMS)[number];

export interface InvoiceLineItem {
  _id?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  category: InvoiceLineItemCategory;
  order?: number;
}

export interface InvoiceDiscount {
  _id?: string;
  name: string;
  type: InvoiceDiscountType;
  value: number;
  calculatedAmountCents?: number;
  note?: string;
  order?: number;
}

export interface InvoicePayment {
  _id?: string;
  amountCents: number;
  paymentDate: string;
  method: InvoicePaymentMethod;
  reference?: string;
  note?: string;
  recordedBy?: string | null;
  recordedByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoicePdfRecord {
  available?: boolean;
  version?: number;
  fileName?: string;
  size?: number;
  generatedAt?: string | null;
  generatedBy?: string | null;
  status?: "Current" | "Superseded" | "Voided" | "";
}

export interface ProjectInvoiceInput {
  invoiceId?: string;
  source?: "manual" | "contract";
  createFromContract?: boolean;
  contractId?: string | null;
  customerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
    customerId?: string;
  };
  propertySnapshot: {
    address: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    formattedAddress?: string;
  };
  projectSnapshot: {
    projectId?: string;
    projectNumber: string;
    workType: string;
    projectDescription: string;
  };
  contractSnapshot?: {
    contractId?: string;
    contractNumber?: string;
    finalContractPriceCents?: number;
    importedAt?: string | null;
  };
  lineItems: Array<Omit<InvoiceLineItem, "_id" | "amountCents">>;
  discounts: Array<Omit<InvoiceDiscount, "_id" | "calculatedAmountCents">>;
  taxTreatment: InvoiceTaxTreatment;
  taxRateBasisPoints: number;
  dueTerm: InvoiceDueTerm;
  dates: {
    invoiceDate: string;
    /** True when the admin deliberately set the date instead of accepting today. */
    invoiceDateIsManual?: boolean;
    dueDate: string;
    serviceDate?: string | null;
  };
  publicNote: string;
  internalNote: string;
  paymentInstructions: string;
}

export interface ProjectInvoice {
  _id: string;
  id: string;
  invoiceNumber: string;
  version: number;
  projectId: string;
  customerId?: string | null;
  contractId?: string | null;
  source: "manual" | "contract";
  status: InvoiceStatus;
  customerSnapshot: ProjectInvoiceInput["customerSnapshot"];
  propertySnapshot: Required<ProjectInvoiceInput["propertySnapshot"]>;
  projectSnapshot: ProjectInvoiceInput["projectSnapshot"];
  contractSnapshot?: ProjectInvoiceInput["contractSnapshot"];
  /**
   * Online payment destination. Stripe collects; ProFixter stays the source of
   * truth. Absent on invoices sent before online payment existed.
   */
  onlinePayment?: {
    provider?: "stripe" | "";
    hostedInvoiceUrl?: string;
    stripeStatus?: string;
    amountDueCents?: number;
    finalizedAt?: string | null;
    lastError?: string;
    unappliedCents?: number;
  };
  /**
   * The project's approved position frozen at issue. Absent on invoices
   * created before this existed, which keep rendering from their own figures.
   */
  projectFinancialSnapshot?: {
    agreementId: string;
    agreementNumber: string;
    agreementVersion: number;
    originalAgreementCents: number;
    executedChangeOrders: Array<{
      changeOrderId: string;
      changeOrderNumber: string;
      title: string;
      netAdjustmentCents: number;
    }>;
    executedChangeOrderCents: number;
    approvedAgreementCents: number;
    previouslyInvoicedCents: number;
    previouslyPaidCents: number;
    uninvoicedApprovedCents: number;
    capturedAt: string | null;
  };
  lineItems: InvoiceLineItem[];
  discounts: InvoiceDiscount[];
  taxTreatment: InvoiceTaxTreatment;
  taxRateBasisPoints: number;
  subtotalCents: number;
  totalDiscountCents: number;
  taxableAmountCents: number;
  taxAmountCents: number;
  invoiceTotalCents: number;
  payments: InvoicePayment[];
  totalPaidCents: number;
  remainingBalanceCents: number;
  dueTerm: InvoiceDueTerm;
  dates: {
    invoiceDate: string;
    invoiceDateIsManual?: boolean;
    dueDate: string;
    serviceDate?: string | null;
    paidInFullAt?: string | null;
  };
  publicNote: string;
  internalNote: string;
  paymentInstructions: string;
  generatedPdfs: InvoicePdfRecord[];
  currentPdf?: InvoicePdfRecord;
  requiresRegeneration?: boolean;
  sentAt?: string | null;
  lastEmailedAt?: string | null;
  emailHistory?: Array<{
    _id?: string;
    recipient: string;
    subject: string;
    message: string;
    pdfVersion?: number;
    sentAt: string;
    sentBy?: string | null;
    providerResponse?: string;
  }>;
  eventHistory?: Array<{
    _id?: string;
    event: string;
    at: string;
    adminId?: string | null;
    adminEmail?: string;
    details?: Record<string, unknown>;
  }>;
  voidedAt?: string | null;
  voidReason?: string;
  parentProjectDeletedAt?: string | null;
  parentProjectDeletedMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Users
export const getAllUsers = async (): Promise<User[]> => {
  const response = await API.get('/api/admin/users');
  return response.data;
};

export const getMembers = async (): Promise<User[]> => {
  const response = await API.get("/api/admin/members");
  return response.data;
};

export const getCustomerActivity = async (
  userId: string,
  limit: 10 | "all" = 10
): Promise<CustomerActivityResponse> => {
  const response = await API.get(`/api/admin/users/${userId}/activity`, {
    params: { limit },
  });
  return response.data;
};

export const getFixters = async (): Promise<FixterAccount[]> => {
  const response = await API.get("/api/admin/fixters");
  return response.data.fixters;
};

export const createFixter = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeePosition: EmployeePosition;
}): Promise<FixterAccount> => {
  const response = await API.post("/api/admin/fixters", data);
  return response.data.fixter;
};

export const updateFixter = async (
  id: string,
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    employeePosition: EmployeePosition;
  }
): Promise<FixterAccount> => {
  const response = await API.put(`/api/admin/fixters/${id}`, data);
  return response.data.fixter;
};

export const setFixterActive = async (
  id: string,
  isActive: boolean
): Promise<FixterAccount> => {
  const response = await API.patch(`/api/admin/fixters/${id}/status`, { isActive });
  return response.data.fixter;
};

export const setFixterAvailabilityStatus = async (
  id: string,
  employeeAvailabilityStatus: EmployeeAvailabilityStatus
): Promise<FixterAccount> => {
  const response = await API.patch(
    `/api/admin/fixters/${id}/availability-status`,
    { employeeAvailabilityStatus }
  );
  return response.data.fixter;
};

export const setDefaultFixter = async (
  id: string,
  isDefault: boolean
): Promise<FixterAccount[]> => {
  const response = await API.patch(`/api/admin/fixters/${id}/default`, {
    isDefault,
  });
  return response.data.fixters;
};

export const deleteFixter = async (id: string): Promise<void> => {
  await API.delete(`/api/admin/fixters/${id}`);
};

export const updateUser = async (
  userId: string,
  data: { name?: string; phone?: string; subscription?: string }
): Promise<User> => {
  const response = await API.put(`/api/admin/users/${userId}`, data);
  return response.data.user;
};

export const deleteUser = async (
  userId: string,
  confirmation: string
): Promise<void> => {
  await API.delete(`/api/admin/users/${userId}`, {
    data: { confirmation },
  });
};

export const getAdminActivityLogs = async (
  filters: AdminActivityLogFilters = {}
): Promise<AdminActivityLogResponse> => {
  const response = await API.get("/api/admin/activity-log", { params: filters });
  return response.data;
};

export const getAdminActivitySummary = async (): Promise<AdminActivitySummary> => {
  const response = await API.get("/api/admin/activity-log/summary");
  return response.data;
};

export const setAddressPlan = async (
  userId: string,
  addressId: string,
  plan: string
): Promise<AddressDetailed[]> => {
  const response = await API.put(
    `/api/admin/users/${userId}/address/${addressId}/subscription`,
    { plan }
  );
  return response.data.addressesDetailed;
};

export const setAddressCancellationDate = async (
  userId: string,
  addressId: string,
  cancelOnDate: string | null
): Promise<AddressDetailed[]> => {
  const response = await API.put(
    `/api/admin/users/${userId}/address/${addressId}/cancellation-date`,
    {
      cancelOnDate,
      timezone: "America/New_York",
    }
  );
  return response.data.addressesDetailed;
};

export const repairUserSubscriptionFromStripe = async (
  data: SubscriptionRepairRequest
): Promise<SubscriptionRepairResponse> => {
  const response = await API.post("/api/admin/users/subscription-sync/repair", data);
  return response.data;
};

// Bookings
export interface BookingAssignee {
  id: string;
  name: string;
  email: string;
  employeePosition: EmployeePosition;
  isDefaultFixter: boolean;
}

export const getAllBookings = async (
  assigned: "all" | "me" = "all"
): Promise<Booking[]> => {
  const response = await API.get('/api/admin/bookings', {
    params: assigned === "me" ? { assigned: "me" } : undefined,
  });
  return response.data;
};

export const getBookingAssignees = async (): Promise<BookingAssignee[]> => {
  const response = await API.get("/api/admin/booking-assignees");
  return response.data.fixters;
};

export const getBookingHistory = async (
  bookingId: string
): Promise<BookingHistoryEntry[]> => {
  const response = await API.get(`/api/admin/bookings/${bookingId}/history`);
  return response.data.history;
};

export const updateBookingStatus = async (
  bookingId: string,
  status: string,
  assignedFixterId?: string | null
): Promise<Booking> => {
  const response = await API.put(`/api/admin/bookings/${bookingId}/status`, {
    status,
    ...(assignedFixterId !== undefined ? { assignedFixterId } : {}),
  });
  return response.data.booking;
};


export const updateBookingAdmin = async (
  bookingId: string,
  patch: BookingAdminPatch
): Promise<Booking> => {
  if (patch.images?.length) {
    const formData = new FormData();
    if (patch.note !== undefined) formData.append("note", patch.note);
    if (patch.adminNote !== undefined) formData.append("adminNote", patch.adminNote);
    if (patch.date !== undefined) formData.append("date", patch.date);
    if (patch.assignedFixterId !== undefined) {
      formData.append("assignedFixterId", patch.assignedFixterId || "");
    }
    patch.images.forEach((file) => formData.append("images", file));
    const response = await API.put(`/api/admin/bookings/${bookingId}`, formData);
    return response.data.booking;
  }

  const response = await API.put(`/api/admin/bookings/${bookingId}`, patch);
  return response.data.booking;
};



// Blacklist
export const getBlacklist = async (): Promise<BlacklistEntry[]> => {
  const response = await API.get('/api/admin/blacklist');
  return response.data;
};

export const addToBlacklist = async (
  userId: string,
  reason: string
): Promise<string> => {
  const response = await API.post(`/api/admin/blacklist/${userId}`, { reason });
  return response.data.id;
};

export const removeFromBlacklist = async (blacklistId: string): Promise<void> => {
  await API.delete(`/api/admin/blacklist/${blacklistId}`);
};

// Email Campaigns
export const getSegmentCounts = async (): Promise<SegmentCounts> => {
  const response = await API.get('/api/admin/segments');
  return response.data;
};

export const sendCampaign = async (
  data: CampaignRequest
): Promise<CampaignResponse> => {
  const response = await API.post('/api/admin/campaigns/send', data, {
    timeout: 300000,
  });
  return response.data;
};

export const sendCampaignTest = async (
  data: CampaignRequest
): Promise<CampaignTestResponse> => {
  const response = await API.post('/api/admin/campaigns/test', data, {
    timeout: 60000,
  });
  return response.data;
};

export const previewCampaign = async (
  data: CampaignRequest
): Promise<CampaignPreview> => {
  const response = await API.post('/api/admin/campaigns/preview', data);
  return response.data;
};

export const getCampaignVariables = async (): Promise<CampaignVariableGroup[]> => {
  const response = await API.get('/api/admin/campaigns/variables');
  return response.data.groups;
};

export const getCampaignRecipients = async (
  segment: string,
  excludedUserIds: string[] = [],
  excludedEmails: string[] = []
): Promise<CampaignRecipientsResponse> => {
  const response = await API.get('/api/admin/campaigns/recipients', {
    params: {
      segment,
      excludedUserIds: excludedUserIds.join(','),
      excludedEmails: excludedEmails.join(','),
    },
  });
  return response.data;
};

export const getEmailLogs = async (
  filters: EmailLogFilters = {}
): Promise<EmailLogResponse> => {
  const response = await API.get('/api/admin/email-logs', { params: filters });
  return response.data;
};

// Calendar Config
export interface CalendarConfig {
  timezone: string;
  slotMinutes: number;
  closedWeekdays: number[];
  defaultHours: string[];
  overrides: Record<string, string[]>;
  holidays: string[];
  minLeadDays: number;
  maxConcurrent: number;
}

export const getCalendarConfig = async (): Promise<CalendarConfig> => {
  const response = await API.get('/api/admin/calendar');
  return response.data;
};

export const updateCalendarConfig = async (
  config: CalendarConfig
): Promise<void> => {
  await API.put('/api/admin/calendar', config);
};

export type CalendarScope = "company" | "technician";
export type CalendarInterval = {
  startTime: string;
  endTime: string;
  capacity?: number | null;
};
export type CalendarStart = {
  time: string;
  capacity?: number | null;
};
export type CalendarWeeklyDay = {
  weekday: number;
  enabled: boolean;
  starts: CalendarStart[];
  intervals: CalendarInterval[];
};
export interface ShadowCompanyTemplate {
  _id: string;
  timezone: string;
  slotMinutes: number;
  visitDurationMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  defaultCapacity: number;
  weeklySchedule: CalendarWeeklyDay[];
  version: number;
}
export interface ShadowTechnician {
  id: string;
  name: string;
  email: string;
  position: "Fixter" | "General Fixter";
  isActive: boolean;
  visibilityStatus: string;
  template?: ShadowTechnicianTemplate | null;
}
export interface ShadowTechnicianTemplate {
  _id: string;
  technicianId: string;
  inheritCompanyHours: boolean;
  weeklySchedule: CalendarWeeklyDay[];
}
export interface CalendarFoundationStatus {
  shadowMode: true;
  companyTemplateReady: boolean;
  technicianTemplatesReady: boolean;
  importedLegacyOverridesReady: boolean;
  warnings: string[];
  errors: string[];
  missingTechnicians?: Array<{ id?: string; name?: string; email?: string }>;
}
export interface CalendarCutoverStatus {
  generatedAt: string;
  featureFlags: {
    reservationEngineEnabled: boolean;
    availabilityPreviewEnabled: boolean;
    mongoTransactionsVerified: boolean;
  };
  transactionProbe: {
    status: "passed" | "not_verified";
    verified: boolean;
    command: string;
  };
  audit: { status: string; command: string };
  backfillDryRun: { status: string; command: string };
  readinessPreview: { status: "available" | "disabled"; endpoint: string };
  instructions: string[];
}
export interface CalendarCutoverReadiness {
  generatedAt: string;
  safeToCutOver: boolean;
  decision: "YES" | "NO";
  reservationEngineEnabled: boolean;
  mongoTransactionsVerified: boolean;
  range: {
    from: string;
    to: string;
    days: number;
    timezone: string;
  };
  blockers: Array<{ category: string; count: number }>;
  warnings: Array<{ category: string; count: number }>;
  migrationDifferences: Array<{ category: string; count: number }>;
  migrationDifferenceCounts: Record<string, number>;
  mismatchCounts: Record<string, number>;
  backfillReadiness: {
    dryRun: boolean;
    activeFutureBookings: number;
    alreadyReserved: number;
    canReserve: number;
    noEligibleTechnician: number;
    conflicts: number;
    outsideWorkingHours: number;
    missingFoundation: number;
    issues: Array<{
      category: string;
      bookingId: string;
      slotStart?: string;
      message?: string;
    }>;
    errors: Array<{ bookingId?: string; message: string }>;
  };
  reservationAudit: Record<string, unknown>;
}
export interface ReservationAutoAssignmentReport {
  dryRun: boolean;
  activeFutureBookings: number;
  alreadyReserved: number;
  canReserve: number;
  created: number;
  noEligibleTechnician: number;
  conflicts: number;
  outsideWorkingHours: number;
  missingFoundation: number;
  plannedAssignments: Array<{
    bookingId: string;
    requestedStart: string;
    technicianId: string;
    technicianName: string;
    isDefaultFixter: boolean;
    dayBookingCount: number;
    weekBookingCount: number;
    assignmentReason: string;
  }>;
  issues: Array<{
    category: string;
    bookingId: string;
    slotStart?: string;
    techniciansEvaluated?: Array<{
      id: string;
      name?: string;
      position?: string;
      accountActive?: boolean;
      availabilityStatus?: string;
      scheduleSource?: string;
      available: boolean;
      rejectionCode?: string | null;
      reason?: string;
      availabilityDiagnostics?: {
        weekday?: number;
        companyDayEnabled?: boolean;
        configuredCompanyStarts?: string[];
        configuredCompanyIntervals?: Array<{
          startTime: string;
          endTime: string;
        }>;
        generatedCompanyStarts?: string[];
        generatedCompanySlots?: Array<{
          time: string;
          endTime: string;
        }>;
        requestedStart?: string;
        requestedEnd?: string;
      } | null;
    }>;
  }>;
  errors: Array<{ bookingId?: string; message: string }>;
  confirmationRequired?: boolean;
  bookingIds?: string[];
}
export interface ShadowCalendarDaySummary {
  date: string;
  bookingCount: number;
  openSlotCount: number;
  usedCapacity: number;
  totalCapacity: number;
  closed: boolean;
  reducedCapacity: boolean;
  hasOverrides: boolean;
  hasTimeOff: boolean;
  hasNote: boolean;
}
export interface ShadowCalendarSlot {
  time: string;
  endTime: string;
  configuredCapacity: number;
  totalCapacity: number;
  usedCapacity: number;
  remainingCapacity: number;
  open: boolean;
  technicians: Array<{
    id: string;
    name: string;
    position: string;
    visibilityStatus: string;
    available: boolean;
    unavailableReason?: string;
    booked: boolean;
  }>;
  bookings: Array<{
    id: string;
    bookingNumber?: string;
    customerName?: string;
    service?: string;
    status?: string;
    assignedFixterName?: string;
  }>;
}
export interface ShadowCalendarDay {
  date: string;
  timezone: string;
  scope: CalendarScope;
  technicianId: string | null;
  bookingCount: number;
  openSlotCount: number;
  usedCapacity: number;
  totalCapacity: number;
  closed: boolean;
  reducedCapacity: boolean;
  hasOverrides: boolean;
  hasTimeOff: boolean;
  note: string;
  slots: ShadowCalendarSlot[];
  technicians: ShadowTechnician[];
}

const calendarScopeParams = (
  scope: CalendarScope,
  technicianId?: string | null
) => ({
  scope,
  ...(scope === "technician" && technicianId ? { technicianId } : {}),
});

export const getCalendarFoundationStatus =
  async (): Promise<CalendarFoundationStatus> => {
    const response = await API.get("/api/admin/calendar/foundation-status");
    return response.data;
  };

export const getCalendarCutoverStatus =
  async (): Promise<CalendarCutoverStatus> => {
    const response = await API.get(
      "/api/admin/calendar/customer-cutover-status"
    );
    return response.data;
  };

export const getCalendarCutoverReadiness = async (
  days = 60
): Promise<CalendarCutoverReadiness> => {
  const response = await API.get(
    "/api/admin/calendar/customer-availability-preview",
    { params: { days } }
  );
  return response.data;
};

export const previewReservationAutoAssignments =
  async (): Promise<ReservationAutoAssignmentReport> => {
    const response = await API.get(
      "/api/admin/calendar/reservation-auto-assignment-preview"
    );
    return response.data;
  };

export const confirmReservationAutoAssignments = async (
  bookingIds: string[]
): Promise<ReservationAutoAssignmentReport> => {
  const response = await API.post(
    "/api/admin/calendar/reservation-auto-assignment",
    { confirm: true, bookingIds }
  );
  return response.data;
};

export const bootstrapCalendarFoundation = async () => {
  const response = await API.post("/api/admin/calendar/foundation/bootstrap");
  return response.data as CalendarFoundationStatus & { ok: boolean };
};

export const getShadowCalendarSummary = async (
  month: string,
  scope: CalendarScope,
  technicianId?: string | null
): Promise<ShadowCalendarDaySummary[]> => {
  const response = await API.get("/api/admin/calendar/summary", {
    params: { month, ...calendarScopeParams(scope, technicianId) },
  });
  return response.data.days;
};

export const getShadowCalendarDay = async (
  date: string,
  scope: CalendarScope,
  technicianId?: string | null
): Promise<ShadowCalendarDay> => {
  const response = await API.get("/api/admin/calendar/day", {
    params: { date, ...calendarScopeParams(scope, technicianId) },
  });
  return response.data;
};

export const getShadowCompanyTemplate =
  async (): Promise<ShadowCompanyTemplate> => {
    const response = await API.get("/api/admin/calendar/company-template");
    return response.data.template;
  };

export const updateShadowCompanyTemplate = async (
  input: Partial<ShadowCompanyTemplate>
): Promise<ShadowCompanyTemplate> => {
  const response = await API.put("/api/admin/calendar/company-template", input);
  return response.data.template;
};

export const getShadowTechnicians = async (): Promise<ShadowTechnician[]> => {
  const response = await API.get("/api/admin/calendar/technicians");
  return response.data.technicians;
};

export const getShadowTechnicianTemplate = async (
  technicianId: string
): Promise<ShadowTechnicianTemplate | null> => {
  const response = await API.get(
    `/api/admin/calendar/technicians/${technicianId}/template`
  );
  return response.data.template;
};

export const updateShadowTechnicianTemplate = async (
  technicianId: string,
  input: Pick<
    ShadowTechnicianTemplate,
    "inheritCompanyHours" | "weeklySchedule"
  >
): Promise<ShadowTechnicianTemplate> => {
  const response = await API.put(
    `/api/admin/calendar/technicians/${technicianId}/template`,
    input
  );
  return response.data.template;
};

export const saveShadowDayOverride = async (input: {
  scopeType: CalendarScope;
  technicianId?: string | null;
  date: string;
  mode: "closed" | "custom_hours" | "open";
  starts?: CalendarStart[];
  intervals?: CalendarInterval[];
  reason?: string;
}) => {
  const response = await API.put("/api/admin/calendar/overrides/day", input);
  return response.data.override;
};

export const restoreShadowDay = async (input: {
  scopeType: CalendarScope;
  technicianId?: string | null;
  date: string;
}) => {
  await API.delete("/api/admin/calendar/overrides/day", { params: input });
};

export const runShadowSlotAction = async (input: {
  scopeType: CalendarScope;
  technicianId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  action: "close" | "open" | "add_spot" | "remove_spot" | "restore";
}) => {
  const response = await API.post(
    "/api/admin/calendar/capacity-overrides/slot-action",
    input
  );
  return response.data;
};

export const createShadowTimeOff = async (input: {
  technicianId: string;
  type: "vacation" | "sick" | "personal" | "training" | "other";
  date?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
  reason?: string;
}) => {
  const response = await API.post("/api/admin/calendar/time-off", input);
  return response.data.timeOff;
};

export interface ShadowTimeOff {
  _id: string;
  technicianId:
    | string
    | { _id: string; name: string; email: string; employeePosition: string };
  type: "vacation" | "sick" | "personal" | "training" | "other";
  startAt: string;
  endAt: string;
  allDay: boolean;
  reason?: string;
  status: "approved" | "canceled";
}

export const getShadowTimeOff = async (
  from: string,
  to: string,
  technicianId?: string | null
): Promise<ShadowTimeOff[]> => {
  const response = await API.get("/api/admin/calendar/time-off", {
    params: { from, to, ...(technicianId ? { technicianId } : {}) },
  });
  return response.data.timeOff;
};

export const cancelShadowTimeOff = async (id: string) => {
  await API.delete(`/api/admin/calendar/time-off/${id}`);
};

export const updateShadowTimeOff = async (
  id: string,
  input: Partial<{
    technicianId: string;
    type: "vacation" | "sick" | "personal" | "training" | "other";
    startAt: string;
    endAt: string;
    allDay: boolean;
    reason: string;
  }>
) => {
  const response = await API.put(`/api/admin/calendar/time-off/${id}`, input);
  return response.data.timeOff as ShadowTimeOff;
};

export const saveShadowDayNote = async (date: string, note: string) => {
  const response = await API.put(`/api/admin/calendar/notes/${date}`, { note });
  return response.data.note;
};

export const deleteShadowDayNote = async (date: string) => {
  await API.delete(`/api/admin/calendar/notes/${date}`);
};

// Referrals
export interface Referral {
  _id: string;
  referrer: string;
  referred: string;
  status: string;
  createdAt: string;
}

// Requests / Leads
export const getAllRequests = async (): Promise<RequestLead[]> => {
  const response = await API.get("/api/admin/requests");
  return response.data;
};

export const updateRequestStatus = async (
  requestId: string,
  status: "new" | "contacted" | "won" | "lost"
): Promise<RequestLead> => {
  const response = await API.put(`/api/admin/requests/${requestId}/status`, {
    status,
  });
  return response.data.request;
};

export const deleteRequestLead = async (
  requestId: string,
  confirmation: string
): Promise<void> => {
  await API.delete(`/api/admin/requests/${encodeURIComponent(requestId)}`, {
    data: { confirmation },
  });
};

// Projects
export const getProjects = async (filters?: {
  status?: string;
  projectType?: string;
  customer?: string;
}): Promise<Project[]> => {
  const response = await API.get("/api/admin/projects", { params: filters });
  return response.data.projects;
};

export const getProject = async (projectId: string): Promise<Project> => {
  const response = await API.get(`/api/admin/projects/${projectId}`);
  return response.data.project;
};

export const getProjectDeletionSummary = async (
  projectId: string
): Promise<ProjectDeletionSummary> => {
  const response = await API.get(`/api/admin/projects/${projectId}/deletion-summary`);
  return response.data.deletionSummary;
};

export const searchProjectCustomers = async (
  params: { q: string; limit?: number; cursor?: string | null },
  signal?: AbortSignal
): Promise<ProjectCustomerSearchResponse> => {
  const response = await API.get("/api/admin/projects/customer-search", {
    params: {
      q: params.q,
      limit: params.limit,
      ...(params.cursor ? { cursor: params.cursor } : {}),
    },
    signal,
  });
  return response.data;
};

export const getProjectCustomer = async (
  customerId: string,
  addressId?: string | null
): Promise<ProjectCustomerSearchResult> => {
  const response = await API.get(`/api/admin/projects/customer/${customerId}`, {
    params: addressId ? { addressId } : undefined,
  });
  return response.data.customer;
};

export const createProject = async (data: ProjectInput): Promise<Project> => {
  const response = await API.post("/api/admin/projects", data);
  return response.data.project;
};

export const updateProject = async (
  projectId: string,
  data: Partial<ProjectInput>
): Promise<Project> => {
  const response = await API.put(`/api/admin/projects/${projectId}`, data);
  return response.data.project;
};

export const deleteProject = async (
  projectId: string,
  confirmation = ""
): Promise<ProjectDeletionResult> => {
  const response = await API.delete(`/api/admin/projects/${projectId}`, {
    data: { confirmation },
  });
  return response.data;
};

export const restoreProject = async (projectId: string): Promise<Project> => {
  const response = await API.post(`/api/admin/projects/${projectId}/restore`);
  return response.data.project;
};

// Estimates
export const getEstimates = async (filters?: {
  projectId?: string;
  status?: string;
}): Promise<Estimate[]> => {
  const response = await API.get("/api/admin/estimates", { params: filters });
  return response.data.estimates;
};

export const getProjectEstimates = async (
  projectId: string
): Promise<Estimate[]> => {
  const response = await API.get(`/api/admin/projects/${projectId}/estimates`);
  return response.data.estimates;
};

export const getEstimate = async (estimateId: string): Promise<Estimate> => {
  const response = await API.get(`/api/admin/estimates/${estimateId}`);
  return response.data.estimate;
};

export const createEstimate = async (
  data: EstimateInput
): Promise<Estimate> => {
  const response = await API.post("/api/admin/estimates", data);
  return response.data.estimate;
};

export const updateEstimate = async (
  estimateId: string,
  data: Partial<EstimateInput>
): Promise<Estimate> => {
  const response = await API.put(`/api/admin/estimates/${estimateId}`, data);
  return response.data.estimate;
};

export const deleteEstimate = async (estimateId: string): Promise<void> => {
  await API.delete(`/api/admin/estimates/${estimateId}`);
};

/**
 * The project's whole financial story in one call.
 *
 * The only place the Admin reads these numbers from. Do not recompute any of
 * them client-side, even the obvious subtractions - the backend owns which
 * invoice statuses count and which change orders are approved.
 */
export const getProjectFinancials = async (
  projectId: string
): Promise<ProjectFinancials> => {
  const response = await API.get(`/api/admin/projects/${projectId}/financials`);
  return response.data;
};

// Contracts
export const getContractMeta = async (): Promise<ContractMeta> => {
  const response = await API.get("/api/admin/contracts/meta");
  return response.data;
};

export const getProjectContracts = async (
  projectId: string
): Promise<ProjectContract[]> => {
  const response = await API.get(`/api/admin/contracts/project/${projectId}`);
  return response.data.contracts;
};

export const getContractEstimateOptions = async (
  projectId: string
): Promise<ContractEstimateOption[]> => {
  const response = await API.get(
    `/api/admin/contracts/project/${projectId}/estimate-options`
  );
  return response.data.estimates || [];
};

export const saveProjectContractDraft = async (
  projectId: string,
  data: ProjectContractInput
): Promise<ProjectContract> => {
  const response = await API.post(
    `/api/admin/contracts/project/${projectId}/draft`,
    data
  );
  return response.data.contract;
};

export const generateProjectContractPdf = async (
  projectId: string,
  contractId: string,
  fullDepositConfirmed = false,
  zeroAdjustedPriceConfirmed = false
): Promise<ProjectContract> => {
  const response = await API.post(`/api/admin/contracts/${contractId}/generate`, {
    projectId,
    fullDepositConfirmed,
    zeroAdjustedPriceConfirmed,
  }, {
    timeout: 300000,
  });
  return response.data.contract;
};

export const emailProjectContract = async (
  contractId: string,
  data: { projectId: string; recipient: string; subject: string; message: string }
): Promise<ProjectContract> => {
  const response = await API.post(`/api/admin/contracts/${contractId}/email`, data, {
    timeout: 300000,
  });
  return response.data.contract;
};

export const uploadSignedProjectContract = async (
  projectId: string,
  contractId: string,
  file: File
): Promise<ProjectContract> => {
  const formData = new FormData();
  formData.append("projectId", projectId);
  formData.append("file", file);
  const response = await API.post(`/api/admin/contracts/${contractId}/signed`, formData, {
    timeout: 300000,
  });
  return response.data.contract;
};

export const cancelProjectContract = async (
  projectId: string,
  contractId: string,
  reason = ""
): Promise<ProjectContract> => {
  const response = await API.post(`/api/admin/contracts/${contractId}/cancel`, { projectId, reason });
  return response.data.contract;
};

export const downloadProjectContractPdf = async (
  projectId: string,
  contractId: string,
  type: "generated" | "signed" = "generated"
): Promise<Blob> => {
  const response = await API.get(`/api/admin/contracts/${contractId}/download`, {
    params: { projectId, type },
    responseType: "blob",
    timeout: 300000,
  });
  return response.data as Blob;
};

// Change Orders
export const getChangeOrderMeta = async (): Promise<ChangeOrderMeta> => {
  const response = await API.get("/api/admin/change-orders/meta");
  return response.data;
};

export const getProjectChangeOrders = async (
  projectId: string
): Promise<{ changeOrders: ProjectChangeOrder[]; contractSummaries: ContractValueSummary[] }> => {
  const response = await API.get(`/api/admin/change-orders/project/${projectId}`);
  return {
    changeOrders: response.data.changeOrders || [],
    contractSummaries: response.data.contractSummaries || [],
  };
};

export const createChangeOrder = async (
  contractId: string,
  data: ChangeOrderInput
): Promise<ProjectChangeOrder> => {
  const response = await API.post(`/api/admin/change-orders/contract/${contractId}`, data);
  return response.data.changeOrder;
};

export const updateChangeOrder = async (
  changeOrderId: string,
  data: ChangeOrderInput
): Promise<ProjectChangeOrder> => {
  const response = await API.put(`/api/admin/change-orders/${changeOrderId}`, data);
  return response.data.changeOrder;
};

export const deleteChangeOrder = async (changeOrderId: string): Promise<void> => {
  await API.delete(`/api/admin/change-orders/${changeOrderId}`);
};

export const generateChangeOrderPdf = async (
  changeOrderId: string
): Promise<ProjectChangeOrder> => {
  const response = await API.post(
    `/api/admin/change-orders/${changeOrderId}/generate`,
    {},
    { timeout: 300000 }
  );
  return response.data.changeOrder;
};

export const downloadChangeOrderPdf = async (
  changeOrderId: string,
  type: "generated" | "executed" = "generated"
): Promise<Blob> => {
  const response = await API.get(`/api/admin/change-orders/${changeOrderId}/download`, {
    params: { type },
    responseType: "blob",
    timeout: 300000,
  });
  return response.data as Blob;
};

export const emailChangeOrder = async (
  changeOrderId: string,
  data: { recipient: string; subject: string; message: string }
): Promise<ProjectChangeOrder> => {
  const response = await API.post(`/api/admin/change-orders/${changeOrderId}/email`, data, {
    timeout: 300000,
  });
  return response.data.changeOrder;
};

export const uploadExecutedChangeOrder = async (
  changeOrderId: string,
  file: File
): Promise<ProjectChangeOrder> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await API.post(`/api/admin/change-orders/${changeOrderId}/executed`, formData, {
    timeout: 300000,
  });
  return response.data.changeOrder;
};

export const voidChangeOrder = async (
  changeOrderId: string,
  reason = ""
): Promise<ProjectChangeOrder> => {
  const response = await API.post(`/api/admin/change-orders/${changeOrderId}/void`, { reason });
  return response.data.changeOrder;
};

// E-signatures
export const getSignatureMeta = async (): Promise<SignatureMeta> => {
  const response = await API.get("/api/admin/signatures/meta");
  return response.data;
};

export const sendDocumentForSignature = async (data: {
  documentType: "CONTRACT" | "CHANGE_ORDER";
  documentId: string;
  message?: string;
  signers?: Array<{ role: "CUSTOMER" | "COMPANY"; name?: string; email: string; order?: number }>;
}): Promise<DocumentSignature> => {
  const response = await API.post("/api/admin/signatures/send", data, { timeout: 300000 });
  return response.data.signature;
};

export const getDocumentSignatures = async (
  documentType: "CONTRACT" | "CHANGE_ORDER",
  documentId: string
): Promise<DocumentSignature[]> => {
  const response = await API.get(`/api/admin/signatures/document/${documentType}/${documentId}`);
  return response.data.signatures || [];
};

export const getSignature = async (signatureId: string): Promise<DocumentSignature> => {
  const response = await API.get(`/api/admin/signatures/${signatureId}`);
  return response.data.signature;
};

export const downloadSignaturePdf = async (
  signatureId: string,
  type: "executed" | "original" | "audit" = "executed"
): Promise<Blob> => {
  const response = await API.get(`/api/admin/signatures/${signatureId}/download`, {
    params: { type },
    responseType: "blob",
    timeout: 300000,
  });
  return response.data as Blob;
};

export const refreshSignatureStatus = async (
  signatureId: string
): Promise<DocumentSignature> => {
  const response = await API.post(
    `/api/admin/signatures/${signatureId}/refresh`,
    {},
    { timeout: 120000 }
  );
  return response.data.signature;
};

export const retrySignatureRetrieval = async (
  signatureId: string
): Promise<DocumentSignature> => {
  const response = await API.post(
    `/api/admin/signatures/${signatureId}/retry-retrieval`,
    {},
    { timeout: 300000 }
  );
  return response.data.signature;
};

export const cancelSignatureRequest = async (
  signatureId: string,
  reason = ""
): Promise<DocumentSignature> => {
  const response = await API.post(`/api/admin/signatures/${signatureId}/cancel`, { reason });
  return response.data.signature;
};

// Native e-signature
export const sendForNativeSignature = async (data: {
  documentType: "CONTRACT" | "CHANGE_ORDER";
  documentId: string;
  mode: "REMOTE" | "IN_PERSON";
  message?: string;
}): Promise<NativeSignatureRequest> => {
  const response = await API.post("/api/admin/signatures/native/send", data, { timeout: 300000 });
  return response.data;
};

export const resendNativeSignature = async (
  signatureId: string
): Promise<NativeSignatureRequest> => {
  const response = await API.post(
    `/api/admin/signatures/native/${signatureId}/resend`,
    {},
    { timeout: 120000 }
  );
  return response.data;
};

export const revokeNativeSignature = async (
  signatureId: string,
  reason = ""
): Promise<{ signature: DocumentSignature }> => {
  const response = await API.post(`/api/admin/signatures/native/${signatureId}/revoke`, { reason });
  return response.data;
};

/** frozen = the exact document signed; executed = completed; certificate = evidence. */
export const downloadNativeDocument = async (
  signatureId: string,
  kind: "frozen" | "executed" | "certificate" = "executed"
): Promise<Blob> => {
  const response = await API.get(`/api/admin/signatures/native/${signatureId}/document`, {
    params: { kind },
    responseType: "blob",
    timeout: 300000,
  });
  return response.data as Blob;
};

export const uploadManuallySignedDocument = async (
  documentType: "CONTRACT" | "CHANGE_ORDER",
  documentId: string,
  file: File
): Promise<{ signature: DocumentSignature }> => {
  const formData = new FormData();
  formData.append("documentType", documentType);
  formData.append("documentId", documentId);
  formData.append("file", file);
  const response = await API.post("/api/admin/signatures/native/manual-upload", formData, {
    timeout: 300000,
  });
  return response.data;
};

// Invoices
export const getProjectInvoices = async (
  projectId: string
): Promise<ProjectInvoice[]> => {
  const response = await API.get(`/api/admin/invoices/project/${projectId}`);
  return response.data.invoices;
};

export const saveProjectInvoiceDraft = async (
  projectId: string,
  data: ProjectInvoiceInput
): Promise<ProjectInvoice> => {
  const response = await API.post(`/api/admin/invoices/project/${projectId}/draft`, data);
  return response.data.invoice;
};

export const createProjectInvoiceFromContract = async (
  projectId: string,
  contractId?: string,
  billing?: InvoiceBillingIntent
): Promise<{ invoice: ProjectInvoice; financialWarnings: InvoiceFinancialWarning[] }> => {
  const response = await API.post(`/api/admin/invoices/project/${projectId}/draft`, {
    createFromContract: true,
    source: "contract",
    ...(contractId ? { contractId } : {}),
    ...(billing ? { billing } : {}),
  });
  return {
    invoice: response.data.invoice,
    financialWarnings: response.data.financialWarnings || [],
  };
};

export const generateProjectInvoicePdf = async (
  projectId: string,
  invoiceId: string
): Promise<ProjectInvoice> => {
  const response = await API.post(`/api/admin/invoices/${invoiceId}/generate`, { projectId }, {
    timeout: 300000,
  });
  return response.data.invoice;
};

export const downloadProjectInvoicePdf = async (
  projectId: string,
  invoiceId: string,
  version?: number
): Promise<Blob> => {
  const response = await API.get(`/api/admin/invoices/${invoiceId}/download`, {
    params: { projectId, ...(version ? { version } : {}) },
    responseType: "blob",
    timeout: 300000,
  });
  return response.data as Blob;
};

export const emailProjectInvoice = async (
  invoiceId: string,
  data: { projectId: string; recipient: string; subject: string; message: string }
): Promise<ProjectInvoice> => {
  const response = await API.post(`/api/admin/invoices/${invoiceId}/email`, data, {
    timeout: 300000,
  });
  return response.data.invoice;
};

export const addProjectInvoicePayment = async (
  projectId: string,
  invoiceId: string,
  data: {
    amountCents: number;
    paymentDate: string;
    method: InvoicePaymentMethod;
    reference?: string;
    note?: string;
  }
): Promise<ProjectInvoice> => {
  const response = await API.post(`/api/admin/invoices/${invoiceId}/payments`, {
    ...data,
    projectId,
  });
  return response.data.invoice;
};

export const updateProjectInvoicePayment = async (
  projectId: string,
  invoiceId: string,
  paymentId: string,
  data: Partial<{
    amountCents: number;
    paymentDate: string;
    method: InvoicePaymentMethod;
    reference: string;
    note: string;
  }>
): Promise<ProjectInvoice> => {
  const response = await API.patch(`/api/admin/invoices/${invoiceId}/payments/${paymentId}`, {
    ...data,
    projectId,
  });
  return response.data.invoice;
};

export const deleteProjectInvoicePayment = async (
  projectId: string,
  invoiceId: string,
  paymentId: string
): Promise<ProjectInvoice> => {
  const response = await API.delete(`/api/admin/invoices/${invoiceId}/payments/${paymentId}`, {
    data: { projectId },
  });
  return response.data.invoice;
};

export const voidProjectInvoice = async (
  projectId: string,
  invoiceId: string,
  data: { confirmation: "VOID"; reason?: string }
): Promise<ProjectInvoice> => {
  const response = await API.post(`/api/admin/invoices/${invoiceId}/void`, {
    ...data,
    projectId,
  });
  return response.data.invoice;
};

// GHL AI Commander
export const generateGhlAiCommanderPlan = async (
  message: string
): Promise<GhlAiCommanderPlanResponse> => {
  const response = await API.post("/api/admin/ai-commander/ghl/plan", {
    message,
  });
  return response.data;
};

export const executeGhlAiCommanderPlan = async (
  confirmationId: string
): Promise<GhlAiCommanderExecuteResponse> => {
  const response = await API.post("/api/admin/ai-commander/ghl/execute", {
    confirmationId,
  }, {
    timeout: 300000,
  });
  return response.data;
};

export const getGhlWorkflowJobStatus = async (
  jobId: string
): Promise<GhlAiCommanderExecuteResponse> => {
  const response = await API.get(
    `/api/admin/ai-commander/ghl/workflows/${encodeURIComponent(jobId)}`,
    {
      timeout: 300000,
    }
  );
  return response.data;
};

export const simulateRoofingSalesAgentTraining = async (
  data: RoofingSalesAgentTrainingRequest
): Promise<RoofingSalesAgentTrainingResponse> => {
  const response = await API.post("/api/admin/jarvis/roofing-agent/simulate", data);
  return response.data;
};

export const askJarvis = async (
  message: string,
  context?: {
    conversationId?: string;
    uploadBatchId?: string;
    files?: JarvisUploadedFile[];
    conversationHistory?: JarvisSavedConversationMessage[];
  }
): Promise<JarvisAskResponse> => {
  const response = await API.post("/api/admin/jarvis/ask", {
    message,
    conversationId: context?.conversationId,
    uploadBatchId: context?.uploadBatchId,
    files: context?.files || [],
    conversationHistory: context?.conversationHistory || [],
  });
  return response.data;
};

export const uploadJarvisFilesForAnalysis = async ({
  prompt,
  conversationId,
  files,
  onUploadProgress,
}: {
  prompt: string;
  conversationId?: string;
  files: File[];
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
}): Promise<JarvisUploadBatchResponse> => {
  const formData = new FormData();
  formData.append("prompt", prompt);
  if (conversationId) formData.append("conversationId", conversationId);
  files.forEach((file) => formData.append("files", file));

  const response = await API.post("/api/admin/jarvis/uploads", formData, {
    timeout: 300000,
    onUploadProgress,
  });
  return response.data;
};

export const listJarvisConversations = async (
  search = ""
): Promise<JarvisConversationListResponse> => {
  const response = await API.get("/api/admin/jarvis/conversations", {
    params: search.trim() ? { search: search.trim() } : undefined,
  });
  return response.data;
};

export const getJarvisConversation = async (
  conversationId: string
): Promise<JarvisSavedConversation> => {
  const response = await API.get(
    `/api/admin/jarvis/conversations/${encodeURIComponent(conversationId)}`
  );
  return response.data.conversation;
};

export const saveJarvisConversation = async (
  conversation: JarvisSavedConversation
): Promise<JarvisSavedConversation> => {
  const response = await API.put(
    `/api/admin/jarvis/conversations/${encodeURIComponent(conversation.conversationId || conversation.id)}`,
    conversation
  );
  return response.data.conversation;
};

export const listJarvisCampaigns = async (): Promise<JarvisCampaignListResponse> => {
  const response = await API.get("/api/admin/jarvis/campaigns");
  return response.data;
};

export const getJarvisCampaign = async (
  campaignId: string
): Promise<JarvisCampaignDetailResponse> => {
  const response = await API.get(`/api/admin/jarvis/campaigns/${encodeURIComponent(campaignId)}`);
  return response.data;
};

export const startJarvisCampaign = async (
  campaignId: string,
  data: { confirmation: string; dryRun?: boolean }
): Promise<JarvisCampaignMutationResponse> => {
  const response = await API.post(
    `/api/admin/jarvis/campaigns/${encodeURIComponent(campaignId)}/start`,
    data,
    { timeout: 300000 }
  );
  return response.data;
};

export const pauseJarvisCampaign = async (
  campaignId: string
): Promise<JarvisCampaignMutationResponse> => {
  const response = await API.post(
    `/api/admin/jarvis/campaigns/${encodeURIComponent(campaignId)}/pause`
  );
  return response.data;
};

export const resumeJarvisCampaign = async (
  campaignId: string
): Promise<JarvisCampaignMutationResponse> => {
  const response = await API.post(
    `/api/admin/jarvis/campaigns/${encodeURIComponent(campaignId)}/resume`
  );
  return response.data;
};

export const getJarvisGhlControlHealth = async (): Promise<JarvisGhlControlReport> => {
  const response = await API.get("/api/admin/jarvis/ghl-control/health", {
    timeout: 300000,
  });
  return response.data.report;
};

export const getReferrals = async (): Promise<Referral[]> => {
  const response = await API.get('/api/admin/referrals');
  return response.data;
};
