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
  addressesDetailed: AddressDetailed[];
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
  plan?: string;
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

export const getReferrals = async (): Promise<Referral[]> => {
  const response = await API.get('/api/admin/referrals');
  return response.data;
};
