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
}

export interface CampaignResponse {
  campaignId: string;
  segment: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
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
  providerMessageId: string;
}

export interface RequestLead {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  serviceType?: string;
  sourcePage?: string;
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

export const updateUser = async (
  userId: string,
  data: { name?: string; phone?: string; subscription?: string }
): Promise<User> => {
  const response = await API.put(`/api/admin/users/${userId}`, data);
  return response.data.user;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await API.delete(`/api/admin/users/${userId}`);
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
export type CalendarWeeklyDay = {
  weekday: number;
  enabled: boolean;
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

export const deleteProject = async (projectId: string): Promise<void> => {
  await API.delete(`/api/admin/projects/${projectId}`);
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

export const getReferrals = async (): Promise<Referral[]> => {
  const response = await API.get('/api/admin/referrals');
  return response.data;
};
