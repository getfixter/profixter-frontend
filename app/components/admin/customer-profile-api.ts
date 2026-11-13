import API from '@/lib/api';
import type { User } from '@/lib/admin-service';

/*
 * Admin: correct a customer's details. The server decides who may change
 * what (phone and email are owner-only) and refuses anything else; this file
 * only carries the requests. See BackEnd routes/adminCustomerProfile.js.
 */

export interface CustomerProfileAddress {
  _id: string;
  label: string;
  line1: string;
  /* Apartment / unit on its own (BE-CUST); line1 still carries it. "" on older addresses. */
  unit?: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  placeId: string;
  isDefault: boolean;
  introVisitStatus: string | null;
  /* Bookings, a plan, a gift, loyalty or a free visit on record: can be corrected, not removed. */
  hasHistory: boolean;
  hasActivePlan: boolean;
}

export interface CustomerProfile {
  _id: string;
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  emailIsAppleRelay: boolean;
  hasGoogle: boolean;
  hasApple: boolean;
  hasPassword: boolean;
  signInMethods: string[];
  stripeCustomer: boolean;
  updatedAt: string | null;
  defaultAddressId: string | null;
  addresses: CustomerProfileAddress[];
}

export interface CustomerProfileResponse {
  profile: CustomerProfile;
  access: { canEditContact: boolean; canEditDetails: boolean };
}

export interface ProfileAddressInput {
  _id?: string;
  label?: string;
  line1: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  placeId?: string;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
}

export interface ProfilePatch {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  addresses?: ProfileAddressInput[];
  acknowledgeWarnings?: boolean;
  expectedUpdatedAt?: string | null;
}

export interface ProfileChange {
  field: string;
  label: string;
  from: string;
  to: string;
  sensitive?: boolean;
}

export interface ProfileSaveResult {
  message: string;
  changes: ProfileChange[];
  notices: string[];
  user: User;
}

export interface ProfileWarning {
  code: string;
  message: string;
}

/* What a refused save says, in a shape the form can show next to each field. */
export interface ProfileSaveError {
  status: number;
  code: string;
  message: string;
  errors: Record<string, string>;
  warnings: ProfileWarning[];
}

export interface ProfileHistoryItem {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  changes: ProfileChange[];
  verificationCleared: { phone: boolean; email: boolean };
  smsConsentReset: boolean;
  reason: string;
}

export const getCustomerProfile = async (userId: string): Promise<CustomerProfileResponse> => {
  const response = await API.get(`/api/admin/users/${userId}/profile`);
  return response.data;
};

export const saveCustomerProfile = async (userId: string, patch: ProfilePatch): Promise<ProfileSaveResult> => {
  try {
    const response = await API.patch(`/api/admin/users/${userId}/profile`, patch);
    return response.data;
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: Record<string, unknown> } }).response;
    const data = response?.data || {};
    const failure: ProfileSaveError = {
      status: response?.status || 0,
      code: String(data.code || ''),
      message: String(data.message || 'Could not save. Check your connection and try again.'),
      errors: (data.errors as Record<string, string>) || {},
      warnings: (data.warnings as ProfileWarning[]) || [],
    };
    throw failure;
  }
};

export const getCustomerProfileHistory = async (
  userId: string
): Promise<{ items: ProfileHistoryItem[]; masked: boolean }> => {
  const response = await API.get(`/api/admin/users/${userId}/profile-history`);
  return response.data;
};

/*
 * Customer details → "Reviewed us": the owner's own mark that this customer
 * left a Google review, which stops the post-visit review email for them
 * (BackEnd jobs/bookingReviewRequests.js). Only the owner may change it; the
 * server says so in canEdit.
 */
export interface ReviewedUsState {
  reviewedUs: { at: string; byName: string } | null;
  lastAskedAt: string | null;
  canEdit: boolean;
}

export const getReviewedUs = async (userId: string): Promise<ReviewedUsState> => {
  const response = await API.get(`/api/admin/users/${userId}/reviewed-us`);
  return response.data;
};

export const setReviewedUs = async (userId: string, reviewed: boolean): Promise<ReviewedUsState> => {
  const response = await API.put(`/api/admin/users/${userId}/reviewed-us`, { reviewed });
  return response.data;
};

/* Review requests at a glance: sent, held back (and why), and opens of the Google link - never "reviews posted". */
export interface ReviewSummary {
  days: number;
  sent: number;
  skipped: Record<string, number>;
  linkOpens: Record<string, number>;
  reviewedCustomers: number;
}

export const getReviewSummary = async (days = 30): Promise<ReviewSummary> => {
  const response = await API.get(`/api/admin/review-requests/summary?days=${days}`);
  return response.data;
};
