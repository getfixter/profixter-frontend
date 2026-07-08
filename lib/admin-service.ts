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
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  images?: Array<{ key: string; url: string }>;
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

export interface Project {
  _id: string;
  projectNumber: string;
  status: ProjectStatus;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  projectType: ProjectType;
  estimateAmount: number;
  depositAmount: number;
  balanceDue: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<
  Project,
  "_id" | "projectNumber" | "createdAt" | "updatedAt"
>;

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
  patch: { note?: string; date?: string; assignedFixterId?: string | null }
): Promise<Booking> => {
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
  confirmation: string
): Promise<void> => {
  await API.delete(`/api/admin/projects/${projectId}`, {
    data: { confirmation },
  });
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

export const getReferrals = async (): Promise<Referral[]> => {
  const response = await API.get('/api/admin/referrals');
  return response.data;
};
