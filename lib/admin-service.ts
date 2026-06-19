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
  useTemplate: boolean;
  ctaText?: string;
  ctaUrl?: string;
  testOnly: boolean;
}

export interface CampaignResponse {
  segment: string;
  total: number;
  sent: number;
  errors: Array<{ email: string; error: string }>;
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
export const getAllBookings = async (): Promise<Booking[]> => {
  const response = await API.get('/api/admin/bookings');
  return response.data;
};

export const updateBookingStatus = async (
  bookingId: string,
  status: string
): Promise<Booking> => {
  const response = await API.put(`/api/admin/bookings/${bookingId}/status`, {
    status,
  });
  return response.data.booking;
};


export const updateBookingAdmin = async (
  bookingId: string,
  patch: { note?: string; date?: string }
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
  const response = await API.post('/api/admin/campaigns/send', data);
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
